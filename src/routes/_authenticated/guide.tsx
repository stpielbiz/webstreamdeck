import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/guide")({
  beforeLoad: () => {
    throw redirect({ to: "/live" });
  },
  head: () => ({
    meta: [
      { title: "TV guide — Streamivo" },
      {
        name: "description",
        content: "See what's on now and next across your channels, and the full day's listings.",
      },
      { property: "og:title", content: "TV guide — Streamivo" },
      { property: "og:description", content: "Now, next and today's listings." },
    ],
  }),
  component: () => null,
});
