"""Structured community updates and moderated comments (112 gate, pending until reviewer approval, +5 pts)."""

from conftest import auth_header

DEVICE_A = {"X-Device-Id": "device-alpha-1234"}


def _register(client, email):
    r = client.post("/auth/register", json={"email": email, "password": "parola-sigura"})
    assert r.status_code == 201
    return r.json()["token"]


def test_comment_112_gate_never_stores(client, submitted_report):
    pid = submitted_report["public_id"]
    r = client.post(
        f"/public/reports/{pid}/comments",
        json={"tag": "worse", "body": "Este o persoana ranita chiar acum pe carosabil."},
        headers=DEVICE_A,
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "call_112"
    assert r.json()["detail"]["stored"] is False
    assert client.get(f"/public/reports/{pid}/comments").json() == []


def test_tag_only_updates_immediately_and_written_comment_waits_for_reviewer(client, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]

    # Tag-only update updates counts immediately.
    t1 = client.post(f"/public/reports/{pid}/comments", json={"tag": "still_there", "body": ""}, headers=DEVICE_A)
    assert t1.status_code == 201
    assert t1.json()["moderation_status"] == "approved"
    assert t1.json()["updates_summary"]["still_there"] == 1

    # Written comment from a signed-in user starts pending and flags personal data for the reviewer.
    commenter = _register(client, "mihai@example.com")
    c1 = client.post(
        f"/public/reports/{pid}/comments",
        json={"tag": "worse", "body": "A parcat din nou masina IS 12 ABC pe trecere."},
        headers=auth_header(commenter),
    )
    assert c1.status_code == 201
    assert c1.json()["moderation_status"] == "pending"
    cid = c1.json()["id"]

    # Not public yet!
    assert client.get(f"/public/reports/{pid}/comments").json() == []

    # Queue shows pending_comments_count and filter works.
    q = client.get("/review/reports?pending_comments=true", headers=auth_header(reviewer_token)).json()
    assert [x["public_id"] for x in q] == [pid] and q[0]["pending_comments_count"] == 1

    rev_comments = client.get(f"/review/reports/{pid}/comments", headers=auth_header(reviewer_token)).json()
    assert len(rev_comments) == 1
    assert rev_comments[0]["flags"][0]["code"] == "personal_data"

    # Rejecting keeps it off public and awards 0 points.
    rej = client.post(f"/review/comments/{cid}", json={"decision": "rejected"}, headers=auth_header(reviewer_token))
    assert rej.status_code == 200 and rej.json()["moderation_status"] == "rejected"
    assert client.get(f"/public/reports/{pid}/comments").json() == []
    assert client.get("/auth/points", headers=auth_header(commenter)).json()["balance"] == 0

    # Clean comment approved -> goes public (without author identity) and awards +5 pts.
    c2 = client.post(
        f"/public/reports/{pid}/comments",
        json={"tag": "worse", "body": "Vizibilitate foarte slaba seara pe ploaie."},
        headers=auth_header(commenter),
    ).json()
    app = client.post(f"/review/comments/{c2['id']}", json={"decision": "approved"}, headers=auth_header(reviewer_token))
    assert app.status_code == 200 and app.json()["moderation_status"] == "approved"

    pub_comments = client.get(f"/public/reports/{pid}/comments").json()
    assert len(pub_comments) == 1
    assert set(pub_comments[0]) == {"id", "tag", "body", "is_simulated", "created_at"}
    assert pub_comments[0]["body"] == "Vizibilitate foarte slaba seara pe ploaie."
    assert client.get("/auth/points", headers=auth_header(commenter)).json()["balance"] == 5

    # Audit log recorded both moderation decisions.
    audit = client.get(f"/review/reports/{pid}/audit", headers=auth_header(reviewer_token)).json()
    assert [a["action"] for a in audit] == ["comment_rejected", "comment_approved"]
