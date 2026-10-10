# Fire TV display size

## Goal
Add a **Display size** preference in User Settings with **Large**, **Medium**, and **Small** choices. Large remains the default. The preference affects only Fire TV screens.

## User experience
- Add a remote-friendly three-option selector near the top of Settings.
- Describe the effect clearly: Large shows bigger menus and cards; Small fits more items on screen.
- Save the choice to the signed-in account so it follows the user to another Fire TV.
- Apply changes immediately after selection, without restarting the app.
- Keep focus outlines and remote navigation behavior unchanged and clearly visible at every size.

## Implementation
- Extend `user_settings` with a validated `screen_size` value: `large`, `medium`, or `small`, defaulting to `large`; retain the existing account-only access rules.
- Extend the existing settings read/save functions and shared settings query so display size and playlist-sync preferences are saved together without overwriting each other.
- Add a shared Fire TV display-size wrapper/state at the TV shell level, leaving regular browser screens unchanged.
- Define coordinated size variants for TV navigation menus, headings, spacing, movie/show cards and grids, home shelves, Live TV rows, and title popups. Use component sizing rather than browser zoom so remote focus and scrolling remain reliable.
- Ensure fixed-size controls and artwork keep stable proportions and no text or focus indicator is clipped in Medium or Small.

## Verification
- Confirm a new account or missing setting uses Large.
- Switch among Large, Medium, and Small and verify menus, cards, text, Live TV, and movie/show popups resize immediately.
- Reload and revisit the TV screens to confirm the saved size persists.
- Test remote movement and visible focus at Fire TV resolution across Home, Movies/Shows, Live TV, and a title popup.
- Confirm regular browser pages do not change size.
