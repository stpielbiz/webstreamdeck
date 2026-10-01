import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Tv } from "lucide-react";

import { claimDeviceCode, createDeviceCode } from "@/lib/device-pairing.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tv/pair")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in on your TV — Stream Deck" },
      {
        name: "description",
        content:
          "Enter the code shown here on a signed-in phone, tablet, or computer to sign in this device.",
      },
      { property: "og:title", content: "Sign in on your TV — Stream Deck" },
      {
        property: "og:description",
        content: "Sign in another device with a short code — no password typing required.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PairPage,
});

function PairPage() {
  const navigate = useNavigate();
  const newCode = useServerFn(createDeviceCode);
  const claim = useServerFn(claimDeviceCode);

  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "signing-in" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const result = await newCode({ data: { label: "Device" } });
      setCode(result.code);
      setStatus("waiting");
    } catch {
      setStatus("error");
      setMessage("Could not get a code. Check your internet connection and try again.");
    }
  }, [newCode]);

  useEffect(() => {
    const existing = supabase.auth.getSession();
    void existing.then(({ data }) => {
      if (data.session) void navigate({ to: "/tv", replace: true });
      else void start();
    });
  }, [navigate, start]);

  useEffect(() => {
    if (status !== "waiting" || !code) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const result = await claim({ data: { code } });
        if (cancelled) return;
        if (result.status === "approved") {
          setStatus("signing-in");
          const { error } = await supabase.auth.verifyOtp({
            email: result.email,
            token: result.token,
            type: "email",
          });
          if (error) {
            setStatus("error");
            setMessage("Sign-in failed. Please get a new code and try again.");
            return;
          }
          void navigate({ to: "/tv", replace: true });
          return;
        }
        if (result.status === "expired") {
          void start();
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled) timer.current = setTimeout(poll, 3000);
    };

    timer.current = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, code, claim, navigate, start]);

  const host = typeof window === "undefined" ? "" : window.location.host;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-3xl text-center">
        <span className="mx-auto mb-6 grid size-14 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Tv className="size-7" />
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Log in this device
        </h1>
        <ol className="mx-auto mt-6 max-w-xl space-y-2 text-left text-lg text-muted-foreground">
          <li>1. On your phone or computer, open {host || "this site"} and sign in.</li>
          <li>
            2. Go to <span className="font-semibold text-foreground">Log in another device</span>.
          </li>
          <li>3. Type the code below.</li>
        </ol>

        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-10">
          {status === "loading" && (
            <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />
          )}
          {code && status !== "loading" && status !== "error" && (
            <p className="font-display text-6xl font-bold tracking-[0.3em] sm:text-7xl">{code}</p>
          )}
          {status === "waiting" && (
            <p className="mt-6 text-base text-muted-foreground">
              Waiting for you to confirm… this code lasts 10 minutes.
            </p>
          )}
          {status === "signing-in" && (
            <p className="mt-6 text-base text-primary">Code accepted — signing you in…</p>
          )}
          {status === "error" && (
            <div className="space-y-4">
              <p className="text-base text-destructive">{message}</p>
              <Button data-tv-focus onClick={() => void start()}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
