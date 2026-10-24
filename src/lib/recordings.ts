import { useCallback, useEffect, useState } from "react";

/** Live TV recordings saved on the Fire TV device by the native app. */
export interface Recording {
  id: string;
  title: string;
  programme?: string;
  startAt: number;
  endAt: number;
  status: "scheduled" | "recording" | "done" | "stopped" | "storage_full" | "failed" | "cancelled" | "missed";
  sizeBytes: number;
  error?: string;
}

export interface StorageInfo {
  freeBytes: number;
  totalBytes: number;
}

interface RecorderBridge {
  startRecording?: (json: string) => string;
  cancelRecording?: (id: string) => void;
  deleteRecording?: (id: string) => void;
  listRecordings?: () => string;
  getStorageInfo?: () => string;
  playRecording?: (id: string) => void;
}

declare global {
  interface Window {
    __streamDeckRecordingUpdate?: (() => void) | undefined;
  }
}

function bridge(): RecorderBridge | null {
  if (typeof window === "undefined") return null;
  return (window.StreamDeckNative as unknown as RecorderBridge | undefined) ?? null;
}

/** True when this device can record (the Jolzplay Fire TV app, new enough). */
export function canRecord(): boolean {
  return typeof bridge()?.startRecording === "function";
}

export function startRecording(request: { title: string; programme?: string | null; url: string; startAt: number; endAt: number }): string {
  return bridge()?.startRecording?.(JSON.stringify(request)) ?? "";
}

export function cancelRecording(id: string) {
  bridge()?.cancelRecording?.(id);
}

export function deleteRecording(id: string) {
  bridge()?.deleteRecording?.(id);
}

export function playRecording(id: string) {
  bridge()?.playRecording?.(id);
}

function read(): { list: Recording[]; storage: StorageInfo | null } {
  const native = bridge();
  let list: Recording[] = [];
  let storage: StorageInfo | null = null;
  try {
    list = JSON.parse(native?.listRecordings?.() ?? "[]") as Recording[];
  } catch {
    list = [];
  }
  try {
    const raw = native?.getStorageInfo?.();
    storage = raw ? (JSON.parse(raw) as StorageInfo) : null;
  } catch {
    storage = null;
  }
  list.sort((a, b) => b.startAt - a.startAt);
  return { list, storage };
}

/** Recordings on this device, kept fresh by native updates and a light poll. */
export function useRecordings() {
  const [state, setState] = useState<{ list: Recording[]; storage: StorageInfo | null; supported: boolean }>({ list: [], storage: null, supported: false });
  const refresh = useCallback(() => setState({ ...read(), supported: canRecord() }), []);
  useEffect(() => {
    refresh();
    const previous = window.__streamDeckRecordingUpdate;
    window.__streamDeckRecordingUpdate = refresh;
    const timer = window.setInterval(refresh, 5_000);
    return () => {
      window.clearInterval(timer);
      window.__streamDeckRecordingUpdate = previous;
    };
  }, [refresh]);
  return { ...state, refresh };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export const STATUS_LABEL: Record<Recording["status"], string> = {
  scheduled: "Scheduled",
  recording: "Recording now",
  done: "Finished",
  stopped: "Stopped early",
  storage_full: "Stopped — storage full",
  failed: "Failed",
  cancelled: "Cancelled",
  missed: "Missed",
};

/** Default length: until the programme on at `start` ends, else one hour. */
export function defaultEnd(start: number, programmeEnd: number | null | undefined): number {
  if (programmeEnd && programmeEnd > start + 60_000) return programmeEnd;
  return start + 60 * 60_000;
}
