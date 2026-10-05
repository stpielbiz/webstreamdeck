# Add an automatic Fire TV app update checker

The installed Stream Deck TV app will check for a newer native release whenever it launches. If one exists, it will show a remote-friendly update window; choosing **Update** downloads the APK and opens Fire TV's standard installer for the user's approval.

## Update experience

- Check the latest published GitHub release once when the native app launches.
- Compare the release's numeric build version with the installed Android `versionCode`, rather than relying on text labels.
- Do nothing when the app is current or the check cannot reach GitHub, so network problems never block streaming.
- Show a focused, D-pad-friendly native update window containing the installed and available versions.
- Provide **Update** and **Not now** actions. “Not now” continues into Stream Deck normally; the prompt can return on the next launch.
- Download only after the user chooses **Update**, show download progress/status, then open Fire TV's standard install screen.
- Fire TV will still require the user to approve installation; the app will not attempt a silent update.

## Reliable release metadata

- Extend the existing GitHub Actions release job to publish a small `update.json` asset alongside `stream-deck-tv.apk`.
- Include the release's `versionCode`, `versionName`, and stable APK download URL in that file.
- Keep the existing latest-release APK URL and public download page unchanged.
- Ensure each workflow run has a strictly increasing `versionCode`, preserving Android's update requirements.

## Android installation support

- Add the Android permission required to request package installation.
- Add a secure file provider so the downloaded APK can be handed to the system installer without exposing app-private files.
- Download updates into the app's cache, replace stale update files, and verify the download completed before opening the installer.
- If Fire TV has not allowed Stream Deck to install unknown apps, direct the user to the appropriate system permission screen and let them retry.
- Keep the same application ID and signing identity so a new APK installs over the existing app instead of creating a second app.

## Technical details

- Add a small native updater module under the Android app and invoke it from `MainActivity` after the TV interface starts.
- Use Android's built-in networking/download and package-install intents; no new server or database is required.
- Add the provider declaration and cache-file path configuration to the Android manifest/resources.
- Add generated release metadata to `.github/workflows/android.yml`, with `stream-deck-tv.apk` remaining the release asset name.
- Record the native updater architecture in `AGENTS.md` and add implementation/device testing tasks to `roadmap.md`.

## Verification

- Build the Android release and confirm the generated release contains both `stream-deck-tv.apk` and `update.json`.
- Verify an up-to-date install opens Stream Deck without a prompt.
- Verify an older install shows the update window at launch and both remote actions work.
- Verify **Update** downloads the APK and reaches Fire TV's installer; approve it and confirm the installed version increases without losing app data.
- Verify unavailable GitHub/network access fails quietly and does not prevent login or playback.
- Final on-device installation approval and update testing will require the owner's Firestick.
