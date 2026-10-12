# Proposal

## Why

Recording runs smoothly on iPhones but keeps stopping on Samsung phones. Both use the same
stock OwnTracks app, posting to the same `https://mini.romangarms.com/pub`. On iOS the OS
itself wakes OwnTracks for significant location changes, so nothing has to stay alive. On
Android, OwnTracks has to keep a foreground service running, and One UI's battery management
stops it: sleeping apps, "Put unused apps to sleep", and background restrictions. Today our
setup guide gives Android users the same eight steps as iPhone users and nothing about
battery. The map then has gaps that only show up afterwards.

The fix is configuration, not new software. We give Samsung users an OwnTracks settings
profile tuned for One UI and the exact One UI settings that keep it running, so Android
records about as reliably as iOS without draining the battery.

## What Changes

- A **Samsung OwnTracks profile**: a small OwnTracks configuration file kept in this repo.
  It switches the app to HTTP mode with our recorder URL and sets its tracking behaviour to
  match what iOS does: significant-change monitoring, a 500 m displacement, no piggy-backing
  on other apps' GPS, autostart on boot. It contains no username or password.
- The **setup guide** (`/how-to-use` and the setup dialog on the map page) gains an
  "Android / Samsung" section with:
  - a one-tap link that loads the profile into OwnTracks, plus a file download as a fallback
  - the One UI battery steps: battery "Unrestricted", add OwnTracks to "Never sleeping apps",
    location "Allow all the time"
  - how to check it is working: the OwnTracks Status screen and the queue count
- The iPhone steps are unchanged.
- No native Android app, no change to OwnTracks, no server or API change.
- The setup wizard that came over from the old branch is not part of this change.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `setup-guide`: the guide stops giving one set of steps for both platforms. It adds an "Android / Samsung" section with the Samsung OwnTracks profile (one-tap link and file, no credentials), the One UI battery steps, and how to verify recording. The iPhone steps and the new-account dialog trigger are unchanged.

## Impact

- **Files**:
  - the new `static/owntracks/samsung.otrc` (the profile)
  - `templates/how-to-use.html` and the setup dialog in `templates/index.html`
  - the setup guide's small JS that builds the one-tap link (`static/js/`)
- **No change**: `app.py` routes, the WhereHaveIBeen-API, the OwnTracks recorder, the iOS app.
- **Users**: Android users follow a new section once. Existing iPhone users see nothing new.
- **Risk is low and reversible**: the profile only sets OwnTracks preferences the user can
  change back in the app. Removing the section restores today's guide.
- **Follow-ups this change does not cover**:
  - Every `/pub` post makes the API run a fresh bcrypt (cost 12) password check with no
    caching. That's worth looking at in WhereHaveIBeen-API if uploads turn out to be the
    bottleneck.
  - The features on `backup-openspec` come in later, one at a time.
