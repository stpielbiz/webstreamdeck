import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/get-app")({
  beforeLoad: () => {
    throw redirect({ to: "/device-login" });
  },
  head: () => ({
    meta: [
      { title: "Log in another device — Stream Deck" },
      {
        name: "description",
        content:
          "Enter a one-time code to sign another device into your Stream Deck account.",
      },
      { property: "og:title", content: "Log in another device — Stream Deck" },
      {
        property: "og:description",
        content: "Sign another device into Stream Deck with a one-time code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
