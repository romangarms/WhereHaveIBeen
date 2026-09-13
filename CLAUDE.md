# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhereHaveIBeen is a Flask-based geospatial web application that visualizes OwnTracks GPS history on an interactive Leaflet map. Users connect to their OwnTracks server, and the app displays routes, calculates distance traveled, area explored, and other analytics.

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application (Waitress WSGI server on port 5000)
python app.py
```

For VS Code debugging, use the preconfigured Flask debugger in `.vscode/launch.json`.

## Environment Variables

Create a `.env` file with:
- `WHIB_FLASK_SECRET_KEY` - Flask session secret key

## Architecture

**Backend (Flask - `app.py`):**
- Session-based authentication storing OwnTracks credentials
- Proxy endpoints for the recorder (`/locations`, `/usersdevices`) and for the
  user management API's per-user compute (`/me/track`, `/me/heatmap`, `/all-roads`)
  and imported history (`/imports`, `/imports/google-timeline`)
- Settings persistence in Flask session (`/save_settings`, `/get_settings`)

**Frontend (Vanilla JS in `static/js/`):**
- `manageData.js` - Builds the `/me/*` query from the UI, polls while the server computes (202), holds the returned stats for the Flights toggle
- `drawOnMap.js` - Leaflet rendering of the server's corridors, flight lines and heat cells
- `logIn.js` - Authentication handling
- `progressBar.js` - Progress strip and reload-chip state
- `statsPanel.js` - Stats ribbon; single source of truth for stat labels and unit formatting (imperial first, metric underneath)

**Data Flow:**
```
OwnTracks Recorder → WhereHaveIBeen-API (/api/me/track, /api/me/heatmap: flight
detection, thinning, buffer, dissolve, stats; cached per user on the Mini)
                   → Flask Backend (/me/track, /me/heatmap proxy with session auth)
                   → Frontend JS → Leaflet Map
```

All geometry and stats are computed server-side in the WhereHaveIBeen-API repo
(`track.py`); the browser only renders. A cold all-time request answers `202`
with `Retry-After` while the server computes and the client polls. Turf.js is
loaded only on `/about` for its illustration.

## Key Libraries

- **Backend:** Flask, Waitress, requests, pytz
- **Frontend:** Leaflet.js, Turf.js, Leaflet Routing Machine, Bootstrap 5

## Deployment

Production is hosted on Fly.io using Docker (see `fly.toml` and `Dockerfile`).

---

## Authentication and Connection Architecture

### System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     Browser     │     │  Flask Backend   │     │ OwnTracks Server │
│   (Frontend)    │     │    (app.py)      │     │    (External)    │
└────────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                       │                        │
         │ POST /login           │                        │
         │ (username, password,  │                        │
         │  serverurl)           │                        │
         │──────────────────────>│                        │
         │                       │                        │
         │ Set encrypted session │                        │
         │ cookie (30-day)       │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ GET /usersdevices     │                        │
         │──────────────────────>│                        │
         │                       │ GET /api/0/last        │
         │                       │ (HTTPBasicAuth)        │
         │                       │───────────────────────>│
         │                       │<───────────────────────│
         │ JSON (users/devices)  │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ GET /locations        │                        │
         │──────────────────────>│                        │
         │                       │ GET /api/0/locations   │
         │                       │ (HTTPBasicAuth)        │
         │                       │───────────────────────>│
         │                       │<───────────────────────│
         │ GeoJSON response      │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ Store in IndexedDB    │                        │
         │ (browser cache)       │                        │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

### Session-Based Authentication

**Security Model:**
- Credentials stored in Flask session cookie (not in database)
- The session is **signed** (tamper-proof) with `WHIB_FLASK_SECRET_KEY`, but
  **not encrypted** — the cookie contents are base64-readable by anyone who
  holds the cookie. The username/password are therefore exposed to the client.
  The cookie is set `Secure` + `HttpOnly` + `SameSite=Lax` to limit exposure.
- Session lifetime: 30 days (`app.permanent_session_lifetime`)
- Sign-out clears entire session (`session.clear()`)

**Session Contents:**

| Key | Description | Set By |
|-----|-------------|--------|
| `username` | OwnTracks username | `/login` |
| `password` | OwnTracks password | `/login` |
| `serverurl` | OwnTracks server URL (e.g., `https://owntracks.example.com`) | `/login` |
| `circle_size` | Buffer size setting (km) | `/save_settings` |

### API Endpoints

#### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | POST | Store OwnTracks credentials in session. Form fields: `username`, `password`, `serverurl` |
| `/sign_out` | GET | Clear session, redirect to `/` |

#### OwnTracks Proxy

These endpoints require a valid session and proxy requests to the user's OwnTracks server using HTTPBasicAuth.

| Endpoint | Method | Proxies To | Description |
|----------|--------|------------|-------------|
| `/locations` | GET | `/api/0/locations` | Fetch GPS history as GeoJSON |
| `/usersdevices` | GET | `/api/0/last` | List available users/devices |

**`/locations` Query Parameters:**
- `startdate` - ISO 8601 datetime (converted to UTC internally)
- `enddate` - ISO 8601 datetime (converted to UTC internally)
- `user` - OwnTracks username filter
- `device` - OwnTracks device filter

#### Settings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/save_settings` | POST | Save `circleSize` to session |
| `/get_settings` | GET | Retrieve saved settings |

#### TRMNL e-ink display

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/trmnl` | GET | Compact JSON of the last N days of driving for a TRMNL 800×480 e-ink screen |
| `/trmnl/preview` | GET | WYSIWYG HTML render of that screen for local browser testing |

These accept **HTTP Basic auth** (so the TRMNL server can poll them — it can't
hold a session) and fall back to the **session cookie** (so a logged-in browser
can hit `/trmnl/preview` directly). Credentials are passed straight through to
OwnTracks, scoped to that user; an unauthenticated request returns `401` with a
`WWW-Authenticate` header so browsers prompt for login. All map projection (Web
Mercator, fitted + decimated to the screen), path building, and stats are
computed server-side. `/trmnl` returns JSON consumed by `trmnl/markup.liquid`;
`/trmnl/preview` renders `templates/trmnl_preview.html`. See `trmnl/README.md`.

The basemap uses the same OpenStreetMap tiles as the main map, positioned
server-side and grayscaled in the markup for e-ink. Tiles are served through a
`/trmnl/tile/<z>/<x>/<y>.png` proxy (in the blueprint) that adds the `Referer` /
`User-Agent` OSM requires — TRMNL's renderer sends neither, so a direct OSM fetch
is blocked. The proxy validates coordinates and caches tiles in memory.

**Query Parameters:** `days` (default 30), `tz` (IANA, default
`America/Los_Angeles`), `device` (optional filter), `basemap` (`osm` default, or
`none` for line-only), `w`/`h` (map area px, default 800×400 — must match the SVG
`viewBox` in the markup).

### Per-user compute proxy

| Endpoint | Proxies To | Description |
|----------|------------|-------------|
| `/me/track` | `/api/me/track` | Buffered driving corridor, flight lines and corridor, stats |
| `/me/heatmap` | `/api/me/heatmap` | Visit-frequency grid `[gx, gy, count]` |
| `/all-roads` | `/api/aggregate-roads` | Anonymised all-users shape with `area_km2` etc. |

Forwarded query parameters: `from`, `to` (ISO 8601 UTC), `device`, `buffer_m`,
`refresh`. No `user` parameter exists; the API serves the session's account
only. `202` and `400` pass through; `401`/`403` upstream become `401` here.

### Google Maps Timeline import

| Endpoint | Method | Proxies To | Description |
|----------|--------|------------|-------------|
| `/imports` | GET | `/api/me/imports` | Imports on file for the session's account |
| `/imports/google-timeline` | PUT | `/api/me/imports/google-timeline` | Body is the raw export file; streamed to the API in 1 MB chunks, never buffered here |
| `/imports/google-timeline` | DELETE | `/api/me/imports/google-timeline` | Remove the import |

The Configure panel's "Import" tab uploads the file with `fetch(..., {method:
'PUT', body: file})`, shows the stored import (points, months covered,
imported at) and, from each track response's `imports` field, how many
imported points are on the map and how many were skipped. The API parses the
file (phone "Export Timeline data" JSON or Takeout `Records.json`), folds the
points into the same server-side track as the devices, and skips any UTC day
that has an OwnTracks fix, so OwnTracks data always wins on overlap. An import
belongs to the account and shows regardless of the selected device. After an
upload or removal the page reloads all-time data; the API has dropped its
cached entries so the first load recomputes behind `202`. An account with an
import but no reporting device still gets a map instead of the setup guide.

### Frontend Authentication Flow

```
Page Load (index.html)
    │
    ├─> getUserSettings()           # Load saved settings from /get_settings
    │
    └─> getUsersAndDevices()        # Validate session via /usersdevices
            │
            ├── Success ──> loggedIn = true
            │               closeForm()
            │               runTasks()  # Fetch and display location data
            │
            └── Failure ──> loggedIn = false
                            openForm()  # Show login form
```

**Key Frontend Files:**
- `logIn.js` - Session validation, settings load/save
- `manageData.js` - `/me/*` requests with 202 polling, stats state
- `drawOnMap.js` - Leaflet rendering

### Caching

There is no application-level browser cache. The API keeps one entry per
(user, devices, buffer, range) on the Mini and extends open-ended (all-time)
entries incrementally; closed ranges are recomputed after 24 h. Every `/me/*`
and `/all-roads` response relays the API's `ETag` and
`Cache-Control: private, no-cache`, and the proxy forwards `If-None-Match`,
so the browser's HTTP cache revalidates each load and gets a `304` when the
server confirms nothing changed. The page also keeps the last `/me/track`
response in memory for a minute so heatmap mode can reuse it for the stats
ribbon; Reload and "Recompute on server" bypass that. The Configure panel's
"Server" tab shows `computed_at` / `latest_tst` and offers "Recompute on
server" (`refresh=1`). On load the page deletes the legacy IndexedDB store
`WhereHaveIBeenCache` from earlier versions.

---

## Future: User Management API

*This section is a placeholder for the planned user management backend integration.*

### Planned Integration

A separate backend/API will be added to:
- Create new OwnTracks users
- Manage user accounts
- Integrate with OwnTracks user provisioning

### Integration Considerations

When implementing:
- **Admin Authentication** - Separate auth system from OwnTracks credentials
- **Permission Model** - Define admin vs regular user access levels
- **Session Extension** - May need `is_admin` flag in Flask session
- **API Layer** - New endpoints for user CRUD operations
