# Add a Firestick link on the main page

## What changes

On the landing page (`/`), add a "For Firesticks" link in the hero button row that goes directly to `/tv/pair` — the screen where a Firestick shows its pairing code and waits to be signed in.

- Where: `src/routes/index.tsx`, hero button row (next to "Log in another device" and "Get the Fire TV app").
- Link: `<Link to="/tv/pair">` with label like "Open on your Firestick".
- Style: ghost button like the other secondary hero links, so the row stays tidy.
- `/tv/pair` already works as a public page (shows the code, waits for approval) — no route changes needed.

## Verification

- Build passes; check the landing page in the preview shows the new link and it opens the pairing screen.
