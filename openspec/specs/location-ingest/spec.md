# location-ingest Specification

## Purpose

How location points get from a phone into the system. Phones run the stock OwnTracks
app (iOS or Android) in HTTP mode. The stock OwnTracks Recorder stores the points,
behind WhereHaveIBeen-API's authentication gate. WhereHaveIBeen does not ship its own
tracker.

## Requirements

### Requirement: OwnTracks HTTP publishing
The system SHALL accept location points from the OwnTracks app as HTTP POSTs to `https://mini.romangarms.com/pub`, authenticated with HTTP Basic credentials of a WhereHaveIBeen account, one OwnTracks message object per request.

#### Scenario: Valid point
- **WHEN** OwnTracks posts a `location` object with valid credentials
- **THEN** the recorder stores it under that account and the device named by the request

#### Scenario: Array body
- **WHEN** a client posts a JSON array of locations in one request
- **THEN** the points are not stored as locations, because the recorder expects a single object

#### Scenario: Bad credentials
- **WHEN** a post carries a wrong password or none
- **THEN** it is rejected with 401 and nothing is stored

### Requirement: Points are stored only under the authenticated account
The gate SHALL pin the recorder's storage user to the authenticated username and ignore any user the client names. The device SHALL come from the client's `X-Limit-D` header or `?d=`.

#### Scenario: Spoofed user
- **WHEN** an authenticated user posts with `X-Limit-U` or `?u=` naming another account
- **THEN** the point is stored under the authenticated user, not the named one

### Requirement: Reads are scoped to the authenticated account
Reads of the recorder API under `/api/0/` SHALL carry a `?user=` equal to the authenticated username, compared case-insensitively. Anything else is refused.

#### Scenario: Unscoped read
- **WHEN** an authenticated request reads `/api/0/last` without `?user=`
- **THEN** it is refused with 403

### Requirement: Credential check on every request
Every request through the gate SHALL be checked against the stored bcrypt hash. Authentication is never cached.

#### Scenario: Each post verified
- **WHEN** a phone uploads a backlog of points
- **THEN** each POST is authenticated individually
