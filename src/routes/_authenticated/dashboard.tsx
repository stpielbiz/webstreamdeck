import { createFileRoute, Link } from "@tanstack/react-router";
import { Tv } from "lucide-react";

import { SubscriptionBanner } from "@/components/subscription-banner";
import { FullUpdateCard } from "@/components/full-update-card";
import { usePlaylists } from "@/components/playlist-context";
import { EmptyState, PosterGrid, PosterTile, Shelf } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgress, useFavorites, useToggleFavorite, useClearProgress, isFavorite } from "@/lib/library-hooks";
import { SectionMenu } from "@/components/layered-navigation";
import { FavouritesLists } from "@/components/favourites-lists";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { useAccountAccess } from "@/lib/account-access";
import { useLibraryOverview, hasCompletedDetailsUpdate } from "@/lib/library-sync";
import { DetailsUpdateHint } from "@/components/details-update-hint";
import { useState } from "react";
import { toast } from "sonner";
import type { ProgressRow } from "@/lib/iptv.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Streamivo" },
      {
        name: "description",
        content: "Continue watching, your favourites and quick access to live TV.",
      },
      { property: "og:title", content: "Home — Streamivo" },
      { property: "og:description", content: "Pick up where you left off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { playlists, activeId, active, isLoading } = usePlaylists();
  const progress = useProgress();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const clearProgress = useClearProgress();
  const [removing, setRemoving] = useState<ProgressRow | null>(null);
  const expired = useAccountAccess().data?.expired === true;
  const library = useLibraryOverview(activeId);
  const detailsPending = !!activeId &&
    ((library.movie.loaded && !hasCompletedDetailsUpdate(activeId, "movie", library.movie.total)) ||
      (library.series.loaded && !hasCompletedDetailsUpdate(activeId, "series", library.series.total)));

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <SectionMenu current="Home" />
        <SubscriptionBanner />
        <EmptyState
          title="Add your first playlist"
          description="Streamivo plays your own IPTV subscription. Add an Xtream Codes login or an M3U link and your channels, movies and series appear here."
          action={
            <Button asChild>
              <Link to="/playlists">Add a playlist</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const resumable = (progress.data ?? []).filter(
    (row) =>
      !row.completed &&
      row.playlistId === activeId &&
      (row.positionSeconds > 30 || row.external),
  );

  return (
    <div className="space-y-10 p-6">
      <SectionMenu current="Home" />
      <SubscriptionBanner />
      {!expired && <FullUpdateCard />}
      {expired ? null : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Watching from {active?.name ?? "your playlist"}
          </p>
        </div>
        <Button asChild>
          <Link to="/live">
            <Tv className="size-4" /> Open Live TV
          </Link>
        </Button>
      </div>

      <Shelf title="Continue watching">
        {progress.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : resumable.length === 0 ? (
          <EmptyState
            title="Nothing to resume yet"
            description="Start a movie or an episode and Streamivo will remember exactly where you stopped."
          />
        ) : (
          <PosterGrid>
            {resumable.map((row) => (
              <PosterTile
                key={`${row.itemKind}-${row.itemId}`}
                to={row.itemKind === "episode" && row.seriesId ? "/series/$id" : "/movies/$id"}
                params={{
                  id: row.itemKind === "episode" && row.seriesId ? row.seriesId : row.itemId,
                }}
                search={{ play: true }}
                title={row.title}
                image={row.posterUrl}
                onLongPress={() => setRemoving(row)}
                subtitle={
                  row.external
                    ? "Watching in an external player"
                    : row.season != null && row.episode != null
                      ? `S${row.season} E${row.episode}`
                      : row.durationSeconds
                        ? `${Math.round((row.durationSeconds - row.positionSeconds) / 60)} min left`
                        : null
                }
                external={row.external}
                progress={
                  row.external
                    ? null
                    : row.durationSeconds
                      ? row.positionSeconds / row.durationSeconds
                      : 0.05
                }
              />
            ))}
          </PosterGrid>
        )}
      </Shelf>

      {detailsPending && <DetailsUpdateHint />}
      <FavouritesLists home />
      <RemoveConfirmDialog
        title={removing?.title ?? null}
        mode={removing && activeId && isFavorite(favorites.data, activeId, removing.itemKind === "episode" ? "series" : "movie", removing.itemKind === "episode" && removing.seriesId ? removing.seriesId : removing.itemId) ? "favourite" : "continue"}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing || !activeId) return;
          const kind = removing.itemKind === "episode" ? "series" : "movie";
          const id = removing.itemKind === "episode" && removing.seriesId ? removing.seriesId : removing.itemId;
          if (isFavorite(favorites.data, activeId, kind, id)) {
            toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: id, title: removing.title, logoUrl: removing.posterUrl });
            toast.success(`Removed ${removing.title} from favourites`);
          } else {
            clearProgress.mutate({ playlistId: removing.playlistId, itemId: removing.itemId });
            toast.success(`Removed ${removing.title} from continue watching`);
          }
        }}
      />
      </>}
    </div>
  );
}
