"""Startup seed: labelled simulated data, only when the database has no reports."""

from dataclasses import replace

from fastapi.testclient import TestClient

from app.db import connect
from app.main import create_app
from app.seed import DEMO_REPORTS, SIMULATED_PREFIX, seed_demo_reports
from tests.conftest import auth_header, valid_report


def _reports(settings):
    conn = connect(settings.database_path)
    try:
        return conn.execute("SELECT * FROM reports").fetchall()
    finally:
        conn.close()


def test_seed_fills_empty_database_with_labelled_simulated_reports(settings):
    client = TestClient(create_app(replace(settings, seed_demo_data=True)))
    rows = _reports(settings)
    assert len(rows) == len(DEMO_REPORTS)
    for r in rows:
        assert r["is_simulated"] == 1
        assert r["source_type"] == "simulated"
        assert r["description"].startswith(SIMULATED_PREFIX)
        assert r["status"] in ("submitted", "under_review")  # never implies referral/authority action
    public = client.get("/public/reports").json()
    assert len(public) == len(DEMO_REPORTS)
    assert all(p["is_simulated"] and p["source_type"] == "simulated" for p in public)


def test_seed_skips_database_that_already_has_reports(settings, client, reporter_token):
    assert client.post("/reports", json=valid_report(), headers=auth_header(reporter_token)).status_code == 201
    create_app(replace(settings, seed_demo_data=True))  # restart with seeding on
    rows = _reports(settings)
    assert len(rows) == 1
    assert rows[0]["is_simulated"] == 0


def test_seed_is_idempotent_across_restarts(settings):
    create_app(replace(settings, seed_demo_data=True))
    create_app(replace(settings, seed_demo_data=True))
    assert len(_reports(settings)) == len(DEMO_REPORTS)
    conn = connect(settings.database_path)
    try:
        assert seed_demo_reports(conn) == 0
    finally:
        conn.close()


def test_seed_disabled_by_default_in_settings(settings, client):
    assert _reports(settings) == []

