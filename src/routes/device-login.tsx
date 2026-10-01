import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { approveDeviceCode } from "@/lib/device-pairing.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/device-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Log in another device — Stream Deck" },
      {
        name: "description",
        content: "Enter the one-time code shown on another device to sign it into Stream Deck.",
      },
      { property: "og:title", content: "Log in another device — Stream Deck" },
      {
        property: "og:description",
        content: "Sign another device into your Stream Deck account with a one-time code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeviceLoginPage,
});

function DeviceLoginPage() {
  const navigate = useNavigate();
  const approve = useServerFn(approveDeviceCode);
  const [checkingSession, setCheckingSession] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        void navigate({ to: "/auth", search: { returnTo: "/device-login" }, replace: true });
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await approve({ data: { code: code.trim().toUpperCase() } });
      setDone(true);
      setCode("");
      toast.success("Device connected — it will sign in within a few seconds.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Checking sign-in" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <LogIn className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">Log in another device</h1>
            <p className="text-sm text-muted-foreground">Type the code shown on that device.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            aria-label="Device code"
            maxLength={8}
            autoFocus
            className="h-14 text-center font-display text-2xl tracking-[0.4em]"
          />
          <Button type="submit" className="w-full" disabled={busy || code.trim().length < 4}>
            {busy ? "Connecting…" : "Log in device"}
          </Button>
          {done && (
            <p className="flex items-center justify-center gap-2 text-sm text-primary">
              <CheckCircle2 className="size-4" /> Done — check your other device.
            </p>
          )}
        </form>

        <p className="mt-4 text-xs text-muted-foreground">
          Codes last 10 minutes and can only be used once. If nothing happens, get a fresh code on
          the other device and try again.
        </p>
      </div>
    </div>
  );
}