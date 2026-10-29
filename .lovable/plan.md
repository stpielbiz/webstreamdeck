# Fix: Xtream pop-up closes when switching away to copy the username (PC)

## What we know
- Signed in as stpierrel@gmail.com, on a PC: Add source → Xtream Codes → type server → go copy the username from another window/tab → come back to paste → the form is gone.
- No saved logs exist for that moment, so the cause is not confirmed yet.
- Coming back to the Jolzplay window triggers three things at once: a "new website version?" check that reloads the page if a newer version was published, a sign-in renewal, and a refresh of the app's data. Any of these can wipe a half-filled form.

## Steps
1. Reproduce in a desktop test browser: open the Xtream form, type a server, switch away from the window, switch back, then paste into Username. Note whether the page reloads, the form resets, or Back is triggered.
2. Fix whichever one step 1 shows, plus close the other two so this can't happen another way:
   - **Update reload:** never reload for a new website version while someone is typing in a form or has unsaved text in one. Wait until they leave the form, or until the next time the page is idle.
   - **Data refresh / sign-in renewal:** keep the add/edit form open and its typed values when the playlists list refreshes in the background.
   - **Back by mistake:** the hidden Back on the form only reacts to a real Back press (remote, Escape or Backspace outside a text field), never to focus changes or pasting.
3. Keep what you typed if the page ever does reload: save the in-progress form for this browser tab (never the password) and restore it on return.
4. Re-run step 1, then fill all fields and press Connect. Check that Fire TV remote navigation on the form still works.

## Technical details
- `src/lib/web-update.ts`: reloads on `focus`/`visibilitychange` when the published bundle fingerprint changed. Add a "busy" guard (focused input/textarea, or a `data-unsaved-form` marker on the page) and defer the reload.
- `src/routes/__root.tsx`: `refreshOnce()` on visibility and the auth listener calling `router.invalidate()` / `invalidateQueries()`. Confirm neither remounts the playlists route.
- `src/routes/_authenticated/playlists.tsx`: form step/state is local `useState`. Mark the details step with `data-unsaved-form`, keep a sessionStorage draft (name, server, username, kind; no password) and clear it on Connect/Cancel.
- Diagnosis stays unconfirmed until step 1.
