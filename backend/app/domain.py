"""Categories, statuses and allowed transitions (CLAUDE.md §4, §3). UI labels live in the mobile i18n file."""

CATEGORIES = (
    "intersectie_periculoasa",   # dangerous intersection / confusing traffic movement
    "trecere_pietoni_nesigura",  # unsafe pedestrian crossing / obstructed visibility
    "defect_carosabil",          # road surface defect
    "banda_blocata",             # blocked lane / obstruction / hazardous stopping
    "semnalizare_lipsa",         # damaged or missing sign or signal
    "iluminat_slab",             # poor lighting / low visibility
    "coada_recurenta",           # recurring queue reported as a safety concern
    "tipar_near_miss",           # near-miss pattern
    "incident_trecut",           # past incident: unverified, non-emergency
    "alta",                      # other / needs review
)

# Never stored: selecting it triggers the 112 gate.
EMERGENCY_CATEGORY = "incident_activ"

STATUSES = ("submitted", "under_review", "validated", "referred", "resolved", "rejected", "expired")

TRANSITIONS: dict[str, set[str]] = {
    "submitted": {"under_review", "validated", "rejected"},
    "under_review": {"validated", "rejected", "expired"},
    "validated": {"referred", "resolved", "rejected"},
    "referred": {"resolved", "validated"},
    "resolved": {"validated"},  # reopen
    "rejected": {"under_review"},  # reopen
    "expired": {"under_review"},
}

# A reviewer has looked at these and confirmed the observation (not an official incident record).
REVIEWER_VERIFIED_STATUSES = ("validated", "referred", "resolved")

# Required when rejecting. The reporter sees a neutral text for the reason, never the reviewer's private note.
REJECTION_REASONS = ("duplicate", "not_road_safety", "insufficient_info", "outside_area", "abusive_spam")

# Statuses hidden from the public map.
PUBLIC_HIDDEN_STATUSES = ("rejected",)

# A held report is kept off every public endpoint until a reviewer moves it to one of these statuses.
VISIBILITIES = ("public", "held")
PUBLISHING_STATUSES = ("under_review", "validated")


def verification(status: str) -> str:
    return "reviewer_verified" if status in REVIEWER_VERIFIED_STATUSES else "unverified"


# Iași municipality plus a margin (approximate bounding box).
IASI_BOUNDS = {"lat_min": 47.08, "lat_max": 47.24, "lon_min": 27.45, "lon_max": 27.72}

# Every simulated demo description starts with this, so the data can never pass for a real report.
SIMULATED_PREFIX = "[SIMULAT] "

# ~110 m north-south, ~75 m east-west at Iași's latitude.
PUBLIC_COORD_DECIMALS = 3
