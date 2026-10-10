import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SavedFranchiseBrowser } from "@/components/saved-franchise-browser";
import { TvShell } from "@/components/tv-shell";

export const Route = createFileRoute("/_authenticated/tv/franchises")({
  head: () => ({ meta: [
    { title: "Saved franchises on TV — Stream Deck" },
    { name: "description", content: "Browse saved movie and show franchises with your TV remote." },
    { property: "og:title", content: "Saved franchises on TV — Stream Deck" },
    { property: "og:description", content: "Remote-friendly saved franchise collections." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TvFranchisesPage,
});

function TvFranchisesPage() {
  const navigate = useNavigate();
  return <TvShell title="Franchise"><SavedFranchiseBrowser tv onBack={() => void navigate({ to: "/tv" })} /></TvShell>;
}