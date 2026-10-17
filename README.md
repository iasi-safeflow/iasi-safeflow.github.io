# Iași SafeFlow (hackathon prototype)

A prototype for reporting and reviewing **non-emergency** road-safety observations in Iași. Residents submit a
location-based report; authorised reviewers triage it in a private queue.

> **Not an emergency service.** If an accident is happening now, someone is injured, or there is immediate danger,
> call **112**. SafeFlow does not notify 112, the police, or any authority. A report is an observation, not proof
> that a location is dangerous.

> **Demo only — test data.** The deployed demo contains test accounts and a seeded dataset labelled
> **"Date simulate" / `[SIMULAT]`**. It is not live city data and not official incident data. Do not enter real
> personal data.

- `backend/`: FastAPI + SQLite API (Python 3.12)
- `mobile/`: Expo (SDK 58) app for Android, plus a static **web build** for GitHub Pages
- `render.yaml`: Render Blueprint for the API (free plan)
- `.github/workflows/pages.yml`: builds the web app and deploys it to GitHub Pages

## Run locally (Windows PowerShell)

Backend:

```powershell
Copy-Item .env.example .env      # then fill in SAFEFLOW_SECRET_KEY and DEMO_REVIEWER_PASSWORD
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000
.\.venv\Scripts\python -m pytest
```

App (needs Node.js; if `npm` is not on PATH, run `$env:Path = "C:\Program Files\nodejs;" + $env:Path` first):

```powershell
cd mobile
npm install
npm run typecheck
npx expo start            # phone (development build / compatible Expo Go)
npm run web               # browser dev server, served under /iasi-safeflow
npm run build:web         # static export to mobile/dist (+ 404.html for GitHub Pages)
```

## Environment variables

Backend (in `.env` locally, set in the host dashboard in production; never commit real values):

| Variable | Purpose |
|---|---|
| `SAFEFLOW_SECRET_KEY` | Signs session tokens. If empty, a random per-process key is used (everyone is logged out on restart). On Render it is generated automatically. |
| `DEMO_REVIEWER_EMAIL` / `DEMO_REVIEWER_PASSWORD` | Demo reviewer account, created at startup if missing. There is no public reviewer sign-up. |
| `SAFEFLOW_ALLOWED_ORIGINS` | Comma-separated exact browser origins allowed by CORS, e.g. `https://<github-username>.github.io` (origin only, no path). Wildcards are rejected at startup. Empty = no CORS headers. |
| `SAFEFLOW_SEED_DEMO_DATA` | `1` (default) seeds 8 labelled simulated reports **only if the database has no reports**. `0` disables. |
| `SAFEFLOW_DB_PATH`, `SAFEFLOW_TOKEN_MAX_AGE`, `SAFEFLOW_REPORTS_PER_HOUR` | Optional. |

App (read at **build time**):

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL. For GitHub Pages it comes from the repository variable of the same name. It is embedded in the public bundle, so it must not be a secret. |

## Web version

The same Expo Router app runs in the browser. Platform-specific pieces use `.web.tsx` / `.web.ts` files:

| Feature | Phone | Web |
|---|---|---|
| Map | Leaflet inside `react-native-webview` (`LeafletMap.tsx`) | Leaflet bundled from npm (`LeafletMap.web.tsx`) |
| Session token | `expo-secure-store` (`tokenStore.ts`) | `localStorage` (`tokenStore.web.ts`) |
| Observed time | native date/time picker (`ObservedAtField.tsx`) | `<input type="datetime-local">` (`ObservedAtField.web.tsx`) |
| 112 gate and banner | shared, identical | shared, identical |

Web limitations: the session token in `localStorage` can be read by any script on the page (XSS exposure). This is
acceptable only for this test-account demo. Browser GPS works only over HTTPS (GitHub Pages is HTTPS). The
"Call 112" button opens a `tel:` link, which opens the phone dialer on Android Chrome and may do nothing on desktop.

GitHub Pages serves the site at `https://<github-username>.github.io/iasi-safeflow/`. The base path is set in
`mobile/app.json` (`experiments.baseUrl`). If the repository is renamed, update it there. `404.html` is a copy of
`index.html` so deep links load the app.

## Free-hosting caveats

- **Render's free plan sleeps** after a period of inactivity. The first request afterwards can take up to about a
  minute while it wakes.
- **There is no persistent disk on the free plan.** The SQLite file is **wiped on every restart, redeploy, or sleep
  cycle**. All submitted reports and registered accounts are lost. On startup the reviewer account and the simulated
  demo dataset are recreated.
- Users stay signed in only while `SAFEFLOW_SECRET_KEY` stays the same, and only until their account is wiped.
- Rate limits are per account and in-memory. This is not production abuse protection.

## Data sources and attribution

- Map tiles © OpenStreetMap contributors (ODbL), used under the
  [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/), light demo use only.
- [Leaflet](https://leafletjs.com/) (BSD-2-Clause).
- No Iași Open Data or Iași Digital feeds are integrated yet. All demo reports are simulated.

## Licensing

The project licence has not been decided yet. `mobile/LICENSE` is the MIT licence that came with the Expo template.
No code from the AGPL-3.0 Iași Digital repository is included.

## Limitations

Hackathon prototype. There is no AI scoring, duplicate detection, or authority integration in this build, and no
production-grade GDPR compliance. Referral statuses are set by a human reviewer and do **not** mean that an
authority received anything.
