import re
import sqlite3
from pathlib import Path

import pytest

from app.safety import EMERGENCY_MESSAGE_EN, EMERGENCY_MESSAGE_RO, emergency_reasons
from conftest import auth_header, valid_report

REPO_ROOT = Path(__file__).resolve().parents[2]


def _report_count(settings) -> int:
    return sqlite3.connect(settings.database_path).execute("SELECT COUNT(*) FROM reports").fetchone()[0]


def _assert_112(r):
    assert r.status_code == 400
    d = r.json()["detail"]
    assert d["code"] == "call_112"
    assert d["stored"] is False
    assert d["message"] == EMERGENCY_MESSAGE_RO
    assert d["message_en"] == "Call 112. SafeFlow is not an emergency service and has not notified anyone."


def test_active_incident_category_is_blocked_and_not_stored(client, reporter_token, settings):
    r = client.post("/reports", json=valid_report(category="incident_activ"), headers=auth_header(reporter_token))
    _assert_112(r)
    assert _report_count(settings) == 0


def test_immediate_danger_yes_is_blocked(client, reporter_token, settings):
    r = client.post("/reports", json=valid_report(immediate_danger=True), headers=auth_header(reporter_token))
    _assert_112(r)
    assert _report_count(settings) == 0


@pytest.mark.parametrize(
    "text",
    [
        "Un pieton a fost rănit la trecere.",
        "Un pieton a fost ranit la trecere.",  # no diacritics
        "Șoferul e INCONȘTIENT în mașină.",
        "Curge sânge, vă rog veniți.",
        "Mașina e în flăcări pe pod.",
        "Accidentul se întâmplă acum în intersecție.",
        "Cineva e blocat în mașină după impact.",
        "Someone is injured near the bridge.",
    ],
)
def test_injury_or_danger_text_is_blocked(client, reporter_token, settings, text):
    r = client.post("/reports", json=valid_report(description=text), headers=auth_header(reporter_token))
    _assert_112(r)
    assert _report_count(settings) == 0


def test_gate_runs_before_login_and_validation(client, settings):
    # Unauthenticated, invalid location, too-short text: the 112 message still wins.
    r = client.post("/reports", json={"category": "incident_activ", "description": "rănit", "lat": 0})
    _assert_112(r)
    assert _report_count(settings) == 0


def test_response_does_not_echo_submitted_text(client, reporter_token):
    secret_text = "Pietonul Popescu Ion a fost rănit grav, numărul IS-99-XYZ."
    r = client.post("/reports", json=valid_report(description=secret_text), headers=auth_header(reporter_token))
    assert "Popescu" not in r.text and "IS-99-XYZ" not in r.text


@pytest.mark.parametrize(
    "text",
    [
        "Groapă adâncă pe Bulevardul Independenței, ocolită de șoferi.",
        "Unghi mort la ieșirea din parcare, nu se vede tramvaiul.",
        "Semaforul pentru pietoni nu funcționează de o săptămână.",
    ],
)
def test_ordinary_hazard_text_is_not_blocked(text):
    assert emergency_reasons("defect_carosabil", text, False) == []


def test_message_never_claims_notification():
    assert "112" in EMERGENCY_MESSAGE_RO and "nu este un serviciu de urgență" in EMERGENCY_MESSAGE_RO
    assert "nu a anunțat pe nimeni" in EMERGENCY_MESSAGE_RO
    assert "has not notified anyone" in EMERGENCY_MESSAGE_EN


# Phrases that would claim or imply emergency services / authorities were contacted.
FORBIDDEN = [
    r"emergency (services )?(have been |were )?notified",
    r"authorit(y|ies) (has |have )?received",
    r"verified by police",
    r"\bwe (have )?(notified|alerted|contacted)",
    r"am (anunțat|notificat|alertat|contactat)",
    r"(a|au) fost (anunțat|notificat|alertat|sesizat)[ăei]*",
    r"(poliția|ambulanța|pompierii|112|autoritățile|primăria) (a|au) (fost )?(anunțat|notificat|primit|alertat)",
    r"verificat de poliție",
    r"trimis (către|la) (112|poliție|autorități|primărie)",
]


def _source_files():
    for base, patterns in ((REPO_ROOT / "backend" / "app", ("*.py",)), (REPO_ROOT / "mobile", ("*.ts", "*.tsx"))):
        if not base.exists():
            continue
        for pat in patterns:
            for p in base.rglob(pat):
                if "node_modules" not in p.parts and ".expo" not in p.parts:
                    yield p


def test_no_source_file_claims_anyone_was_notified():
    offenders = []
    for path in _source_files():
        text = path.read_text(encoding="utf-8").lower()
        for pattern in FORBIDDEN:
            for m in re.finditer(pattern, text):
                # Allowed only in negated form, e.g. "nu a anunțat", "has not notified".
                before = text[max(0, m.start() - 12):m.start()]
                if "nu " in before or "not " in before or "n't " in before:
                    continue
                offenders.append(f"{path.relative_to(REPO_ROOT)}: {m.group(0)!r}")
    assert offenders == []
