# WhereHaveIBeen: project history

How the project got to where `main` is today (2026-10-12). This file is reference for
writing proposals. The current behaviour lives in `openspec/specs/`; this file explains
how it got there and which directions were already tried.

## Systems

| Piece | Repo | Runs on | Role |
|---|---|---|---|
| Web app (Flask) | `romangarms/WhereHaveIBeen` (this repo) | Fly.io | Login, proxying, rendering; no database |
| iOS app (SwiftUI) | this repo, `ios/` | TestFlight | Native viewer; recording is done by OwnTracks |
| TRMNL plugin | this repo, `trmnl/` | Fly.io (blueprint) | E-ink summary screen |
| WhereHaveIBeen-API | `romangarms/WhereHaveIBeen-API` | Mac Mini homelab, Docker | Accounts (SQLite + bcrypt), Traefik ForwardAuth gate, all track/heatmap/aggregate compute, imports |
| OwnTracks Recorder | stock `owntracks/recorder` image | Mac Mini, behind Traefik | Stores points from phones (`/pub`), serves `/api/0/*` |
| OwnTracks app | stock, App Store / Play Store | Users' phones | The tracker. WhereHaveIBeen does not ship its own |

Hostnames:
- `tracker.romangarms.com`: the web app.
- `mini.romangarms.com`: the API and the recorder.

Main is maintained by Roman Garms: about 205 of 210 commits on `main`; the rest are
dependabot.

## Timeline

**Aug 2024: first version.** A Flask app logs in to a user-supplied OwnTracks server
(the URL was a form field), fetches `/api/0/locations` and draws it with Leaflet. Paths
were road-snapped through an OSRM server, with "simple" (buffered straight lines) and
"complex" (OSRM-routed) modes. All processing happened in the browser. Deployed to
Fly.io with Waitress.

**Sep–Nov 2024: making the browser cope.** Filtering bad points (zero velocity, jumps),
downsampling, a progress bar, timers per stage, automatic simple/complex choice, no
routing over 3k points, user and device auto-discovery, session settings (buffer size),
a switch to Flask-session, Bootstrap styling, JS split into modules.

**Mar–May 2025: stats and flights.** Stats accumulate across tasks, flight detection
(first version), a task system for the processing pipeline, time-of-day filters and
timezone fixes.

**Jan–Feb 2026: caching and accounts.**
- Browser-side caching (IndexedDB) and an OSRM failure fallback.
- A settings panel and a UI update.
- `FRONTEND-CHANGES.md` described a planned external JWT user API. That was not built;
  WhereHaveIBeen-API went the ForwardAuth way instead.
- The API repo is born (2026-01-31). It handles registration and ForwardAuth in front of
  a shared recorder. That turned the app from "bring your own OwnTracks server" into one
  hosted server with accounts: `/register`, `/delete-account`, a fixed
  `WHIB_OWNTRACKS_URL`.

**Jun 2026: privacy and sharing.**
- Per-user isolation on the recorder: `/api/0/` reads must carry their own `?user=`, and
  `/pub` writes are pinned to the authenticated user.
- An SSRF fix in the old `/proxy`, and a hardened session cookie.
- The custom-OSRM-router UI was removed.
- Heatmap.
- "Everyone's Roads", the anonymised aggregate computed by the API.
- A new date picker, and usernames may not contain underscores.

**Jul 2026: TRMNL plugin.** Server-rendered e-ink view with an OSM tile proxy, later with
flights.

**Sep 2026: v3.0 and the move to the server.**
- v3.0 UI: full-page map, Configure popover, stats ribbon, imperial units first.
- Better flight detection.
- OSRM road snapping removed entirely.
- All route, flight and heatmap compute moved into WhereHaveIBeen-API (`/api/me/track`,
  `/api/me/heatmap`), with per-user caching on the Mini, 202 + progress polling, and
  ETag/304. The browser IndexedDB cache was retired.
- The native iOS app (SwiftUI) shipped to TestFlight as 1.0 and 1.0.1.
- Google Maps Timeline import, folded into tracks and the aggregate. OwnTracks wins on
  overlapping days.

## Directions tried and set aside

- **OSRM road snapping** (2024–2026). Removed: it was costly, fragile, and unnecessary
  once corridors are buffered.
- **Browser-side processing and IndexedDB cache.** Replaced by server-side compute.
- **External JWT user-management API** (`FRONTEND-CHANGES.md`, Jan 2026). Not built;
  ForwardAuth plus Basic auth won.
- **`openspec-init` roadmap integration** (Connor Dolan, Jul 2026, branch
  `backup-openspec`, not merged). It added a local SQLite `users` table to the Flask app
  with `is_admin`, waypoints, car profiles with live location, challenge segments,
  journey privacy, and a self-hosting setup wizard (OSRM, database and admin config).
  It predates the move to server-side compute and assumes a local database the web app
  no longer has, so it doesn't merge as-is. The intent is to bring those features in
  later, one at a time, rebuilt on the API design.
- **Native Android tracker** (Oct 2026, proposed on `android-app`, withdrawn).
  Re-implementing OwnTracks was out of proportion. The Android problem is configuration
  on One UI; see the `samsung-owntracks-profile` change.

## Known constraints worth remembering

- The recorder's `/pub` stores one message object per request; there are no batch
  uploads.
- Every request through the gate runs a bcrypt check (cost 12) with no caching. That's
  cheap per request, but it adds up during a phone's backlog flush or while heavy
  compute is running.
- The web app's session cookie holds the OwnTracks password, signed but not encrypted.
- Deploying the API means rebuilding on the Mini from its working tree. Back up
  `users.db` first; it isn't replicated.
- iPhone recording is reliable because iOS wakes OwnTracks for significant location
  changes. Android depends on OwnTracks' foreground service staying alive, which One UI
  battery management undermines.
