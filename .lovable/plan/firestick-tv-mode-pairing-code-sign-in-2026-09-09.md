# Firestick TV Mode + Pairing Code Sign-in

Add a "Get the app" download/install section, plus a remote-friendly TV version of the site that people sign into on a Firestick with a short code instead of typing a password.

Note up front: a Firestick app is an Android app file (.apk), which cannot be built inside this web project. Instead the Firestick opens the site in its Silk browser (or a free browser app) and runs the TV layout full screen — same account, same playlists, same continue-watching. The download page is built so an actual app file can be dropped in later.

## What users get

1. **Install page** (`/get-app`, linked from the sidebar and the landing page)
   - Firestick card with step-by-step instructions: open Silk Browser, go to the short site address, choose "Sign in with code", add to favourites for one-click launch next time.
   - A short, remote-typeable address shown big, plus a QR code so they can check the steps on a phone.
   - Windows / iPhone / Android are not listed yet.

2. **TV mode** (`/tv` and its sub-screens)
   - Big-text, dark, 10-foot layout: left rail (Live TV, Movies, Series, Favourites, Continue watching), large focused tiles.
   - Full D-pad/remote control: arrow keys move focus, OK selects, Back goes up a level, Play/Pause and channel up/down work in the player.
   - Reuses the existing playlists, catalogue, favourites, guide and progress — nothing new on the provider side.

3. **Pairing code sign-in**
   - TV screen shows a 6-character code (e.g. `K7QM2P`) and the address to visit.
   - On a phone or computer, signed in to the account, the user opens the "Connect a TV" page, types the code, and confirms.
   - The TV signs itself in within a couple of seconds and stays signed in on that device.
   - Codes expire after 10 minutes, are single-use, and are rotated automatically if unused.

## Order of work

1. Device-pairing storage and server logic.
2. TV sign-in screen (code display + polling) and the phone-side "Connect a TV" page.
3. TV-mode layout, remote navigation, and the TV player.
4. Install/download page with Firestick instructions and QR code.

## Technical notes

- **Table `device_codes`** (RLS, explicit grants): `id`, `code` (unique, short, unambiguous alphabet), `user_id` (null until approved), `approved_at`, `consumed_at`, `expires_at`, `created_at`. Policies scope reads/updates to `auth.uid()`; the unauthenticated create/poll paths go through server functions only, never direct table access from the TV.
- **Server functions** in `src/lib/device-pairing.functions.ts`:
  - `createDeviceCode` — unauthenticated, rate-limited, returns code + expiry.
  - `approveDeviceCode` — `requireSupabaseAuth`, marks the row with `context.userId`.
  - `claimDeviceCode` — unauthenticated poll; once approved, mints a one-time sign-in link for that user via the admin client (loaded inside the handler) and returns the OTP token so the TV can establish a real session. Marks the row consumed immediately; single use, constant-time code lookup, generic errors on failure.
- **TV session**: TV exchanges the returned token with `supabase.auth.verifyOtp`, giving a normal long-lived session in that browser — existing `_authenticated` guards and RLS apply unchanged.
- **Routes**: `/tv/pair` (public, code screen), `/get-app` (public), `/connect-tv` under `_authenticated`, and `_authenticated/tv/*` for the TV screens with their own shell (`src/components/tv-shell.tsx`) instead of the sidebar shell.
- **Remote input**: a focus-manager hook (`src/lib/use-spatial-nav.ts`) mapping arrow/Enter/Backspace and media keys onto a grid of focusable tiles; `scrollIntoView` on focus change. Silk browser supports standard keydown events from the Firestick remote.
- **Web app manifest** (icons, name, standalone) so the TV page can also be pinned; no service worker, no offline mode.
- Reuses existing `iptv.functions.ts`, signed stream proxy and `video-player.tsx` — the TV player is a thin wrapper adding remote key handling and larger controls.

## Limits to be aware of

- Silk Browser on Firestick is the playback engine, so the same HLS-friendly / DRM-free stream limits as the website apply.
- A real sideloadable Firestick app would be a separate Android build outside this project; the install page is structured so it can be linked in later without redesign.
