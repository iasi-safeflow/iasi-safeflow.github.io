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
npm run web               # browser dev server
npm run build:web         # static export to mobile/dist (+ 404.html for GitHub Pages)
```

## Environment variables

Backend (in `.env` locally, set in the host dashboard in production; never commit real values):

| Variable | Purpose |
|---|---|
| `SAFEFLOW_SECRET_KEY` | Signs session tokens. If empty, a random per-process key is used (everyone is logged out on restart). On Render it is generated automatically. |
| `DEMO_REVIEWER_EMAIL` / `DEMO_REVIEWER_PASSWORD` | Demo reviewer account, created at startup if missing. There is no public reviewer sign-up. |
| `SAFEFLOW_ALLOWED_ORIGINS` | Comma-separated exact browser origins allowed by CORS, e.g. `https://iasi-safeflow.github.io` (origin only, no path). Wildcards are rejected at startup. Empty = no CORS headers. |
| `SAFEFLOW_SEED_DEMO_DATA` | `1` (default) seeds 12 labelled simulated reports **only if the database has no reports**: a duplicate pair, a held report with a deliberately invalid licence plate, a high-importance school crossing and a held vague report. `0` disables. |
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
| Maps inside a scrolling screen (report form, report details: `cooperativeGestures`) | one finger scrolls the page, two fingers move and zoom the map while the page stays still; an idle watermark says so | same rules for touch (watermark only on touch-first devices); a mouse drags the map and the wheel zooms it |
| Session token | `expo-secure-store` (`tokenStore.ts`) | `localStorage` (`tokenStore.web.ts`) |
| Observed time | native date/time picker (`ObservedAtField.tsx`) | `<input type="datetime-local">` (`ObservedAtField.web.tsx`) |
| 112 gate and banner | shared, identical | shared, identical |

Web limitations: the session token in `localStorage` can be read by any script on the page (XSS exposure). This is
acceptable only for this test-account demo. Browser GPS works only over HTTPS (GitHub Pages is HTTPS). The
"Call 112" button opens a `tel:` link, which opens the phone dialer on Android Chrome and may do nothing on desktop.

GitHub Pages serves the site at the root of `https://iasi-safeflow.github.io/` (repository
`iasi-safeflow/iasi-safeflow.github.io`, an organization Pages site). If it is ever moved to a project repository,
the site would live under `/<repo-name>/`: set `experiments.baseUrl` in `mobile/app.json` accordingly. `404.html` is a copy of
`index.html` so deep links load the app.

The site is also an **installable web app (PWA)**:
- `mobile/public/manifest.json` provides the name, icons and standalone display.
- `mobile/public/sw.js` is a small service worker. `scripts/postexport-web.js` writes a build id and the list of
  app files into it, so the app opens offline and each deploy replaces the old cache.
- API calls and map tiles are never cached. When there's no connection, an offline banner appears under the 112
  banner (`OfflineBanner.tsx`, using `expo-network`).

## Install on Android

> Demo app with test data only. It is not an emergency service: for emergencies call **112**.

**Option 1: Android app (APK).** Behaves like any installed app.
1. On the phone, open https://iasi-safeflow.github.io → **Cont** → **Descarcă aplicația Android (APK)**, or go
   directly to the latest release on the repository's GitHub **Releases** page.
2. Open the downloaded file (from Chrome's download message, or from the **Downloads**/**Files** app).
3. When Android asks, tap **Settings**, turn on **Allow from this source** for the app that opened the file (Chrome,
   or Files/Download Manager), go back, and tap **Install**. This is needed only once per app.
4. **Google Play Protect** then shows **App scan recommended**, because the app isn't from the Play Store. Either tap
   **Scan app** (this sends the APK to Google for a check), or tap **More details → Install without scanning**.
5. **Updates:** install the newer APK over the old one. Your data stays, because every APK is signed with the same
   SafeFlow release key. The installed version is shown under **Cont → Versiune aplicație**.

**Option 2: installable website (PWA).** In Chrome open https://iasi-safeflow.github.io → menu **⋮ → Install app**
(or **Cont → Instalează din browser**). It updates itself on every deploy.

### Building the APK (maintainers, Windows)

`cd mobile; npm run build:android` creates `mobile/release/iasi-safeflow-<version>.apk` (git-ignored).

**Storage:** the script writes nothing to C:.

| What | Location |
|---|---|
| Android SDK | `D:\Android\Sdk` (a copy of Android Studio's SDK) |
| Gradle cache, temp files, npm and Expo caches, Android user data | `D:\safeflow-build\...` |
| JDK | Android Studio's JBR (only read) |

**Windows path-length workarounds:**
- The build runs in a short mirror folder `D:\sf`.
- It targets `arm64-v8a` only.
- It uses legacy native-library packaging.
- `react-native-gesture-handler` generates object paths longer than 260 characters, so Windows long paths must be
  enabled (`LongPathsEnabled=1`). The SDK's CMake 3.22.1 must also use **ninja ≥ 1.12**: replace
  `D:\Android\Sdk\cmake\3.22.1\bin\ninja.exe` with ninja 1.13.2 from the official ninja-build GitHub release (the
  original is kept as `ninja-1.10.2.exe`).

**Signing:** release builds are signed by `plugins/withReleaseSigning.js` with the key
`D:\safeflow-keys\safeflow-release.jks`. Its password and alias are read from
`D:\safeflow-build\gradle-home\gradle.properties`, which is never committed. To create both once, run
`powershell -ExecutionPolicy Bypass -File mobile\scripts\make-release-key.ps1`. If the four `SAFEFLOW_RELEASE_*` properties are missing, the build fails instead
of using the debug key.

> **Back up the key file and its password.** Without them, future APKs can't be installed over existing ones.

**Before each release:**
- bump `expo.version` and `expo.android.versionCode` in `mobile/app.json`;
- upload `release/iasi-safeflow.apk` to a new GitHub Release (the web app links to `releases/latest/download/iasi-safeflow.apk`).

The API URL is baked in at build time (`EXPO_PUBLIC_API_URL`, default `https://iasi-safeflow-api.onrender.com`, must be HTTPS).

## Reviewer workflow and review assistant

**Statuses:**

| From | Allowed next statuses |
|---|---|
| Primit | În analiză, Validat, Respins |
| În analiză | Validat, Respins, Expirat |
| Validat | Pregătit pentru sesizare, Rezolvat, Respins |
| Pregătit pentru sesizare | Rezolvat, Validat |
| Rezolvat | Validat (redeschis) |
| Respins | În analiză (redeschis) |
| Expirat | În analiză |

The public label reads **"Verificat de un recenzent"** only for Validat, Pregătit pentru sesizare and Rezolvat. That
means a reviewer looked at the report; it is not an official confirmation. Every other status reads "Raport
utilizator – neverificat".

**Rejecting** requires a reason: Duplicat, Nu ține de siguranța rutieră, Informații insuficiente, În afara zonei
Iași, or Conținut abuziv / spam. The reporter sees the reason in neutral wording under "Ale mele". The reviewer's
optional note stays private. Reopening is allowed. Every change goes to the append-only audit log.

**Held reports:** a new report flagged by the assistant (personal data, abusive language, vague text, possibly not
about road safety, or a possible emergency) is kept off the public map and every public endpoint. It is published
only when a reviewer moves it to În analiză or Validat. The reporter sees "În așteptare – va fi publicat după
verificare".

**Review assistant ("Analiză automată"):** explainable rules and character 3-gram text similarity, in pure Python,
with no external AI service or API key. It suggests duplicates, an importance level (Ridicată / Medie / Scăzută) with
a "De ce?" breakdown, and problem flags. It never changes a status or notifies anyone. Its results are labelled
"Sugestie automată – nu este o verificare" and are visible to reviewers only. The reviewer-only **Istoric AI** tab
lists every check and what the reviewer did next. Formulas, weights and limitations are in
[docs/ASSISTANT.md](docs/ASSISTANT.md).

## Free-hosting caveats

- **Render's free plan sleeps** after a period of inactivity. The first request afterwards can take up to about a
  minute while it wakes (measured: 22 s after 16 minutes idle, then under 1 s). Until then the map shows a loading message.
  `.github/workflows/keep-awake.yml` pings `/health` every 10 minutes to keep it awake. This is best effort: GitHub
  can run scheduled jobs late, and disables them after 60 days without repository activity. Staying awake uses
  ~744 of Render's 750 free instance hours per month.
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

Hackathon prototype. The review assistant is rule-based and has not been validated against crash data. Its
importance level is a triage suggestion, not a crash prediction (see the limitations in
[docs/ASSISTANT.md](docs/ASSISTANT.md)). There is no authority integration and no production-grade GDPR compliance. Referral statuses are set by a human reviewer and do **not** mean that an
authority received anything.
