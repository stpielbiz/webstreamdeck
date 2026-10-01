# General device login

## Goal
Replace the Firestick-specific setup experience with a simple way to sign into Stream Deck on any other device using its one-time code.

## Changes
- Replace “Watch on TV” and “Watch on Firestick” links with “Log in another device.”
- Send those links directly to the code-entry screen instead of the Firestick instructions page.
- Rename the code-entry screen and all guidance from “Connect a TV” to device-neutral wording such as “Log in another device.”
- Let a signed-out phone or computer sign in first, then return automatically to the code-entry screen instead of the dashboard.
- Update success, error, expiry, page title, and sharing descriptions to refer to “device” rather than TV or Firestick.
- Remove the Firestick installation page from the user journey. Keep its existing public address working by redirecting it to the new device-login destination.
- Keep the code shown on the device, its 10-minute expiry, single-use protection, and automatic sign-in behavior unchanged.

## Resulting flow
```text
New device shows a code
        ↓
Phone, tablet, or computer opens “Log in another device”
        ↓
Sign in if needed
        ↓
Code-entry screen opens automatically
        ↓
Enter code → new device signs in
```

## Verification
- Test the flow while already signed in and while signed out.
- Confirm the old Firestick page redirects correctly.
- Confirm navigation wording is updated on desktop, mobile, and the public home page.
- Confirm a valid code signs in the waiting device and invalid/expired codes remain safely rejected.
