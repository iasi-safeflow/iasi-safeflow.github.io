from conftest import auth_header


def test_public_map_is_privacy_safe(client, submitted_report):
    items = client.get("/public/reports").json()  # no login needed
    assert len(items) == 1
    item = items[0]
    assert set(item) == {
        "public_id", "category", "status", "lat", "lon", "observed_date", "updated_date",
        "source_type", "is_simulated", "verification", "area_street",
        "confirmations_count", "confirmed_by_me",
        "boosts_count", "boosted_by_me",
        "updates_summary", "approved_comments_count",
    }
    assert item["confirmations_count"] == 0 and item["confirmed_by_me"] is False
    assert item["boosts_count"] == 0 and item["boosted_by_me"] is False
    assert item["updates_summary"] == {"still_there": 0, "worse": 0, "looks_resolved": 0}
    assert item["approved_comments_count"] == 0
    assert item["lat"] == 47.162 and item["lon"] == 27.589  # rounded to ~100 m
    assert len(item["observed_date"]) == 10  # date only, no exact time
    assert submitted_report["description"] not in str(item)


def test_rejected_reports_hidden_from_public_map_but_status_lookup_works(client, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]
    client.post(f"/review/reports/{pid}/status", json={"status": "rejected", "reason": "insufficient_info"}, headers=auth_header(reviewer_token))
    assert client.get("/public/reports").json() == []
    lookup = client.get(f"/public/reports/{pid.lower()}")
    assert lookup.status_code == 200 and lookup.json()["status"] == "rejected"
    assert "description" not in lookup.json()


def test_public_filters_and_unknown_id(client, submitted_report):
    assert len(client.get("/public/reports?category=defect_carosabil").json()) == 1
    assert client.get("/public/reports?category=iluminat_slab").json() == []
    assert client.get("/public/reports/SF-NOPE0000").status_code == 404
