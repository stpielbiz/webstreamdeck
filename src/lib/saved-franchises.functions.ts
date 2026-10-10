import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Franchise, FranchiseMember } from "@/lib/franchise.functions";

export interface SavedFranchise extends Franchise {
  id: string;
  key: string;
  createdAt: string;
}

const memberSchema = z.object({
  title: z.string().min(1).max(200),
  year: z.number().int().min(1800).max(2200).nullable(),
  kind: z.enum(["movie", "series"]),
  story_index: z.number().int().min(0).max(1000),
});

const keyOf = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

function fromRow(row: {
  id: string; franchise_key: string; franchise_name: string; has_story_order: boolean;
  members: unknown; created_at: string;
}): SavedFranchise {
  return {
    id: row.id,
    key: row.franchise_key,
    name: row.franchise_name,
    hasStoryOrder: row.has_story_order,
    members: row.members as FranchiseMember[],
    createdAt: row.created_at,
  };
}

export const listSavedFranchises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedFranchise[]> => {
    const { data, error } = await context.supabase
      .from("saved_franchises")
      .select("id, franchise_key, franchise_name, has_story_order, members, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(fromRow);
  });

export const saveFranchise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    name: z.string().min(1).max(200),
    hasStoryOrder: z.boolean(),
    members: z.array(memberSchema).min(2).max(50),
  }).parse(input))
  .handler(async ({ data, context }): Promise<SavedFranchise> => {
    const franchiseKey = keyOf(data.name);
    if (!franchiseKey) throw new Error("This list could not be saved.");
    const { data: saved, error } = await context.supabase.from("saved_franchises").upsert({
      user_id: context.userId,
      franchise_key: franchiseKey,
      franchise_name: data.name,
      has_story_order: data.hasStoryOrder,
      members: data.members,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,franchise_key" }).select("id, franchise_key, franchise_name, has_story_order, members, created_at").single();
    if (error) throw new Error(error.message);
    return fromRow(saved);
  });

export const removeSavedFranchise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<void> => {
    const { error } = await context.supabase.from("saved_franchises").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
  });