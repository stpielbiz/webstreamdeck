# Contact us page (support and feedback)

## What users get
- A new **Contact us** page, reachable from the menu on the web and on Fire TV (remote-friendly), and from the public homepage footer.
- Two big buttons at the top: **Support** and **Feedback** (one selected at a time).
- Form fields:
  - Name
  - Jolzplay account email (filled in automatically when signed in, editable; required)
  - Subject line (short)
  - Message
- **Send** button, then a "Thanks, we got your message" confirmation.
- No email address is shown anywhere on the page.

## What you receive
- Each message goes to payment@jolzplay.com.
- Subject: `[Support] <their subject>` or `[Feedback] <their subject>`.
- Body includes: type, name, Jolzplay account email, whether they were signed in, device (Fire TV or browser), date/time, and the message.
- Replying goes straight back to the user's account email.

## Sending setup needed first
- The app needs a sending address on your domain. We'll use **notify.jolzplay.com** so it doesn't interfere with your Zoho mailbox on jolzplay.com.
- You'll click "Set up email domain" and follow the steps; messages start arriving once that domain is verified.

## Technical details
- Configure Lovable email sender domain `notify.jolzplay.com`; scaffold transactional email templates; add a `contact-message` template.
- Route `src/routes/contact.tsx` (public, works signed in or out) with head metadata; TV-friendly `data-tv-focus` controls; links added in app shell, TV home menu, and homepage.
- Server function validates input with zod (lengths, email format), rate-limits per sender, sets reply-to to the account email, and sends to the fixed recipient kept server-side only (never sent to the browser).
