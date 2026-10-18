"""Every weight, threshold and word list used by the review assistant. Documented in docs/ASSISTANT.md.

Word lists are matched against normalised text (lowercase, no diacritics), at word starts.
Change ASSISTANT_VERSION whenever a rule or weight changes, so stored results stay traceable.
"""

ASSISTANT_VERSION = "asistent-reguli-v1"

# ---- Duplicate suggestions ----
DUPLICATE_RADIUS_M = 150.0
DUPLICATE_WINDOW_DAYS = 30
# combined = 0.5 × text similarity + 0.3 × distance closeness + 0.2 × category match, all in 0–1.
DUPLICATE_WEIGHTS = {"text": 0.5, "distance": 0.3, "category": 0.2}
PROBABLE_DUPLICATE = 0.75  # "Probabil duplicat"
POSSIBLE_DUPLICATE = 0.55  # "Posibil duplicat"
NGRAM_SIZE = 3
# Thresholds for the "reasons that matched" list shown to reviewers (they do not change the score).
TEXT_MATCH_REASON = 0.5
CLOSE_MATCH_REASON_M = 50.0

# ---- Importance (review priority), 0–100 ----
CATEGORY_POINTS = {
    "intersectie_periculoasa": 35,
    "trecere_pietoni_nesigura": 35,
    "tipar_near_miss": 30,
    "semnalizare_lipsa": 28,
    "banda_blocata": 25,
    "iluminat_slab": 22,
    "defect_carosabil": 20,
    "incident_trecut": 20,
    "coada_recurenta": 10,
    "alta": 8,
}
# Mentions of vulnerable road users or places where they gather.
VULNERABLE_STEMS = (
    "pieton", "copil", "copii", "elev", "scoal", "gradinit", "trecere", "biciclis", "bicicl", "carucio",
    "persoane in varsta", "persoana in varsta", "varstnic", "batran", "nevazator", "scaun cu rotile",
)
VULNERABLE_POINTS = 15
CORROBORATION_POINTS_EACH = 10
CORROBORATION_MAX_POINTS = 30
# Linear decay from RECENCY_MAX_POINTS (observed now) to 0 (observed RECENCY_ZERO_DAYS ago or earlier).
RECENCY_MAX_POINTS = 15
RECENCY_ZERO_DAYS = 30
GPS_PRECISE_M = 30.0
GPS_PRECISE_POINTS = 5
DESCRIPTION_MIN_CHARS = 60
DESCRIPTION_MIN_WORDS = 10
DESCRIPTION_POINTS = 5
IMPORTANCE_HIGH = 65  # "Ridicată"
IMPORTANCE_MEDIUM = 40  # "Medie"; below this "Scăzută"

# ---- Re-checks ----
# Open reports near a new report get a fresh (appended) check. Rejected/resolved/expired ones are left alone.
OPEN_STATUSES = ("submitted", "under_review", "validated", "referred")
