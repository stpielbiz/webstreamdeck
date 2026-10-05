// Set to "owner/repo" of the GitHub repository that builds the Fire TV app.
export const GITHUB_REPO = "";

export const APK_URL = GITHUB_REPO
  ? `https://github.com/${GITHUB_REPO}/releases/latest/download/stream-deck-tv.apk`
  : null;
