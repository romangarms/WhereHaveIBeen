# ios-app Specification

## Purpose

A native iPhone viewer (`ios/`, SwiftUI) for the same per-user data as the web app. It
only views data; on iPhone, the OwnTracks app does the recording.

## Requirements

### Requirement: Sign in with the same account
The app SHALL sign in with the WhereHaveIBeen username and password, check them with `/api/me/devices`, and keep them in the Keychain.

#### Scenario: Wrong password
- **WHEN** the API rejects the credentials
- **THEN** the app shows "Wrong username or password" and stays on the sign-in screen

### Requirement: Same views as the web app
The app SHALL offer Map, Stats, Everyone and Settings tabs, using the same API endpoints and stat wording as the web app. The Map tab offers routes or heatmap, a flights toggle, and a Configure sheet for device, time frame and buffer.

#### Scenario: Map tab
- **WHEN** a signed-in user opens the Map tab
- **THEN** they see their corridor and the first stat tiles, with a Configure sheet for filters

### Requirement: Works offline from saved data
The app SHALL cache the last responses on the phone. When the server cannot be reached, it SHALL show them, marked as saved data.

#### Scenario: No network
- **WHEN** the phone is offline and a map was loaded before
- **THEN** the saved map is shown with "Showing saved data"

### Requirement: Server progress
While the server computes, the app SHALL show the same progress stages as the web app and poll until the data is ready.

#### Scenario: Refresh
- **WHEN** the user forces a refresh
- **THEN** a progress strip shows the server's stage until the new data arrives
