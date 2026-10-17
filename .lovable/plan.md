# Fire Stick friendly homepage

## What changes
- Rebuild the public homepage so the remote can move through every button and card with clear highlighting. It opens on the main button, and Up/Down/Left/Right move in a predictable way.
- Main actions as large buttons:
  - Start free trial
  - Sign in
  - Sign in this TV with a code
  - Log in another device
  - Get the Fire TV app
- New feature cards covering what the app actually does:
  - Live TV with guide, recent channels and multi-view
  - Movies and Shows by year
  - Franchise collections
  - Favourites, including favourite categories
  - Search by title or actor
  - Resume anywhere
  - Playlist sync across playlists
  - Several playlists, with a different one per device
  - Automatic stream recovery
- A short "How it works" strip: add your playlist, pick a device, watch.
- On the Fire TV app, the signed-out home puts "Sign in this TV with a code" first.

## Easy to change later
- All homepage wording, buttons, feature cards and steps live in one simple content list. Editing a title, a description or a card's order is a one-line change, and you can ask me any time.

## Technical details
- New `src/content/homepage.ts` holding the hero text, the actions (label, link, style) and the features (icon name, title, body).
- `src/routes/index.tsx` renders from that file. It uses the existing remote navigation (`useSpatialNav`) with `data-tv-focus` targets and the shared focus ring, larger hit areas, and autofocus on the main button.
- Keep the signed-in redirect to the dashboard, or to the TV home in TV mode. Use `isFireTvDevice()` to choose the primary action.
- Update the head() description. Add an AGENTS.md rule that homepage copy lives in the content file.
