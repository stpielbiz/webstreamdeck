import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmed: boolean;
  isAdmin: boolean;
  playlists: number;
  favorites: number;
  progress: number;
};

/** True only when the caller holds the admin role. */
export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return false;
    return data === true;
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Not authorised");
}

/** Full account list with per-account usage counts. Admin only. */
export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const [roles, playlists, favorites, progress] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("playlists").select("user_id"),
      supabaseAdmin.from("favorites").select("user_id"),
      supabaseAdmin.from("watch_progress").select("user_id"),
    ]);

    const admins = new Set(
      (roles.data ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
    );
    const tally = (rows: { user_id: string }[] | null) => {
      const map = new Map<string, number>();
      for (const row of rows ?? []) map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1);
      return map;
    };
    const pl = tally(playlists.data as any);
    const fv = tally(favorites.data as any);
    const pg = tally(progress.data as any);

    return list.users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      confirmed: Boolean(user.email_confirmed_at),
      isAdmin: admins.has(user.id),
      playlists: pl.get(user.id) ?? 0,
      favorites: fv.get(user.id) ?? 0,
      progress: pg.get(user.id) ?? 0,
    }));
  });

/** Shared metadata cache + catalogue stats. Admin only. */
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (table: string) => {
      const { count: c } = await supabaseAdmin
        .from(table as any)
        .select("*", { count: "exact", head: true });
      return c ?? 0;
    };
    const [metadata, playlists, favorites, progress, devices] = await Promise.all([
      count("title_metadata"),
      count("playlists"),
      count("favorites"),
      count("watch_progress"),
      count("device_codes"),
    ]);
    return { metadata, playlists, favorites, progress, devices };
  });

/** Grant or revoke the admin role for another account. Admin only. */
export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.admin) {
      throw new Error("You cannot remove your own admin access");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Permanently remove an account and everything it owns. Admin only. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("favorites").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("watch_progress").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("playlists").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send a password-reset / magic sign-in link to an account. Admin only. */
export const sendAccountLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email(), origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: `${data.origin}/auth` },
    });
    if (error) throw new Error(error.message);
    return { link: link.properties?.action_link ?? null };
  });
