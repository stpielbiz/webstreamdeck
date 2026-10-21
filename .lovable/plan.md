# PayPal transfer payments (manual activation)

## How it works for the user
1. New accounts get the 1-day free trial (already in place).
2. On the Home screen (browser and Fire TV), the account card shows:
   - Price: **$60 USD per year**
   - Send to: **Streamivotv@gmail.com**
   - "Write your Streamivo login email in the PayPal note"
   - A **How to pay** button that opens step-by-step instructions (your uploaded guide, shown as a picture plus short text steps, with Friends and Family highlighted).
   - A **PayPal transfer sent** button.
3. Pressing **PayPal transfer sent**:
   - Adds 48 hours to their access (counted from now), once per account.
   - Shows a confirmation: "Thanks! We'll check your payment and activate your year. You have 48 more hours of access meanwhile. Make sure you used Friends and Family and put your login email in the note."
   - The card then reads "Payment pending review" with the new end time; the button disappears.
4. Expired users still see this card on Home, so they can pay and press the button to get back in for 48 hours.
5. Once you set their expiry in Admin, the card shows the active date as it does today.

## For you (Admin)
- The account list shows a **Transfer sent** badge with the date and time, so you know whom to check in PayPal.
- You activate by setting the expiry date as you do now; that clears the pending badge.

## Technical details
- Add `transfer_claimed_at` to `account_access`.
- New authenticated server function `claimTransferSent`: refuses if already claimed or never-expires; sets `expires_at = greatest(expires_at, now()) + 48h` and `transfer_claimed_at = now()` (server-side write, user can't set dates).
- `getAccountAccess` returns `transferClaimedAt`; admin list returns it too; admin expiry update clears it.
- Rebuild `subscription-banner.tsx` with remote-friendly focusable buttons and a focus-trapped instructions dialog; replace the disabled "Coming soon" PayPal button.
- Upload the guide image as an app asset.
- Save price, email, and the note rule to memory; update the subscription memory.
- Test: claim adds exactly 48h and only once.
