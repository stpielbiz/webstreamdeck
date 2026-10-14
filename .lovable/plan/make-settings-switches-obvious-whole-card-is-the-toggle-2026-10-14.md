# Make Settings switches obvious: whole card is the toggle

## What changes

The two on/off settings — **Sync my playlists** and **Background updates** — become one big button each. You press anywhere on the card (title, description, or the switch itself) to turn it on or off. There is no tiny target to hunt for.

- **On** = the card is highlighted: coloured border, soft tint, the pill filled, and the word **On** shown in the highlight colour.
- **Off** = the card is plain and slightly dimmed, the pill is empty, and the word **Off** is shown.
- On a computer the card lights up when the mouse is over it, so it reads as clickable.
- On Fire TV the remote lands on the whole card — one press of OK flips it. The thick inset highlight that marks the selected item still appears, so you always know which card you are on.
- Nothing else changes: the same messages appear after a change ("Background updates are on", "All background updates stopped"), turning Background updates off still stops an update that is running, and the cards stay in the same top-to-bottom order for the remote (Back, TV display size, Sync my playlists, Background updates, movie & show details, Update library).
- While a change is being saved the card briefly goes dim and ignores presses, so you can't flip it twice by accident.
- **TV display size** (a choice of three sizes, not on/off) and the admin-only switches keep their current look.

## How it works

New shared component `src/components/setting-toggle-card.tsx`:

- Renders a single `<button type="button" role="switch" aria-checked={checked}>` filling the card: `w-full text-left` with the existing card padding, icon + title, description, and a right-hand on/off indicator.
- Props: `icon`, `title`, `description`, `checked`, `disabled`, `onToggle`, `focusKey`.
- Whole-card focus/remote wiring lives on that button: `data-tv-focus`, `data-remote-row`, `data-zone-entry="true"`, `data-focus-key={focusKey}` — one focusable element per row, so ordered-row navigation in `src/lib/use-spatial-nav.ts` (which walks `[data-remote-row]` in DOM order and requires a `[data-tv-focus]` control inside each row) keeps stepping one card at a time.
- State styling: on → `border-primary/60 bg-primary/10`, off → `border-border bg-card` with `opacity`-dimmed description; `hover:border-primary/40` for mouse users. The existing global rule for `[data-tv-focus]:focus` (inset 3px ring + inner border) continues to supply the selection highlight, so no new focus CSS is needed.
- Indicator: a presentational pill (track + thumb divs, plus an **On**/**Off** word) that mirrors the current switch look. The Radix `Switch` is itself a `<button>`, so it cannot sit inside the card button — it is replaced here by this non-interactive marker, and the card button carries `role="switch"` + `aria-checked` for screen readers.

`src/routes/_authenticated/settings.tsx`:

- The two `<label>` cards (lines ~124-156) are replaced by two `<SettingToggleCard>` usages, keeping `toggle` and `toggleBackground` as the `onToggle` handlers and the same `disabled` condition (`settings.isLoading || save.isPending`).
- The inner `<span data-remote-row>` wrappers and the `Switch` imports/usages for these two cards are removed; `Switch` stays available in the project (still used in `src/routes/_authenticated/admin.tsx`).
- No new settings, no database changes, no server functions — `user_settings.sync_playlists` and `user_settings.background_updates` are saved exactly as before.

## Verification

- Build clean via `/tmp/observability/build-errors.log`.
- Authenticated preview: press on the description text of each card and confirm the pill, the On/Off word, the highlight, and the confirmation message all change together; press again to reverse.
- Confirm the remote-order walk still visits every Settings control once, in order, with no skipped card.
- Web part lands on publish.
