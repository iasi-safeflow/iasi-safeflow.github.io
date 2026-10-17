import pytest

from conftest import auth_header, valid_report

REVIEW_GETS = ["/review/reports", "/review/audit"]


@pytest.mark.parametrize("path", REVIEW_GETS)
def test_review_endpoints_require_login(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("path", REVIEW_GETS)
def test_review_endpoints_forbid_reporters(client, reporter_token, path):
    r = client.get(path, headers=auth_header(reporter_token))
    assert r.status_code == 403


def test_reporter_cannot_change_status_or_read_detail(client, reporter_token, submitted_report):
    pid = submitted_report["public_id"]
    h = auth_header(reporter_token)
    assert client.get(f"/review/reports/{pid}", headers=h).status_code == 403
    assert client.get(f"/review/reports/{pid}/audit", headers=h).status_code == 403
    r = client.post(f"/review/reports/{pid}/status", json={"status": "under_review"}, headers=h)
    assert r.status_code == 403
    assert client.get(f"/public/reports/{pid}").json()["status"] == "submitted"


def test_reviewer_sees_queue_with_pseudonymous_reporter(client, reviewer_token, submitted_report):
    queue = client.get("/review/reports", headers=auth_header(reviewer_token)).json()
    assert len(queue) == 1
    item = queue[0]
    assert item["description"] == submitted_report["description"]
    assert item["reporter_ref"].startswith("R-")
    assert "email" not in str(item).lower() and "ana@example.com" not in str(item)


def test_queue_filters(client, reporter_token, reviewer_token):
    h = auth_header(reporter_token)
    client.post("/reports", json=valid_report(), headers=h)
    client.post("/reports", json=valid_report(category="iluminat_slab", description="Stâlpii de iluminat nu merg."), headers=h)
    rh = auth_header(reviewer_token)
    assert len(client.get("/review/reports?category=iluminat_slab", headers=rh).json()) == 1
    assert len(client.get("/review/reports?status=submitted", headers=rh).json()) == 2
    assert client.get("/review/reports?sort=random", headers=rh).status_code == 422


def test_reviewer_status_change_and_invalid_transition(client, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    h = auth_header(reviewer_token)
    r = client.post(f"/review/reports/{pid}/status", json={"status": "resolved"}, headers=h)
    assert r.status_code == 409  # submitted -> resolved is not allowed
    assert set(r.json()["detail"]["allowed"]) == {"under_review", "rejected"}

    r = client.post(f"/review/reports/{pid}/status", json={"status": "under_review"}, headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "under_review"
    assert client.get(f"/public/reports/{pid}").json()["status"] == "under_review"

    assert client.post(f"/review/reports/{pid}/status", json={"status": "bogus"}, headers=h).status_code == 422
    assert client.post("/review/reports/SF-NOPE0000/status", json={"status": "under_review"}, headers=h).status_code == 404


def test_reporters_only_see_their_own_reports(client, submitted_report):
    other = client.post("/auth/register", json={"email": "alt@example.com", "password": "parola-sigura"}).json()["token"]
    assert client.get("/reports/mine", headers=auth_header(other)).json() == []
