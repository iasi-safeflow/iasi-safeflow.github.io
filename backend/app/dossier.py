"""Formal Romanian referral dossier builder for validated/referred/resolved reports.

Generates a ready-to-file text and printable HTML dossier for municipal authorities, always clearly labelled
as NOT automatically sent. User-submitted text is HTML-escaped in the printable view.
"""

import html
from datetime import datetime

DOSSIER_STATUSES = ("validated", "referred", "resolved")
DEFAULT_RECIPIENT = "Primăria Municipiului Iași / Poliția Locală Iași / Administratorul drumului"
DOSSIER_DISCLAIMER = (
    "Document pregătit pentru sesizare (netrimis automat). "
    "Iași SafeFlow nu a transmis acest raport niciunei autorități."
)

CATEGORY_LABELS_RO = {
    "intersectie_periculoasa": "Intersecție periculoasă / circulație confuză",
    "trecere_pietoni_nesigura": "Trecere de pietoni nesigură / vizibilitate obstrucționată",
    "defect_carosabil": "Defect al carosabilului (groapă, denivelare)",
    "banda_blocata": "Bandă blocată / obstacol / oprire periculoasă",
    "semnalizare_lipsa": "Indicator sau semafor deteriorat ori lipsă",
    "iluminat_slab": "Iluminat slab / vizibilitate redusă",
    "coada_recurenta": "Coadă recurentă semnalată ca problemă de siguranță",
    "tipar_near_miss": "Situații repetate evitate la limită (near-miss)",
    "incident_trecut": "Incident din trecut (fără răniți, neverificat)",
    "alta": "Altele / necesită analiză",
}

STATUS_LABELS_RO = {
    "submitted": "Primit",
    "under_review": "În analiză",
    "validated": "Validat",
    "referred": "Pregătit pentru sesizare (netrimis)",
    "resolved": "Rezolvat (conform recenzentului)",
    "rejected": "Respins",
    "expired": "Expirat",
}

IMPORTANCE_LABELS_RO = {"high": "Ridicată", "medium": "Medie", "low": "Scăzută"}


def _format_audit_line(entry: dict) -> str:
    when = entry["created_at"][:16].replace("T", " ")
    if entry["action"] == "status_change":
        frm = STATUS_LABELS_RO.get(entry["from_status"] or "", entry["from_status"] or "?")
        to = STATUS_LABELS_RO.get(entry["to_status"] or "", entry["to_status"] or "?")
        line = f"- {when} · {entry['reviewer_email']}: {frm} → {to}"
    else:
        rel = f" ({entry['related_report_id']})" if entry.get("related_report_id") else ""
        line = f"- {when} · {entry['reviewer_email']}: {entry['action']}{rel}"
    if entry.get("notes"):
        line += f" — Notă: „{entry['notes']}”"
    return line


def build_dossier(
    report: dict,
    *,
    street: str | None,
    confirmations_count: int,
    duplicate_ids: list[str],
    cluster: dict | None,
    importance: dict | None,
    audit: list[dict],
    generated_at: datetime,
) -> dict:
    public_id = report["public_id"]
    cat_label = CATEGORY_LABELS_RO.get(report["category"], report["category"])
    status_label = STATUS_LABELS_RO.get(report["status"], report["status"])
    gen_str = generated_at.strftime("%d.%m.%Y %H:%M UTC")
    obs_str = report["observed_at"][:16].replace("T", " ")
    created_str = report["created_at"][:16].replace("T", " ")
    coords = f"{report['lat']:.5f}, {report['lon']:.5f}"
    if report.get("gps_accuracy_m"):
        coords += f" (±{round(report['gps_accuracy_m'])} m)"
    loc_line = f"{street} · {coords}" if street else coords

    lines = [
        f"DOSAR DE SESIZARE SIGURANȚĂ RUTIERĂ — {public_id}",
        f"Generat la: {gen_str}",
        f"Către: {DEFAULT_RECIPIENT}",
        "",
        f"ATENȚIE: {DOSSIER_DISCLAIMER}",
        "",
        "1. DATE RAPORT",
        f"- ID raport: {public_id}",
        f"- Status curent: {status_label}",
        f"- Categorie: {cat_label}",
        f"- Locație: {loc_line}",
        f"- Observat la: {obs_str}",
        f"- Înregistrat la: {created_str}",
        f"- Confirmări de la cetățeni (+1): {confirmations_count}",
    ]
    if duplicate_ids:
        lines.append(f"- Duplicate legate: {', '.join(duplicate_ids)}")
    if report.get("is_simulated"):
        lines.append("- Sursă: Date simulate (demonstrație)")

    lines.extend(["", "2. DESCRIEREA OBSERVAȚIEI", report["description"]])

    if cluster is not None:
        lines.extend([
            "",
            "3. CONTEXT ZONĂ (ULTIMELE 30 DE ZILE)",
            (
                f"- Zona face parte dintr-un tipar cu {cluster['reports_count']} rapoarte și "
                f"{cluster['confirmations_count']} confirmări (total {cluster['total_observations']} observații)."
            ),
            f"- Rapoarte asociate: {', '.join(cluster['report_ids'])}",
            f"- Precizare: {cluster['disclaimer']}",
        ])

    if importance is not None:
        imp_label = IMPORTANCE_LABELS_RO.get(importance["level"], importance["level"])
        lines.extend([
            "",
            "4. PRIORITATE SUGERATĂ (ANALIZĂ AUTOMATĂ – NU ESTE O VERIFICARE)",
            f"- Nivel: {imp_label} ({importance['score']}/100)",
        ])

    lines.extend(["", "5. JURNAL DE RECENZIE"])
    if audit:
        lines.extend(_format_audit_line(e) for e in audit)
    else:
        lines.append("- Fără înregistrări.")

    lines.extend(["", "---", DOSSIER_DISCLAIMER])
    text = "\n".join(lines)

    # Printable HTML: escape every dynamic field so untrusted report text can never inject markup.
    e = html.escape
    audit_html = "".join(f"<li>{e(_format_audit_line(a).lstrip('- '))}</li>" for a in audit) or "<li>Fără înregistrări.</li>"
    cluster_html = ""
    if cluster is not None:
        cluster_html = (
            "<h2>3. Context zonă (ultimele 30 de zile)</h2>"
            f"<p>Zonă cu <strong>{cluster['reports_count']}</strong> rapoarte și "
            f"<strong>{cluster['confirmations_count']}</strong> confirmări "
            f"(total {cluster['total_observations']} observații): {e(', '.join(cluster['report_ids']))}.</p>"
            f"<p class='muted'>{e(cluster['disclaimer'])}</p>"
        )
    imp_html = ""
    if importance is not None:
        imp_label = IMPORTANCE_LABELS_RO.get(importance["level"], importance["level"])
        imp_html = (
            "<h2>4. Prioritate sugerată (Analiză automată)</h2>"
            f"<p><strong>{e(imp_label)}</strong> ({int(importance['score'])}/100) — sugestie de prioritizare, nu o verificare.</p>"
        )

    doc_html = f"""<!doctype html>
<html lang="ro"><head><meta charset="utf-8">
<title>Dosar sesizare {e(public_id)} — Iași SafeFlow</title>
<style>
body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:28px auto;padding:0 18px;color:#1f1b2e;line-height:1.5}}
.notice{{background:#fde8e7;color:#8a1c14;border:1px solid #c62828;border-radius:10px;padding:12px 14px;font-weight:700;margin:14px 0}}
h1{{font-size:20px;margin:0 0 6px}} h2{{font-size:15px;margin:20px 0 6px;border-bottom:1px solid #e4e0f0;padding-bottom:4px}}
.muted{{color:#5d5672;font-size:13px}} table{{width:100%;border-collapse:collapse}} td{{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top}}
td.k{{width:210px;font-weight:600;color:#4a4360}} .desc{{background:#f7f5fc;border:1px solid #e4e0f0;border-radius:10px;padding:12px;white-space:pre-wrap}}
@media print{{.no-print{{display:none}}}}
</style></head><body>
<div class="no-print" style="margin-bottom:14px"><button onclick="window.print()" style="padding:8px 14px;font-weight:700;cursor:pointer">Tipărește / Salvează PDF</button></div>
<h1>Dosar de sesizare siguranță rutieră — {e(public_id)}</h1>
<div class="muted">Generat la {e(gen_str)} · Către: {e(DEFAULT_RECIPIENT)}</div>
<div class="notice">{e(DOSSIER_DISCLAIMER)}</div>
<h2>1. Date raport</h2>
<table>
<tr><td class="k">ID raport</td><td>{e(public_id)}</td></tr>
<tr><td class="k">Status curent</td><td>{e(status_label)}</td></tr>
<tr><td class="k">Categorie</td><td>{e(cat_label)}</td></tr>
<tr><td class="k">Locație</td><td>{e(loc_line)}</td></tr>
<tr><td class="k">Observat / Înregistrat</td><td>{e(obs_str)} / {e(created_str)}</td></tr>
<tr><td class="k">Confirmări cetățeni (+1)</td><td>{confirmations_count}</td></tr>
{f'<tr><td class="k">Duplicate legate</td><td>{e(", ".join(duplicate_ids))}</td></tr>' if duplicate_ids else ''}
{f'<tr><td class="k">Sursă</td><td>Date simulate (demonstrație)</td></tr>' if report.get('is_simulated') else ''}
</table>
<h2>2. Descrierea observației</h2>
<div class="desc">{e(report['description'])}</div>
{cluster_html}
{imp_html}
<h2>5. Jurnal de recenzie</h2>
<ul>{audit_html}</ul>
<p class="muted">{e(DOSSIER_DISCLAIMER)}</p>
</body></html>"""

    return {
        "public_id": public_id,
        "status": report["status"],
        "status_label": status_label,
        "recipient": DEFAULT_RECIPIENT,
        "generated_at": generated_at.isoformat(timespec="seconds"),
        "disclaimer": DOSSIER_DISCLAIMER,
        "text": text,
        "html": doc_html,
    }
