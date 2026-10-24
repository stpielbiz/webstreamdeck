import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlaylists } from "@/components/playlist-context";
import { requestLibraryRefresh, runBulkRefresh, stopBulkRefresh, useBulkRefreshState, useLibraryRefreshStatus, getBulkRefreshState } from "@/lib/library-sync";
import { refreshTitles } from "@/lib/metadata.functions";
import { needsFullUpdate, readFullUpdate, snoozeTime, writeFullUpdate } from "@/lib/full-update";

type Phase = "idle" | "library" | "details" | "done";

function ago(at?: number) {
  if (!at) return "Never on this device";
  const d = Math.floor((Date.now() - at) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

/** Home screen reminder to save the whole library (and details) on this device. */
export function FullUpdateCard() {
  const { activeId } = usePlaylists();
  const client = useQueryClient();
  const refreshFn = useServerFn(refreshTitles);
  const refresh = useLibraryRefreshStatus();
  const bulk = useBulkRefreshState();
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const stopped = useRef(false);
  const sawRunning = useRef(false);

  useEffect(() => { if (activeId) setShow(needsFullUpdate(readFullUpdate(activeId))); }, [activeId]);

  // Channels, movies and shows first; details start once that refresh ends.
  useEffect(() => {
    if (phase !== "library" || !activeId) return;
    if (refresh.running) { sawRunning.current = true; return; }
    if (!sawRunning.current) return;
    if (stopped.current) { setPhase("idle"); return; }
    setPhase("details");
    void (async () => {
      for (const kind of ["movie", "series"] as const) {
        if (stopped.current) break;
        await runBulkRefresh(client, activeId, kind, ({ data }) => refreshFn({ data: { ...data, playlistId: activeId } }));
        if (getBulkRefreshState().done < getBulkRefreshState().total) stopped.current = true;
      }
      if (stopped.current) { setPhase("idle"); return; }
      writeFullUpdate(activeId, { lastAt: Date.now() });
      setPhase("done");
      window.setTimeout(() => setShow(false), 5000);
    })();
  }, [phase, refresh.running, activeId, client, refreshFn]);

  if (!activeId || !show) return null;
  const rec = readFullUpdate(activeId);
  const start = () => { stopped.current = false; sawRunning.current = refresh.running; setPhase("library"); requestLibraryRefresh(activeId); };
  const stop = () => { stopped.current = true; stopBulkRefresh(); };
  const later = () => { writeFullUpdate(activeId, { ...rec, snoozeUntil: snoozeTime() }); setShow(false); };
  const label = bulk.kind === "series" ? "Show details" : "Movie details";

  return (
    <section data-remote-row className="flex flex-wrap items-center gap-4 rounded-lg border border-primary/40 bg-card p-4">
      <Zap className="size-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-bold">{phase === "done" ? "All set — everything is saved on this device" : "Get a faster Streamivo"}</h2>
        {phase === "idle" && <>
          <p className="text-sm text-muted-foreground">Run a full update to save your channels, movies, shows and their details on this device. Browsing then loads from your device and feels faster.</p>
          <p className="text-xs text-muted-foreground">Last full update: {ago(rec.lastAt)}</p>
        </>}
        {phase === "library" && <p className="text-sm text-muted-foreground">Updating {refresh.phase || "library"}{refresh.total > 0 ? ` ${refresh.done.toLocaleString()} / ${refresh.total.toLocaleString()}` : "…"}</p>}
        {phase === "details" && <p className="text-sm text-muted-foreground">{label} {bulk.done.toLocaleString()} / {bulk.total.toLocaleString()}</p>}
      </div>
      {phase === "idle" && <div className="flex gap-2">
        <Button data-tv-focus onClick={start}>Update everything</Button>
        <Button data-tv-focus variant="secondary" onClick={later}>Later</Button>
      </div>}
      {phase === "details" && <Button data-tv-focus variant="secondary" onClick={stop}>Stop</Button>}
    </section>
  );
}
