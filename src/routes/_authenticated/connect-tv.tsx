import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Tv } from "lucide-react";
import { toast } from "sonner";

import { approveDeviceCode } from "@/lib/device-pairing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/connect-tv")({
  head: () => ({
    meta: [
      { title: "Connect a TV — Stream Deck" },
      {
        name: "description",
        content: "Enter the code shown on your Firestick or TV to sign that device into your account.",
      },
      { property: "og:title", content: "Connect a TV — Stream Deck" },
      { property: "og:description", content: "Pair a TV with a short code." },
    ],
  }),
  component: ConnectTvPage,
});

function ConnectTvPage() {
  const approve = useServerFn(approveDeviceCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await approve({ data: { code: code.trim().toUpperCase() } });
      setDone(true);
      setCode("");
      toast.success("TV connected — it will sign in within a few seconds.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Tv className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Connect a TV</h1>
          <p className="text-sm text-muted-foreground">
            Type the code shown on your Firestick or TV screen.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={8}
          autoFocus
          className="h-14 text-center font-display text-2xl tracking-[0.4em]"
        />
        <Button type="submit" className="w-full" disabled={busy || code.trim().length < 4}>
          {busy ? "Connecting…" : "Connect TV"}
        </Button>
        {done && (
          <p className="flex items-center justify-center gap-2 text-sm text-primary">
            <CheckCircle2 className="size-4" /> Done — check your TV.
          </p>
        )}
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Codes last 10 minutes and can only be used once. If nothing happens on the TV, get a fresh
        code there and try again.
      </p>
    </div>
  );
}
