"""Duplicate suggestions: distance, character 3-gram TF-IDF cosine similarity and category match. Pure Python."""

import math
import re
from collections import Counter
from collections.abc import Iterable

from ..domain import SIMULATED_PREFIX
from ..safety import normalize
from . import config

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_text(text: str) -> str:
    """Lowercase, no diacritics, punctuation turned into spaces, spaces collapsed. Drops the simulated-data prefix."""
    if text.startswith(SIMULATED_PREFIX):
        text = text[len(SIMULATED_PREFIX):]
    return _NON_ALNUM.sub(" ", normalize(text)).strip()


def ngrams(text: str, n: int = config.NGRAM_SIZE) -> Counter:
    padded = f" {normalize_text(text)} "
    return Counter(padded[i : i + n] for i in range(len(padded) - n + 1))


def idf_table(corpus: Iterable[Counter]) -> dict[str, float]:
    """Smoothed IDF: ln((1 + N) / (1 + df)) + 1, so n-grams found in every document still count a little."""
    docs = list(corpus)
    df: Counter = Counter()
    for grams in docs:
        df.update(grams.keys())
    n = len(docs)
    return {g: math.log((1 + n) / (1 + d)) + 1 for g, d in df.items()}


def cosine(a: Counter, b: Counter, idf: dict[str, float]) -> float:
    def weights(grams: Counter) -> dict[str, float]:
        return {g: tf * idf.get(g, 1.0) for g, tf in grams.items()}

    wa, wb = weights(a), weights(b)
    dot = sum(w * wb.get(g, 0.0) for g, w in wa.items())
    norm = math.sqrt(sum(w * w for w in wa.values())) * math.sqrt(sum(w * w for w in wb.values()))
    return dot / norm if norm else 0.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def duplicate_level(score: float) -> str | None:
    if score >= config.PROBABLE_DUPLICATE:
        return "probable"
    if score >= config.POSSIBLE_DUPLICATE:
        return "possible"
    return None


def compare(report: dict, other: dict, idf: dict[str, float]) -> dict | None:
    """Score one candidate pair. None when the other report is outside the search radius."""
    distance = haversine_m(report["lat"], report["lon"], other["lat"], other["lon"])
    if distance > config.DUPLICATE_RADIUS_M:
        return None
    text = cosine(ngrams(report["description"]), ngrams(other["description"]), idf)
    closeness = 1 - distance / config.DUPLICATE_RADIUS_M
    same_category = report["category"] == other["category"]
    w = config.DUPLICATE_WEIGHTS
    score = w["text"] * text + w["distance"] * closeness + w["category"] * (1.0 if same_category else 0.0)
    reasons = []
    if text >= config.TEXT_MATCH_REASON:
        reasons.append("similar_text")
    if distance <= config.CLOSE_MATCH_REASON_M:
        reasons.append("very_close")
    if same_category:
        reasons.append("same_category")
    return {
        "public_id": other["public_id"],
        "score": round(score, 3),
        "level": duplicate_level(score),
        "distance_m": round(distance),
        "text_similarity": round(text, 3),
        "same_category": same_category,
        "reasons": reasons,
    }


def find_duplicates(report: dict, candidates: list[dict], corpus: list[dict]) -> list[dict]:
    """Candidates that reach at least "Posibil duplicat", best first. `corpus` (reports in the time window) sets the IDF."""
    idf = idf_table(ngrams(d["description"]) for d in corpus)
    scored = (compare(report, c, idf) for c in candidates)
    matches = [m for m in scored if m is not None and m["level"] is not None]
    return sorted(matches, key=lambda m: (-m["score"], m["distance_m"], m["public_id"]))
