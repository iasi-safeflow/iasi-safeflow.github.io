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

STATUSES = ("submitted", "under_review", "referred", "resolved", "rejected", "expired")

TRANSITIONS: dict[str, set[str]] = {
    "submitted": {"under_review", "rejected"},
    "under_review": {"referred", "resolved", "rejected", "expired"},
    "referred": {"under_review", "resolved"},
    "resolved": {"under_review"},
    "rejected": {"under_review"},
    "expired": {"under_review"},
}

# Statuses hidden from the public map.
PUBLIC_HIDDEN_STATUSES = ("rejected",)

# Iași municipality plus a margin (approximate bounding box).
IASI_BOUNDS = {"lat_min": 47.08, "lat_max": 47.24, "lon_min": 27.45, "lon_max": 27.72}

# ~110 m north-south, ~75 m east-west at Iași's latitude.
PUBLIC_COORD_DECIMALS = 3
