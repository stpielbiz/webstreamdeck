import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Explains why running the movie & show details update is worthwhile.
 * Shown until a full details update has completed for the playlist.
 */
export function DetailsUpdateHint({ tv = false }: { tv?: boolean }) {
  return (
    <div className="mt-4 max-w-2xl rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 font-display text-base font-semibold">
        <Sparkles className="size-4 shrink-0 text-primary" /> Get more from your movies and shows
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Run the details update once and every movie and show gets:
      </p>
      <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
        <li>Posters and artwork</li>
        <li>Full descriptions, actors, genres and years</li>
        <li>Search that also finds titles by actor</li>
        <li>Franchise and collection lists</li>
        <li>Better "Popular on Stream Deck" rows</li>
      </ul>
      <p className="mt-2 text-sm text-muted-foreground">
        The update runs in the background — please wait until it finishes.
      </p>
      <Button asChild size="sm" className="mt-3" data-tv-focus>
        <Link to="/settings" search={tv ? { mode: "tv" } : {}}>Open Settings to update details</Link>
      </Button>
    </div>
  );
}
