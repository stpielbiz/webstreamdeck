import { BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Post-login subscription notice: accounts are free for a 1-day trial, then a
 * yearly subscription (PayPal transfer) activates the account. The PayPal
 * action stays disabled until the owner's PayPal account is set up.
 */
export function SubscriptionBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/10 p-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-display text-base font-semibold">
          <BadgeCheck className="size-5 text-primary" />
          Your account is free for 1 day
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          The trial runs for one day. To activate your account afterwards, send a yearly
          subscription by PayPal transfer — payment setup is coming soon.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button disabled aria-disabled>
          Pay with PayPal
        </Button>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coming soon
        </span>
      </div>
    </div>
  );
}
