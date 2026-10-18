"""Problem flags. Any flag on a new report keeps it off the public map until a reviewer decides.

Each flag is {"code", "label", "evidence": [{"text", "start", "end", "kind"?}], "detail"}. Evidence offsets point
into the original description, so the reviewer UI can highlight exactly what matched.
"""

import re
import unicodedata

from ..domain import SIMULATED_PREFIX
from ..safety import _KEYWORDS as GATE_KEYWORDS  # the 112 gate's list, reused as-is
from . import config

LABELS = {
    "personal_data": "Date personale (număr de înmatriculare, telefon sau e-mail)",
    "abusive": "Limbaj abuziv sau jignitor",
    "vague": "Descriere vagă sau prea scurtă",
    "not_road_safety": "Posibil fără legătură cu siguranța rutieră",
    "possible_emergency": "Posibilă urgență – verificați",
}

# Romanian county codes; Bucharest ("B") plates may have 2 or 3 digits.
_COUNTIES = (
    "AB AR AG BC BH BN BT BV BR BZ CS CL CJ CT CV DB DJ GL GR GJ HR HD IL IS IF MM MH MS NT OT PH SM SJ SB SV TR TM "
    "TL VS VL VN"
).split()
_PLATE = re.compile(
    r"\b(?:B[\s-]?\d{2,3}|(?:" + "|".join(_COUNTIES) + r")[\s-]?\d{2})[\s-]?[A-Z]{3}\b", re.IGNORECASE
)
# Mobile (07…) and landline (02…/03…) numbers, national or +40/0040, with optional spaces, dots or dashes.
_PHONE = re.compile(r"(?<![\d+])(?:\+40|0040|0)[\s.-]?[237](?:[\s.-]?\d){8}(?!\d)")
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")


def _word_list(patterns) -> re.Pattern:
    return re.compile(r"\b(?:" + "|".join(patterns) + r")\w*")


_ABUSIVE = _word_list(config.ABUSIVE_PATTERNS)
_ROAD = _word_list(config.ROAD_PATTERNS)
_EMERGENCY = _word_list([*GATE_KEYWORDS, *config.SOFT_EMERGENCY_PATTERNS])


def normalize_with_offsets(text: str) -> tuple[str, list[int]]:
    """Lowercase, no diacritics, whitespace collapsed (like safety.normalize), plus each output char's source index."""
    out, offsets = [], []
    for i, ch in enumerate(text):
        for c in unicodedata.normalize("NFKD", ch):
            if unicodedata.combining(c):
                continue
            c = " " if c.isspace() else c.lower()
            if c == " " and out and out[-1] == " ":
                continue
            out.append(c)
            offsets.append(i)
    return "".join(out), offsets


def _normalized_matches(pattern: re.Pattern, text: str) -> list[dict]:
    norm, offsets = normalize_with_offsets(text)
    found = []
    for m in pattern.finditer(norm):
        start, end = offsets[m.start()], offsets[m.end() - 1] + 1
        found.append({"text": text[start:end], "start": start, "end": end})
    return found


def _raw_matches(pattern: re.Pattern, text: str, kind: str) -> list[dict]:
    return [{"text": m.group(), "start": m.start(), "end": m.end(), "kind": kind} for m in pattern.finditer(text)]


def _flag(code: str, evidence: list[dict], detail: str | None = None) -> dict:
    return {"code": code, "label": LABELS[code], "evidence": evidence, "detail": detail}


def detect_flags(report: dict) -> list[dict]:
    text = report["description"]
    if text.startswith(SIMULATED_PREFIX):
        text = " " * len(SIMULATED_PREFIX) + text[len(SIMULATED_PREFIX):]  # keep offsets aligned with the original
    flags = []

    personal = _raw_matches(_EMAIL, text, "email") + _raw_matches(_PHONE, text, "phone") + _raw_matches(_PLATE, text, "plate")
    if personal:
        flags.append(_flag("personal_data", sorted(personal, key=lambda e: e["start"])))

    abusive = _normalized_matches(_ABUSIVE, text)
    if abusive:
        flags.append(_flag("abusive", abusive))

    norm = normalize_with_offsets(text)[0].strip()
    words = len(re.findall(r"\w+", norm))
    if len(norm) < config.VAGUE_MIN_CHARS or words < config.VAGUE_MIN_WORDS:
        flags.append(_flag("vague", [], f"{len(norm)} caractere, {words} cuvinte"))

    if report["category"] == "alta" and not _ROAD.search(norm):
        flags.append(_flag("not_road_safety", [], "Categoria „Altele” și niciun termen rutier în descriere."))

    emergency = _normalized_matches(_EMERGENCY, text)
    if emergency:
        flags.append(_flag("possible_emergency", emergency, "Dacă este o urgență, sunați la 112."))

    return flags
