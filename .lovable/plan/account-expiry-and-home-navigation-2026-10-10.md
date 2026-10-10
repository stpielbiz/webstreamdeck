# Account expiry and Home navigation

## What will change

- Rename every visible **Sections** return link across Live TV, Movies, Shows, Favourites, Guide, and Franchise screens to **Home**, while keeping its existing destination appropriate to web or Fire TV mode.
- Add a saved access record for each account with either:
  - a specific expiry date, or
  - **Never expires**.
- Give new accounts the existing one-day free trial by default. Backfill existing accounts from their original join date, while keeping the owner/admin account active without expiry.
- Extend the Admin account list with the current status, an expiry-date control, and a **Never expires** switch. Updates will be admin-only and validated on the server.
- Replace the static trial notice at the top of Home with the actual account status: expiry date, time remaining, expired state, or never expires. Show it on both browser Home and Fire TV Home.
- When access has expired, grey out and disable Live TV, Movies, Shows, Favourites, Franchise, Playlists, and related content links. Keep **Home**, **Settings**, and sign-out usable as requested.
- Guard direct navigation as well as menu clicks: an expired account opening a disabled address will return to Home rather than briefly exposing the screen.

## Technical details

- Add an account-access table with explicit grants and row-level rules: users can read only their own status; only authenticated admin server actions can change another account.
- Add a safe account-creation trigger so future signups receive a one-day expiry automatically.
- Add authenticated account-status functions and cache invalidation so an admin change appears without signing out.
- Centralize the expiry check in the authenticated shell and reuse it in both the browser and Fire TV menus, preserving the existing remote-focus behavior and making disabled entries non-focusable.
- Preserve role security: admin authorization continues to use the protected roles table and server-side role checks.

## Verification

- Confirm all former **Sections** links read **Home** and return to the correct Home screen.
- Test admin date changes, **Never expires**, and switching back to a dated expiry.
- Test active, expired, and never-expiring accounts on browser and Fire TV layouts.
- Confirm expired users can use Home, Settings, and sign-out, while disabled destinations cannot be entered by click, remote focus, or direct address.
