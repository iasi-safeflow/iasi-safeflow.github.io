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

# ---- Problem flags (each one holds a new report until a reviewer decides) ----
VAGUE_MIN_CHARS = 25
VAGUE_MIN_WORDS = 4
# The lists below are regular expressions matched on normalised text at a word start. A fragment that ends in \b
# must be the whole word; any other fragment is a stem and may continue (e.g. "groap" matches "groapa", "gropi" not).
# Small, configurable list of insults and vulgar words.
ABUSIVE_PATTERNS = (
    r"idiot", r"cretin", r"tampit", r"imbecil", r"dobitoc", r"nesimtit", r"jegos", r"handicapat", r"retardat",
    r"bou\b", r"boule\b", r"prost\b", r"proasta\b", r"prostule\b", r"muie\b", r"pula\b", r"pizd", r"fut\b",
    r"futu\b", r"futut", r"cacat", r"labagi",
)
# Without any of these, a report in category "alta" is probably not about road safety.
ROAD_PATTERNS = (
    r"strad", r"drum", r"sosea", r"bulevard", r"bd\b", r"intersect", r"giratori", r"semafor", r"trecer", r"pieton",
    r"trotuar", r"carosab", r"banda", r"benzi", r"masin", r"auto", r"vehicul", r"sofer", r"bicicl", r"pista",
    r"tramvai", r"autobuz", r"troleibuz", r"statie", r"parcar", r"parcat", r"indicator", r"semn", r"marcaj",
    r"groap", r"gropi", r"iluminat", r"felinar", r"stalp", r"vizibil", r"viteza", r"accident", r"depasi", r"viraj",
    r"curba", r"pod\b", r"pasaj", r"rampa", r"capac", r"asfalt", r"trafic", r"circula", r"coada", r"ambuteiaj",
    r"fran", r"claxon", r"traversa", r"sens\b", r"near miss", r"rutier",
)
# Softer phrases that may describe an injury or an ongoing incident. They extend the 112 gate's own list
# (app/safety.py, unchanged), which stops the clearest cases before anything is stored; these only flag.
# They also match harmless text ("am lovit o groapă"), hence the label "Posibilă urgență – verificați".
SOFT_EMERGENCY_PATTERNS = (
    r"a cazut", r"cazut", r"cazuta", r"lovit", r"lovita", r"pe jos\b", r"nu se (?:mai )?ridica", r"nu raspunde",
    r"durer", r"doare\b", r"spital", r"chiar acum", r"in acest moment", r"in momentul de fata", r"tocmai s-a",
    r"rasturnat",
)
