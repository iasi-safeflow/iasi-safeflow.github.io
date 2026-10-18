"""Startup seed: labelled simulated data, only when the database has no reports."""

from dataclasses import replace

from fastapi.testclient import TestClient

from app.assistant.runner import run_out
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
    assert {p["public_id"] for p in public} == {d[0] for d in DEMO_REPORTS} - {"SF-TESTDEMB", "SF-TESTDEMD"}  # held
    assert all(p["is_simulated"] and p["source_type"] == "simulated" for p in public)


def test_seed_demo_shows_each_assistant_case(settings):
    create_app(replace(settings, seed_demo_data=True))
    conn = connect(settings.database_path)
    try:
        runs = {
            r["public_id"]: run_out(r)
            for r in conn.execute(
                """SELECT ar.*, rp.public_id FROM assistant_runs ar JOIN reports rp ON rp.id = ar.report_id
                   WHERE ar.id IN (SELECT MAX(id) FROM assistant_runs GROUP BY report_id)"""
            ).fetchall()
        }
    finally:
        conn.close()
    assert len(runs) == len(DEMO_REPORTS)
    assert [d["public_id"] for d in runs["SF-TESTDEMA"]["duplicates"]] == ["SF-TESTDEM2"]
    assert runs["SF-TESTDEMA"]["duplicates"][0]["level"] == "probable"
    assert [f["code"] for f in runs["SF-TESTDEMB"]["flags"]] == ["personal_data"]
    assert runs["SF-TESTDEMC"]["importance"]["level"] == "high"
    assert [f["code"] for f in runs["SF-TESTDEMD"]["flags"]] == ["vague"]
    flagged = {pid for pid, run in runs.items() if run["flags"]}
    assert flagged == {"SF-TESTDEMB", "SF-TESTDEMD"}


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

