import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SavedFranchiseBrowser } from "@/components/saved-franchise-browser";

export const Route = createFileRoute("/_authenticated/franchises")({
  head: () => ({ meta: [
    { title: "Saved franchises — Stream Deck" },
    { name: "description", content: "Open the movie and show franchises saved to your Stream Deck account." },
    { property: "og:title", content: "Saved franchises — Stream Deck" },
    { property: "og:description", content: "Your saved movie and show franchise collections." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FranchisesPage,
});

function FranchisesPage() {
  const navigate = useNavigate();
  return <SavedFranchiseBrowser onBack={() => void navigate({ to: "/dashboard" })} />;
}