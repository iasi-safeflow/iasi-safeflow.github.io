"""Reviewer workflow: validated status, rejection reasons, private notes, held reports and reopening."""

import sqlite3

import pytest

from app.db import MIGRATIONS, SCHEMA, connect, init_db
from conftest import auth_header

ALL_STATUSES = ("submitted", "under_review", "validated", "referred", "resolved", "rejected", "expired")

# Written out here rather than imported, so a change to domain.TRANSITIONS has to be made deliberately in both places.
EXPECTED = {
    "submitted": {"under_review", "validated", "rejected"},
    "under_review": {"validated", "rejected", "expired"},
    "validated": {"referred", "resolved", "rejected"},
    "referred": {"resolved", "validated"},
    "resolved": {"validated"},
    "rejected": {"under_review"},
    "expired": {"under_review"},
}


def _force(settings, pid, **columns):
    """Put a report into a given state directly, to test transitions from any starting status."""
    conn = sqlite3.connect(settings.database_path)
    sets = ", ".join(f"{k} = ?" for k in columns)
    conn.execute(f"UPDATE reports SET {sets} WHERE public_id = ?", (*columns.values(), pid))
    conn.commit()
    conn.close()


def _change(client, token, pid, status, **extra):
    return client.post(f"/review/reports/{pid}/status", json={"status": status, **extra}, headers=auth_header(token))


def _audit(client, token, pid):
    return client.get(f"/review/reports/{pid}/audit", headers=auth_header(token)).json()


@pytest.mark.parametrize("current", ALL_STATUSES)
@pytest.mark.parametrize("target", ALL_STATUSES)
def test_every_transition_is_allowed_or_blocked(client, settings, reviewer_token, submitted_report, current, target):
    pid = submitted_report["public_id"]
    _force(settings, pid, status=current)
    extra = {"reason": "insufficient_info"} if target == "rejected" else {}
    r = _change(client, reviewer_token, pid, target, **extra)
    if target in EXPECTED[current]:
        assert r.status_code == 200, r.text
        assert r.json()["status"] == target
        assert len(_audit(client, reviewer_token, pid)) == 1
    else:
        assert r.status_code == 409
        assert set(r.json()["detail"]["allowed"]) == EXPECTED[current]
        assert _audit(client, reviewer_token, pid) == []


@pytest.mark.parametrize(
    "body",
    [
        {"status": "rejected"},  # reason missing
        {"status": "rejected", "reason": "nu_imi_place"},  # unknown reason
        {"status": "under_review", "reason": "duplicate"},  # reason only belongs to a rejection
    ],
)
def test_reject_requires_a_known_reason(client, reviewer_token, submitted_report, body):
    pid = submitted_report["public_id"]
    r = client.post(f"/review/reports/{pid}/status", json=body, headers=auth_header(reviewer_token))
    assert r.status_code == 422
    assert _audit(client, reviewer_token, pid) == []


def test_reporter_sees_reason_but_never_the_private_note(client, reporter_token, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    note = "Notă internă: același loc ca SF-ALTUL01."
    r = _change(client, reviewer_token, pid, "rejected", reason="duplicate", notes=note)
    assert r.status_code == 200
    assert r.json()["rejection_reason"] == "duplicate"

    mine = client.get("/reports/mine", headers=auth_header(reporter_token)).json()
    assert mine[0]["status"] == "rejected" and mine[0]["rejection_reason"] == "duplicate"
    assert "notes" not in mine[0] and note not in str(mine)

    lookup = client.get(f"/public/reports/{pid}").json()
    assert note not in str(lookup)

    entry = _audit(client, reviewer_token, pid)[0]
    assert entry["reason"] == "duplicate" and entry["notes"] == note  # reviewers keep the note


def test_reopen_after_rejection_is_logged_and_clears_the_reason(client, reporter_token, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    assert _change(client, reviewer_token, pid, "rejected", reason="outside_area").status_code == 200
    r = _change(client, reviewer_token, pid, "under_review", notes="Redeschis: locația e în Iași.")
    assert r.status_code == 200 and r.json()["rejection_reason"] is None

    log = _audit(client, reviewer_token, pid)
    assert [(e["from_status"], e["to_status"], e["reason"]) for e in log] == [
        ("submitted", "rejected", "outside_area"),
        ("rejected", "under_review", None),
    ]
    assert client.get("/reports/mine", headers=auth_header(reporter_token)).json()[0]["rejection_reason"] is None
    assert len(client.get("/public/reports").json()) == 1  # visible on the map again


def test_reopen_resolved_goes_back_to_validated(client, settings, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    _force(settings, pid, status="resolved")
    r = _change(client, reviewer_token, pid, "validated", notes="Problema a reapărut.")
    assert r.status_code == 200
    assert _audit(client, reviewer_token, pid)[0]["from_status"] == "resolved"


def test_verification_label_follows_reviewer_decision(client, reporter_token, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    assert client.get(f"/public/reports/{pid}").json()["verification"] == "unverified"
    _change(client, reviewer_token, pid, "under_review")
    assert client.get(f"/public/reports/{pid}").json()["verification"] == "unverified"
    _change(client, reviewer_token, pid, "validated")
    assert client.get(f"/public/reports/{pid}").json()["verification"] == "reviewer_verified"
    assert client.get("/public/reports").json()[0]["verification"] == "reviewer_verified"
    assert client.get("/reports/mine", headers=auth_header(reporter_token)).json()[0]["verification"] == "reviewer_verified"
    _change(client, reviewer_token, pid, "referred")
    assert client.get(f"/public/reports/{pid}").json()["verification"] == "reviewer_verified"


def _assert_not_public(client, pid):
    for query in ("", "?category=defect_carosabil", "?status=submitted"):
        assert pid not in str(client.get("/public/reports" + query).json())
    assert client.get(f"/public/reports/{pid}").status_code == 404
    assert client.get(f"/public/reports/{pid.lower()}").status_code == 404


def test_held_report_never_appears_in_public_endpoints(client, settings, reporter_token, submitted_report):
    pid = submitted_report["public_id"]
    _force(settings, pid, public_visibility="held")
    _assert_not_public(client, pid)
    mine = client.get("/reports/mine", headers=auth_header(reporter_token)).json()
    assert mine[0]["public_id"] == pid and mine[0]["public_visibility"] == "held"


def test_held_report_stays_hidden_when_rejected_and_reopen_publishes_it(client, settings, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    _force(settings, pid, public_visibility="held")
    assert _change(client, reviewer_token, pid, "rejected", reason="abusive_spam").json()["public_visibility"] == "held"
    _assert_not_public(client, pid)
    assert _change(client, reviewer_token, pid, "under_review").json()["public_visibility"] == "public"
    assert client.get(f"/public/reports/{pid}").status_code == 200


@pytest.mark.parametrize("target", ["under_review", "validated"])
def test_reviewer_publishes_held_report(client, settings, reviewer_token, submitted_report, target):
    pid = submitted_report["public_id"]
    _force(settings, pid, public_visibility="held")
    assert _change(client, reviewer_token, pid, target).json()["public_visibility"] == "public"
    assert [r["public_id"] for r in client.get("/public/reports").json()] == [pid]


def test_queue_filters_held_reports(client, settings, reviewer_token, submitted_report):
    _force(settings, submitted_report["public_id"], public_visibility="held")
    h = auth_header(reviewer_token)
    assert len(client.get("/review/reports?visibility=held", headers=h).json()) == 1
    assert client.get("/review/reports?visibility=public", headers=h).json() == []
    assert client.get("/review/reports?visibility=secret", headers=h).status_code == 422


def test_migration_keeps_existing_data(tmp_path):
    path = str(tmp_path / "old.db")
    old = sqlite3.connect(path)
    old.executescript(SCHEMA)  # the schema as released before any migration
    old.execute("INSERT INTO users (email, password_hash, role, created_at) VALUES ('a@b.ro', 'x', 'reporter', 't')")
    old.execute(
        """INSERT INTO reports (public_id, reporter_id, category, description, lat, lon, location_source, observed_at,
               created_at, updated_at, status) VALUES ('SF-OLD00002', 1, 'alta', 'Raport vechi de test.', 47.16, 27.58,
               'pin', 't', 't', 't', 'under_review')"""
    )
    old.execute(
        """INSERT INTO review_actions (report_id, reviewer_id, action, from_status, to_status, notes, created_at)
           VALUES (1, 1, 'status_change', 'submitted', 'under_review', 'veche', 't')"""
    )
    old.commit()
    old.close()

    conn = connect(path)
    init_db(conn)
    init_db(conn)  # running again is a no-op
    assert conn.execute("PRAGMA user_version").fetchone()[0] == len(MIGRATIONS)
    row = conn.execute("SELECT * FROM reports").fetchone()
    assert (row["public_id"], row["status"], row["public_visibility"], row["rejection_reason"]) == (
        "SF-OLD00002", "under_review", "public", None,
    )
    action = conn.execute("SELECT * FROM review_actions").fetchone()
    assert action["notes"] == "veche" and action["reason"] is None
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        conn.execute("DELETE FROM review_actions")  # triggers survive the migration
    conn.close()
