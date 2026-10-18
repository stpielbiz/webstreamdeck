# Live TV recordings (Fire TV first, PC with notice)

## What the user gets
- **Hold OK on a channel** (Fire TV) or **right-click** (PC) opens a small menu: **Add to favourites / Remove from favourites** and **Record**. A quick press still plays the channel, as it does now.
- **Record** asks: **Now** or **Later**.
  - **Now**: starts right away. Length defaults to "until this programme ends" (from the guide), and you can change it to 30 min, 1 h, 2 h, 3 h, or a custom length.
  - **Later**: pick a date and time (remote-friendly up/down pickers), then a length. It defaults to the end of the programme on at that time.
- **Recordings menu** (TV home and website): shows recording, scheduled, and finished items. Each has Play, Stop or Cancel, and Delete. The top shows Fire TV storage, e.g. "12.4 GB free of 16 GB".
- **Storage full**: the recording stops, the part already recorded is kept, and you see a "Storage full" message.
- **PC**: the Record option shows a notice: "Recording works on the Stream Deck Fire TV app. On a computer, recording would need the tab to stay open, so it's Fire TV only for now." Recordings made on a Fire TV are listed, but you can only play them on that Fire TV.

## Technical details
- **Native (Fire TV APK, needs new release)**: new `RecordingService` (Android foreground service with a notification) that copies the live stream to app storage with OkHttp. HLS streams get their segments added on; TS streams are copied directly. A free-space check runs every 10 s, and it stops below 300 MB. Future recordings use `AlarmManager.setExactAndAllowWhileIdle` and are re-scheduled after the device restarts. New bridge calls on `StreamDeckNative`: `startRecording(json)`, `scheduleRecording(json)`, `cancelRecording(id)`, `deleteRecording(id)`, `listRecordings()`, `getStorageInfo()`, `playFile(path)`, plus a `__streamDeckRecordingUpdate` callback.
- **Database**: `recordings` table (user_id, device_id, playlist_id, item_id, title, programme, start_at, end_at, status, size_bytes, row-level security on own rows), so the website can list them. Each device's recordings are linked by a per-device id saved on that device.
- **Web**: shared `ChannelActionMenu` (hold or right-click), a `RecordDialog` (Now/Later, date/time and length pickers that work with the remote, focus kept inside the dialog), a `/tv/recordings` page plus a `/recordings` page, and a menu entry on TV home and the dashboard. This replaces the current "hold to toggle favourite" on Live TV, Favourites, and Home channel rows.
- Recording uses the device's own connection to your provider, just like playback does.
- Update roadmap.md, AGENTS.md (recording rule), and memory (menu behaviour, storage warning).

## Limits
- You need the next Fire TV app update before recording works.
- Some providers allow only one connection, so recording and watching at the same time may fail. The app will warn about this.
