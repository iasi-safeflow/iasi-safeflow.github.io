"""Review assistant through the API: stored results, re-checks, duplicate decisions and what stays private."""

import sqlite3
from datetime import datetime, timedelta, timezone

import pytest

from conftest import auth_header, valid_report

POTHOLE = "Groapă mare pe banda din dreapta, lângă stația de tramvai."
POTHOLE_TYPO = "groapa mare pe banda dreapta langa statia de tramvi"


def _submit(client, token, **overrides):
    r = client.post("/reports", json=valid_report(**overrides), headers=auth_header(token))
    assert r.status_code == 201, r.text
    return r.json()["public_id"]


def _analysis(client, token, pid):
    r = client.get(f"/review/reports/{pid}/assistant", headers=auth_header(token))
    assert r.status_code == 200, r.text
    return r.json()


def _decide(client, token, pid, other, action, notes=""):
    return client.post(
        f"/review/reports/{pid}/duplicates/{other}", json={"action": action, "notes": notes}, headers=auth_header(token)
    )


def _factor(analysis, code):
    return next(f for f in analysis["latest"]["importance"]["factors"] if f["code"] == code)


@pytest.fixture
def pair(client, reporter_token):
    """An older report and a newer, near-identical one 20 m away."""
    old = _submit(client, reporter_token, description=POTHOLE)
    new = _submit(client, reporter_token, description=POTHOLE_TYPO, lat=47.16252)
    return old, new


def test_each_new_report_gets_a_stored_versioned_check(client, reviewer_token, submitted_report):
    a = _analysis(client, reviewer_token, submitted_report["public_id"])
    assert a["checks"] == 1
    latest = a["latest"]
    assert latest["assistant_version"] == "asistent-reguli-v1" and latest["triggered_by"] == "created"
    assert latest["created_at"] and latest["flags"] == [] and latest["duplicates"] == []
    assert latest["importance"]["level"] in {"high", "medium", "low"}


def test_duplicate_found_and_nearby_report_rechecked_without_overwriting(client, settings, reviewer_token, pair):
    old, new = pair
    found = _analysis(client, reviewer_token, new)["latest"]["duplicates"]
    assert [d["public_id"] for d in found] == [old]
    assert found[0]["level"] == "probable" and found[0]["distance_m"] == 20
    assert found[0]["report"]["description"] == POTHOLE and found[0]["decision"] is None

    a_old = _analysis(client, reviewer_token, old)
    assert a_old["checks"] == 2  # created + re-check when the new report arrived
    assert a_old["latest"]["triggered_by"] == "nearby_report"
    assert [d["public_id"] for d in a_old["latest"]["duplicates"]] == [new]
    assert _factor(a_old, "corroboration")["detail"] == 1

    conn = sqlite3.connect(settings.database_path)
    first = conn.execute("SELECT duplicates_json FROM assistant_runs ORDER BY id LIMIT 1").fetchone()[0]
    assert first == "[]"  # the first check of the old report is kept as it was


def test_recheck_never_changes_status_or_visibility(client, reviewer_token, pair):
    old, _ = pair
    detail = client.get(f"/review/reports/{old}", headers=auth_header(reviewer_token)).json()
    assert detail["status"] == "submitted" and detail["public_visibility"] == "public"


def test_time_window_cut_off(client, reporter_token, reviewer_token):
    now = datetime.now(timezone.utc)
    _submit(client, reporter_token, description=POTHOLE, observed_at=(now - timedelta(days=35)).isoformat())
    recent = _submit(client, reporter_token, description=POTHOLE, observed_at=(now - timedelta(days=25)).isoformat())
    new = _submit(client, reporter_token, description=POTHOLE_TYPO)
    assert [d["public_id"] for d in _analysis(client, reviewer_token, new)["latest"]["duplicates"]] == [recent]


def test_rejected_reports_are_not_candidates(client, reporter_token, reviewer_token):
    old = _submit(client, reporter_token, description=POTHOLE)
    client.post(f"/review/reports/{old}/status", json={"status": "rejected", "reason": "insufficient_info"},
                headers=auth_header(reviewer_token))
    new = _submit(client, reporter_token, description=POTHOLE_TYPO)
    assert _analysis(client, reviewer_token, new)["latest"]["duplicates"] == []


def test_link_rejects_newer_report_and_corroborates_original(client, reporter_token, reviewer_token, pair):
    old, new = pair
    r = _decide(client, reviewer_token, old, new, "link", "Aceeași groapă.")  # works from either report
    assert r.status_code == 200, r.text

    newer = client.get(f"/review/reports/{new}", headers=auth_header(reviewer_token)).json()
    assert newer["status"] == "rejected" and newer["rejection_reason"] == "duplicate"
    mine = {m["public_id"]: m for m in client.get("/reports/mine", headers=auth_header(reporter_token)).json()}
    assert mine[new]["rejection_reason"] == "duplicate" and mine[old]["status"] == "submitted"

    a_old = _analysis(client, reviewer_token, old)
    assert a_old["latest"]["triggered_by"] == "reviewer_decision"
    assert a_old["latest"]["duplicates"] == []  # the duplicate is rejected now…
    assert _factor(a_old, "corroboration")["detail"] == 1  # …but still counts once for the original
    assert a_old["latest"]["confirmed_links"] == [{"public_id": new, "role": "duplicate"}]

    for pid, other in ((new, old), (old, new)):
        log = client.get(f"/review/reports/{pid}/audit", headers=auth_header(reviewer_token)).json()
        assert [(e["action"], e["related_report_id"]) for e in log] == [("duplicate_link", other)]
    assert log[0]["to_status"] is None  # the original's status did not change
    newer_log = client.get(f"/review/reports/{new}/audit", headers=auth_header(reviewer_token)).json()[0]
    assert (newer_log["from_status"], newer_log["to_status"], newer_log["reason"]) == ("submitted", "rejected", "duplicate")

    assert _decide(client, reviewer_token, new, old, "link").status_code == 409  # already linked


def test_revoke_reopens_the_duplicate_and_nothing_is_deleted(client, settings, reviewer_token, pair):
    old, new = pair
    _decide(client, reviewer_token, new, old, "link")
    r = _decide(client, reviewer_token, new, old, "revoke", "Sunt gropi diferite.")
    assert r.status_code == 200
    assert (r.json()["status"], r.json()["rejection_reason"]) == ("under_review", None)

    conn = sqlite3.connect(settings.database_path)
    types = [t for (t,) in conn.execute("SELECT relation_type FROM report_relations ORDER BY id")]
    assert types == ["duplicate_confirmed", "duplicate_revoked"]
    assert [d["public_id"] for d in _analysis(client, reviewer_token, old)["latest"]["duplicates"]] == [new]
    actions = [e["action"] for e in client.get(f"/review/reports/{new}/audit", headers=auth_header(reviewer_token)).json()]
    assert actions == ["duplicate_link", "duplicate_revoke"]
    assert _decide(client, reviewer_token, new, old, "revoke").status_code == 409  # nothing left to undo


def test_not_duplicate_is_recorded_and_pair_not_suggested_again(client, settings, reviewer_token, pair):
    old, new = pair
    r = _decide(client, reviewer_token, new, old, "not_duplicate")
    assert r.status_code == 200 and r.json()["status"] == "submitted"  # no status change
    assert _analysis(client, reviewer_token, new)["latest"]["duplicates"] == []
    assert _analysis(client, reviewer_token, old)["latest"]["duplicates"] == []
    conn = sqlite3.connect(settings.database_path)
    assert conn.execute("SELECT relation_type FROM report_relations").fetchall() == [("not_duplicate",)]
    log = client.get(f"/review/reports/{old}/audit", headers=auth_header(reviewer_token)).json()
    assert [(e["action"], e["related_report_id"]) for e in log] == [("not_duplicate", new)]


def test_duplicate_decision_errors(client, reporter_token, reviewer_token, pair):
    old, new = pair
    assert _decide(client, reviewer_token, old, old, "link").status_code == 422
    assert _decide(client, reviewer_token, old, "SF-NOPE0000", "link").status_code == 404
    assert _decide(client, reviewer_token, old, new, "merge").status_code == 422
    assert _decide(client, reporter_token, old, new, "link").status_code == 403
    assert client.get(f"/review/reports/{old}/assistant", headers=auth_header(reporter_token)).status_code == 403


def test_assistant_tables_are_append_only(client, settings, reviewer_token, pair):
    old, new = pair
    _decide(client, reviewer_token, new, old, "not_duplicate")
    conn = sqlite3.connect(settings.database_path)
    for table in ("assistant_runs", "report_relations"):
        with pytest.raises(sqlite3.DatabaseError, match="append-only"):
            conn.execute(f"UPDATE {table} SET created_at = 'x'")
        with pytest.raises(sqlite3.DatabaseError, match="append-only"):
            conn.execute(f"DELETE FROM {table}")


def test_importance_is_visible_to_reviewers_only(client, reporter_token, reviewer_token, pair):
    old, new = pair
    queue = client.get("/review/reports?sort=importance", headers=auth_header(reviewer_token)).json()
    assert all(item["assistant"]["importance_level"] for item in queue)
    scores = [item["assistant"]["importance_score"] for item in queue]
    assert scores == sorted(scores, reverse=True)
    assert queue[0]["assistant"]["duplicate_level"] == "probable"

    for body in (
        client.get("/reports/mine", headers=auth_header(reporter_token)).json(),
        client.get("/public/reports").json(),
        client.get(f"/public/reports/{old}").json(),
    ):
        text = str(body)
        assert "importance" not in text and "assistant" not in text and "duplicate" not in text


def test_assistant_failure_holds_the_report(client, reporter_token, reviewer_token, monkeypatch):
    def broken(*_args, **_kwargs):
        raise RuntimeError("simulated assistant failure")

    monkeypatch.setattr("app.routers.reports.assess", broken)
    pid = _submit(client, reporter_token)
    assert client.get(f"/public/reports/{pid}").status_code == 404
    mine = client.get("/reports/mine", headers=auth_header(reporter_token)).json()[0]
    assert mine["public_visibility"] == "held"
    assert _analysis(client, reviewer_token, pid) == {"latest": None, "checks": 0, "current_version": "asistent-reguli-v1"}
