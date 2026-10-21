# Native app notes

These rules apply to `native-app/` (the Fire TV app). Read `AGENTS.md` at the project root for the site-wide rules.

- Native Fire TV app lives in `native-app/android/` (Kotlin WebView + Media3 player, JS bridge `window.StreamDeckNative`) and is built by `.github/workflows/android.yml` — providers block server/browser playback, so device-side playback is required.
- Native app checks GitHub releases at launch/on request; installs via Android's user-approved installer — secure in-app upgrades.
- Native Back is consumed once on key release and routed to the site's layer-aware handler; player close and completion have separate callbacks — no skipped layers.
- Provider calls use `device-provider.ts` hooks: Fire TV runs `iptv-provider.ts` on-device via `fetchToUrl` (body served at `/__native-body/<id>`; `fetchText` fallback), else server — providers blank our servers; giant script strings froze the page.
- Recordings are device-only: native `RecordingManager` (foreground service + alarms) saves .ts files and its index on the Fire TV; web reads them via bridge — browsers can't record in background.
- Player recents bar: `StreamDeckNative.setRecentChannels` feeds it; Down toggles, OK switches (reports `__streamDeckChannelSwitched`). Live-only: VOD keeps Down for seeking.
