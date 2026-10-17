# Iași SafeFlow — product plan (draft for hackathon)

## One-sentence concept

A citizen-powered road-safety reporting and risk-triage platform for Iași that combines geolocated reports with verified open-data signals, highlights possible risk hotspots, and helps authorized reviewers route non-emergency issues to the right municipal/road authority.

## Problem statement

Road users can observe dangerous intersections, blocked sightlines, unsafe crossings, damaged road surfaces, missing signs, obstructions, or recurring near-miss situations, but information may be fragmented across informal channels. Authorities need structured, geolocated reports with evidence, timestamps, deduplication, and a transparent way to prioritize review.

This is a hypothesis to validate with residents and potential institutional users. Reports do not by themselves prove that a location causes accidents.

## Target users

### Public users
- Drivers, pedestrians, cyclists, passengers, and people with reduced mobility.
- Submit a hazard report, add a location and optional evidence, confirm a pre-existing report, and follow a status using a report ID.

### Reviewer users
- Municipal traffic/mobility staff, road administrators, or other authorized non-emergency reviewers.
- Review and validate reports, merge duplicates, set status, prioritize investigation, and route issues through an approved channel.

### Emergency services
- Not an operational user of the hackathon MVP unless a formal integration is supplied by an authorized partner.
- When an active emergency, injury, or immediate danger is reported, clearly instruct the user to call 112. Do not imply that the app has dispatched emergency services.

## What the app helps with

1. Collect consistent, geolocated safety observations from residents.
2. Reduce noise by suggesting duplicate or corroborating reports.
3. Prioritize review based on severity, recency, evidence, corroboration, and available contextual data.
4. Visualize clusters of reports and potential risk zones on a map.
5. Give reviewers a queue and workflow to validate, refer, or resolve items.
6. Make it possible to measure response times and recurring issue patterns after a real partner workflow is established.

## Proposed reporting categories

- dangerous intersection or confusing traffic movement
- unsafe pedestrian crossing / obstructed visibility
- road surface defect
- blocked lane / obstruction / hazardous stopping
- damaged or missing traffic sign or signal
- poor lighting or low visibility
- recurring traffic queue reported as a safety concern
- near-miss pattern
- other / needs review

## Product workflow

1. User opens the map, selects a location, chooses a category, writes a short description, and optionally attaches a photo.
2. Backend validates coordinates, fields, upload size/type, and timestamp; assigns an ID and status `submitted`.
3. AI/rules suggest category and related reports. Original user input remains available and unchanged.
4. Transparent scoring provides a **review priority**, not a verified danger verdict.
5. Public map shows only privacy-safe fields; reviewer dashboard shows detailed queue and evidence.
6. Human reviewer validates, rejects, links as duplicate/corroborating, marks for referral, or resolves.
7. A real authority handoff remains disabled until the target authority and integration process are confirmed. Hackathon demo uses a mock referral or export labelled as such.

## Role of AI

### MVP
- Suggest category from report text.
- Suggest possible duplicates based on location, time, category, and text similarity.
- Calculate transparent review priority from configurable factors.
- Summarize evidence and unknowns in Romanian for a reviewer.
- Cluster reports by road segment/grid and time period to show potential hotspots.

### Later, after data validation
- Compare report clusters with official accident history, if legally reusable data becomes available.
- Estimate risk patterns only after collecting enough representative labelled data and evaluating model quality.
- Detect changes over time and support evaluation of remediation impact.

AI should not autonomously declare a cause of crashes, notify emergency dispatch, or make final decisions about public safety.

## Candidate data sources to investigate

1. **Iași Open Data Portal:** https://iasi.oras.digital/ — data catalogue and resources. API docs: https://iasi.oras.digital/api-docs/
2. **Iași Digital GitHub repository:** https://github.com/innovator-dev/iasi-digital — README lists public transport, public parking, air quality, waste management, and traffic data. Repository licence is AGPL-3.0; check obligations before reusing code.
3. **Community-generated reports:** the primary new data source; timestamp and coordinates are essential.
4. **Official accident records / road-infrastructure data:** investigate availability, licence, update rate, coverage, and access before basing risk claims on them.
5. Other city traffic/public-transport feeds only after verifying actual access and terms.

For every source, record owner, URL, schema, update frequency, geographic coverage, licence, last successful retrieval, and failure/staleness behaviour.

## Safety, privacy, and trust requirements

- A risk report is an observation, not proof of causality.
- Show the distinction between public report, external data, AI suggestion, and human-verified status.
- Keep reporter identity private. Make contact details optional where possible.
- Strip image metadata; moderate images and avoid publishing faces, number plates, or identifying details.
- Add rate limiting, spam controls, upload validation, and abuse reporting.
- Keep an audit trail of reviewer actions.
- Provide a visible emergency notice for immediate danger: call 112; the app is not an emergency channel.
- Do not connect to emergency systems or claim that authorities have been notified without explicit authorization and confirmed integration.

## Suggested technical architecture

- Frontend: React + Vite + Leaflet
- Backend: Python + FastAPI
- Database: SQLite for hackathon, with a path to PostgreSQL if deployed
- Validation: Pydantic
- Tests: pytest
- Optional geospatial tooling: Shapely / GeoJSON when needed

Start as a modular monolith. Keep separate modules for reports, source adapters, scoring, duplicate suggestions, moderation, and authority handoff.

## MVP screen list

1. Public hazard map and filters.
2. Report submission form.
3. Report detail/status page.
4. Private reviewer dashboard and triage queue.
5. Data-source health/status view.

## Success measures for the demo

- Report submission works end-to-end.
- Every report has a location, timestamp, category, and status.
- Reviewer can inspect evidence and change status.
- At least one duplicate/corroboration example and one high-priority example can be demonstrated with clearly labelled fixtures if real reports are unavailable.
- Dashboard distinguishes live data from historical/simulated data.
- Scoring is explainable and tested.
- No unverified claims of emergency dispatch or risk-prediction accuracy.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Open data does not contain accident records or sufficient traffic detail | Treat these as unverified; use community reports and label what is missing. |
| Malicious or inaccurate reports | Rate limits, corroboration, moderation, audit trail, human validation. |
| Duplicate reports overwhelm reviewers | Suggest duplicates and allow reviewers to link them without deleting evidence. |
| False implication that emergency services are notified | Clear 112 messaging and no emergency integration in MVP. |
| Personal data or revealing photos | Data minimization, private reporter details, EXIF removal, redaction/moderation. |
| AI score is mistaken for objective risk | Show factors and evidence; call it review priority, not crash probability. |
| Source/API unavailable during demo | Adapter fallback and clearly labelled fixtures; never label simulated data live. |

## Questions to resolve before implementation

1. Which risk categories are in scope for v1: infrastructure hazards, dangerous traffic patterns/near misses, active incidents, or a combination?
2. Which organization is the first intended recipient: Primăria, road administrator, Poliția Locală, IPJ, or another body? Who would own review and closure?
3. By “send directly,” do you mean a reviewer dashboard, a downloadable/email referral, an existing official portal, or a formal API integration? Which has actually been authorized?
4. Should reports be anonymous, account-based, or anonymous with optional contact details?
5. Can users upload photos/video, and should images be private to reviewers or public after moderation?
6. Which data from Iași Digital have you confirmed works: traffic layer, public transport, parking, or another dataset? Are you reusing its code or only consuming its data/API?
7. Does the hackathon MVP need live inputs or is clearly labelled historical/demo data acceptable for parts that lack an accessible feed?
8. Do you want AI to focus first on text classification, duplicate detection, hotspot clustering, or explanation/triage scoring?

## Recommended first milestone

Inspect the existing workspace and verify Iași Open Data/Iași Digital access. Then build the smallest end-to-end slice:

**user submits a geolocated hazard → backend stores it → map shows a privacy-safe marker → reviewer queue displays it → reviewer changes status → action is audit-logged.**

Only after this is stable should AI classification, deduplication, hotspot analysis, and external-data adapters be added.
