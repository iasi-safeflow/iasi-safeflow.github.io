"""Unit tests for duplicate similarity and the importance score (no database)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.assistant import config
from app.assistant.priority import importance_level, score_importance
from app.assistant.similarity import find_duplicates, haversine_m, normalize_text

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=timezone.utc)
LAT, LON = 47.16234, 27.58871
METRE_LAT = 1 / 111_195  # degrees of latitude per metre

POTHOLE = "Groapă mare pe banda din dreapta, lângă stația de tramvai."


def rep(public_id, description, *, metres_north=0.0, category="defect_carosabil"):
    return {"public_id": public_id, "description": description, "category": category,
            "lat": LAT + metres_north * METRE_LAT, "lon": LON}


def dupes(new, *others):
    return find_duplicates(new, list(others), corpus=[new, *others])


def test_normalisation_removes_case_diacritics_punctuation_and_simulated_prefix():
    assert normalize_text("[SIMULAT] Groapă  MARE, lângă stația!") == "groapa mare langa statia"


def test_haversine_matches_known_distance():
    assert haversine_m(LAT, LON, LAT + 100 * METRE_LAT, LON) == pytest.approx(100, abs=0.5)


def test_clear_duplicate_with_typos_and_missing_diacritics_is_probable():
    found = dupes(rep("SF-NEW", "groapa mare pe banda dreapta langa statia de tramvi", metres_north=20), rep("SF-OLD", POTHOLE))
    assert [d["public_id"] for d in found] == ["SF-OLD"]
    d = found[0]
    assert d["level"] == "probable" and d["score"] >= config.PROBABLE_DUPLICATE
    assert d["distance_m"] == 20 and d["same_category"] is True
    assert set(d["reasons"]) == {"similar_text", "very_close", "same_category"}


def test_reworded_report_nearby_is_possible_duplicate():
    reworded = "Este o groapa adanca pe banda dreapta langa tramvai, masinile o ocolesc brusc."
    found = dupes(rep("SF-NEW", reworded, metres_north=40), rep("SF-OLD", POTHOLE))
    assert found and found[0]["level"] == "possible"


@pytest.mark.parametrize(
    "description, category",
    [
        ("Semaforul pentru pietoni nu funcționează de o săptămână.", "semnalizare_lipsa"),
        ("Capac de canal lipsă pe trotuar, foarte periculos noaptea.", "defect_carosabil"),
    ],
)
def test_different_problems_at_the_same_spot_are_not_matched(description, category):
    assert dupes(rep("SF-NEW", description, category=category, metres_north=5), rep("SF-OLD", POTHOLE)) == []


def test_identical_text_outside_radius_is_not_a_candidate():
    assert dupes(rep("SF-NEW", POTHOLE, metres_north=config.DUPLICATE_RADIUS_M + 5), rep("SF-OLD", POTHOLE)) == []
    assert dupes(rep("SF-NEW", POTHOLE, metres_north=config.DUPLICATE_RADIUS_M - 5), rep("SF-OLD", POTHOLE))


def test_combined_score_follows_documented_formula():
    d = dupes(rep("SF-NEW", POTHOLE, metres_north=75), rep("SF-OLD", POTHOLE))[0]
    # identical text (1.0), half the radius (closeness 0.5), same category (1.0)
    assert d["text_similarity"] == pytest.approx(1.0)
    assert d["score"] == pytest.approx(0.5 * 1.0 + 0.3 * 0.5 + 0.2 * 1.0, abs=0.01)


# ---- Importance ----

BASE = {
    "public_id": "SF-BASE",
    "category": "defect_carosabil",
    "description": "Groapă pe stradă.",
    "location_source": "pin",
    "gps_accuracy_m": None,
    "observed_at": NOW.isoformat(),
}


def score(corroborations=0, **changes):
    return score_importance({**BASE, **changes}, corroborations=corroborations, now=NOW)


def points(result, code):
    return next(f["points"] for f in result["factors"] if f["code"] == code)


def test_score_is_deterministic_and_lists_every_factor():
    assert score() == score()
    codes = [f["code"] for f in score()["factors"]]
    assert codes == ["category", "vulnerable_users", "corroboration", "recency", "location_precision", "description"]
    base = score()
    assert base["score"] == sum(f["points"] for f in base["factors"]) == 20 + 15  # category + fresh


def test_category_weight():
    assert score(category="trecere_pietoni_nesigura")["score"] - score()["score"] == 35 - 20
    assert points(score(category="coada_recurenta"), "category") == 10
    assert points(score(category="alta"), "category") == 8


@pytest.mark.parametrize("word", ["pietoni", "copiii", "școală", "grădiniță", "trecerea", "bicicliști", "cărucior", "vârstnici", "persoane în vârstă"])
def test_vulnerable_road_users_add_points(word):
    s = score(description=f"Groapă pe stradă, {word}.")
    assert points(s, "vulnerable_users") == config.VULNERABLE_POINTS
    assert s["score"] - score()["score"] == config.VULNERABLE_POINTS


def test_corroboration_adds_ten_each_up_to_thirty():
    assert [points(score(corroborations=n), "corroboration") for n in (0, 1, 2, 3, 5)] == [0, 10, 20, 30, 30]


def test_recency_decays_over_days():
    at = lambda days: points(score(observed_at=(NOW - timedelta(days=days)).isoformat()), "recency")  # noqa: E731
    assert at(0) == 15
    assert at(0) > at(10) > at(20) > at(29)
    assert at(30) == 0 and at(90) == 0


def test_precise_gps_bonus():
    assert points(score(location_source="gps", gps_accuracy_m=12), "location_precision") == 5
    assert points(score(location_source="gps", gps_accuracy_m=31), "location_precision") == 0
    assert points(score(location_source="pin", gps_accuracy_m=5), "location_precision") == 0


def test_complete_description_bonus():
    long = "Groapă adâncă pe banda din dreapta, chiar după semafor, mașinile frânează brusc ca să o ocolească."
    assert points(score(description=long), "description") == 5
    assert points(score(), "description") == 0


def test_levels_and_cap():
    assert [importance_level(s) for s in (100, 65, 64, 40, 39, 0)] == ["high", "high", "medium", "medium", "low", "low"]
    top = score(
        corroborations=9, category="trecere_pietoni_nesigura", location_source="gps", gps_accuracy_m=3,
        description="Copiii traversează zilnic spre școală pe trecerea fără semafor, iar mașinile nu opresc deloc.",
    )
    assert top["score"] == 100 and top["level"] == "high"
