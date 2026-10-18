"""Importance (review priority): a transparent 0–100 score built from named factors. A triage suggestion only.

Every factor is returned with its points, including factors worth 0, so "De ce?" can list all of them.
"""

import re
from datetime import datetime

from . import config
from .similarity import normalize_text

_VULNERABLE = re.compile(r"\b(?:" + "|".join(re.escape(s) for s in config.VULNERABLE_STEMS) + r")\w*")


def importance_level(score: int) -> str:
    if score >= config.IMPORTANCE_HIGH:
        return "high"
    if score >= config.IMPORTANCE_MEDIUM:
        return "medium"
    return "low"


def vulnerable_mentions(description: str) -> list[str]:
    return sorted(set(_VULNERABLE.findall(normalize_text(description))))


def score_importance(report: dict, corroborations: int, now: datetime) -> dict:
    """`corroborations`: other open reports nearby that likely describe the same problem (counted by the runner)."""
    factors = []

    def add(code: str, points: int, detail) -> None:
        factors.append({"code": code, "points": points, "detail": detail})

    add("category", config.CATEGORY_POINTS.get(report["category"], 0), report["category"])

    mentions = vulnerable_mentions(report["description"])
    add("vulnerable_users", config.VULNERABLE_POINTS if mentions else 0, mentions)

    add(
        "corroboration",
        min(corroborations * config.CORROBORATION_POINTS_EACH, config.CORROBORATION_MAX_POINTS),
        corroborations,
    )

    age_days = max(0.0, (now - datetime.fromisoformat(report["observed_at"])).total_seconds() / 86400)
    fresh = max(0.0, 1 - age_days / config.RECENCY_ZERO_DAYS)
    add("recency", round(config.RECENCY_MAX_POINTS * fresh), round(age_days, 1))

    accuracy = report.get("gps_accuracy_m")
    precise = report.get("location_source") == "gps" and accuracy is not None and accuracy <= config.GPS_PRECISE_M
    add("location_precision", config.GPS_PRECISE_POINTS if precise else 0, accuracy)

    text = normalize_text(report["description"])
    chars, words = len(text), len(text.split())
    complete = chars >= config.DESCRIPTION_MIN_CHARS and words >= config.DESCRIPTION_MIN_WORDS
    add("description", config.DESCRIPTION_POINTS if complete else 0, {"chars": chars, "words": words})

    score = max(0, min(100, sum(f["points"] for f in factors)))
    return {"score": score, "level": importance_level(score), "factors": factors}
