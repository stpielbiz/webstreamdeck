import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Tv } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { APK_URL } from "@/lib/app-download";

export const Route = createFileRoute("/download")({
  validateSearch: z.object({ mode: z.literal("tv").optional() }),
  head: () => ({
    meta: [
      { title: "Download the Stream Deck TV app for Fire TV" },
      {
        name: "description",
        content: "Install the Stream Deck TV app on your Fire TV Stick for smooth playback of your own playlists.",
      },
      { property: "og:title", content: "Download the Stream Deck TV app" },
      {
        property: "og:description",
        content: "Get the Fire TV app and install it in a few steps with the Downloader app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

const STEPS = [
  "On your Fire TV, open Settings → My Fire TV → Developer options and turn on “Apps from Unknown Sources” (or allow it for Downloader).",
  "From the Fire TV app store, install the free “Downloader” app.",
  "Open Downloader and type the download link shown on this page, then press Go.",
  "When the file finishes downloading, choose Install, then Open.",
  "Stream Deck TV shows a code — enter it on your phone or PC at Log in another device.",
];

function DownloadPage() {
  const { mode } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded bg-primary text-primary-foreground">
            <Tv className="size-5" />
          </span>
          <span className="font-display text-xl font-bold">Stream Deck</span>
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-16">
        {mode === "tv" && <Button asChild variant="ghost" className="mb-6" data-tv-focus data-layer-back><Link to="/tv"><ArrowLeft className="size-4" /> Back to TV Home</Link></Button>}
        <h1 className="text-3xl font-bold sm:text-5xl">Stream Deck TV app</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          The Fire TV app plays streams directly on your device, just like TiviMate, so providers
          that block the browser still work.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          {APK_URL ? (
            <>
              <Button asChild size="lg" data-tv-focus>
                <a href={APK_URL}>
                  <Download className="mr-2 size-5" /> Download for Fire TV (APK)
                </a>
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">Link for the Downloader app:</p>
              <p className="mt-1 break-all font-mono text-sm text-primary">{APK_URL}</p>
            </>
          ) : (
            <>
              <Button size="lg" disabled>
                <Download className="mr-2 size-5" /> Coming soon
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">The download link will appear here shortly.</p>
            </>
          )}
        </div>

        <h2 className="mt-12 text-2xl font-bold">Install on a Fire TV Stick</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <Button asChild variant="outline" className="mt-8">
          <Link to="/device-login">Log in another device</Link>
        </Button>
      </main>
    </div>
  );
}
