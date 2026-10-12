# trmnl-display Specification

## Purpose

A compact view of recent driving for a TRMNL 800×480 e-ink screen. The server renders
everything, so the device only displays it.

## Requirements

### Requirement: Recent driving JSON
`/trmnl` SHALL return the last N days of driving (default 30) as JSON for the TRMNL markup. The server projects and decimates the map to the screen and computes the stats.

#### Scenario: Default request
- **WHEN** TRMNL polls `/trmnl` with Basic credentials
- **THEN** it gets the last 30 days in America/Los_Angeles time, sized for an 800×400 map area

### Requirement: Authentication for a poller
The TRMNL endpoints SHALL accept HTTP Basic credentials and fall back to the session cookie. Without either, they SHALL answer 401 with `WWW-Authenticate`.

#### Scenario: No credentials
- **WHEN** a request has neither Basic auth nor a session
- **THEN** it gets 401 and a browser is prompted to log in

### Requirement: Basemap through a tile proxy
The OSM basemap SHALL be served through `/trmnl/tile/<z>/<x>/<y>.png`. The proxy adds the Referer and User-Agent OSM requires, validates coordinates, and caches tiles in memory. `basemap=none` SHALL give a line-only map.

#### Scenario: Line-only
- **WHEN** a request sets `basemap=none`
- **THEN** the screen shows only the route lines

### Requirement: Preview
`/trmnl/preview` SHALL render the same screen as HTML for testing in a browser.

#### Scenario: Preview
- **WHEN** a signed-in user opens `/trmnl/preview`
- **THEN** they see what the e-ink screen will show
