import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ShieldCheck, ShieldOff, Trash2, KeyRound, RefreshCw, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  adminStats,
  deleteAccount,
  listAccounts,
  sendAccountLink,
  setAccountAccess,
  setAdminRole,
  type AdminUser,
} from "@/lib/admin.functions";
import { useIsAdmin } from "@/lib/use-admin";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setDebugEnabled, useDebugLog } from "@/lib/debug-log";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: z.object({ mode: z.literal("tv").optional() }),
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin · Jolzplay" },
      { name: "description", content: "Manage Jolzplay accounts, roles and cached title data." },
      { property: "og:title", content: "Admin · Jolzplay" },
      {
        property: "og:description",
        content: "Manage Jolzplay accounts, roles and cached title data.",
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
  const [logsOpen, setLogsOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
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
  const accessFn = useServerFn(setAccountAccess);

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

  const access = useMutation({
    mutationFn: (input: { userId: string; neverExpires: boolean; expiresAt: string | null }) => accessFn({ data: input }),
    onSuccess: () => {
      toast.success("Expiry updated");
      refresh();
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
        <Button variant="secondary" size="sm" data-tv-focus onClick={refresh}>
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
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">Connection & stream logs</h2>
            <p className="text-sm text-muted-foreground">Turn on for this device. While on, logs save here automatically every 20 seconds (codes start with AUTO).</p>
          </div>
          <Switch data-tv-focus checked={debug.enabled} onCheckedChange={setDebugEnabled} aria-label="Connection and stream logs" />
        </div>
        <Button variant="outline" size="sm" data-tv-focus onClick={() => setLogsOpen((v) => !v)}>
          {logsOpen ? "Hide logs" : `Show logs (${logs.data?.length ?? 0})`}
        </Button>
        {logsOpen && (logs.data ?? []).map((log) => (
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Accounts</h2>
          <SearchField value={filter} onValueChange={setFilter} placeholder="Search by email" containerClassName="max-w-sm" data-tv-focus data-app-search="true" />
        </div>

        {accounts.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : accounts.isError ? (
          <p className="text-sm text-destructive">{(accounts.error as Error).message}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No accounts match that search.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((user) => (
              <li key={user.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-all font-semibold">{user.email ?? "—"}</span>
                  {user.isAdmin && <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Admin</span>}
                  {!user.confirmed && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">unconfirmed</span>}
                  {user.transferClaimedAt && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Transfer sent {new Date(user.transferClaimedAt).toLocaleString()}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Joined {fmt(user.createdAt)} · Last sign-in {fmt(user.lastSignInAt)} · {user.playlists} sources · {user.favorites} favourites · {user.progress} watching
                </p>
                <AccountExpiryControl user={user} tv={mode === "tv"} pending={access.isPending} onSave={(value) => access.mutate({ userId: user.id, ...value })} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" data-tv-focus onClick={() => role.mutate({ userId: user.id, admin: !user.isAdmin })}>
                    {user.isAdmin ? <><ShieldOff className="size-4" /> Remove admin</> : <><ShieldCheck className="size-4" /> Make admin</>}
                  </Button>
                  <Button variant="outline" size="sm" data-tv-focus disabled={!user.email} onClick={() => user.email && link.mutate(user.email)}>
                    <KeyRound className="size-4" /> Reset link
                  </Button>
                  <Button variant="outline" size="sm" data-tv-focus onClick={() => setDeleting(user)}>
                    <Trash2 className="size-4 text-destructive" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>Permanently delete {deleting?.email ?? "this account"} and all of its saved data.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" data-tv-focus autoFocus data-dialog-back onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" data-tv-focus onClick={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function addTo(base: Date, unit: "day" | "month" | "year") {
  const d = new Date(base);
  if (unit === "day") d.setDate(d.getDate() + 1);
  else if (unit === "month") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

function AccountExpiryControl({ user, tv, pending, onSave }: {
  user: AdminUser;
  tv: boolean;
  pending: boolean;
  onSave: (value: { neverExpires: boolean; expiresAt: string | null }) => void;
}) {
  const [neverExpires, setNeverExpires] = useState(user.neverExpires);
  const [date, setDate] = useState(user.expiresAt?.slice(0, 10) ?? "");
  const bump = (unit: "day" | "month" | "year") => {
    const current = date ? new Date(`${date}T12:00:00`) : null;
    const base = current && current > new Date() ? current : new Date();
    const next = addTo(base, unit);
    setNeverExpires(false);
    setDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
  };
  const save = () => {
    if (neverExpires) return onSave({ neverExpires: true, expiresAt: null });
    if (!date) return void toast.error("Choose an expiry date");
    onSave({ neverExpires: false, expiresAt: new Date(`${date}T23:59:59.999Z`).toISOString() });
  };
  const label = neverExpires ? "Never expires" : date ? `Expires ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "No expiry date set";

  return (
    <div className="space-y-2 rounded-md bg-secondary/40 p-3">
      <p className="text-sm font-semibold">
        {label}
        {user.expired && !user.neverExpires && <span className="ml-2 text-destructive">(currently expired)</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" data-tv-focus disabled={pending} onClick={() => bump("day")}>+1 day</Button>
        <Button type="button" size="sm" variant="secondary" data-tv-focus disabled={pending} onClick={() => bump("month")}>+1 month</Button>
        <Button type="button" size="sm" variant="secondary" data-tv-focus disabled={pending} onClick={() => bump("year")}>+1 year</Button>
        <Button type="button" size="sm" variant={neverExpires ? "default" : "outline"} data-tv-focus disabled={pending} onClick={() => setNeverExpires((v) => !v)}>
          Never expires: {neverExpires ? "On" : "Off"}
        </Button>
        {!tv && <Input type="date" className="w-auto" value={date} disabled={neverExpires || pending} onChange={(event) => setDate(event.target.value)} aria-label={`Expiry date for ${user.email ?? "account"}`} />}
        <Button type="button" size="sm" data-tv-focus disabled={pending} onClick={save}><CalendarClock className="size-4" /> Save</Button>
      </div>
    </div>
  );
}
