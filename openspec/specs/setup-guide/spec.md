# setup-guide Specification

## Purpose

What the web app tells a new user so their phone starts sending locations: create an
account, then configure the stock OwnTracks app to publish to the recorder.

## Requirements

### Requirement: OwnTracks setup steps
The setup guide on `/how-to-use` and in the map page's setup dialog SHALL tell the user to install OwnTracks (iOS or Android), switch it to HTTP mode, enter their username, password and a device ID, and set the URL to `https://mini.romangarms.com/pub`.

#### Scenario: Following the guide
- **WHEN** a new user follows the guide on either platform
- **THEN** OwnTracks is configured to publish to the recorder under their account

### Requirement: Same steps for both platforms
The guide SHALL give one set of steps for both iOS and Android.

#### Scenario: Android user
- **WHEN** an Android user reads the guide
- **THEN** they see the same steps as an iPhone user, with an Android download link

### Requirement: Verification
The guide SHALL tell the user to send a location manually, then check OwnTracks' Status screen for the connection URL and an "idle" state.

#### Scenario: Verify
- **WHEN** the user taps upload in OwnTracks after setup
- **THEN** the Status screen shows the recorder URL and "idle"

### Requirement: Guide for new accounts
The map page SHALL open the setup dialog for a signed-in account that has no reporting device and no import. The dialog SHALL also be reachable from settings.

#### Scenario: New account
- **WHEN** a newly registered user lands on the map with no device data
- **THEN** the setup dialog opens
