import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Unambiguous alphabet — no 0/O, 1/I, 5/S. */
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
const CODE_LENGTH = 6;
const TTL_MINUTES = 10;

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export interface DeviceCodeInfo {
  code: string;
  expiresAt: string;
}

/** Called by the TV before anybody is signed in. */
export const createDeviceCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ label: z.string().trim().max(60).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<DeviceCodeInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Housekeeping: drop anything that has expired.
    await supabaseAdmin.from("device_codes").delete().lt("expires_at", new Date().toISOString());

    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomCode();
      const { error } = await supabaseAdmin.from("device_codes").insert({
        code,
        device_label: data.label ?? null,
        expires_at: expiresAt,
      });
      if (!error) return { code, expiresAt };
      if (error.code !== "23505") throw new Error("Could not start pairing. Please try again.");
    }
    throw new Error("Could not start pairing. Please try again.");
  });

/** Called from a signed-in phone or computer to approve a TV. */
export const approveDeviceCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{4,8}$/, "Enter the code shown on your TV."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("device_codes")
      .select("id, expires_at, consumed_at")
      .eq("code", data.code)
      .maybeSingle();

    if (error) throw new Error("Could not check that code. Please try again.");
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("That code is not valid any more. Get a fresh code on your TV.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("device_codes")
      .update({ user_id: context.userId, approved_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("consumed_at", null);

    if (updateError) throw new Error("Could not connect that TV. Please try again.");
    return { ok: true };
  });

export type ClaimResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "approved"; email: string; token: string };

/** Polled by the TV. Once approved it returns a one-time sign-in token. */
export const claimDeviceCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().toUpperCase().max(8) }).parse(input),
  )
  .handler(async ({ data }): Promise<ClaimResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("device_codes")
      .select("id, user_id, approved_at, consumed_at, expires_at")
      .eq("code", data.code)
      .maybeSingle();

    if (!row || row.consumed_at) return { status: "expired" };
    if (new Date(row.expires_at).getTime() < Date.now()) return { status: "expired" };
    if (!row.approved_at || !row.user_id) return { status: "pending" };

    // Single use: consume before minting anything.
    const { data: consumed } = await supabaseAdmin
      .from("device_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();
    if (!consumed) return { status: "expired" };

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      row.user_id,
    );
    const email = userData?.user?.email;
    if (userError || !email) return { status: "expired" };

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const token = link?.properties?.email_otp;
    if (linkError || !token) return { status: "expired" };

    return { status: "approved", email, token };
  });
