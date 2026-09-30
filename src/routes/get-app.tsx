import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Tv } from "lucide-react";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Watch on Firestick — Stream Deck" },
      {
        name: "description",
        content:
          "Set up Stream Deck on your Amazon Fire TV Stick in three minutes and sign in with a short code — no password typing with the remote.",
      },
      { property: "og:title", content: "Watch on Firestick — Stream Deck" },
      {
        property: "og:description",
        content: "Open Stream Deck on your Fire TV Stick and sign in with a code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetAppPage,
});

const STEPS = [
  "On your Fire TV Stick home screen, open the Silk Browser (install it free from the Fire TV app store if it isn't there yet).",
  "Type the address below into Silk's address bar using the remote.",
  "Choose “Sign in with a code”. Your TV shows a 6-character code.",
  "On your phone or computer, sign in here, open “Connect a TV” and type that code.",
  "Your TV signs in by itself and stays signed in. Add the page to Silk's bookmarks so it's one click next time.",
];

function GetAppPage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const pairUrl = `${origin}/tv/pair`;

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Tv className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Watch on Firestick</h1>
            <p className="text-sm text-muted-foreground">
              Same account, same playlists, same place you stopped.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Amazon Fire TV Stick</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Type this address on your TV:
          </p>
          {origin ? (
            <Link
              to="/tv/pair"
              aria-label="Open the TV sign-in screen"
              className="mt-3 block break-all rounded-md font-display text-2xl font-bold text-primary outline-none underline decoration-primary/50 underline-offset-4 transition hover:decoration-primary focus-visible:ring-4 focus-visible:ring-primary/40"
            >
              {`${origin.replace(/^https?:\/\//, "")}/tv/pair`}
            </Link>
          ) : (
            <p className="mt-3 font-display text-2xl font-bold text-primary">…</p>
          )}

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <ol className="flex-1 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {origin && (
              <div className="shrink-0 rounded-xl bg-white p-3">
                <QRCodeSVG value={pairUrl} size={140} />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/tv/pair"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Open the TV sign-in screen
            </Link>
            <Link
              to="/connect-tv"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium"
            >
              Connect a TV with a code
            </Link>
          </div>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Playback on the TV uses the Fire TV's own browser, so the same stream limits as the
          website apply: modern HLS channels play, older MPEG-TS-only and copy-protected streams
          don't. Windows, iPhone and Android versions are coming later.
        </p>
      </div>
    </div>
  );
}
