import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AccountAccess } from "@/lib/account-access";

export const getAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountAccess> => {
    const { data, error } = await context.supabase
      .from("account_access")
      .select("expires_at, never_expires")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not check account access");

    const expiresAt = data?.expires_at ?? null;
    const neverExpires = data?.never_expires ?? false;
    return {
      expiresAt,
      neverExpires,
      expired: !neverExpires && (!expiresAt || new Date(expiresAt).getTime() <= Date.now()),
    };
  });