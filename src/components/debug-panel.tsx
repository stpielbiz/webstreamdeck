import { useState } from "react";
import { Bug, Copy, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { clearDebugLog, formatDebugLog, setDebugEnabled, useDebugLog } from "@/lib/debug-log";

/** Floating log viewer, visible only while diagnostics are switched on. */
export function DebugPanel() {
  const { enabled, entries } = useDebugLog();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  if (!enabled) return null;

  const save = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return toast.error("Sign in to save logs");
    const code = "LOG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("stream_logs").insert({
      code, user_id: data.user.id, device: navigator.userAgent.slice(0, 300), entries: entries as never,
    });
    if (error) return toast.error(error.message);
    setSaved(code);
    toast.success(`Logs saved as ${code}`);
  };

  const copy = async () => {
    const text = formatDebugLog();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy these logs", text);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="fixed bottom-3 left-3 z-[60] shadow-lg" onClick={() => setOpen(true)}>
        <Bug className="size-4" /> Logs ({entries.length})
      </Button>
    );
  }

  return (
    <div data-tv-zone="debug" className="fixed inset-x-3 bottom-3 z-[60] flex max-h-[45vh] flex-col rounded-lg border border-border bg-card shadow-2xl sm:left-3 sm:right-auto sm:w-[40rem]">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Bug className="size-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">Connection & stream logs</span>
        <Button data-tv-focus size="sm" variant="ghost" onClick={save}><Save className="size-4" /> {saved ?? "Save"}</Button>
        <Button data-tv-focus size="sm" variant="ghost" onClick={copy}><Copy className="size-4" /> {copied ? "Copied" : "Copy"}</Button>
        <Button data-tv-focus size="sm" variant="ghost" onClick={clearDebugLog}><Trash2 className="size-4" /> Clear</Button>
        <Button data-tv-focus size="sm" variant="ghost" onClick={() => setDebugEnabled(false)}>Turn off</Button>
        <Button data-tv-focus size="icon" variant="ghost" aria-label="Hide logs" onClick={() => setOpen(false)}><X className="size-4" /></Button>
      </div>
      <pre className="scrollbar-thin min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all p-2 font-mono text-[11px] leading-snug text-muted-foreground">
        {entries.length ? formatDebugLog() : "No events yet — try playing something."}
      </pre>
    </div>
  );
}
