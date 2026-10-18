"""'Istoric AI': every assistant check next to the reviewer's next action, derived from the audit log."""

from conftest import auth_header, valid_report

POTHOLE = "Groapă mare pe banda din dreapta, lângă stația de tramvai."


def _submit(client, token, **overrides):
    r = client.post("/reports", json=valid_report(**overrides), headers=auth_header(token))
    assert r.status_code == 201, r.text
    return r.json()["public_id"]


def _history(client, token, query=""):
    r = client.get("/review/assistant-runs" + query, headers=auth_header(token))
    assert r.status_code == 200, r.text
    return r.json()


def test_history_is_reviewer_only(client, reporter_token):
    assert client.get("/review/assistant-runs").status_code == 401
    assert client.get("/review/assistant-runs", headers=auth_header(reporter_token)).status_code == 403


def test_new_check_is_pending_until_a_reviewer_acts(client, reviewer_token, submitted_report):
    [row] = _history(client, reviewer_token)
    assert row["report_id"] == submitted_report["public_id"]
    assert row["assistant_version"] == "asistent-reguli-v1" and row["triggered_by"] == "created"
    assert row["importance"]["factors"] and row["flags"] == [] and row["duplicates"] == []
    assert row["decision"] == {"kind": "pending"}


def test_decision_is_the_first_action_after_the_check(client, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    h = auth_header(reviewer_token)
    client.post(f"/review/reports/{pid}/status", json={"status": "validated"}, headers=h)
    client.post(f"/review/reports/{pid}/status", json={"status": "rejected", "reason": "outside_area"}, headers=h)
    [row] = _history(client, reviewer_token)
    assert row["decision"]["kind"] == "validated"  # the first action, not the latest


def test_rejection_reason_and_duplicate_decisions(client, reporter_token, reviewer_token):
    h = auth_header(reviewer_token)
    old = _submit(client, reporter_token, description=POTHOLE)
    new = _submit(client, reporter_token, description="groapa mare pe banda dreapta langa statia de tramvi", lat=47.16252)
    client.post(f"/review/reports/{new}/duplicates/{old}", json={"action": "link"}, headers=h)
    other = _submit(client, reporter_token, description="Semaforul de la intersecție nu funcționează de ieri.", lat=47.17)
    client.post(f"/review/reports/{other}/status", json={"status": "rejected", "reason": "insufficient_info"}, headers=h)

    rows = _history(client, reviewer_token)
    by = {(r["report_id"], r["triggered_by"]): r for r in reversed(rows)}  # keep the newest check per key
    assert by[(new, "created")]["decision"]["kind"] == "duplicate_link"
    assert by[(new, "created")]["decision"]["related_report_id"] == old
    assert by[(new, "created")]["duplicates"][0]["public_id"] == old
    assert by[(old, "reviewer_decision")]["decision"] == {"kind": "pending"}  # check made after the link
    rejected = by[(other, "created")]["decision"]
    assert (rejected["kind"], rejected["reason"]) == ("rejected", "insufficient_info")
    assert [r["id"] for r in rows] == sorted((r["id"] for r in rows), reverse=True)  # newest first


def test_history_filters(client, reporter_token, reviewer_token):
    plate = _submit(client, reporter_token, description="Mașina IS 12 ABC parchează zilnic pe trecerea de pietoni.")
    plain = _submit(client, reporter_token, lat=47.17)
    client.post(f"/review/reports/{plain}/status", json={"status": "validated"}, headers=auth_header(reviewer_token))

    assert [r["report_id"] for r in _history(client, reviewer_token, "?flag=personal_data")] == [plate]
    assert [r["report_id"] for r in _history(client, reviewer_token, "?decision=validated")] == [plain]
    assert [r["report_id"] for r in _history(client, reviewer_token, "?decision=pending")] == [plate]
    levels = {r["importance"]["level"] for r in _history(client, reviewer_token)}
    for level in levels:
        assert {r["importance"]["level"] for r in _history(client, reviewer_token, f"?importance={level}")} == {level}
    assert client.get("/review/assistant-runs?decision=maybe", headers=auth_header(reviewer_token)).status_code == 422
