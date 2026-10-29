# Keep the Fire Stick signed in after pairing

Goal: once a Fire Stick is paired with a code, it stays signed in until the user presses Sign out (or the account is deleted).

## What I found
- Every time a signed-in screen opens, the app asks the server "who is this?". If that check fails for any reason — Wi-Fi still waking up after the Fire Stick sleeps, a slow reply — it sends the device straight to the code screen, even though the sign-in is still valid.
- The sign-in is kept only in the web view's storage. If the Fire Stick closes the app while the sign-in is being renewed in the background, or before storage is written to disk, it can be lost, so a new code is needed.
- Nothing is logged when this happens, so we can't currently see which of the two caused each logout.

## Changes
1. **Don't kick out on a network hiccup.** Signed-in screens trust the sign-in saved on the device. They only send the device to the code screen when the server clearly says the sign-in is no longer valid, not when the connection fails or times out. If the connection fails, the app retries quietly in the background.
2. **Backup copy in the Fire TV app.** After a successful pairing and every background renewal, the Fire TV app keeps its own copy of the sign-in in its private storage. When the app starts and the web view has lost its sign-in, it restores the copy before showing anything, so no code is needed. Pressing Sign out deletes the copy.
3. **Safer renewal.** Renew the sign-in when the app comes back to the screen or wakes from sleep, and only once at a time, so two renewals can't cancel each other out.
4. **Logging.** Write a diagnostic line every time the device signs out or gets sent to the code screen, with the reason (pressed Sign out, server refused, no connection, restored from backup). If it ever happens again, you can switch on logs and I can see exactly why.

## What changes for users
- Paired Fire Sticks stay signed in through sleep, Wi-Fi drops, restarts and app updates.
- The code screen only appears after Sign out, for a deleted account, or when the server truly rejects the sign-in.
- Items 1, 3 and 4 work once the site is published. Item 2 needs the next Fire TV app update.

## Technical details
- `src/routes/_authenticated/route.tsx`: use `getSession()` (local) to decide; call `getUser()` in the background and redirect only on an auth error (401/403, `session_not_found`, `refresh_token_not_found`), never on fetch/timeout errors.
- New bridge methods on `window.StreamDeckNative` (`saveAuthBackup`, `readAuthBackup`, `clearAuthBackup`) stored in private SharedPreferences in `MainActivity.kt`; web side writes on `SIGNED_IN`/`TOKEN_REFRESHED`, restores with `supabase.auth.setSession()` before the guard runs, clears on explicit sign-out in `app-shell.tsx`.
- Visibility/wake listener triggers a single guarded `refreshSession()`; trace lines through the existing diagnostics logger in `__root.tsx`.
- Add a small test that a network error in the guard does not redirect, and an auth error does.
