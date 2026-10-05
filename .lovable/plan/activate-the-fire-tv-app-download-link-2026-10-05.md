# Activate the Fire TV app download link

The download page (`/download`) already exists with the install guide and a disabled "Coming soon" button. The GitHub repository is now connected and the first APK release has been published, so the download button can go live.

## Change

- Set `GITHUB_REPO = "stpielbiz/webstreamdeck"` in `src/lib/app-download.ts`.

That single value turns `APK_URL` into:
`https://github.com/stpielbiz/webstreamdeck/releases/latest/download/stream-deck-tv.apk`

The `/download` page then automatically shows:
- An enabled **Download for Fire TV (APK)** button.
- The copyable link for the Downloader app on Fire TV.

No other pages change — the landing page and in-app menu already link to `/download`.

## Verification

- Confirm the GitHub release exists by requesting the release URL (expects a redirect to the APK, not a 404).
- Open `/download` in a test browser: button enabled, correct link shown, no page errors.
- Build must stay clean.

## Technical details

- File touched: `src/lib/app-download.ts` (one constant).
- The APK itself is built by the existing GitHub Action (`.github/workflows/android.yml`) and published as a release asset named `stream-deck-tv.apk`; the `releases/latest/download/...` URL always points at the newest build, so future app updates need no code change here.
