import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createPlaylist, deletePlaylist } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/media";
import { Switch } from "@/components/ui/switch";
import { debugLog, redactUrl, setDebugEnabled, useDebugLog } from "@/lib/debug-log";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({
    meta: [
      { title: "Playlists — Stream Deck" },
      {
        name: "description",
        content: "Add and manage your Xtream Codes logins and M3U playlist links.",
      },
      { property: "og:title", content: "Playlists — Stream Deck" },
      { property: "og:description", content: "Manage the IPTV sources on your account." },
    ],
  }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const { playlists, refetch, activeId, setActiveId } = usePlaylists();
  const queryClient = useQueryClient();
  const create = useServerFn(createPlaylist);
  const remove = useServerFn(deletePlaylist);

  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const debug = useDebugLog();

  const addMutation = useMutation({
    mutationFn: (kind: "xtream" | "m3u") => {
      debugLog("connect", `Adding ${kind} source`, { server: redactUrl(kind === "xtream" ? serverUrl : m3uUrl) });
      return create({
        data:
          kind === "xtream"
            ? { name, kind, serverUrl, username, password }
            : { name, kind, m3uUrl },
      });
    },
    onSuccess: (playlist) => {
      debugLog("connect", "Source added", { id: playlist.id });
      toast.success(`${playlist.name} added`);
      setName("");
      setServerUrl("");
      setUsername("");
      setPassword("");
      setM3uUrl("");
      refetch();
      setActiveId(playlist.id);
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      debugLog("connect", "Adding source failed", error.message);
      toast.error(error.message || "That playlist could not be added.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Playlist removed");
      refetch();
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Playlists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the details from your IPTV provider. Your login is stored on your account only and is
          never shown in the address bar while streaming.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="font-display text-base font-semibold">Connection & stream logs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Records each step when connecting and playing, on this device only. A Logs button appears
            at the bottom left so you can copy them. Logins and passwords are hidden.
          </p>
        </div>
        <Switch data-tv-focus checked={debug.enabled} onCheckedChange={setDebugEnabled} aria-label="Connection and stream logs" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
          <Plus className="size-4 text-primary" /> Add a source
        </h2>
        <Tabs defaultValue="xtream">
          <TabsList>
            <TabsTrigger value="xtream">Xtream Codes</TabsTrigger>
            <TabsTrigger value="m3u">M3U link</TabsTrigger>
          </TabsList>

          <TabsContent value="xtream" className="mt-5 space-y-4">
            <Field label="Name" value={name} onChange={setName} placeholder="Living room" />
            <Field
              label="Server address"
              value={serverUrl}
              onChange={setServerUrl}
              placeholder="http://example.com:8080"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username" value={username} onChange={setUsername} />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
            </div>
            <Button
              disabled={
                addMutation.isPending || !name || !serverUrl || !username || !password
              }
              onClick={() => addMutation.mutate("xtream")}
            >
              {addMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add and verify
            </Button>
          </TabsContent>

          <TabsContent value="m3u" className="mt-5 space-y-4">
            <Field label="Name" value={name} onChange={setName} placeholder="Main playlist" />
            <Field
              label="Playlist link"
              value={m3uUrl}
              onChange={setM3uUrl}
              placeholder="http://example.com/get.php?username=...&type=m3u_plus"
            />
            <Button
              disabled={addMutation.isPending || !name || !m3uUrl}
              onClick={() => addMutation.mutate("m3u")}
            >
              {addMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add and verify
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {playlists.length === 0 ? (
        <EmptyState
          title="No sources yet"
          description="Add your first Xtream login or M3U link above and your channels, movies and series will appear."
        />
      ) : (
        <div className="space-y-3">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {playlist.name}
                  {playlist.id === activeId && (
                    <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      In use
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {playlist.kind === "xtream"
                    ? `${playlist.serverUrl} · ${playlist.username}`
                    : playlist.m3uUrl}
                </p>
              </div>
              {playlist.id !== activeId && (
                <Button variant="ghost" size="sm" onClick={() => setActiveId(playlist.id)}>
                  Use
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${playlist.name}`}
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(playlist.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
