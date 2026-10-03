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
- Browsing uses a shared three-layer section → category → content workspace across TV and web, with zone-bound focus and compact preview playback — this keeps remote navigation deterministic.
- Device pairing uses the public `/device-login` entry screen and returns there after authentication; legacy Firestick and TV-specific links redirect to it.
