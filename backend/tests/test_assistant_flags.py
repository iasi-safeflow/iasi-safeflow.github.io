"""Problem flags: positives and negatives for each flag, evidence offsets, and holding flagged reports."""

import pytest

from app.assistant.flags import LABELS, detect_flags
from app.safety import emergency_reasons
from conftest import auth_header, valid_report

CLEAN = "Groapă mare pe banda din dreapta, lângă stația de tramvai."


def flags(description, category="defect_carosabil"):
    return {f["code"]: f for f in detect_flags({"description": description, "category": category})}


def evidence(description, code, category="defect_carosabil"):
    found = flags(description, category)[code]["evidence"]
    for e in found:  # offsets always point at the original text, diacritics included
        assert description[e["start"] : e["end"]] == e["text"]
    return [e["text"] for e in found]


def test_clean_report_has_no_flags():
    assert flags(CLEAN) == {}


def test_every_flag_has_a_romanian_label():
    assert LABELS["possible_emergency"] == "Posibilă urgență – verificați"
    assert set(LABELS) == {"personal_data", "abusive", "vague", "not_road_safety", "possible_emergency"}


# ---- personal_data ----

@pytest.mark.parametrize(
    "description, expected",
    [
        ("Mașina IS 12 ABC parchează zilnic pe trecerea de pietoni.", ["IS 12 ABC"]),
        ("Un autoturism B 123 ABC oprește mereu în intersecție.", ["B 123 ABC"]),
        ("Duba is-07-xyz blochează banda de autobuz dimineața.", ["is-07-xyz"]),
        ("Mașina IS12ABC stă pe trotuar lângă școală în fiecare zi.", ["IS12ABC"]),
        ("Pentru detalii sunați-mă la 0745 123 456, groapa e adâncă.", ["0745 123 456"]),
        ("Pentru detalii: +40 745-123-456, semaforul nu merge.", ["+40 745-123-456"]),
        ("Am anunțat și la 0232 123 456, dar groapa e tot acolo.", ["0232 123 456"]),
        ("Scrieți-mi la ana.pop@example.com despre trecerea de pietoni.", ["ana.pop@example.com"]),
    ],
)
def test_personal_data_positives(description, expected):
    assert evidence(description, "personal_data") == expected


@pytest.mark.parametrize(
    "description",
    [
        "Groapă de 12 cm adâncime pe strada Lăpușneanu nr. 12, în dreptul blocului.",
        "Indicatorul B 12 lipsește de la intersecție de o săptămână.",
        "Autobuzul 28 trece la 10 minute, stația 12 e aglomerată la 07:45.",
        "Limita de 30 km/h nu e respectată, am numărat 15 mașini în 2 minute.",
    ],
)
def test_personal_data_negatives(description):
    assert "personal_data" not in flags(description)


# ---- abusive ----

def test_abusive_positive_keeps_diacritics_in_evidence():
    assert evidence("Șoferii idioți parchează pe trecere în fiecare dimineață.", "abusive") == ["idioți"]
    assert evidence("Boule, nu mai parca pe trotuar lângă școală!", "abusive") == ["Boule"]


@pytest.mark.parametrize(
    "description",
    [CLEAN, "Bulevardul are marcaje șterse și boutique-ul are mașini parcate în fața ușii.",
     "Limbaj futurist pe un panou care distrage atenția șoferilor la semafor."],
)
def test_abusive_negatives(description):
    assert "abusive" not in flags(description)


# ---- vague ----

@pytest.mark.parametrize(
    "description",
    ["E periculos aici.", "Groapă mare, atenție!", "Intersecțiile periculoase acolo"],  # last: 31 chars, 3 words
)
def test_vague_positives(description):
    assert "vague" in flags(description)


def test_vague_negative():
    assert "vague" not in flags(CLEAN)


# ---- not_road_safety ----

def test_not_road_safety_needs_category_other_and_no_road_words():
    noise = "Vecinii fac gălăgie noaptea târziu în bloc, nu se poate dormi."
    assert "not_road_safety" in flags(noise, "alta")
    assert "not_road_safety" not in flags(noise, "iluminat_slab")  # a specific category is trusted
    assert "not_road_safety" not in flags("Mașini parcate pe trotuar care blochează trecerea.", "alta")


# ---- possible_emergency ----

@pytest.mark.parametrize(
    "description, expected",
    [
        ("Un bătrân a căzut pe trotuar lângă trecerea de pietoni.", ["a căzut"]),
        ("Am lovit o groapă adâncă pe banda din dreapta, aproape de pod.", ["lovit"]),  # harmless: hence "verificați"
        ("Un pieton rănit ieri la trecere, problema e semaforul.", ["rănit"]),  # 112 gate keyword reused
    ],
)
def test_possible_emergency_positives(description, expected):
    assert evidence(description, "possible_emergency") == expected
    assert flags(description)["possible_emergency"]["detail"] == "Dacă este o urgență, sunați la 112."


@pytest.mark.parametrize("description", [CLEAN, "Unghi mort la ieșirea din parcare, mașinile nu se văd."])
def test_possible_emergency_negatives(description):
    assert "possible_emergency" not in flags(description)


def test_simulated_prefix_keeps_offsets():
    description = "[SIMULAT] Mașina IS 12 ABC stă pe trecere (exemplu de test)."
    assert evidence(description, "personal_data") == ["IS 12 ABC"]


# ---- through the API ----

def test_flagged_report_is_held_and_reviewer_sees_evidence(client, reporter_token, reviewer_token):
    description = "Mașina IS 12 ABC parchează zilnic pe trecerea de pietoni."
    r = client.post("/reports", json=valid_report(description=description), headers=auth_header(reporter_token))
    assert r.status_code == 201 and r.json()["public_visibility"] == "held"
    pid = r.json()["public_id"]
    assert client.get("/public/reports").json() == []
    assert client.get(f"/public/reports/{pid}").status_code == 404

    analysis = client.get(f"/review/reports/{pid}/assistant", headers=auth_header(reviewer_token)).json()
    [flag] = analysis["latest"]["flags"]
    assert flag["code"] == "personal_data" and flag["evidence"][0]["text"] == "IS 12 ABC"
    queue = client.get("/review/reports?visibility=held", headers=auth_header(reviewer_token)).json()
    assert [(q["public_id"], q["assistant"]["flags"]) for q in queue] == [(pid, ["personal_data"])]


def test_soft_emergency_phrase_is_stored_but_held_not_blocked(client, reporter_token):
    description = "Un bătrân a căzut ieri pe trotuarul denivelat de lângă trecere."
    assert emergency_reasons("defect_carosabil", description, False) == []  # the 112 gate lets it through
    r = client.post("/reports", json=valid_report(description=description), headers=auth_header(reporter_token))
    assert r.status_code == 201 and r.json()["public_visibility"] == "held"


def test_report_without_flags_is_public(client, submitted_report):
    assert submitted_report["public_visibility"] == "public"
