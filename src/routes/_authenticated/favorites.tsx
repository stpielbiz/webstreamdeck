import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { FavouritesLists } from "@/components/favourites-lists";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "Favourites — Stream Deck" },
      {
        name: "description",
        content: "The channels, films and shows you starred, ready to play in one click.",
      },
      { property: "og:title", content: "Favourites — Stream Deck" },
      { property: "og:description", content: "Separate compact lists of your favourite channels, movies and shows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const navigate = useNavigate();
  return (
    <div data-tv-zone="content" className="space-y-4 p-6">
      <div className="mb-4"><Button data-layer-back data-tv-focus variant="ghost" onClick={() => void navigate({ to: "/dashboard" })}><ArrowLeft className="size-4" /> Home</Button></div>
      <h1 className="font-display text-2xl font-bold">Favourites</h1>
      <FavouritesLists />
    </div>
  );
}
