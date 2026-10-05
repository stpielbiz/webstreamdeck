import { createFileRoute } from "@tanstack/react-router";

import { GuideView } from "@/components/guide-view";
import { TvShell } from "@/components/tv-shell";

export const Route = createFileRoute("/_authenticated/tv/guide")({
  head: () => ({
    meta: [
      { title: "TV guide on your TV — Stream Deck" },
      { name: "description", content: "Browse current and upcoming programmes with your Fire TV remote." },
      { property: "og:title", content: "TV guide on your TV — Stream Deck" },
      { property: "og:description", content: "Remote-friendly programme listings for your channels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvGuide,
});

function TvGuide() {
  return <TvShell title="Guide" immersive><div className="h-full overflow-y-auto"><GuideView tv /></div></TvShell>;
}