import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSaveSettings, useSettings } from "@/lib/playlist-sync";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: z.object({ mode: z.literal("tv").optional() }),
  head: () => ({
    meta: [
      { title: "Settings — Stream Deck" },
      { name: "description", content: "Choose how Stream Deck handles your playlists and viewing history." },
      { property: "og:title", content: "Settings — Stream Deck" },
      { property: "og:description", content: "Personal Stream Deck preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { mode } = Route.useSearch();
  const settings = useSettings();
  const save = useSaveSettings();
  const enabled = settings.data?.syncPlaylists ?? false;

  const toggle = (value: boolean) =>
    save.mutate({ syncPlaylists: value }, {
      onSuccess: () => toast.success(value ? "Playlist sync is on" : "Playlist sync is off"),
      onError: () => toast.error("Could not save the setting. Try again."),
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" data-tv-focus data-layer-back>
          <Link to={mode === "tv" ? "/tv" : "/dashboard"}><ArrowLeft className="size-4" /> {mode === "tv" ? "Back to TV Home" : "Back"}</Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
      </div>
      <label className="flex cursor-pointer items-start justify-between gap-6 rounded-xl border border-border bg-card p-5">
        <span>
          <span className="block font-semibold">Sync my playlists</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Continue watching follows you across your playlists. If you start a movie or episode on one playlist,
            you can resume it at the same spot on another playlist that has the same title.
          </span>
        </span>
        <Switch
          data-tv-focus
          data-zone-entry="true"
          data-focus-key="setting-sync-playlists"
          checked={enabled}
          disabled={settings.isLoading || save.isPending}
          onCheckedChange={toggle}
          aria-label="Sync my playlists"
        />
      </label>
    </div>
  );
}
