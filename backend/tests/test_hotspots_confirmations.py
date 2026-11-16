"""1-tap citizen confirmations and privacy-safe hotspot clusters."""

from datetime import datetime, timedelta, timezone

from conftest import auth_header, valid_report

DEVICE_A = {"X-Device-Id": "device-alpha-1234"}
DEVICE_B = {"X-Device-Id": "device-bravo-5678"}


def _create(client, token, **overrides):
    r = client.post("/reports", json=valid_report(**overrides), headers=auth_header(token))
    assert r.status_code == 201, r.text
    return r.json()


def test_anonymous_confirm_toggle_and_counts(client, submitted_report):
    pid = submitted_report["public_id"]

    # Missing or too-short device ID without login is rejected.
    assert client.post(f"/public/reports/{pid}/confirm").status_code == 422
    assert client.post(f"/public/reports/{pid}/confirm", headers={"X-Device-Id": "short"}).status_code == 422

    # First tap confirms; second tap undoes.
    r1 = client.post(f"/public/reports/{pid}/confirm", headers=DEVICE_A)
    assert r1.status_code == 200
    assert r1.json() == {"public_id": pid, "confirmations_count": 1, "confirmed_by_me": True}

    r2 = client.post(f"/public/reports/{pid}/confirm", headers=DEVICE_B)
    assert r2.json() == {"public_id": pid, "confirmations_count": 2, "confirmed_by_me": True}

    # Public list reflects caller's own state via X-Device-Id.
    pub_a = client.get("/public/reports", headers=DEVICE_A).json()[0]
    pub_c = client.get("/public/reports", headers={"X-Device-Id": "device-charlie-99"}).json()[0]
    assert pub_a["confirmations_count"] == 2 and pub_a["confirmed_by_me"] is True
    assert pub_c["confirmations_count"] == 2 and pub_c["confirmed_by_me"] is False

    # Undo from DEVICE_A drops count back to 1.
    r3 = client.post(f"/public/reports/{pid}/confirm", headers=DEVICE_A)
    assert r3.json() == {"public_id": pid, "confirmations_count": 1, "confirmed_by_me": False}


def test_self_confirm_blocked_and_closed_or_hidden_reports_blocked(client, reporter_token, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]

    # Original author cannot +1 their own report.
    self_res = client.post(f"/public/reports/{pid}/confirm", headers={**auth_header(reporter_token), **DEVICE_A})
    assert self_res.status_code == 409
    assert self_res.json()["detail"]["code"] == "self_confirm"

    # A held report is invisible (404) until published.
    held = _create(client, reporter_token, description="Oprit ilegal masina IS 12 ABC pe trecere.")
    assert client.post(f"/public/reports/{held['public_id']}/confirm", headers=DEVICE_A).status_code == 404

    # Closing a report (resolved) blocks new confirmations; rejecting hides it (404).
    client.post(f"/review/reports/{pid}/status", json={"status": "validated"}, headers=auth_header(reviewer_token))
    client.post(f"/review/reports/{pid}/status", json={"status": "resolved"}, headers=auth_header(reviewer_token))
    closed = client.post(f"/public/reports/{pid}/confirm", headers=DEVICE_A)
    assert closed.status_code == 409 and closed.json()["detail"]["code"] == "report_closed"


def test_confirm_rate_limit(client, submitted_report):
    pid = submitted_report["public_id"]
    codes = [
        client.post(f"/public/reports/{pid}/confirm", headers={"X-Device-Id": f"device-spam-{i:04d}"}).status_code
        for i in range(35)
    ]
    assert 429 in codes


def test_reviewer_queue_sorts_by_confirmations_and_surfaces_counts(client, reporter_token, reviewer_token):
    r1 = _create(client, reporter_token, description="Groapa mare langa statie, greu de evitat.")
    r2 = _create(client, reporter_token, lat=47.175, lon=27.575, description="Trecere neiluminata pe bulevard.")

    client.post(f"/public/reports/{r2['public_id']}/confirm", headers=DEVICE_A)
    client.post(f"/public/reports/{r2['public_id']}/confirm", headers=DEVICE_B)

    mine = client.get("/reports/mine", headers=auth_header(reporter_token)).json()
    by_id = {m["public_id"]: m for m in mine}
    assert by_id[r2["public_id"]]["confirmations_count"] == 2
    assert by_id[r1["public_id"]]["confirmations_count"] == 0

    q = client.get("/review/reports?sort=confirmations", headers=auth_header(reviewer_token)).json()
    assert [x["public_id"] for x in q] == [r2["public_id"], r1["public_id"]]
    assert q[0]["confirmations_count"] == 2


def test_clusters_group_nearby_and_corroborated_reports_privacy_safely(client, reporter_token, reviewer_token):
    # Two nearby reports (~30 m apart) form one cluster.
    a = _create(client, reporter_token, lat=47.16234, lon=27.58871, category="tipar_near_miss")
    b = _create(client, reporter_token, lat=47.16255, lon=27.58890, category="trecere_pietoni_nesigura")
    # Held report nearby must NOT be included.
    _create(client, reporter_token, lat=47.16240, lon=27.58880, description="Masina IS 12 ABC pe trecere.")
    # Far-away single report with 0 confirmations does not form a cluster until confirmed >= 2 times.
    far = _create(client, reporter_token, lat=47.18000, lon=27.55000, category="iluminat_slab")
    # Old report outside the 30-day default window.
    old_at = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
    _create(client, reporter_token, lat=47.18005, lon=27.55005, observed_at=old_at, category="iluminat_slab")

    clusters = client.get("/public/clusters").json()
    assert len(clusters) == 1
    c = clusters[0]
    assert c["reports_count"] == 2
    assert set(c["report_ids"]) == {a["public_id"], b["public_id"]}
    assert "Tipar potențial" in c["disclaimer"]
    assert "description" not in str(c)

    # Confirming the far report twice makes it surface as a hotspot cluster too.
    client.post(f"/public/reports/{far['public_id']}/confirm", headers=DEVICE_A)
    client.post(f"/public/reports/{far['public_id']}/confirm", headers=DEVICE_B)
    clusters2 = client.get("/public/clusters").json()
    assert len(clusters2) == 2

    # Category filter and window filter work.
    assert len(client.get("/public/clusters?category=iluminat_slab").json()) == 1
    assert len(client.get("/public/clusters?category=iluminat_slab&days=60").json()) == 1
    far_cluster = client.get("/public/clusters?category=iluminat_slab&days=60").json()[0]
    assert far_cluster["reports_count"] == 2
