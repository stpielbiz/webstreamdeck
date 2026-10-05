import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tv/guide")({
  beforeLoad: () => {
    throw redirect({ to: "/tv/live" });
  },
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
  component: () => null,
});