import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { useMemo } from "react";
import { findGameBroadcasts } from "@/lib/game-broadcasts.functions";
import { suggestChannels } from "@/lib/channel-suggest";
import type { CatalogItem } from "@/lib/iptv-types";

/** "Game on today" card: looks the team up online and suggests playlist channels. */
export function GameSuggestionCard({ query, channels, onPlay }: { query: string; channels?: CatalogItem[] | undefined; onPlay: (item: CatalogItem) => void }) {
  const lookup = useServerFn(findGameBroadcasts);
  const term = query.trim();
  const game = useQuery({
    queryKey: ["game-broadcasts", term.toLowerCase()],
    queryFn: () => lookup({ data: { query: term } }),
    enabled: term.length >= 3,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const picks = useMemo(() => (game.data && channels ? suggestChannels(game.data, channels) : []), [game.data, channels]);
  if (!game.data) return null;
  const when = new Date(game.data.startsAt);
  return (
    <div data-remote-row className="mb-2 shrink-0 rounded border border-primary/40 bg-card p-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Trophy className="size-4 text-primary" /> Game on: {game.data.matchup}
        <span className="text-xs font-normal text-muted-foreground">· {game.data.league} · {when.toLocaleDateString([], { weekday: "short" })} {when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </p>
      {game.data.broadcasts.length > 0 && <p className="mt-0.5 truncate text-xs text-muted-foreground">On: {game.data.broadcasts.join(", ")}</p>}
      {picks.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {picks.map((item) => (
            <button key={item.id} type="button" data-tv-focus onClick={() => onPlay(item)} className="rounded bg-secondary px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-primary">
              {item.name}
            </button>
          ))}
        </div>
      ) : <p className="mt-1 text-xs text-muted-foreground">No matching channels found in your playlist.</p>}
    </div>
  );
}
