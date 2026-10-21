import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AccountAccess } from "@/lib/account-access";

export const getAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountAccess> => {
    const { data, error } = await context.supabase
      .from("account_access")
      .select("expires_at, never_expires, transfer_claimed_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not check account access");

    const expiresAt = data?.expires_at ?? null;
    const neverExpires = data?.never_expires ?? false;
    return {
      expiresAt,
      neverExpires,
      transferClaimedAt: data?.transfer_claimed_at ?? null,
      expired: !neverExpires && (!expiresAt || new Date(expiresAt).getTime() <= Date.now()),
    };
  });

/** User reports a PayPal transfer: one-time 48h extension, checked server-side. */
export const claimTransferSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_transfer_sent");
    if (error) throw new Error("This account has already reported a transfer.");
    return { expiresAt: data as string };
  });
