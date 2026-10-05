# In-app download link and Home button on login

## What changes
1. **Download in the app (signed-in users)**: add a "Get the TV app" item to the main section menu (Home, Guide, Live TV, Movies, Shows, Favourites, Playlists...) so it shows on every signed-in screen, including Firestick screens. It opens the existing download page.
2. **Back to Home on the login screen**: add a clear "Back to Home" button at the top of the sign-in page (above the email/password and Google options) that returns to the main landing page. It is remote-focusable for Firestick.

## Technical details
- `src/components/layered-navigation.tsx`: append a Download entry (`/download`, `Download` icon) to the extra items next to Playlists/Admin, shown when signed in.
- `src/routes/auth.tsx`: add a ghost `Button asChild` + `Link to="/"` with an `ArrowLeft` icon, `data-tv-focus`, placed above the logo/card. Also on the "Check your email" state.
- No changes to sign-in logic.
