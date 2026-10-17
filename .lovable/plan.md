# Fire TV: signed-out goes to the pairing code screen

## What changes
- When the Fire TV app finds you signed out (session expired, or sign-out), it opens the "Sign in on your TV" screen that shows a code, instead of the email/password login page.
- Phones and computers keep going to the normal login page.
- The code screen still lets you choose the regular login if wanted (existing option kept).

## Technical details
- Add a small `isFireTvDevice()` helper: true when `window.StreamDeckNative` exists, or the current path is under `/tv` / `mode=tv`.
- `_authenticated/route.tsx` beforeLoad: redirect to `/tv/pair` when on Fire TV, else `/auth`.
- `app-shell.tsx` sign-out and the root `SIGNED_OUT` handling follow the same rule.
- `/auth` itself: if opened on the Fire TV app without an explicit choice, forward to `/tv/pair`.
- After pairing, `/tv/pair` already navigates to `/tv`.
- Record rule in AGENTS.md.
