import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/connect-tv")({
  beforeLoad: () => {
    throw redirect({ to: "/device-login" });
  },
  head: () => ({
    meta: [
      { title: "Log in another device — Streamivo" },
      {
        name: "description",
        content: "Enter the one-time code shown on another device.",
      },
      { property: "og:title", content: "Log in another device — Streamivo" },
      { property: "og:description", content: "Sign in another device with a one-time code." },
    ],
  }),
  component: () => null,
});
