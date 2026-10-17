from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

REVIEWER_EMAIL = "reviewer@example.com"
REVIEWER_PASSWORD = "test-reviewer-pass"  # test-only value, not a real credential


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        database_path=str(tmp_path / "test.db"),
        secret_key="test-secret-key",
        demo_reviewer_email=REVIEWER_EMAIL,
        demo_reviewer_password=REVIEWER_PASSWORD,
        report_rate_limit_per_hour=5,
    )


@pytest.fixture
def client(settings) -> TestClient:
    return TestClient(create_app(settings))


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def reporter_token(client) -> str:
    r = client.post("/auth/register", json={"email": "ana@example.com", "password": "parola-sigura"})
    assert r.status_code == 201
    return r.json()["token"]


@pytest.fixture
def reviewer_token(client) -> str:
    r = client.post("/auth/login", json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD})
    assert r.status_code == 200
    return r.json()["token"]


def valid_report(**overrides) -> dict:
    body = {
        "category": "defect_carosabil",
        "description": "Groapă mare pe banda din dreapta, lângă stația de tramvai.",
        "lat": 47.16234,
        "lon": 27.58871,
        "location_source": "pin",
        "observed_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
        "immediate_danger": False,
    }
    body.update(overrides)
    return body


@pytest.fixture
def submitted_report(client, reporter_token) -> dict:
    r = client.post("/reports", json=valid_report(), headers=auth_header(reporter_token))
    assert r.status_code == 201, r.text
    return r.json()
