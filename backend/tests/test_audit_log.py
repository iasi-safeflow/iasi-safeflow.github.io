import sqlite3

import pytest

from conftest import REVIEWER_EMAIL, auth_header


def _move(client, token, pid, status, notes=""):
    r = client.post(f"/review/reports/{pid}/status", json={"status": status, "notes": notes}, headers=auth_header(token))
    assert r.status_code == 200, r.text


def test_each_status_change_is_audited_in_order(client, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    _move(client, reviewer_token, pid, "under_review", "Verific la fața locului.")
    _move(client, reviewer_token, pid, "resolved")

    log = client.get(f"/review/reports/{pid}/audit", headers=auth_header(reviewer_token)).json()
    assert [(e["from_status"], e["to_status"]) for e in log] == [("submitted", "under_review"), ("under_review", "resolved")]
    assert all(e["reviewer_email"] == REVIEWER_EMAIL and e["action"] == "status_change" for e in log)
    assert log[0]["notes"] == "Verific la fața locului."
    assert log[1]["notes"] is None

    global_log = client.get("/review/audit", headers=auth_header(reviewer_token)).json()
    assert [e["to_status"] for e in global_log] == ["resolved", "under_review"]  # newest first


def test_rejected_transition_writes_no_audit_entry(client, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    client.post(f"/review/reports/{pid}/status", json={"status": "resolved"}, headers=auth_header(reviewer_token))
    assert client.get(f"/review/reports/{pid}/audit", headers=auth_header(reviewer_token)).json() == []


def test_forbidden_attempt_writes_no_audit_entry(client, reporter_token, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    client.post(f"/review/reports/{pid}/status", json={"status": "under_review"}, headers=auth_header(reporter_token))
    assert client.get(f"/review/reports/{pid}/audit", headers=auth_header(reviewer_token)).json() == []


def test_audit_log_is_append_only_in_database(client, reviewer_token, submitted_report, settings):
    _move(client, reviewer_token, submitted_report["public_id"], "under_review")
    conn = sqlite3.connect(settings.database_path)
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        conn.execute("UPDATE review_actions SET to_status = 'resolved'")
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        conn.execute("DELETE FROM review_actions")


def test_notes_length_limited(client, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    r = client.post(
        f"/review/reports/{pid}/status", json={"status": "under_review", "notes": "x" * 501}, headers=auth_header(reviewer_token)
    )
    assert r.status_code == 422
