# Switch PayPal recipient to payment@jolzplay.com

## What changes for users
- The Home payment card, "How to pay" steps, and the "transfer sent" confirmation will all say to send the $60 USD Friends and Family payment to **payment@jolzplay.com** instead of Streamivotv@gmail.com.
- Everything else (price, 1-day trial, +48h once, manual activation, login email in the note) stays the same.

## Note
- The guide picture inside "How to pay" may still show the old email. The written steps will show the new one. Send an updated picture if you'd like it replaced.

## Technical details
- Update `email` and the recipient step in `src/content/payment.ts`.
- Search the project for any other `Streamivotv@gmail.com` mentions and replace them.
- Update the subscription memory with the new recipient address.
