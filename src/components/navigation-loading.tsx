import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export function NavigationLoading() {
  const pending = useRouterState({ select: (state) => state.status === "pending" });
  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Opening screen"
      className="fixed inset-0 z-[100] grid place-items-center bg-background/85 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 rounded border border-border bg-card px-5 py-4 shadow-lg">
        <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" />
        <span className="font-display text-lg font-semibold">Opening…</span>
      </div>
    </div>
  );
}