"""Official referral dossier export (validated/referred/resolved reports only, never auto-sent)."""

from conftest import auth_header, valid_report


def test_dossier_requires_reviewer_and_validated_status(client, reporter_token, reviewer_token, submitted_report):
    pid = submitted_report["public_id"]

    # Reporters cannot access the dossier endpoint.
    assert client.get(f"/review/reports/{pid}/dossier", headers=auth_header(reporter_token)).status_code == 403

    # Submitted / under_review / rejected reports cannot generate a dossier (choice 1A).
    r_sub = client.get(f"/review/reports/{pid}/dossier", headers=auth_header(reviewer_token))
    assert r_sub.status_code == 409
    assert r_sub.json()["detail"]["code"] == "dossier_requires_validation"

    client.post(f"/review/reports/{pid}/status", json={"status": "under_review"}, headers=auth_header(reviewer_token))
    assert client.get(f"/review/reports/{pid}/dossier", headers=auth_header(reviewer_token)).status_code == 409


def test_dossier_includes_generic_recipient_disclaimer_context_and_escapes_html(client, reporter_token, reviewer_token):
    r1 = client.post(
        "/reports",
        json=valid_report(description="Marcaj sters langa <script>alert(1)</script> trecere scoala."),
        headers=auth_header(reporter_token),
    ).json()
    pid = r1["public_id"]
    # Second nearby report to form a cluster + 1 confirmation.
    client.post(
        "/reports",
        json=valid_report(lat=47.16245, lon=27.58880, description="Alta observatie la aceeasi trecere de pietoni."),
        headers=auth_header(reporter_token),
    )
    client.post(f"/public/reports/{pid}/confirm", headers={"X-Device-Id": "device-alpha-1234"})

    client.post(
        f"/review/reports/{pid}/status",
        json={"status": "validated", "notes": "Verificat la fata locului."},
        headers=auth_header(reviewer_token),
    )

    res = client.get(f"/review/reports/{pid}/dossier", headers=auth_header(reviewer_token))
    assert res.status_code == 200
    body = res.json()
    assert body["public_id"] == pid
    assert body["status"] == "validated"
    assert "Primăria Municipiului Iași" in body["recipient"]
    assert "netrimis automat" in body["disclaimer"]
    assert "Confirmări de la cetățeni (+1): 1" in body["text"]
    assert "CONTEXT ZONĂ" in body["text"]
    assert "Verificat la fata locului." in body["text"]
    assert "<script>alert(1)</script>" not in body["html"]
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in body["html"]
