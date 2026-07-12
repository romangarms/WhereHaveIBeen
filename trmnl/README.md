# TRMNL "Roads Driven" plugin

Displays your last 30 days of driving as a road map with headline stats, sized
for the TRMNL 800×480 black & white e-ink screen.

It is powered by the `GET /trmnl` endpoint in `app.py`, which fetches your
OwnTracks history, fits the GPS track to a slippy-map zoom, and returns the
positioned **OpenStreetMap basemap tiles** plus an SVG path for the route and
exact stats (distance, active days, top speed, peak altitude). The TRMNL markup
in `markup.liquid` lays the tiles down (grayscaled for e-ink) and draws the route
(white-cased black line) on top. The route is a vector `<path>`, so it stays
razor-sharp.

> The basemap uses the same OpenStreetMap tiles as the main map, fetched by
> TRMNL's renderer at draw time — no map data passes through this app. For a pure
> line-only screen, pass `?basemap=none` (or drop the tile `{% for %}` block from
> `markup.liquid`).

![preview](preview.png)

## Test it locally (no TRMNL needed)

The endpoints accept your **logged-in web session** as a fallback to the Basic
auth header, so testing in your browser is easy:

1. Run the app (`python app.py`) and sign in at `http://localhost:5000` as usual.
2. Open **`http://localhost:5000/trmnl/preview`** — this renders the real 800×480
   screen with your data, styled to look like the e-ink panel. Add query params
   to experiment, e.g. `…/trmnl/preview?days=7&tz=Europe/London`.
3. To see the raw JSON the TRMNL plugin will consume, open
   **`http://localhost:5000/trmnl`**.

If you open either while signed out, the browser shows a login prompt — enter
your OwnTracks username/password there. Or from the terminal:

```bash
curl -u 'YOUR_USER:YOUR_PASSWORD' http://localhost:5000/trmnl
```

## 1. Deploy

The endpoint ships as part of the Flask app. Deploy as usual (Fly.io), then it is
reachable at:

```
https://<your-domain>/trmnl
```

For the hosted instance that is `https://wherehaveibeen.fly.dev/trmnl` (use your
own domain if different).

## 2. Build your auth header

The endpoint authenticates with HTTP Basic auth passed straight through to
OwnTracks — the same credentials you log in with. TRMNL runs the poll on its
server, so it can't use a browser session; you give it the header instead.

Generate the header value from your OwnTracks `username:password`:

```bash
printf '%s' 'YOUR_USERNAME:YOUR_PASSWORD' | base64
```

That prints a string like `dXNlcjpwYXNz`. Your full header is:

```
Authorization: Basic dXNlcjpwYXNz
```

> The credentials are sent to *your own* server over HTTPS and forwarded to
> OwnTracks exactly as the web app already does. They are not stored by the
> plugin.

## 3. Create the TRMNL private plugin

In your TRMNL account: **Plugins → Private Plugin → Add New**.

| Field | Value |
|-------|-------|
| **Strategy** | `Polling` |
| **Polling URL** | `https://<your-domain>/trmnl` |
| **Polling Verb** | `GET` |
| **Polling Headers** | `Authorization: Basic <your base64 string>` (one per line) |
| **Remove bleed margin?** | `Yes` (the markup is full-bleed) |
| **Enable Dark Mode?** | `No` |

Leave **Polling Body** and **OAuth** empty.

Set the refresh interval on the plugin/playlist to whatever you like — every few
hours is plenty for a 30-day view and is gentle on the OwnTracks server.

## 4. Paste the markup

Click **Edit Markup**, select the **Full** layout, and paste the contents of
[`markup.liquid`](markup.liquid). Use the live preview to confirm the map and
stats render. Save.

> If a `{{ variable }}` shows up blank, open the **Merge Variables** dropdown in
> the editor to see the exact path TRMNL assigned the polled JSON and adjust the
> reference. Top-level names (`{{ map_d }}`, `{{ distance_fmt }}`, …) are the
> default for the Polling strategy.

## Endpoint options (query params)

All optional:

| Param | Default | Meaning |
|-------|---------|---------|
| `days` | `30` | Look-back window in days |
| `tz` | `America/Los_Angeles` | IANA timezone for the date range label |
| `device` | *(auto)* | Restrict to one OwnTracks device. Omitted, it auto-detects and merges all your devices (the recorder requires a device, so this is discovered via `/api/0/last`) |
| `basemap` | `osm` | OpenStreetMap basemap behind the route. Pass `none` for a line-only screen |
| `w` / `h` | `800` / `400` | Map drawing area in px (must match the SVG `viewBox` in the markup) |

Example — 14 days, London time, one device:

```
https://<your-domain>/trmnl?days=14&tz=Europe/London&device=phone
```

## JSON returned by the endpoint

```jsonc
{
  "map_d":          "M120 40 L121 42 ...",  // SVG path, all track segments
  "has_data":       true,
  "width":          800,
  "height":         400,
  "days":           30,
  "date_range":     "Jun 11 – Jul 11",
  "distance_fmt":   "188 mi",
  "distance_km_fmt":"302 km",
  "top_speed_fmt":  "40 mph",
  "max_alt_fmt":    "459 ft",
  "active_days_fmt":"25",
  "point_count":    3190
}
```
