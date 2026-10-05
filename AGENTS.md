<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Native Fire TV app lives in `native-app/android/` (Kotlin WebView + Media3 player, JS bridge `window.StreamDeckNative`) and is built by `.github/workflows/android.yml` — providers block server/browser playback, so device-side playback is required.
- Movies and Shows use sections → persistent 20/80 category/content browsing across TV and web, with zone-bound focus and compact preview playback — this keeps remote navigation deterministic without hiding context.
- Selecting a Movie or Show opens a compact modal with details and preview playback; remote Back closes it before leaving the section.
- Device pairing uses the public `/device-login` entry screen and returns there after authentication; legacy Firestick and TV-specific links redirect to it.
- The TV home uses a persistent menu/details workspace: focus previews a section, OK opens it, and content rows remain independently remote-navigable.
- The native Fire TV app checks the latest GitHub release metadata at launch and uses Android's installer for user-approved APK updates — this preserves device security while enabling in-app upgrades.
