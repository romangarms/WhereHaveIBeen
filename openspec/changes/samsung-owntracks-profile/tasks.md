# Tasks

## 1. Profile

- [ ] 1.1 Add `static/owntracks/samsung.otrc` with exactly the keys in design §4. Verify it parses as JSON and is served by `python app.py` at `/static/owntracks/samsung.otrc`.
- [ ] 1.2 On the Samsung test phone, enable "Allow external configuration", import the file through Configuration management, and confirm OwnTracks' preferences show every value from design §4 while the existing username, password and device ID are unchanged. Record the One UI and OwnTracks versions in the PR.

## 2. Setup guide

- [ ] 2.1 Restructure the guide on `templates/how-to-use.html` into shared account steps, an unchanged iPhone block, and an "Android / Samsung" block with the steps from the spec. Verify that the iPhone text is byte-for-byte unchanged in the diff.
- [ ] 2.2 Mirror the same structure in the setup dialog in `templates/index.html`. Verify that the dialog opens on desktop and at phone width without horizontal scroll.
- [ ] 2.3 Build the `owntracks:///config?inline=` link from the `.otrc` file at page load, in a small function next to the guide's existing JS, with the download link as the fallback. Verify that tapping it on the test phone opens OwnTracks' import screen with the profile values.

## 3. Validation on a Samsung phone

- [ ] 3.1 With the profile and battery steps applied, record a normal day: a commute with the screen off, a drive with Google Maps navigating, an overnight charge and a reboot. Verify on tracker.romangarms.com that the device's track has no gaps longer than the 30-minute ping while the phone was on.
- [ ] 3.2 Compare OwnTracks' battery use in Settings → Battery for that day against a day on the current setup. Verify it is no higher. Note the result in the PR.
- [ ] 3.3 Check the highway portions of the corridor from 3.1. If they are patchy, set `useGNSSInSignificantMonitoringMode: true` in the profile, repeat one drive, and record which setting shipped (design §3).

## Workflow follow-up

- Merge after 3.1–3.3 pass on the test phone, then archive the change.
- Separately, consider asking for per-request auth caching in WhereHaveIBeen-API if uploads ever back up.
