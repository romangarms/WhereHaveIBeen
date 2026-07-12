"""TRMNL e-ink display blueprint.

A TRMNL private plugin (Polling strategy) fetches these endpoints server-side and
renders the returned data into an 800x480 black & white e-ink screen via Liquid
markup. TRMNL cannot hold a browser session, so auth here is a pass-through HTTP
Basic header the user configures in TRMNL's "Polling Headers" field; the decoded
credentials are used directly against OwnTracks, scoped to that user. The endpoints
also accept the app session as a fallback so the preview works in a logged-in
browser.

All map projection, point decimation and stats are computed here so the markup
only has to drop ready-made tiles, an SVG path and pre-formatted stat values into
place — keeping the polling payload tiny and the render razor-sharp on e-ink.
"""

import math
import os
from datetime import datetime, timedelta

import pytz
import requests
from dotenv import load_dotenv
from flask import (
    Blueprint,
    current_app,
    jsonify,
    render_template,
    request,
    session,
)
from requests.auth import HTTPBasicAuth

load_dotenv()

OWNTRACKS_URL = os.getenv("WHIB_OWNTRACKS_URL")
INTERNAL_ERROR_MESSAGE = "An internal error has occurred."

trmnl_bp = Blueprint("trmnl", __name__)

# Break the track into a new subpath when consecutive points are farther apart
# than this (km): a flight or GPS teleport, not a road we drove.
TRMNL_SEGMENT_BREAK_KM = 100
# OwnTracks points with accuracy worse than this (metres) are too noisy to draw.
TRMNL_MAX_ACCURACY_M = 100
# Drop projected points closer than this (screen px) to the last kept one — at
# 800x480 anything finer is invisible and just bloats the payload.
TRMNL_MIN_PIXEL_GAP = 1.2
# Tightest zoom we'll snap to; keeps a little basemap context around short trips.
TRMNL_MAX_ZOOM = 15
TILE_SIZE = 256


def _haversine_km(lat1, lon1, lat2, lon2):
    r = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _trmnl_extract(features):
    """Filter noisy points, split the track into subpaths across big jumps, and
    accumulate exact stats. Returns (kept_segments, stats) independent of any
    projection — projection happens later so it can be tile-aligned."""
    kept = []  # list of segments; each segment is a list of (lat, lon)
    segment = []
    prev = None
    distance_km = 0.0
    top_speed = 0.0
    max_alt = 0.0
    active_days = set()

    for feature in features:
        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates")
        props = feature.get("properties") or {}
        if not coords or props.get("acc", 9999) >= TRMNL_MAX_ACCURACY_M:
            continue
        lon, lat = coords[0], coords[1]

        top_speed = max(top_speed, props.get("vel", 0) or 0)
        max_alt = max(max_alt, props.get("alt", 0) or 0)
        tst = props.get("isotst")
        if tst:
            active_days.add(tst[:10])

        if prev is not None:
            step = _haversine_km(prev[0], prev[1], lat, lon)
            if step > TRMNL_SEGMENT_BREAK_KM:
                if len(segment) > 1:
                    kept.append(segment)
                segment = []
            else:
                distance_km += step
        segment.append((lat, lon))
        prev = (lat, lon)

    if len(segment) > 1:
        kept.append(segment)

    stats = {
        "distance_km": distance_km,
        "top_speed": top_speed,
        "max_alt": max_alt,
        "active_days": len(active_days),
        "point_count": sum(len(s) for s in kept),
    }
    return kept, stats


def _trmnl_world_px(lat, lon, zoom):
    """Global Web Mercator pixel coordinate (slippy-map convention) at a zoom."""
    n = TILE_SIZE * (2 ** zoom)
    x = (lon + 180.0) / 360.0 * n
    siny = min(max(math.sin(math.radians(lat)), -0.9999), 0.9999)
    y = (0.5 - math.log((1 + siny) / (1 - siny)) / (4 * math.pi)) * n
    return x, y


def _trmnl_build_tilemap(kept, width, height, with_basemap=True, padding=24):
    """Fit the track to a slippy-map zoom, then return the basemap tiles and the
    SVG path — both in the same width x height pixel space so they line up.

    Uses the same OpenStreetMap tiles as the main map; a grayscale filter in the
    markup makes them e-ink friendly. Returns (tiles, path_d, zoom); tiles is a
    list of {url, left, top} (empty when with_basemap is False).
    """
    pts = [pt for seg in kept for pt in seg]
    if not pts:
        return [], "", 0

    lats = [p[0] for p in pts]
    lons = [p[1] for p in pts]
    # Largest zoom at which the whole track fits inside the padded viewport.
    zoom = 0
    for z in range(TRMNL_MAX_ZOOM, -1, -1):
        x0, y0 = _trmnl_world_px(max(lats), min(lons), z)
        x1, y1 = _trmnl_world_px(min(lats), max(lons), z)
        if (x1 - x0) <= (width - 2 * padding) and (y1 - y0) <= (height - 2 * padding):
            zoom = z
            break

    world = [_trmnl_world_px(lat, lon, zoom) for lat, lon in pts]
    xs = [w[0] for w in world]
    ys = [w[1] for w in world]
    # Centre the track's bounding box in the viewport.
    origin_x = (min(xs) + max(xs)) / 2 - width / 2
    origin_y = (min(ys) + max(ys)) / 2 - height / 2

    n_tiles = 2 ** zoom
    tiles = []
    if with_basemap:
        for tx in range(int(math.floor(origin_x / TILE_SIZE)),
                         int(math.floor((origin_x + width) / TILE_SIZE)) + 1):
            for ty in range(int(math.floor(origin_y / TILE_SIZE)),
                             int(math.floor((origin_y + height) / TILE_SIZE)) + 1):
                if ty < 0 or ty >= n_tiles:
                    continue
                wx = tx % n_tiles  # wrap across the antimeridian
                sub = "abc"[(tx + ty) % 3]  # spread load across OSM subdomains
                tiles.append({
                    "url": f"https://{sub}.tile.openstreetmap.org/{zoom}/{wx}/{ty}.png",
                    "left": round(tx * TILE_SIZE - origin_x, 1),
                    "top": round(ty * TILE_SIZE - origin_y, 1),
                })

    parts = []
    for seg in kept:
        pixels = []
        last = None
        for lat, lon in seg:
            wx, wy = _trmnl_world_px(lat, lon, zoom)
            px, py = wx - origin_x, wy - origin_y
            if last is None or math.hypot(px - last[0], py - last[1]) >= TRMNL_MIN_PIXEL_GAP:
                pixels.append((px, py))
                last = (px, py)
        if len(pixels) < 2:
            continue
        parts.append("M" + " L".join(f"{round(px, 1)} {round(py, 1)}" for px, py in pixels))

    return tiles, " ".join(parts), zoom


def _trmnl_credentials():
    """Credentials for the TRMNL endpoints.

    TRMNL polls server-side and sends HTTP Basic auth; a logged-in browser has no
    such header, so fall back to the session so the endpoint (and its preview) can
    be tested locally just by being signed in.
    """
    auth = request.authorization
    if auth and auth.username:
        return auth.username, auth.password
    if session.get("username"):
        return session.get("username"), session.get("password")
    return None, None


class _OwnTracksAuthError(Exception):
    """Raised when OwnTracks rejects the forwarded credentials."""


def _trmnl_iso(dt):
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _trmnl_last_entries(username, password):
    """The user's last-known position per device, via /api/0/last."""
    response = requests.get(
        OWNTRACKS_URL + "/api/0/last",
        auth=HTTPBasicAuth(username, password),
        params={"user": username.lower()},
        timeout=30,
    )
    if response.status_code in (401, 403):
        raise _OwnTracksAuthError()
    if response.status_code != 200:
        return []
    entries = response.json()
    return entries if isinstance(entries, list) else []


def _trmnl_devices(username, password):
    """Device names for the user. The recorder's /api/0/locations 416s unless a
    device is supplied, so we discover them here when the caller didn't pin one."""
    return [e["device"] for e in _trmnl_last_entries(username, password)
            if isinstance(e, dict) and e.get("device")]


def _trmnl_fetch_features(username, password, start, end, devices):
    """Fetch GeoJSON features for a time window across one or more devices.

    The OwnTracks recorder returns 416 (not an empty list) when a device has no
    records in the window, so treat that as "no data" rather than an error. When
    several devices are merged, points are re-sorted chronologically so the drawn
    track stays in order.
    """
    features = []
    for device in devices:
        params = {
            "from": _trmnl_iso(start),
            "to": _trmnl_iso(end),
            "format": "geojson",
            "user": username.lower(),
            "device": device,
        }
        response = requests.get(
            OWNTRACKS_URL + "/api/0/locations",
            auth=HTTPBasicAuth(username, password),
            params=params,
            timeout=60,
        )
        if response.status_code in (401, 403):
            raise _OwnTracksAuthError()
        if response.status_code == 416:
            continue
        response.raise_for_status()
        features.extend(response.json().get("features", []))

    if len(devices) > 1:
        features.sort(key=lambda f: (f.get("properties") or {}).get("tst", 0))
    return features


def _trmnl_latest_timestamp(username, password):
    """UTC datetime of the user's most recent point, via /api/0/last, or None."""
    tsts = [e.get("tst") for e in _trmnl_last_entries(username, password)
            if isinstance(e, dict) and e.get("tst")]
    if not tsts:
        return None
    return datetime.fromtimestamp(max(tsts), tz=pytz.UTC)


def _trmnl_payload(username, password):
    """Fetch the user's recent history and build the render payload.

    Returns (payload_dict, None) on success, or (None, (json_body, status)) on
    failure so the caller can return the error verbatim.
    """
    try:
        days = int(request.args.get("days", 30))
    except ValueError:
        days = 30
    try:
        width = int(request.args.get("w", 800))
        height = int(request.args.get("h", 400))
    except ValueError:
        width, height = 800, 400

    now = datetime.now(pytz.UTC)
    start = now - timedelta(days=days)
    end = now

    try:
        requested = request.args.get("device")
        # The recorder needs a device; use the requested one, else every device
        # the user has, so we don't silently miss a phone/tablet's history.
        devices = [requested] if requested else _trmnl_devices(username, password)

        features = _trmnl_fetch_features(username, password, start, end, devices)
        # If nothing was logged in the wall-clock window (e.g. you haven't driven
        # recently, or the server clock is ahead of the data), fall back to the
        # last `days` of whatever data actually exists so the display stays useful.
        if not features:
            latest = _trmnl_latest_timestamp(username, password)
            if latest and latest < start:
                end = latest
                start = latest - timedelta(days=days)
                features = _trmnl_fetch_features(username, password, start, end, devices)
    except _OwnTracksAuthError:
        return None, ({"error": "Invalid OwnTracks credentials."}, 401)
    except requests.RequestException as err:
        current_app.logger.error(f"TRMNL: Error fetching from OwnTracks: {err}")
        return None, ({"error": INTERNAL_ERROR_MESSAGE}, 502)

    with_basemap = request.args.get("basemap", "osm").lower() != "none"

    kept, stats = _trmnl_extract(features)
    tiles, map_d, zoom = _trmnl_build_tilemap(kept, width, height, with_basemap)

    distance_km = stats["distance_km"]
    distance_mi = distance_km / 1.609
    top_speed_mph = stats["top_speed"] / 1.609
    max_alt_ft = stats["max_alt"] * 3.281

    try:
        tz = pytz.timezone(request.args.get("tz", "America/Los_Angeles"))
    except pytz.UnknownTimeZoneError:
        tz = pytz.timezone("America/Los_Angeles")
    local_end = end.astimezone(tz)
    local_start = start.astimezone(tz)

    return {
        "map_d": map_d,
        "tiles": tiles,
        "zoom": zoom,
        "width": width,
        "height": height,
        "has_data": bool(map_d),
        "days": days,
        "date_range": f"{local_start.strftime('%b %-d')} – {local_end.strftime('%b %-d')}",
        "distance_fmt": f"{distance_mi:,.0f} mi",
        "distance_km_fmt": f"{distance_km:,.0f} km",
        "top_speed_fmt": f"{top_speed_mph:,.0f} mph",
        "max_alt_fmt": f"{max_alt_ft:,.0f} ft",
        "active_days_fmt": str(stats["active_days"]),
        "point_count": stats["point_count"],
    }, None


def _trmnl_unauthorized():
    resp = jsonify({"error": "Sign in, or send HTTP Basic credentials."})
    resp.status_code = 401
    # Prompts the browser for a native login dialog when hit without a session.
    resp.headers["WWW-Authenticate"] = 'Basic realm="WhereHaveIBeen TRMNL"'
    return resp


def _trmnl_debug(username, password):
    """Raw diagnostics for why a window may come back empty. ?debug=1"""
    report = {"user": username, "owntracks_url": OWNTRACKS_URL}
    now = datetime.now(pytz.UTC)
    start = now - timedelta(days=30)

    def probe(label, params):
        try:
            r = requests.get(
                OWNTRACKS_URL + "/api/0/locations",
                auth=HTTPBasicAuth(username, password),
                params=params,
                timeout=60,
            )
            n = None
            try:
                n = len(r.json().get("features", []))
            except Exception:
                n = "n/a"
            report[label] = {"params": params, "status": r.status_code, "features": n}
        except Exception as e:
            report[label] = {"params": params, "error": str(e)}

    # Discover the device name from /api/0/last so we can probe user+device too.
    device = None
    try:
        r = requests.get(OWNTRACKS_URL + "/api/0/last", auth=HTTPBasicAuth(username, password),
                         params={"user": username.lower()}, timeout=30)
        entries = r.json() if r.status_code == 200 else []
        if entries and isinstance(entries[0], dict):
            device = entries[0].get("device")
    except Exception:
        entries = []

    probe("wide_user_only", {"from": "2015-01-01T01:00:00.0002Z", "to": "2099-12-31T23:59:59.000Z",
                             "format": "geojson", "user": username.lower()})
    probe("wide_user_device", {"from": "2015-01-01T01:00:00.0002Z", "to": "2099-12-31T23:59:59.000Z",
                               "format": "geojson", "user": username.lower(), "device": device})
    probe("window_user_device", {"from": _trmnl_iso(start), "to": _trmnl_iso(now),
                                  "format": "geojson", "user": username.lower(), "device": device})
    probe("wide_no_format", {"from": "2015-01-01", "to": "2099-12-31",
                             "user": username.lower(), "device": device})

    try:
        tsts = [e.get("tst") for e in entries if isinstance(e, dict) and e.get("tst")]
        report["device_from_last"] = device
        report["last"] = {
            "status": r.status_code,
            "entries": len(entries) if isinstance(entries, list) else "not-a-list",
            "first_entry_keys": sorted(entries[0].keys()) if entries and isinstance(entries[0], dict) else None,
            "max_tst": max(tsts) if tsts else None,
            "max_tst_iso": datetime.fromtimestamp(max(tsts), tz=pytz.UTC).isoformat() if tsts else None,
        }
    except Exception as e:
        report["last"] = {"error": str(e)}

    report["server_now_utc"] = now.isoformat()
    return report


@trmnl_bp.route("/trmnl")
def trmnl():
    username, password = _trmnl_credentials()
    if not username:
        return _trmnl_unauthorized()

    if request.args.get("debug"):
        return jsonify(_trmnl_debug(username, password))

    payload, error = _trmnl_payload(username, password)
    if error:
        body, status = error
        return jsonify(body), status
    return jsonify(payload)


@trmnl_bp.route("/trmnl/preview")
def trmnl_preview():
    """WYSIWYG local preview: renders the actual 800x480 screen in the browser
    using the same data as the TRMNL plugin, so you can eyeball it while signed
    in (no TRMNL account needed)."""
    username, password = _trmnl_credentials()
    if not username:
        return _trmnl_unauthorized()

    payload, error = _trmnl_payload(username, password)
    if error:
        body, status = error
        return jsonify(body), status
    return render_template("trmnl_preview.html", **payload)
