# Spec Delta

## REMOVED Requirements

### Requirement: Same steps for both platforms
**Reason**: Android needs its own steps. On One UI, OwnTracks has to be configured and exempted from battery management before it records reliably. iOS needs neither.
**Migration**: iPhone users see the same steps as before. Android users follow the new "Android / Samsung" section (see "Android section in the setup guide").

## ADDED Requirements

### Requirement: Samsung OwnTracks profile
The project SHALL publish one OwnTracks configuration profile for Samsung phones. It sets HTTP mode, the recorder URL, significant-change monitoring with a 500 m displacement and 60 s interval, the fastest interval pinned to the interval, a 30-minute ping and autostart on boot.

#### Scenario: Profile contents
- **WHEN** the profile is loaded into OwnTracks Android
- **THEN** OwnTracks shows connection mode HTTP, URL `https://mini.romangarms.com/pub`, monitoring "Significant", locator displacement 500 m, locator interval 60 s, and "Start on boot" on

#### Scenario: Settings not in the profile are untouched
- **WHEN** the profile is loaded into an OwnTracks app that already has a device ID, tracker ID, username and password
- **THEN** those values are unchanged

### Requirement: Profile carries no credentials
The profile and any link that delivers it SHALL NOT contain a username, password or other account data.

#### Scenario: Shared link
- **WHEN** someone opens the profile link or file without being signed in
- **THEN** they get only tracking and connection settings, not any account's credentials

### Requirement: One-tap delivery with a file fallback
The setup guide SHALL offer the profile as an `owntracks:///config?inline=` link that opens OwnTracks' import screen, and as a downloadable `.otrc` file for importing from OwnTracks' Configuration management screen.

#### Scenario: Link on the phone
- **WHEN** an Android user with OwnTracks installed taps the profile link
- **THEN** OwnTracks opens its configuration import screen showing the profile's settings for the user to apply

#### Scenario: External configuration disabled
- **WHEN** OwnTracks says external configuration loading is disabled
- **THEN** the guide's preceding step has already told the user to turn on "Allow external configuration" in OwnTracks' Remote control settings, and to turn it off again after importing

#### Scenario: File fallback
- **WHEN** the link does not open OwnTracks
- **THEN** the user can download the `.otrc` file and import it from OwnTracks' Configuration management screen

### Requirement: Android section in the setup guide
The setup guide on `/how-to-use` and in the map page's setup dialog SHALL show an "Android / Samsung" section after the shared account steps. It SHALL leave the iPhone steps unchanged.

#### Scenario: iPhone user
- **WHEN** an iPhone user follows the guide
- **THEN** the steps they see are the same as before this change

#### Scenario: Android user
- **WHEN** an Android user follows the guide
- **THEN** they are told to install OwnTracks, load the profile, enter their username, password and device ID, and complete the One UI battery steps

### Requirement: One UI battery steps
The Android section SHALL list, in order, the steps One UI needs. Location "Allow all the time". OwnTracks' battery usage "Unrestricted". OwnTracks added to "Never sleeping apps". Notifications allowed. It SHALL give each step's settings path as One UI names it.

#### Scenario: Battery step
- **WHEN** the user reaches the battery step
- **THEN** the guide gives the path Settings → Apps → OwnTracks → Battery → Unrestricted

#### Scenario: Never sleeping apps step
- **WHEN** the user reaches the sleeping apps step
- **THEN** the guide gives the path Settings → Battery → Background usage limits → Never sleeping apps → add OwnTracks

### Requirement: Verifying recording
The Android section SHALL tell the user how to confirm recording works. They open OwnTracks' Status screen and check the endpoint state, the last location time and the outgoing queue length. A growing queue means points are recorded but not uploading.

#### Scenario: Healthy check
- **WHEN** the user opens OwnTracks' Status screen after setup and a short drive
- **THEN** the guide's description matches what they see: a recent last-location time and an empty or near-empty queue
