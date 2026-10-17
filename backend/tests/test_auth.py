import sqlite3

from conftest import REVIEWER_EMAIL, auth_header


def test_register_creates_reporter_and_hashes_password(client, settings):
    r = client.post("/auth/register", json={"email": "Ion@Example.com", "password": "parola-sigura"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["role"] == "reporter"
    assert body["user"]["email"] == "ion@example.com"

    row = sqlite3.connect(settings.database_path).execute(
        "SELECT password_hash FROM users WHERE email = 'ion@example.com'"
    ).fetchone()
    assert row[0] != "parola-sigura" and row[0].startswith("$2")


def test_register_ignores_role_field(client):
    r = client.post("/auth/register", json={"email": "x@example.com", "password": "parola-sigura", "role": "reviewer"})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "reporter"


def test_register_duplicate_email_rejected(client):
    creds = {"email": "dup@example.com", "password": "parola-sigura"}
    assert client.post("/auth/register", json=creds).status_code == 201
    r = client.post("/auth/register", json={**creds, "email": "DUP@example.com"})
    assert r.status_code == 409


def test_register_validation(client):
    assert client.post("/auth/register", json={"email": "not-an-email", "password": "parola-sigura"}).status_code == 422
    assert client.post("/auth/register", json={"email": "a@example.com", "password": "scurt"}).status_code == 422
    assert client.post("/auth/register", json={"email": "a@example.com", "password": "ă" * 40}).status_code == 422


def test_login_and_me(client, reporter_token):
    r = client.post("/auth/login", json={"email": "ana@example.com", "password": "parola-sigura"})
    assert r.status_code == 200
    me = client.get("/auth/me", headers=auth_header(r.json()["token"]))
    assert me.json()["email"] == "ana@example.com"


def test_login_wrong_password(client, reporter_token):
    r = client.post("/auth/login", json={"email": "ana@example.com", "password": "gresita-123"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_credentials"


def test_login_lockout_after_repeated_failures(client, reporter_token, settings):
    for _ in range(settings.login_max_failures):
        client.post("/auth/login", json={"email": "ana@example.com", "password": "gresita-123"})
    r = client.post("/auth/login", json={"email": "ana@example.com", "password": "parola-sigura"})
    assert r.status_code == 429


def test_demo_reviewer_seeded_from_settings(client, reviewer_token):
    me = client.get("/auth/me", headers=auth_header(reviewer_token)).json()
    assert me == {"id": me["id"], "email": REVIEWER_EMAIL, "role": "reviewer"}


def test_tampered_or_missing_token_is_unauthenticated(client, reporter_token):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=auth_header(reporter_token + "x")).status_code == 401


def test_token_signed_with_other_secret_rejected(client):
    from app.security import issue_token

    forged = issue_token("another-secret", 1)
    assert client.get("/auth/me", headers=auth_header(forged)).status_code == 401
