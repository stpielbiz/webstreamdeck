import { CircleDot, HardDrive, Play, Square, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { STATUS_LABEL, cancelRecording, deleteRecording, formatBytes, playRecording, useRecordings } from "@/lib/recordings";

function when(ms: number) {
  return new Date(ms).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Recordings saved on this Fire TV, with storage and Play / Stop / Delete. */
export function RecordingsList({ tv }: { tv?: boolean }) {
  const { list, storage, supported, refresh } = useRecordings();

  if (!supported) {
    return (
      <div className="max-w-2xl space-y-3 rounded border border-border bg-card p-5">
        <p className="font-semibold">Recording works in the Streamivo app on Fire TV.</p>
        <p className="text-sm text-muted-foreground">
          On a computer, a website can only record while its tab stays open, so recording is Fire TV only for now.
          You need a Fire TV Stick with the latest Streamivo app and some free storage. Recordings stay on the Fire TV that made them.
        </p>
        <p className="text-sm text-muted-foreground">To record, hold OK on a channel in Live TV and choose Record.</p>
        {!tv && (
          <Button asChild data-tv-focus variant="secondary">
            <Link to="/download">Get the Fire TV app</Link>
          </Button>
        )}
      </div>
    );
  }

  const used = storage ? storage.totalBytes - storage.freeBytes : 0;
  return (
    <div className="max-w-3xl space-y-4">
      {storage && (
        <div className="rounded border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <HardDrive className="size-4" /> {formatBytes(storage.freeBytes)} free of {formatBytes(storage.totalBytes)}
          </p>
          <Progress className="mt-2 h-2" value={storage.totalBytes ? (used / storage.totalBytes) * 100 : 0} />
          {storage.freeBytes < 500 * 1024 ** 2 && (
            <p className="mt-2 text-sm text-destructive">Storage is almost full. Delete recordings to make room — recording stops when space runs out.</p>
          )}
        </div>
      )}

      {list.length === 0 && (
        <p className="text-muted-foreground">No recordings yet. In Live TV, hold OK on a channel and choose Record.</p>
      )}

      <div className="flex flex-col gap-2">
        {list.map((rec) => {
          const live = rec.status === "recording";
          const scheduled = rec.status === "scheduled";
          const playable = rec.sizeBytes > 0 && !scheduled;
          return (
            <div key={rec.id} data-remote-row className="flex flex-wrap items-center gap-3 rounded border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">
                  {live && <CircleDot className="size-4 shrink-0 animate-pulse text-destructive motion-reduce:animate-none" />}
                  {rec.title}{rec.programme ? ` · ${rec.programme}` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {when(rec.startAt)} – {new Date(rec.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" · "}{STATUS_LABEL[rec.status] ?? rec.status}
                  {rec.sizeBytes > 0 && ` · ${formatBytes(rec.sizeBytes)}`}
                  {rec.status === "failed" && rec.error ? ` · ${rec.error}` : ""}
                </p>
              </div>
              {playable && (
                <Button data-tv-focus size="sm" onClick={() => playRecording(rec.id)}><Play className="size-4" /> Play</Button>
              )}
              {(live || scheduled) && (
                <Button data-tv-focus size="sm" variant="secondary" onClick={() => { cancelRecording(rec.id); refresh(); }}>
                  <Square className="size-4" /> {live ? "Stop" : "Cancel"}
                </Button>
              )}
              <Button data-tv-focus size="sm" variant="ghost" aria-label={`Delete ${rec.title}`} onClick={() => { deleteRecording(rec.id); refresh(); }}>
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
