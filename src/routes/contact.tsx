import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, LifeBuoy, Loader2, MessageSquare, Send } from "lucide-react";
import { BrandMark, BrandName } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSpatialNav } from "@/lib/use-spatial-nav";
import { isFireTvDevice } from "@/lib/fire-tv-device";
import { sendContactMessage } from "@/lib/contact.functions";

export const Route = createFileRoute("/contact")({
  validateSearch: (search: Record<string, unknown>) => ({ mode: search.mode === "tv" ? "tv" : undefined }),
  head: () => ({ meta: [
    { title: "Contact us — Jolzplay" },
    { name: "description", content: "Contact Jolzplay for account support or share your feedback." },
    { property: "og:title", content: "Contact us — Jolzplay" },
    { property: "og:description", content: "Send your support question or feedback to Jolzplay." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Contact,
});

function Contact() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const send = useServerFn(sendContactMessage);
  const [type, setType] = useState<"Support" | "Feedback">("Support");
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [tv, setTv] = useState(mode === "tv");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const first = useRef<HTMLButtonElement>(null);
  const submissionId = useRef<string | null>(null);
  const home = tv ? "/tv" : signedIn ? "/dashboard" : "/";
  useSpatialNav({ onBack: () => { void navigate({ to: home }); } });
  useEffect(() => {
    setTv(mode === "tv" || isFireTvDevice());
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) { setEmail(data.session?.user.email ?? ""); setSignedIn(!!data.session); }
    });
    first.current?.focus();
    return () => { cancelled = true; };
  }, [mode]);
  return <div className="min-h-screen bg-background">
    <header className="border-b border-border"><div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
      <span className="flex items-center gap-2 font-display text-xl font-bold"><BrandMark className="size-8" /><BrandName /></span>
      <Button asChild variant="ghost"><Link to={home} data-tv-focus><ArrowLeft className="size-4" />Back</Link></Button>
    </div></header>
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold">Contact us</h1>
      {success ? <section role="status" className="mt-8 space-y-4"><CheckCircle2 className="size-10 text-primary" /><h2 className="text-xl font-semibold">Thanks, we got your message.</h2><Button data-tv-focus onClick={() => { setSuccess(false); submissionId.current = null; }}>Send another message</Button></section> :
      <form className="mt-6 space-y-5" onSubmit={async event => {
        event.preventDefault();
        if (pending) return;
        const fields = new FormData(event.currentTarget);
        submissionId.current ??= crypto.randomUUID();
        setPending(true); setError("");
        try {
          const result = await send({ data: { type, name: String(fields.get("name") ?? ""), accountEmail: email, subject: String(fields.get("subject") ?? ""), message: String(fields.get("message") ?? ""), website: String(fields.get("website") ?? ""), device: tv ? "Fire TV" : "Browser", submissionId: submissionId.current } });
          if (result.sent) setSuccess(true); else setError(result.message);
        } catch { setError("We couldn't send your message. Please try again later."); }
        finally { setPending(false); }
      }}>
        <div data-remote-row className="grid grid-cols-2 gap-3" aria-label="Message type">
          <Button ref={first} type="button" data-tv-focus aria-pressed={type === "Support"} variant={type === "Support" ? "default" : "outline"} className="h-12 text-base" onClick={() => setType("Support")}><LifeBuoy className="size-5" />Support</Button>
          <Button type="button" data-tv-focus aria-pressed={type === "Feedback"} variant={type === "Feedback" ? "default" : "outline"} className="h-12 text-base" onClick={() => setType("Feedback")}><MessageSquare className="size-5" />Feedback</Button>
        </div>
        <div className="space-y-2"><Label htmlFor="contact-name">Name</Label><Input id="contact-name" name="name" autoComplete="name" maxLength={100} required data-tv-focus className="h-12" /></div>
        <div className="space-y-2"><Label htmlFor="contact-email">Jolzplay account email</Label><Input id="contact-email" name="accountEmail" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} data-tv-focus className="h-12" /></div>
        <div className="space-y-2"><Label htmlFor="contact-subject">Subject</Label><Input id="contact-subject" name="subject" maxLength={120} required data-tv-focus className="h-12" /></div>
        <div className="space-y-2"><Label htmlFor="contact-message">Message</Label><Textarea id="contact-message" name="message" maxLength={5000} required data-tv-focus className="min-h-32" /></div>
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" data-tv-focus disabled={pending} className="h-12 px-6">{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{pending ? "Sending…" : "Send"}</Button>
      </form>}
    </main>
  </div>;
}