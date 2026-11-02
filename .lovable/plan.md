# Replace the old Jolzplay icon on the Fire Stick home menu

## Why the old icon is still showing
- The new icon is only inside the Fire TV app itself. Your Fire Stick keeps showing the icon of the app version it has installed, so it changes only after the app is updated.
- The Fire TV home menu also keeps its own saved copy of app icons, and often doesn't refresh it after an update.
- The app's icon and home-menu banner are currently drawn shapes rather than regular pictures. Fire TV menus handle regular pictures more reliably and sometimes ignore drawn ones.

## Plan
1. Make regular picture versions of the Jolzplay icon (green play tile) and the wide home-menu banner (tile plus "JOLZ PLAY" on dark navy), in the sizes Fire TV expects.
2. Point the app at these pictures for its icon and banner, keeping the same app identity so it updates in place and keeps everyone signed in.
3. Release this in the next Fire TV app update.
4. Steps for you after updating, if the old icon is still there:
   - Restart the Fire Stick: Settings → My Fire TV → Restart.
   - If it's still old: Settings → Applications → Manage Installed Applications → Jolzplay → Clear cache, then restart again.

## Technical details
- Add `res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` (48–192 px) and `res/drawable-xhdpi/banner.png` (320x180), rendered from the existing vector artwork / brand colours (#121826, #21393B, #79DA8D).
- `AndroidManifest.xml`: `android:icon="@mipmap/ic_launcher"`, `android:banner="@drawable/banner"` (PNG takes priority over the XML; remove `banner.xml`).
- versionCode comes from the release workflow, so the next release installs as a normal update.
