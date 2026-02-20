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
- `WHIB_DEFAULT_OSRM_URL` - OSRM routing service URL

## Architecture

**Backend (Flask - `app.py`):**
- Session-based authentication storing OwnTracks credentials
- Proxy endpoints for OwnTracks API (`/locations`, `/usersdevices`)
- OSRM routing proxy (`/proxy`) to handle HTTPS/HTTP compatibility
- Settings persistence in Flask session (`/save_settings`, `/get_settings`)

**Frontend (Vanilla JS in `static/js/`):**
- `manageData.js` - Data fetching, filtering, and processing pipeline
- `drawOnMap.js` - Route calculation and Leaflet map rendering
- `logIn.js` - Authentication handling
- `cacheManager.js` - IndexedDB caching with settings validation
- `progressBar.js` - Progress UI management

**Data Flow:**
```
OwnTracks Server → Flask Backend (proxy/auth) → Frontend JS → Leaflet Map
                                              → IndexedDB Cache
```

**Routing Strategies (based on point count):**
- Complex: OSRM server routing (snaps to roads)
- Simple: Turf.js buffering (fallback)
- NoRoute: Point filtering only (very large datasets)

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
         │ GET /proxy?coords=... │     ┌─────────────────┐│
         │──────────────────────>│────>│   OSRM Server   ││
         │ Route JSON            │<────│   (External)    ││
         │<──────────────────────│     └─────────────────┘│
         │                       │                        │
         │ Store in IndexedDB    │                        │
         │ (browser cache)       │                        │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

### Session-Based Authentication

**Security Model:**
- Credentials stored in Flask encrypted session cookie (not in database)
- Session encrypted with `WHIB_FLASK_SECRET_KEY` environment variable
- Session lifetime: 30 days (`app.permanent_session_lifetime`)
- Sign-out clears entire session (`session.clear()`)

**Session Contents:**

| Key | Description | Set By |
|-----|-------------|--------|
| `username` | OwnTracks username | `/login` |
| `password` | OwnTracks password | `/login` |
| `serverurl` | OwnTracks server URL (e.g., `https://owntracks.example.com`) | `/login` |
| `circle_size` | Buffer size setting (km) | `/save_settings` |
| `osrm_url` | Custom OSRM router URL | `/save_settings` |

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
| `/save_settings` | POST | Save `circleSize` and `osrmURL` to session |
| `/get_settings` | GET | Retrieve saved settings |

#### OSRM Routing Proxy

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/proxy` | GET | Forward routing requests to OSRM server |

**Purpose:** Bypasses mixed-content (HTTPS/HTTP) browser restrictions when the OSRM server doesn't support HTTPS.

**Query Parameters:**
- `osrmURL` - Custom OSRM server URL (optional, falls back to `WHIB_DEFAULT_OSRM_URL`)
- `coords` - Coordinate string for OSRM routing API

### Routing Strategy

Routes are calculated differently based on GPS point count:

| Point Count | Strategy | Description |
|-------------|----------|-------------|
| < 500 | Complex | OSRM road routing (snaps to actual roads) |
| 500 - 3000 | Simple | Direct line connections via Turf.js |
| 3000 - 5000 | NoRoute | Point filtering, 10m minimum spacing |
| > 5000 | NoRoute | Point filtering, 100m minimum spacing |

**Fallback:** Complex routing falls back to Simple if OSRM fails (e.g., points over water with no road route).

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
- `manageData.js` - Data fetching from `/locations`, filtering, statistics
- `drawOnMap.js` - Route calculation (Complex/Simple/NoRoute), Leaflet rendering
- `cacheManager.js` - IndexedDB cache management

### IndexedDB Caching

The frontend caches processed route data in IndexedDB to avoid re-fetching and re-processing.

**Cache Structure:**
```javascript
{
  driving: { buffer: GeoJSON, timestamp, startTimestamp },
  flying: { buffer: GeoJSON, timestamp, startTimestamp },
  settings: { bufferSize, osrmUrl },
  metrics: { highestAltitude, highestVelocity, totalDistance }
}
```

**Cache Invalidation Triggers:**
- Buffer size (`circleSize`) setting changed
- OSRM URL changed
- Manual cache clear by user

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
