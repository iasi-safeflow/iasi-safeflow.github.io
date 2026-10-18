# Review assistant ("Analiză automată")

The review assistant helps reviewers triage reports. It uses explainable rules and text similarity. There is no
machine-learning model, no external AI service, no API key, and no network call. Everything runs in the backend
(`backend/app/assistant/`) in pure Python.

## What it may and may not do

- It **only suggests**. It never changes a status, rejects, deletes, merges, or notifies anyone. Only a human
  reviewer decides.
- **One exception, set out in the spec:** a new report with any problem flag starts out **held**, meaning it is kept
  off the public map and every public endpoint. A reviewer publishes it by moving it to *În analiză* or *Validat*.
  If the assistant fails, the report is held too, rather than published unchecked. Later re-checks never change
  visibility.
- Every result is stored in its own row of `assistant_runs`, separate from the user's text, with the version
  (`asistent-reguli-v1`) and a timestamp. The table is append-only: database triggers block `UPDATE` and `DELETE`.
  A newer result is a new row.
- Everywhere in the UI it is labelled **"Sugestie automată – nu este o verificare"**.
- **Importance is a triage suggestion, not proof that a place is dangerous.** It is never called "risc" or
  "probabilitate de accident".
- Reporters and the public never see importance, flags, or duplicate suggestions.

## When it runs

| Trigger (`triggered_by`) | What is checked |
|---|---|
| `created` | Every new report, synchronously, before it is stored. Demo seed reports are checked the same way. |
| `nearby_report` | Every **open** report (*Primit*, *În analiză*, *Validat*, *Pregătit pentru sesizare*) within 150 m and 30 days of a new report. |
| `reviewer_decision` | After "Leagă ca duplicat", "Nu e duplicat" or "Anulează legătura", and after a status change into or out of *Respins*: the reports involved (unless rejected) and every open report within 150 m of them. A rejected report is then no longer offered as a duplicate anywhere. The UI also hides the link buttons when either report is rejected. |

## Duplicate suggestions (`similarity.py`)

1. **Candidates:** non-rejected reports observed within ±30 days of the report, at most 150 m away (haversine
   distance). Pairs a reviewer marked "Nu e duplicat" or already linked are not suggested again. A revoked link is
   suggested again.
2. **Text normalisation:** lowercase, diacritics removed, punctuation turned into spaces, spaces collapsed, and the
   `[SIMULAT]` prefix dropped.
3. **Text similarity:** character 3-grams (with a leading and trailing space), TF-IDF weights, cosine similarity.
   The IDF is computed over all non-rejected reports in the same ±30-day window, citywide:
   `idf = ln((1 + N) / (1 + df)) + 1`. Character n-grams tolerate typos and missing diacritics.
4. **Combined score (0–1):**

   ```
   score = 0.5 × text_similarity + 0.3 × (1 − distance_m / 150) + 0.2 × (1 if same category else 0)
   ```

5. **Levels:** ≥ 0.75 **"Probabil duplicat"**, ≥ 0.55 **"Posibil duplicat"**. Below 0.55 nothing is shown.
6. **Stored per candidate:** ID, score, level, distance in metres, text similarity, whether the category matches,
   and the reasons that matched. The reasons are `similar_text` (similarity ≥ 0.5), `very_close` (≤ 50 m) and
   `same_category`; they explain the score but do not change it.

Measured on sample texts: a copy with typos and no diacritics scores 0.87 text similarity. A reworded description
of the same pothole scores 0.44. Unrelated problems score 0.04–0.10.

### Reviewer decisions

| Button | Effect (each step is audit-logged on **both** reports) |
|---|---|
| **Leagă ca duplicat** | Adds a `report_relations` row `duplicate_confirmed`, from the **newer** report to the older one. Rejects the newer report with reason *Duplicat*. Counts as +1 corroboration for the older report. |
| **Nu e duplicat** | Adds a `not_duplicate` relation. The pair is not suggested again. No status change. |
| **Anulează legătura** | Adds a `duplicate_revoked` relation. If the newer report is still rejected as a duplicate, it is reopened to *În analiză*. |

`report_relations` is append-only. The newest row for a pair is the current decision, and nothing is deleted.

## Importance: Ridicată / Medie / Scăzută (`priority.py`)

The score (0–100) is the sum of the factors below, capped at 100. Every factor is shown under **"De ce?"** with its
points, including factors worth 0. All weights live in `backend/app/assistant/config.py`.

| Factor | Points |
|---|---|
| Category | intersecție periculoasă 35, trecere de pietoni nesigură 35, near-miss 30, semnalizare lipsă 28, bandă blocată 25, iluminat slab 22, defect carosabil 20, incident din trecut 20, coadă recurentă 10, altele 8 |
| Vulnerable road users mentioned | +15 if the description mentions pietoni, copii/copil, elevi, școală, grădiniță, trecere, bicicliști/bicicletă, cărucior, persoane în vârstă, vârstnici, bătrâni, nevăzători or scaun cu rotile (word starts, no diacritics needed) |
| Corroboration | +10 for each nearby report that reaches at least "Posibil duplicat", plus each confirmed duplicate link, up to +30 |
| Recency | `round(15 × max(0, 1 − days_since_observed / 30))`: 15 for a report observed today, 0 after 30 days |
| Location precision | +5 for GPS with accuracy ≤ 30 m |
| Description completeness | +5 for at least 60 characters and at least 10 words |

**Levels:** ≥ 65 **Ridicată**, 40–64 **Medie**, < 40 **Scăzută**.

Example: a fresh report about an unsafe crossing that mentions school children, with a 60+ character description,
scores 35 + 15 + 15 + 5 = **70** (Ridicată).

The stored score is a snapshot taken when the check ran. Recency is not recomputed when a page loads. The queue and
"De ce?" show the latest stored check and its time.

## Problem flags (`flags.py`)

Each flag has a code, a Romanian label, and evidence. The evidence is the matched text plus its character offsets in
the original description, which the reviewer UI highlights. **Any flag holds a new report.**

| Code | Label | Rule |
|---|---|---|
| `personal_data` | Date personale | Romanian licence plates with a real county code (`IS 12 ABC`, `IS-12-ABC`, `IS12ABC`, `B 123 ABC`). Phone numbers: 07…, 02…, 03…, +40 / 0040, with spaces, dots or dashes. E-mail addresses. |
| `abusive` | Limbaj abuziv | A small, configurable Romanian list of insults and vulgar words (`ABUSIVE_PATTERNS`) |
| `vague` | Descriere vagă | Fewer than 25 characters or fewer than 4 words after normalisation |
| `not_road_safety` | Posibil fără legătură rutieră | Category *Altele* and none of the road-related words in `ROAD_PATTERNS` |
| `possible_emergency` | **Posibilă urgență – verificați** | The 112 gate's own keyword list (imported from `app/safety.py`, unchanged) plus softer phrases (`SOFT_EMERGENCY_PATTERNS`: "a căzut", "lovit", "pe jos", "spital", "chiar acum", …). The UI shows **"Dacă este o urgență, sunați la 112"** next to it. |

The 112 gate still runs first and is unchanged. Reports that clearly describe an active emergency or an injury are
never stored. `possible_emergency` only catches softer wording that gets past the gate.

## Istoric AI (reviewer-only tab)

`GET /review/assistant-runs` lists every check, newest first, with:
- report ID, time, trigger and version
- importance and its reasons, flags and duplicates
- **what the reviewer did next**.

That last item is the first audit-log entry on the report after the check. Each check stores the newest audit ID at
the moment it ran, so the decision is found by ID rather than by timestamp. The possible values are:
- *Duplicat acceptat*
- *Marcat „Nu e duplicat”*
- *Legătură anulată*
- *Validat*
- *Respins* (with the reason)
- *Status schimbat*
- *Nicio decizie încă*

No manual input is needed. You can filter by flag, importance and decision. Nothing can be edited or deleted.

These decisions are a labelled dataset that could later be used to train or evaluate a model. That would need its
own validation on held-out data before any claim about accuracy.

## Limitations

- **Rules, not understanding.** The rules miss paraphrases with no shared wording. A reworded duplicate may score
  below 0.55. Similar wording about two genuinely different problems in the same spot and category can reach
  "Posibil duplicat".
- **Short texts** give unstable similarity scores.
- **Vagueness is judged by length only.** A long but unspecific description is not flagged.
- **Flags have false positives by design.** "Am lovit o groapă" triggers `possible_emergency`, and "nesimțiți" about
  drivers triggers `abusive`. The cost is a short review delay. Flags also have false negatives: unusual plate
  formats, numbers written in words, and insults that aren't on the list.
- **Licence-plate detection** accepts any three letters after a valid county code. It does not check that a plate
  actually exists.
- **The importance weights are judgement calls.** They have not been validated against crash data, which the project
  doesn't have. The score is not a crash prediction.
- **IDF depends on the time window,** so the same pair can score slightly differently as other reports come and go.
  Each stored result records what the assistant saw at that time.
- **Performance:** each check reads every non-rejected report in the ±30-day window. That is fine for a demo; a
  larger deployment would need a spatial index or a prefilter by bounding box.
