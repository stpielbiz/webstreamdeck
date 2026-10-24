import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/get-app")({
  beforeLoad: () => {
    throw redirect({ to: "/device-login" });
  },
  head: () => ({
    meta: [
      { title: "Log in another device — Jolzplay" },
      {
        name: "description",
        content:
          "Enter a one-time code to sign another device into your Jolzplay account.",
      },
      { property: "og:title", content: "Log in another device — Jolzplay" },
      {
        property: "og:description",
        content: "Sign another device into Jolzplay with a one-time code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
