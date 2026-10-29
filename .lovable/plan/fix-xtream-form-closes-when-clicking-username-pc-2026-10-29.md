# Fix: Xtream form closes when clicking Username (PC)

## Goal
On a computer, adding an Xtream Codes playlist must stay on the details form while you click between Name, Server address, Username and Password. Only Cancel, Back or Connect should leave it.

## Steps
1. Reproduce on a desktop-size browser: Playlists → Add a source → Xtream Codes → type a server → click Username. Record what closes the form (Back being triggered, the step resetting, or the page reloading/redirecting), with logs on.
2. Fix the confirmed cause. Likely suspects, in order:
   - A Back action firing outside the text fields (the hidden Back button on the form is picked up by the shared Back key/remote handler, e.g. a Backspace while focus briefly sits outside an input).
   - The form step resetting when playlist data refreshes in the background (form state lost on re-render).
   - The browser's saved-password autofill on the Username/Password pair submitting or reloading the form.
3. Make sure the typed values survive if the form re-renders, and that Back/Escape is ignored while any form field is in use.
4. Re-run the same test, plus filling all four fields and pressing Connect, and confirm Fire TV remote navigation on the form still works.

## Technical details
- Form lives in `src/routes/_authenticated/playlists.tsx` (step state `details`, hidden `data-layer-back` button calling `back()`).
- Shared Back handling: `src/lib/use-spatial-nav.ts` (Backspace/Escape when not typing) and `src/components/app-shell.tsx` `onBack` clicking `[data-layer-back]`.
- Diagnosis is unconfirmed until step 1; the fix targets whatever step 1 shows.
