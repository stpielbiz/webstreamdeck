import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Tv } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Stream Deck" },
      {
        name: "description",
        content:
          "Sign in or create a Stream Deck account to watch your own IPTV playlists with favourites and resume.",
      },
      { property: "og:title", content: "Sign in — Stream Deck" },
      {
        property: "og:description",
        content: "Access your playlists, favourites and continue watching.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const signUp = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setCheckEmail(true);
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in didn't work. Try again or use your email.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded bg-primary text-primary-foreground">
            <Tv className="size-5" />
          </span>
          <span className="font-display text-xl font-bold">Stream Deck</span>
        </Link>

        {checkEmail ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <h1 className="font-display text-lg font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to {email}. Open it and you'll be signed in.
            </p>
            <Button variant="ghost" className="mt-4" onClick={() => setCheckEmail(false)}>
              Back
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              {(["signin", "signup"] as const).map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${tab}-email`}>Email</Label>
                    <Input
                      id={`${tab}-email`}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${tab}-password`}>Password</Label>
                    <Input
                      id={`${tab}-password`}
                      type="password"
                      autoComplete={tab === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void (tab === "signin" ? signIn() : signUp());
                      }}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={busy || !email || password.length < 6}
                    onClick={() => void (tab === "signin" ? signIn() : signUp())}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {tab === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>
              Continue with Google
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
