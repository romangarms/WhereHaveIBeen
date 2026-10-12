# track-map Specification

## Purpose

The signed-in user's own map in the web app: where they have driven, as a buffered
corridor, their detected plane flights, and the controls that choose what is shown.
WhereHaveIBeen-API computes all geometry; the browser only renders.

## Requirements

### Requirement: Own data only
The map SHALL show only the signed-in account's data. The web app forwards no user parameter, and the API serves only the authenticated account.

#### Scenario: Another user's data
- **WHEN** a signed-in user requests track data
- **THEN** the response covers only their own devices and imports

### Requirement: Driving corridor
The map SHALL draw the driven history as a corridor buffered by the chosen buffer size (default 500 m), with flights excluded from the corridor.

#### Scenario: Default buffer
- **WHEN** a user loads the map without changing settings
- **THEN** the corridor is buffered by 500 m

#### Scenario: Buffer changed
- **WHEN** the user changes the buffer size in Configure
- **THEN** the map reloads with a corridor at the new size

### Requirement: Flights
The API SHALL detect plane flights and return them separately, as lines and a corridor. The map SHALL hide them by default. When shown, they are drawn lighter, beneath the driven roads, and only then count in stats.

#### Scenario: Flights toggled on
- **WHEN** the user turns on flights
- **THEN** flight lines appear under the roads and the distance stat changes from "Distance driven" to "Distance travelled"

### Requirement: Filters
The user SHALL be able to choose a time frame (All, Month, Week, 48h, 24h or a custom range) and a device or all devices.

#### Scenario: Time frame
- **WHEN** the user picks "Week"
- **THEN** the map shows data from the last 7 days

#### Scenario: Device
- **WHEN** the account has several devices and the user picks one
- **THEN** only that device's data is shown

### Requirement: Server compute with progress
While the API is still computing, it SHALL answer 202 with progress (stage, done, total). The page SHALL poll and show a progress strip naming the stage: fetching GPS history, adding imported history, or building corridors.

#### Scenario: Cold all-time load
- **WHEN** a user loads all-time data that is not cached on the server
- **THEN** the progress strip shows the server's stage and step count until the map appears

### Requirement: Caching and revalidation
Responses SHALL carry an ETag and `Cache-Control: private, no-cache`. The proxy SHALL forward `If-None-Match`, so unchanged data returns 304. "Recompute on server" SHALL force a fresh compute.

#### Scenario: Unchanged reload
- **WHEN** a user reloads and nothing has changed on the server
- **THEN** the browser gets a 304 and reuses its copy

#### Scenario: Forced recompute
- **WHEN** the user presses "Recompute on server"
- **THEN** the request carries `refresh=1` and the server recomputes
