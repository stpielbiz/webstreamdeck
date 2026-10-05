import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ShieldCheck, ShieldOff, Trash2, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  adminStats,
  deleteAccount,
  listAccounts,
  sendAccountLink,
  setAdminRole,
} from "@/lib/admin.functions";
import { useIsAdmin } from "@/lib/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { setDebugEnabled, useDebugLog } from "@/lib/debug-log";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: z.object({ mode: z.literal("tv").optional() }),
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin · Stream Deck" },
      { name: "description", content: "Manage Stream Deck accounts, roles and cached title data." },
      { property: "og:title", content: "Admin · Stream Deck" },
      {
        property: "og:description",
        content: "Manage Stream Deck accounts, roles and cached title data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AdminPage() {
  const { mode } = Route.useSearch();
  const { isAdmin, loading } = useIsAdmin();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");

  const debug = useDebugLog();
  const [openLog, setOpenLog] = useState<string | null>(null);
  const logs = useQuery({
    queryKey: ["admin", "stream-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("stream_logs").select("id, code, device, entries, created_at").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
  const accountsFn = useServerFn(listAccounts);
  const statsFn = useServerFn(adminStats);
  const roleFn = useServerFn(setAdminRole);
  const removeFn = useServerFn(deleteAccount);
  const linkFn = useServerFn(sendAccountLink);

  const accounts = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: () => accountsFn(),
    enabled: isAdmin,
  });
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => statsFn(),
    enabled: isAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const role = useMutation({
    mutationFn: (input: { userId: string; admin: boolean }) => roleFn({ data: input }),
    onSuccess: () => {
      toast.success("Access updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account removed");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const link = useMutation({
    mutationFn: (email: string) =>
      linkFn({ data: { email, origin: window.location.origin } }),
    onSuccess: (result) => {
      if (result.link) {
        void navigator.clipboard?.writeText(result.link);
        toast.success("Reset link copied to clipboard");
      } else {
        toast.success("Reset link created");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted to the account owner.
          </p>
        </div>
      </div>
    );
  }

  const rows = (accounts.data ?? []).filter((user) =>
    (user.email ?? "").toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      {mode === "tv" && <Button asChild variant="ghost" data-tv-focus data-layer-back><Link to="/tv"><ArrowLeft className="size-4" /> Back to TV Home</Link></Button>}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage accounts, access and shared title data.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Saved titles", value: stats.data?.metadata },
          { label: "Playlists", value: stats.data?.playlists },
          { label: "Favourites", value: stats.data?.favorites },
          { label: "In progress", value: stats.data?.progress },
          { label: "TV pairings", value: stats.data?.devices },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {card.value === undefined ? "—" : card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Connection & stream logs</h2>
            <p className="text-sm text-muted-foreground">Turn on for this device. A Logs button appears bottom-left; press Save to store them with a code.</p>
          </div>
          <Switch data-tv-focus checked={debug.enabled} onCheckedChange={setDebugEnabled} aria-label="Connection and stream logs" />
        </div>
        {(logs.data ?? []).map((log) => (
          <div key={log.id} className="rounded border border-border">
            <button data-tv-focus className="flex w-full justify-between px-3 py-2 text-left text-sm" onClick={() => setOpenLog(openLog === log.id ? null : log.id)}>
              <span className="font-mono font-semibold">{log.code}</span>
              <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
            </button>
            {openLog === log.id && (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all border-t border-border p-2 font-mono text-[11px] text-muted-foreground">
                {log.device + "\n" + (log.entries as { at: string; scope: string; message: string; detail?: string }[]).map((e) => `${e.at.slice(11, 23)} [${e.scope}] ${e.message}${e.detail ? " " + e.detail : ""}`).join("\n")}
              </pre>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Accounts</h2>
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search by email"
            className="max-w-xs"
          />
        </div>

        {accounts.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : accounts.isError ? (
          <p className="text-sm text-destructive">
            {(accounts.error as Error).message}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2">Last sign-in</th>
                  <th className="px-3 py-2">Sources</th>
                  <th className="px-3 py-2">Favourites</th>
                  <th className="px-3 py-2">Watching</th>
                  <th className="px-3 py-2">Access</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      {user.email ?? "—"}
                      {!user.confirmed && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          unconfirmed
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmt(user.createdAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmt(user.lastSignInAt)}</td>
                    <td className="px-3 py-2">{user.playlists}</td>
                    <td className="px-3 py-2">{user.favorites}</td>
                    <td className="px-3 py-2">{user.progress}</td>
                    <td className="px-3 py-2">
                      {user.isAdmin ? (
                        <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                          Admin
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Member</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={user.isAdmin ? "Remove admin access" : "Make admin"}
                          onClick={() =>
                            role.mutate({ userId: user.id, admin: !user.isAdmin })
                          }
                        >
                          {user.isAdmin ? (
                            <ShieldOff className="size-4" />
                          ) : (
                            <ShieldCheck className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Copy password reset link"
                          disabled={!user.email}
                          onClick={() => user.email && link.mutate(user.email)}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete account"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Permanently delete ${user.email ?? "this account"} and all of its saved data?`,
                              )
                            ) {
                              remove.mutate(user.id);
                            }
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                      No accounts match that search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
