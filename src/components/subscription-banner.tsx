import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, CalendarClock, CircleAlert, Hourglass } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import guide from "@/assets/paypal-guide.png.asset.json";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT } from "@/content/payment";
import { useAccountAccess } from "@/lib/account-access";
import { claimTransferSent } from "@/lib/account-access.functions";

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString(undefined, {
  month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
}) : null;

/** Home account card: trial/expiry status plus PayPal Friends and Family payment flow. */
export function SubscriptionBanner() {
  const access = useAccountAccess();
  const status = access.data;
  const qc = useQueryClient();
  const claim = useServerFn(claimTransferSent);
  const [howTo, setHowTo] = useState(false);
  const [sent, setSent] = useState(false);
  const mutation = useMutation({
    mutationFn: () => claim(),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["account-access"] }); setSent(true); },
    onError: (e: Error) => toast.error(e.message),
  });

  const date = fmt(status?.expiresAt ?? null);
  const pending = !!status?.transferClaimedAt;
  const Icon = status?.neverExpires ? BadgeCheck : pending ? Hourglass : status?.expired ? CircleAlert : CalendarClock;
  const title = access.isLoading ? "Checking account access…"
    : status?.neverExpires ? "Your account never expires"
    : pending ? "Payment pending review"
    : status?.expired ? "Your account has expired"
    : `Your account is active until ${date ?? "soon"}`;
  const body = status?.neverExpires ? "Your access is active with no expiry date."
    : pending ? `Thanks! We're checking your PayPal transfer. Your access stays open until ${date}, and we'll activate your year once it arrives.`
    : status?.expired ? "Live TV, movies, shows and playlists are paused. Send your yearly payment below to get back in."
    : `Keep watching after that for ${PAYMENT.price}.`;
  const showPay = !!status && !status.neverExpires;

  if (!status || status.neverExpires) return null;

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
      <div>
        <p className="flex items-center gap-2 font-display text-base font-semibold"><Icon className="size-5 text-primary" />{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      {showPay && !pending && (
        <div className="space-y-3">
          <p className="text-sm"><strong>{PAYMENT.price}</strong> <span className="text-muted-foreground">by PayPal Friends and Family to</span> <strong>{PAYMENT.email}</strong></p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" data-tv-focus onClick={() => setHowTo(true)}>How to pay</Button>
            <Button data-tv-focus disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : "PayPal transfer sent"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={howTo} onOpenChange={setHowTo}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>How to pay with PayPal</DialogTitle>
            <DialogDescription>Send {PAYMENT.price} to {PAYMENT.email} using Friends and Family.</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-1 pl-5 text-sm">{PAYMENT.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <img src={guide.url} alt="PayPal Friends and Family steps" className="w-full rounded-md" loading="lazy" />
          <Button data-tv-focus autoFocus onClick={() => setHowTo(false)}>Got it</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={sent} onOpenChange={setSent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thanks — we got your notice</DialogTitle>
            <DialogDescription>You have 48 more hours of access while we check your payment.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Make sure you sent {PAYMENT.price} to <strong>{PAYMENT.email}</strong>.</li>
            <li>It must be <strong>Friends and Family</strong>, not Goods and Services.</li>
            <li>Your Streamivo login email must be in the PayPal note so we can match it.</li>
            <li>Once the funds arrive we'll activate your account for a year. Your access stays open until {date}.</li>
          </ul>
          <Button data-tv-focus autoFocus onClick={() => setSent(false)}>OK</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
