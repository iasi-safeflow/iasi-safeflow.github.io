from datetime import datetime, timedelta, timezone

import pytest

from conftest import auth_header, valid_report


def test_valid_report_is_stored_as_submitted(client, reporter_token):
    r = client.post("/reports", json=valid_report(), headers=auth_header(reporter_token))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "submitted"
    assert body["public_id"].startswith("SF-") and len(body["public_id"]) == 11
    assert body["verification"] == "unverified"
    assert body["is_simulated"] is False

    mine = client.get("/reports/mine", headers=auth_header(reporter_token)).json()
    assert [m["public_id"] for m in mine] == [body["public_id"]]


def test_gps_location_with_accuracy(client, reporter_token):
    r = client.post(
        "/reports", json=valid_report(location_source="gps", gps_accuracy_m=12.5), headers=auth_header(reporter_token)
    )
    assert r.status_code == 201


def test_submission_requires_login(client):
    assert client.post("/reports", json=valid_report()).status_code == 401


@pytest.mark.parametrize(
    "overrides",
    [
        {"category": "necunoscuta"},
        {"description": "scurt"},
        {"description": "          spații          "},
        {"description": "x" * 1001},
        {"lat": 44.43, "lon": 26.10},  # Bucharest, outside Iași
        {"lat": "nu-e-numar"},
        {"location_source": "wifi"},
        {"observed_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
        {"observed_at": (datetime.now(timezone.utc) - timedelta(days=400)).isoformat()},
        {"observed_at": "2026-01-01T10:00:00"},  # no timezone
        {"gps_accuracy_m": -1},
        {"unexpected_field": "x"},
    ],
)
def test_invalid_reports_rejected(client, reporter_token, overrides):
    r = client.post("/reports", json=valid_report(**overrides), headers=auth_header(reporter_token))
    assert r.status_code == 422, r.text
    assert r.json()["detail"]["code"] == "validation_error"
    assert client.get("/reports/mine", headers=auth_header(reporter_token)).json() == []


def test_immediate_danger_answer_is_required(client, reporter_token):
    body = valid_report()
    del body["immediate_danger"]
    r = client.post("/reports", json=body, headers=auth_header(reporter_token))
    assert r.status_code == 422


def test_validation_messages_are_romanian(client, reporter_token):
    r = client.post("/reports", json=valid_report(lat=44.43, lon=26.10), headers=auth_header(reporter_token))
    messages = " ".join(f["message"] for f in r.json()["detail"]["fields"])
    assert "zona Iașiului" in messages


def test_rate_limit(client, reporter_token, settings):
    for _ in range(settings.report_rate_limit_per_hour):
        assert client.post("/reports", json=valid_report(), headers=auth_header(reporter_token)).status_code == 201
    r = client.post("/reports", json=valid_report(), headers=auth_header(reporter_token))
    assert r.status_code == 429


def test_past_incident_category_is_accepted_as_unverified(client, reporter_token):
    r = client.post(
        "/reports",
        json=valid_report(category="incident_trecut", description="Săptămâna trecută două mașini s-au atins ușor aici."),
        headers=auth_header(reporter_token),
    )
    assert r.status_code == 201
    assert r.json()["verification"] == "unverified"
