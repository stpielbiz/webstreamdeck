import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Link2, Loader2, Pencil, Plus, Server, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { createPlaylist, deletePlaylist, updatePlaylist, type ConnectionSummary } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { debugLog, redactUrl } from "@/lib/debug-log";
import { requestLibraryRefresh } from "@/lib/library-sync";
import type { PlaylistSummary } from "@/lib/iptv.functions";

export const Route = createFileRoute("/_authenticated/playlists")({
  validateSearch: z.object({ mode: z.literal("tv").optional() }),
  head: () => ({
    meta: [
      { title: "Playlists — Stream Deck" },
      { name: "description", content: "Add, edit and remove your Xtream Codes logins and M3U playlist links." },
      { property: "og:title", content: "Playlists — Stream Deck" },
      { property: "og:description", content: "Manage the IPTV sources on your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlaylistsPage,
});

type Kind = "xtream" | "m3u";
type Step = "list" | "type" | "details" | "testing" | "result" | "delete";
interface Form { name: string; serverUrl: string; username: string; password: string; m3uUrl: string }
const emptyForm: Form = { name: "", serverUrl: "", username: "", password: "", m3uUrl: "" };

function PlaylistsPage() {
  const { mode } = Route.useSearch();
  const { playlists, refetch, activeId, setActiveId } = usePlaylists();
  const queryClient = useQueryClient();
  const create = useServerFn(createPlaylist);
  const update = useServerFn(updatePlaylist);
  const remove = useServerFn(deletePlaylist);

  const [step, setStep] = useState<Step>("list");
  const [kind, setKind] = useState<Kind>("xtream");
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<PlaylistSummary | null>(null);
  const [deleting, setDeleting] = useState<PlaylistSummary | null>(null);
  const [result, setResult] = useState<{ ok: true; name: string; id: string; summary: ConnectionSummary } | { ok: false; message: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Focus the first control of each step so the remote always lands somewhere useful.
  useEffect(() => {
    let tries = 0;
    let id = 0;
    const attempt = () => {
      const target = step === "list"
        ? root.current?.querySelector<HTMLElement>("[data-pl-row='0'][data-pl-col='1']")
          ?? root.current?.querySelector<HTMLElement>("[data-pl-add]")
        : root.current?.querySelector<HTMLElement>("[data-step-entry]");
      if (target) target.focus();
      else if (tries++ < 30) id = window.requestAnimationFrame(attempt);
    };
    id = window.requestAnimationFrame(attempt);
    return () => window.cancelAnimationFrame(id);
  }, [step, playlists.length]);

  // Own arrow-key handling: predictable grid on the list, linear order on other steps.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const dir = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as Record<string, "up" | "down" | "left" | "right">)[event.key];
      if (!dir || !root.current) return;
      const active = document.activeElement as HTMLElement | null;
      const typing = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
      if (typing && (dir === "left" || dir === "right")) return;
      event.preventDefault();
      event.stopPropagation();
      const scope = root.current;
      if (step === "list") {
        const buttons = Array.from(scope.querySelectorAll<HTMLElement>("[data-pl-row]"));
        if (!buttons.length) return;
        const pos = (el: HTMLElement) => ({ row: Number(el.dataset['plRow']), col: Number(el.dataset['plCol']) });
        const cur = active && buttons.includes(active) ? pos(active) : null;
        let next: HTMLElement | undefined;
        if (!cur) next = buttons[0];
        else if (dir === "left" || dir === "right") {
          const same = buttons.filter((b) => pos(b).row === cur.row).sort((a, b) => pos(a).col - pos(b).col);
          const i = same.indexOf(active!);
          next = same[i + (dir === "right" ? 1 : -1)];
        } else {
          const rows = Array.from(new Set(buttons.map((b) => pos(b).row))).sort((a, b) => a - b);
          const targetRow = rows[rows.indexOf(cur.row) + (dir === "down" ? 1 : -1)];
          if (targetRow !== undefined) {
            const inRow = buttons.filter((b) => pos(b).row === targetRow);
            next = inRow.find((b) => pos(b).col === cur.col)
              ?? inRow.sort((a, b) => Math.abs(pos(a).col - cur.col) - Math.abs(pos(b).col - cur.col))[0];
          }
        }
        next?.focus();
        next?.scrollIntoView({ block: "nearest" });
        return;
      }
      const items = Array.from(scope.querySelectorAll<HTMLElement>("[data-pl-item]:not([disabled])"));
      if (!items.length) return;
      const i = active ? items.indexOf(active) : -1;
      const next = i < 0 ? items[0] : items[i + (dir === "down" || dir === "right" ? 1 : -1)];
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [step]);

  const set = (key: keyof Form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const connect = useMutation({
    mutationFn: () => {
      debugLog("connect", `${editing ? "Updating" : "Adding"} ${kind} source`, { server: redactUrl(kind === "xtream" ? form.serverUrl : form.m3uUrl) });
      const data = kind === "xtream"
        ? { name: form.name, kind, serverUrl: form.serverUrl, username: form.username, password: form.password }
        : { name: form.name, kind, m3uUrl: form.m3uUrl };
      return editing ? update({ data: { ...data, id: editing.id } }) : create({ data });
    },
    onMutate: () => setStep("testing"),
    onSuccess: ({ playlist, summary }) => {
      debugLog("connect", "Source connected", { id: playlist.id });
      setResult({ ok: true, name: playlist.name, id: playlist.id, summary });
      setStep("result");
      refetch();
      if (editing) requestLibraryRefresh(playlist.id);
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      debugLog("connect", "Connection failed", error.message);
      setResult({ ok: false, message: error.message || "Could not connect to that provider." });
      setStep("result");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Playlist deleted");
      setDeleting(null);
      setStep("list");
      refetch();
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startAdd = () => { setEditing(null); setForm(emptyForm); setStep("type"); };
  const startEdit = (playlist: PlaylistSummary) => {
    setEditing(playlist);
    setKind(playlist.kind);
    setForm({ name: playlist.name, serverUrl: playlist.serverUrl ?? "", username: playlist.username ?? "", password: "", m3uUrl: playlist.m3uUrl ?? "" });
    setStep("details");
  };
  const back = () => {
    if (step === "type" || step === "delete") setStep("list");
    else if (step === "details") setStep(editing ? "list" : "type");
    else if (step === "result") setStep(result?.ok ? "list" : "details");
  };

  const canConnect = !!form.name.trim() && (kind === "m3u"
    ? !!form.m3uUrl.trim()
    : !!form.serverUrl.trim() && !!form.username.trim() && (!!editing || !!form.password));

  const backButton = step === "list"
    ? mode === "tv" && <Link to="/tv" data-layer-back tabIndex={-1} className="sr-only">Back to TV Home</Link>
    : step !== "testing" && <Button variant="ghost" tabIndex={-1} data-layer-back onClick={back}><ArrowLeft className="size-4" /> Back</Button>;

  return (
    <div ref={root} className="mx-auto max-w-3xl space-y-6 p-6">
      {backButton}

      {step === "list" && (
        <>
          <div>
            <h1 className="font-display text-2xl font-bold">Your playlists</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your login is stored on your account only.</p>
          </div>
          {playlists.length === 0 && <p className="text-sm text-muted-foreground">No sources yet. Add your Xtream login or M3U link to see your channels, movies and shows.</p>}
          <div className="space-y-3">
            {playlists.map((playlist, index) => (
              <div key={playlist.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {playlist.name}
                    {playlist.id === activeId && <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">In use</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {playlist.kind === "xtream" ? `Xtream · ${playlist.serverUrl} · ${playlist.username}` : `M3U · ${playlist.m3uUrl}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {playlist.id !== activeId && <Button size="sm" data-pl-row={index} data-pl-col={0} onClick={() => { setActiveId(playlist.id); toast.success(`Now using ${playlist.name}`); }}>Use</Button>}
                  <Button size="sm" variant="outline" data-pl-row={index} data-pl-col={1} onClick={() => startEdit(playlist)}><Pencil className="size-4" /> Edit</Button>
                  <Button size="sm" variant="outline" data-pl-row={index} data-pl-col={2} onClick={() => { setDeleting(playlist); setStep("delete"); }}><Trash2 className="size-4 text-destructive" /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
          <Button size="lg" data-pl-add data-pl-row={playlists.length} data-pl-col={1} onClick={startAdd} className="w-full sm:w-auto"><Plus className="size-4" /> Add a source</Button>
        </>
      )}

      {step === "type" && (
        <>
          <h1 className="font-display text-2xl font-bold">What type of source?</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <TypeCard entry icon={<Server className="size-6" />} title="Xtream Codes" description="Server address, username and password from your provider." onClick={() => { setKind("xtream"); setStep("details"); }} />
            <TypeCard icon={<Link2 className="size-6" />} title="M3U link" description="A single playlist link (usually ends with m3u or m3u_plus)." onClick={() => { setKind("m3u"); setStep("details"); }} />
          </div>
        </>
      )}

      {step === "details" && (
        <form className="space-y-4 rounded-xl border border-border bg-card p-5" onSubmit={(event) => { event.preventDefault(); if (canConnect) connect.mutate(); }}>
          <h1 className="font-display text-xl font-bold">{editing ? `Edit ${editing.name}` : kind === "xtream" ? "Xtream Codes details" : "M3U link details"}</h1>
          <Field entry label="Name" value={form.name} onChange={set("name")} placeholder="Living room" />
          {kind === "xtream" ? (
            <>
              <Field label="Server address" value={form.serverUrl} onChange={set("serverUrl")} placeholder="http://example.com:8080" />
              <Field label="Username" value={form.username} onChange={set("username")} />
              <Field label="Password" value={form.password} onChange={set("password")} type="password" placeholder={editing ? "Leave blank to keep the current password" : undefined} />
            </>
          ) : (
            <Field label="Playlist link" value={form.m3uUrl} onChange={set("m3uUrl")} placeholder="http://example.com/get.php?username=...&type=m3u_plus" />
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" data-tv-focus data-pl-item disabled={!canConnect}>{editing ? "Save and connect" : "Connect"}</Button>
            <Button type="button" variant="ghost" data-tv-focus data-pl-item onClick={() => setStep("list")}>Cancel</Button>
          </div>
        </form>
      )}

      {step === "testing" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="font-semibold">Connecting to your provider…</p>
          <p className="text-sm text-muted-foreground">This can take a few seconds.</p>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
          {result.ok ? (
            <>
              <CheckCircle2 className="size-12 text-primary" />
              <p className="font-display text-xl font-bold">Connected to {result.name}</p>
              <p className="text-sm text-muted-foreground">{describe(result.summary)}</p>
              <Button data-tv-focus data-pl-item data-step-entry onClick={() => { setActiveId(result.id); setStep("list"); }}>Done</Button>
            </>
          ) : (
            <>
              <XCircle className="size-12 text-destructive" />
              <p className="font-display text-xl font-bold">Could not connect</p>
              <p className="max-w-md text-sm text-muted-foreground">{result.message}</p>
              <div className="flex gap-2">
                <Button data-tv-focus data-pl-item data-step-entry onClick={() => setStep("details")}>Try again</Button>
                <Button variant="ghost" data-tv-focus data-pl-item onClick={() => setStep("list")}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "delete" && deleting && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <p className="font-display text-xl font-bold">Delete {deleting.name}?</p>
          <p className="text-sm text-muted-foreground">Its favourites and watch history on this playlist will be removed.</p>
          <div className="flex gap-2">
            <Button variant="destructive" data-tv-focus data-pl-item disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(deleting.id)}>
              {removeMutation.isPending && <Loader2 className="size-4 animate-spin" />} Delete
            </Button>
            <Button variant="ghost" data-tv-focus data-pl-item data-step-entry onClick={() => setStep("list")}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function describe(summary: ConnectionSummary) {
  const n = (value: number) => value.toLocaleString();
  if (summary.unit === "categories") {
    return `Found ${n(summary.live)} channel categories, ${n(summary.movie)} movie categories and ${n(summary.series)} show categories.`;
  }
  return `Found ${n(summary.live + summary.movie + summary.series)} entries in the playlist.`;
}

function TypeCard({ icon, title, description, onClick, entry }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; entry?: boolean }) {
  return (
    <button type="button" data-tv-focus data-pl-item data-step-entry={entry ? true : undefined} onClick={onClick} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="text-primary">{icon}</span>
      <span className="font-display text-lg font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", entry }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string | undefined; type?: string; entry?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input data-tv-focus data-pl-item data-step-entry={entry ? true : undefined} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
