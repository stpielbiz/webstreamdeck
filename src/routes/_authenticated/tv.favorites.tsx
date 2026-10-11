import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { FavouritesLists } from "@/components/favourites-lists";
import { Button } from "@/components/ui/button";
import { TvShell } from "@/components/tv-shell";

export const Route = createFileRoute("/_authenticated/tv/favorites")({
  head: () => ({
    meta: [
      { title: "Favourites on your TV — Stream Deck" },
      {
        name: "description",
        content: "Your starred channels, movies and series, ready to open with the remote.",
      },
      { property: "og:title", content: "Favourites on your TV — Stream Deck" },
      { property: "og:description", content: "Separate compact lists of your favourite channels, movies and shows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvFavorites,
});

function TvFavorites() {
  const navigate = useNavigate();
  return (
    <TvShell title="Favourites">
      <div data-remote-row className="mb-4"><Button data-layer-back data-tv-focus variant="ghost" onClick={() => void navigate({ to: "/tv" })}><ArrowLeft className="size-4" /> Home</Button></div>
      
      <FavouritesLists tv />
    </TvShell>
  );
}
