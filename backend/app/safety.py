"""112 gate. Active incidents, injuries or immediate danger are never stored or queued.

The keyword list is deliberately broad: a false positive costs the user one extra
step (rephrasing a past, non-injury report); a false negative could delay a 112 call.
"""

import re
import unicodedata

from .domain import EMERGENCY_CATEGORY

EMERGENCY_MESSAGE_EN = "Call 112. SafeFlow is not an emergency service and has not notified anyone."
EMERGENCY_MESSAGE_RO = "Sunați la 112. SafeFlow nu este un serviciu de urgență și nu a anunțat pe nimeni."

# Matched against lowercase text with diacritics removed, at word starts.
_KEYWORDS = [
    r"ranit", r"raniti", r"ranita", r"ranire", r"accidentat",
    r"sange", r"sanger",
    r"inconstient", r"lesinat", r"nu respira", r"nu (mai )?misca",
    r"victim", r"decedat", r"(?<!unghi )mort\b", r"morti\b",  # "unghi mort" = blind spot
    r"ambulant", r"smurd", r"urgenta",
    r"foc\b", r"incendiu", r"in flacari", r"arde\b", r"ard\b", r"fum dens",
    r"pericol imediat", r"pericol iminent", r"se intampla acum", r"acum are loc",
    r"blocat in masina", r"prins in masina", r"incarcerat",
    r"ajutor\b",
    r"injur", r"bleeding", r"unconscious", r"on fire", r"happening now", r"immediate danger",
]
_PATTERN = re.compile(r"\b(?:" + "|".join(_KEYWORDS) + r")")


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", stripped.lower())


def emergency_reasons(category: object, description: object, immediate_danger: object) -> list[str]:
    """Return why a submission must be stopped (empty list = allowed). Accepts raw, unvalidated input."""
    reasons = []
    if category == EMERGENCY_CATEGORY:
        reasons.append("category")
    if immediate_danger is True:
        reasons.append("immediate_danger")
    if isinstance(description, str) and _PATTERN.search(normalize(description)):
        reasons.append("text")
    return reasons


def emergency_response_body(reasons: list[str]) -> dict:
    # The submitted text is never echoed back or logged.
    return {
        "code": "call_112",
        "stored": False,
        "message": EMERGENCY_MESSAGE_RO,
        "message_en": EMERGENCY_MESSAGE_EN,
        "reasons": reasons,
    }
