# Simple expiry label beside the app name

## What changes
- Next to the **Streamivo** name in the top left, show a small, quiet label:
  - **Never expires** for accounts set to never expire
  - **Expires Oct 23, 2026** for accounts with an end date
  - **Expired** (in a warning colour) once access has ended
- This appears on the website header and on the Fire Stick TV home header. It's text only, so the remote never stops on it.
- The large "Your account never expires" card at the top of Home is removed.
- People who still need to pay (trial, pending review, expired) keep the PayPal card on Home, made smaller: one line with the price and the PayPal email, plus the **How to pay** and **PayPal transfer sent** buttons. The full steps stay inside **How to pay**.

## Technical details
- New small `AccountExpiryBadge` component reading `useAccountAccess()`; date formatted with `toLocaleDateString`.
- Render it beside the wordmark in `app-shell.tsx` (both header layouts) and in the TV shell/home header.
- `subscription-banner.tsx`: return nothing for never-expire accounts; compact the payment layout for others.
