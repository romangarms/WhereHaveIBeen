# history-import Specification

## Purpose

Brings location history recorded before OwnTracks, from Google Maps Timeline, into the
user's map without overriding anything OwnTracks recorded.

## Requirements

### Requirement: Google Maps Timeline upload
A signed-in user SHALL be able to upload a Google Maps Timeline export from the Configure panel's Import tab: either the phone's "Export Timeline data" JSON or Takeout `Records.json`. The upload is streamed through to the API, not held by the web app.

#### Scenario: Upload
- **WHEN** a user uploads a Timeline export
- **THEN** the Import tab shows the stored import's point count, months covered and import time

### Requirement: OwnTracks wins on overlap
Imported points SHALL be skipped for any UTC day that has an OwnTracks fix.

#### Scenario: Overlapping day
- **WHEN** an import contains points on a day the phone also recorded with OwnTracks
- **THEN** only the OwnTracks points for that day are used

### Requirement: Account-wide
An import SHALL belong to the account, appear regardless of the selected device, and be included in Everyone's Roads.

#### Scenario: Device filter
- **WHEN** a user filters to one device
- **THEN** imported history is still shown

### Requirement: Removal and recompute
A user SHALL be able to remove their import. After an upload or a removal, the all-time map is recomputed.

#### Scenario: Removal
- **WHEN** a user removes their import
- **THEN** the import is deleted and the next all-time load recomputes without it

### Requirement: Map without a device
An account with an import but no reporting device SHALL get a map instead of the setup guide.

#### Scenario: Import only
- **WHEN** an account has an import and no OwnTracks device
- **THEN** the map loads the imported history
