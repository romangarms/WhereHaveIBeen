# Design

## Context

See proposal.md for why. Facts below come from the source of the systems involved, checked
on 2026-10-12.

**Server.** `/pub` on `mini.romangarms.com` goes through Traefik. ForwardAuth calls
WhereHaveIBeen-API's `/auth/verify`, which checks the Basic-auth password and pins
`X-Limit-U` to the authenticated user. Traefik then passes the request to the stock
`owntracks/recorder` image. The recorder's `dopublish` stores **one JSON object per POST**.
An array has no `_type`, so it isn't stored as a location. OwnTracks Android already sends
one message per POST, so nothing here limits us, and nothing here changes.

**OwnTracks Android** (`owntracks/android`, HEAD `3129fc2`):

- **Location request** (`BackgroundService.setupLocationRequest`). Significant mode asks the
  fused provider for `locatorInterval` (default 60 s), `locatorDisplacement` (default
  500 m), and balanced-power priority. On Android 16+ it uses GNSS only when
  `useGNSSInSignificantMonitoringMode` is on.
- **Fastest interval.** It is 1 s unless `pegLocatorFastestIntervalToInterval` is on. With
  1 s, OwnTracks also receives every fix another app (navigation, say) asks for, and wakes
  and uploads for each one.
- **Staying alive.** It runs a `START_STICKY` foreground service, re-arms itself with an
  alarm when swiped from Recents, and restarts on boot (`autostartOnBoot`, default on). Its
  Play build cannot request the battery-optimization exemption itself, so the user has to
  grant it in Settings. That's why our guide has to.
- **Importing a profile.** `owntracks:///config?inline=<base64 JSON>` URIs and `.otrc` files
  work only after the user enables "Allow external configuration" (Preferences → Remote
  control). That setting cannot itself be set by an import. An import applies only the keys
  present in the file (`Preferences.importConfiguration`). Enum values are integers:
  `mode` HTTP = 3, `monitoring` Significant = 1.

**One UI.** Apps that aren't on "Never sleeping apps" can be put to sleep automatically.
Sleeping apps lose background execution, which ends the OwnTracks service until the user
opens it again. Battery "Optimized" also allows Doze-era restrictions. "Unrestricted" plus
"Never sleeping apps" is the combination One UI documents for apps that must run in the
background.

## Goals / Non-Goals

**Goals:**
- A Samsung phone records with the stock OwnTracks app as continuously as an iPhone does,
  through a normal day: screen off, reboots, and other apps using GPS.
- Battery use no worse than OwnTracks' own defaults; better where we remove 1 s
  piggy-backing.
- A change small enough to review in one sitting and to revert by deleting a section.

**Non-Goals:**
- A native Android app or OwnTracks fork. That's only on the table if this proves
  insufficient.
- Non-Samsung OEM guides. The section is written so another OEM's steps can be added later.
- Server-side changes, including the per-request bcrypt cost noted in the proposal.
- Changing how iPhone users set up.

## Decisions

**1. Match iOS's model: Significant monitoring, not Move.** iOS OwnTracks works well in
significant-change mode. Android's Significant mode with a 500 m displacement is the closest
equivalent, and keeps the fused provider in balanced power. Move mode keeps GNSS on
continuously, the opposite of not draining the battery. *Alternative:* Move with a long
interval still holds GNSS and wakes the processor often; rejected.

**2. Pin the fastest interval (`pegLocatorFastestIntervalToInterval: true`).** This is the
main battery lever available without code. Without it, a drive with Google Maps navigating
delivers a fix every second to OwnTracks, each one queued and posted, and each post costs a
bcrypt check on the server. With it, OwnTracks takes at most one fix per 60 s.

**3. Leave GNSS in Significant mode off at first (`useGNSSInSignificantMonitoringMode`
unset).** Balanced power without GNSS is what iOS's significant-change service effectively
does: cell and Wi-Fi. On Android 16 / One UI 8 that may make highway drives too coarse. The
validation drive (tasks §3) checks this. If corridors come out patchy, turning it on is a
one-line profile change, not a design change.

**4. Profile keys.**

| Key | Value | Why |
|---|---|---|
| `_type` | `"configuration"` | Required by OwnTracks import |
| `mode` | `3` | HTTP |
| `url` | `"https://mini.romangarms.com/pub"` | Same as today's guide |
| `monitoring` | `1` | Significant |
| `locatorDisplacement` | `500` | OwnTracks default; matches iOS significant change |
| `locatorInterval` | `60` | OwnTracks default |
| `pegLocatorFastestIntervalToInterval` | `true` | Decision 2 |
| `ping` | `30` | Halves the idle heartbeat wake-ups from the default 15 min |
| `autostartOnBoot` | `true` | Explicit, in case it was turned off |

No `username`, `password`, `deviceId` or `tid`: the import leaves absent keys alone, so
existing values survive. A shared link must never carry credentials either.

**5. One file, two deliveries.** `static/owntracks/samsung.otrc` is the single source of
truth. The guide's JS fetches it, base64-encodes it, and builds the
`owntracks:///config?inline=` link at page load. The same file is the download fallback.
*Alternative:* hard-code the link in the template; rejected, because then two copies of the
profile would drift apart.

**6. Guide placement.** The account steps (create account, username, password, device ID)
stay shared. After them, an "iPhone" block (today's steps) and an "Android / Samsung" block
(install, enable external config, tap profile, enter credentials, battery steps, turn
external config back off, verify). We show both blocks, not detect the OS: someone setting
up a partner's phone from a laptop needs to see the Android steps.

## Risks / Trade-offs

- [One UI menu names differ between versions (One UI 5 puts battery under "Battery and
  device care")] → Paths are written for One UI 6–8, which the test phone runs. A one-line
  note covers older versions. Verified on the real phone in tasks §3.
- [Users leave "Allow external configuration" on] → The guide says to turn it off after
  importing. The profile can't change it either way.
- [Significant mode without GNSS is coarse on Android 16] → Decision 3: measured, and
  reversible in the profile.
- [It still dies on some firmware despite every setting] → Then we have evidence: the
  Status-screen check says whether recording or upload stopped. That is the trigger to
  revisit a code-level fix. This change does not pre-empt it.

## Migration Plan

Existing Android users can load the profile over their current setup: only the listed keys
change. To roll back, re-select their old monitoring mode in OwnTracks, or remove the guide
section. There is no server state.

## Open Questions

- Whether to turn on `useGNSSInSignificantMonitoringMode` for One UI 8 (Decision 3). This is
  answered by the validation drive and changes only one value in the profile.
