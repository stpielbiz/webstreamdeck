import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { isDebugEnabled, trace } from "@/lib/debug-log";

/** Short, credential-free name for a query in the step trail. */
function label(queryKey: readonly unknown[]): string {
  return queryKey
    .slice(0, 3)
    .map((part) => (typeof part === "string" ? (part.length > 40 ? `${part.slice(0, 8)}…` : part) : typeof part === "number" ? String(part) : "…"))
    .join("/");
}

function size(data: unknown): string {
  if (Array.isArray(data)) return `${data.length} items`;
  if (data && typeof data === "object") return `${Object.keys(data).length} keys`;
  return "";
}

let installed = false;

/** While logs are on: every data download and page change becomes a trail step. */
export function installTrace(queryClient: QueryClient, router: AnyRouter): () => void {
  if (installed || !isDebugEnabled() || typeof window === "undefined") return () => {};
  installed = true;
  const started = new Map<string, number>();
  const offQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    const action = event.action as { type: string; manual?: boolean };
    const key = event.query.queryHash;
    if (action.type === "fetch") {
      if (started.has(key)) return;
      started.set(key, performance.now());
      trace(`Fetch ${label(event.query.queryKey)}: start`);
    } else if (action.type === "success" || action.type === "error") {
      const at = started.get(key);
      if (at === undefined) return;
      started.delete(key);
      trace(`Fetch ${label(event.query.queryKey)}: ${action.type === "error" ? "failed" : "done"} in ${Math.round(performance.now() - at)} ms`, action.type === "success" ? size(event.query.state.data) : undefined);
    }
  });
  const offBefore = router.subscribe("onBeforeNavigate", (event) => trace(`Navigate to ${event.toLocation.pathname}: start`));
  const offResolved = router.subscribe("onResolved", (event) => trace(`Navigate to ${event.toLocation.pathname}: done`));
  const onVisibility = () => trace(`Page ${document.visibilityState}`);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    installed = false;
    offQueries();
    offBefore();
    offResolved();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
