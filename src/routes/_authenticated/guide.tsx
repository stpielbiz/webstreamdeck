import { createFileRoute } from "@tanstack/react-router";
import { GuideView } from "@/components/guide-view";

export const Route = createFileRoute("/_authenticated/guide")({
  head: () => ({
    meta: [
      { title: "TV guide — Stream Deck" },
      {
        name: "description",
        content: "See what's on now and next across your channels, and the full day's listings.",
      },
      { property: "og:title", content: "TV guide — Stream Deck" },
      { property: "og:description", content: "Now, next and today's listings." },
    ],
  }),
  component: () => <GuideView />,
});
