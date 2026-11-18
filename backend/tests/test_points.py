"""Civic points, priority boosts (50 pts), and Trusted Weight (2x at 100 earned pts)."""

from conftest import auth_header, valid_report


def _register(client, email):
    r = client.post("/auth/register", json={"email": email, "password": "parola-sigura"})
    assert r.status_code == 201
    return r.json()["token"]


def _create(client, token, **overrides):
    r = client.post("/reports", json=valid_report(**overrides), headers=auth_header(token))
    assert r.status_code == 201, r.text
    return r.json()


def test_points_earned_only_on_validation_and_impact_idempotently(client, reporter_token, reviewer_token):
    long_desc = (
        "Trecere de pietoni cu vizibilitate blocata langa scoala, masinile parcheaza chiar pe colt "
        "si pietonii nu sunt vazuti deloc."
    )
    rep = _create(client, reporter_token, description=long_desc)
    pid = rep["public_id"]

    # Unverified submission grants 0 points.
    pts0 = client.get("/auth/points", headers=auth_header(reporter_token)).json()
    assert pts0["balance"] == 0 and pts0["earned"] == 0 and pts0["trusted"] is False

    # Another user confirms while signed in.
    other = _register(client, "bob@example.com")
    client.post(f"/public/reports/{pid}/confirm", headers=auth_header(other))

    # Validation awards +15 + 5 (detail bonus) to reporter, and +5 to confirmer.
    client.post(f"/review/reports/{pid}/status", json={"status": "validated"}, headers=auth_header(reviewer_token))
    pts_rep = client.get("/auth/points", headers=auth_header(reporter_token)).json()
    assert pts_rep["balance"] == 20 and pts_rep["earned"] == 20
    pts_bob = client.get("/auth/points", headers=auth_header(other)).json()
    assert pts_bob["balance"] == 5 and pts_bob["earned"] == 5

    # Referral awards +25 to both; resolving afterwards does not double-award impact.
    client.post(f"/review/reports/{pid}/status", json={"status": "referred"}, headers=auth_header(reviewer_token))
    assert client.get("/auth/points", headers=auth_header(reporter_token)).json()["balance"] == 45
    assert client.get("/auth/points", headers=auth_header(other)).json()["balance"] == 30

    client.post(f"/review/reports/{pid}/status", json={"status": "resolved"}, headers=auth_header(reviewer_token))
    assert client.get("/auth/points", headers=auth_header(reporter_token)).json()["balance"] == 45

    # Reopening and re-validating does not double-award validation points.
    client.post(f"/review/reports/{pid}/status", json={"status": "validated"}, headers=auth_header(reviewer_token))
    assert client.get("/auth/points", headers=auth_header(reporter_token)).json()["balance"] == 45


def test_rejected_reports_award_zero_points(client, reporter_token, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    client.post(
        f"/review/reports/{pid}/status",
        json={"status": "rejected", "reason": "insufficient_info"},
        headers=auth_header(reviewer_token),
    )
    pts = client.get("/auth/points", headers=auth_header(reporter_token)).json()
    assert pts["balance"] == 0 and pts["earned"] == 0


def test_boost_costs_50_points_and_trusted_weight_unlocks_at_100(client, reporter_token, reviewer_token):
    # Cannot boost with 0 points.
    target = _create(client, reporter_token, lat=47.175, lon=27.575, description="Trecere nesigura langa parc.")
    t_id = target["public_id"]
    low = client.post(f"/public/reports/{t_id}/boost", headers=auth_header(reporter_token))
    assert low.status_code == 409 and low.json()["detail"]["code"] == "insufficient_points"

    # Earn 135 points across 3 validated + referred detailed reports (45 pts each).
    for i in range(3):
        r = _create(
            client,
            reporter_token,
            lat=47.15 + i * 0.004,
            lon=27.56 + i * 0.004,
            description=(
                f"Problema {i}: indicator lipsa si vizibilitate redusa pe strada principala langa intersectia aglomerata."
            ),
        )
        client.post(f"/review/reports/{r['public_id']}/status", json={"status": "validated"}, headers=auth_header(reviewer_token))
        client.post(f"/review/reports/{r['public_id']}/status", json={"status": "referred"}, headers=auth_header(reviewer_token))

    pts = client.get("/auth/points", headers=auth_header(reporter_token)).json()
    assert pts["earned"] == 135 and pts["balance"] == 135 and pts["trusted"] is True and pts["weight"] == 2

    # Spend 50 points to boost target report; duplicate boost is blocked.
    b = client.post(f"/public/reports/{t_id}/boost", headers=auth_header(reporter_token))
    assert b.status_code == 200
    assert b.json() == {"public_id": t_id, "boosts_count": 1, "boosted_by_me": True, "points_balance": 85}
    dup = client.post(f"/public/reports/{t_id}/boost", headers=auth_header(reporter_token))
    assert dup.status_code == 409 and dup.json()["detail"]["code"] == "already_boosted"

    # Trusted status (earned >= 100) stays True even after balance drops below 100!
    after_spend = client.get("/auth/points", headers=auth_header(reporter_token)).json()
    assert after_spend["balance"] == 85 and after_spend["earned"] == 135 and after_spend["trusted"] is True

    # Reviewer queue sorts boosted reports first when sort=boosts.
    q = client.get("/review/reports?sort=boosts", headers=auth_header(reviewer_token)).json()
    assert q[0]["public_id"] == t_id and q[0]["boosts_count"] == 1

    # Trusted user's confirmation stores weight = 2 and counts 2x in assistant corroboration.
    other_user = _register(client, "vlad@example.com")
    other_rep = _create(client, other_user, lat=47.168, lon=27.602, description="Iluminat slab in statia de autobuz.")
    client.post(f"/public/reports/{other_rep['public_id']}/confirm", headers=auth_header(reporter_token))
    # Trigger a fresh nearby check on other_rep to verify weighted corroboration (+20 instead of +10).
    _create(client, other_user, lat=47.1681, lon=27.6021, category="banda_blocata", description="Masini parcate neregulamentar in statie.")
    assistant = client.get(f"/review/reports/{other_rep['public_id']}/assistant", headers=auth_header(reviewer_token)).json()
    corrob = next(f for f in assistant["latest"]["importance"]["factors"] if f["code"] == "corroboration")
    assert corrob["points"] == 20  # 1 trusted confirmation (weight 2) -> 2 * 10 = 20
