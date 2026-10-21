# Admin page: collapsible logs, remote-friendly accounts and expiry

## What changes
1. **Logs collapse:** the "Connection & stream logs" section shows only its title, the on/off switch and a **Show logs (30)** button. Pressing it opens the list; each log still opens on its own. Closed by default, so the accounts are a few presses away.
2. **Accounts as cards instead of a wide table:** each account becomes one card, one under the other, going down the page. Each card shows the email, badges (Admin, unconfirmed, Transfer sent), joined / last sign-in, counts, the expiry controls and the action buttons. Up/Down moves between cards, Left/Right moves along the buttons inside a card. No more sideways scrolling to reach things.
3. **Easy expiry with the remote:** the date box is replaced by big buttons:
   - **+1 day**, **+1 month**, **+1 year** (counted from the current expiry, or today if already expired)
   - **Never expires** on/off
   - a readable line showing the new date, like "Expires Oct 21, 2027", then **Save**
   - On a computer, a small date box remains for picking an exact day.
4. **All buttons reachable:** Refresh, the admin/reset/delete buttons and the never-expires switch all get the remote highlight, and the delete confirmation becomes an on-screen dialog the remote can use (the browser pop-up doesn't work well on the Fire Stick).

## Technical details
- `src/routes/_authenticated/admin.tsx` only: add `logsOpen` state; replace `<table>` with a card list; add `data-tv-focus` to all actions; rewrite `AccountExpiryControl` with date arithmetic on a `Date` and keep `<Input type="date">` hidden in TV mode; swap `window.confirm` for a Dialog.
