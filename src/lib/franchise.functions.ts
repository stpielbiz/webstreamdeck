import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface FranchiseMember { title: string; year: number | null; kind: "movie" | "series"; story_index: number }
export interface Franchise { name: string; hasStoryOrder: boolean; members: FranchiseMember[] }

const keyOf = (title: string) => title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

async function askAi(apiKey: string, title: string, kind: string): Promise<Franchise | null | "error"> {
  const body = {
    model: "openai/gpt-6-astra",
    stream: true,
    reasoning: { effort: "low" },
    instructions:
      "You identify film/TV franchises and shared universes. Given a title, decide whether it belongs to a franchise " +
      "with at least 2 entries (sequels, prequels, spin-offs, shared universe). If not, return franchise null and empty members. " +
      "Otherwise list every released movie and TV show in it with release year, kind, and story_index = position in in-universe " +
      "chronological order (1 = earliest in story). Set has_story_order true only when story order differs meaningfully from release order. " +
      "Use the official English titles. For very large universes (e.g. Marvel) limit to the most relevant sub-franchise of the title " +
      "(e.g. Captain America films plus directly connected Avengers films), max 30 members.",
    input: `Title: ${title}\nType: ${kind}`,
    text: {
      format: {
        type: "json_schema",
        name: "franchise",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            franchise: { type: ["string", "null"] },
            has_story_order: { type: "boolean" },
            members: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  year: { type: ["number", "null"] },
                  kind: { type: "string", enum: ["movie", "series"] },
                  story_index: { type: "number" },
                },
                required: ["title", "year", "kind", "story_index"],
              },
            },
          },
          required: ["franchise", "has_story_order", "members"],
        },
      },
    },
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) return "error";
  let text = "";
  let buffer = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string; response?: { output_text?: string } };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        else if (ev.type === "response.completed" && !text && ev.response?.output_text) text = ev.response.output_text;
      } catch { /* keep-alive */ }
    }
  }
  try {
    const parsed = JSON.parse(text) as { franchise: string | null; has_story_order: boolean; members: FranchiseMember[] };
    if (!parsed.franchise || parsed.members.length < 2) return null;
    return { name: parsed.franchise, hasStoryOrder: parsed.has_story_order, members: parsed.members };
  } catch {
    return "error";
  }
}

/** Finds the franchise of a title; each title is looked up once and saved for everyone. */
export const resolveFranchise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; kind: "movie" | "series" }) => ({ title: String(input.title).slice(0, 200), kind: input.kind }))
  .handler(async ({ data, context }): Promise<Franchise | null> => {
    const key = keyOf(data.title);
    if (!key) return null;
    const { data: saved } = await context.supabase.from("franchise_lookups").select("*").eq("lookup_key", key).maybeSingle();
    if (saved) return saved.franchise_name ? { name: saved.franchise_name, hasStoryOrder: saved.has_story_order, members: saved.members as unknown as FranchiseMember[] } : null;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return null;
    const result = await askAi(apiKey, data.title, data.kind);
    if (result === "error") return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = [{ lookup_key: key, franchise_name: result?.name ?? null, has_story_order: result?.hasStoryOrder ?? false, members: (result?.members ?? []) as never }];
    // Save under every member title too, so related searches reuse it.
    if (result) for (const m of result.members) {
      const k = keyOf(m.title);
      if (k && k !== key) rows.push({ lookup_key: k, franchise_name: result.name, has_story_order: result.hasStoryOrder, members: result.members as never });
    }
    await supabaseAdmin.from("franchise_lookups").upsert(rows, { onConflict: "lookup_key", ignoreDuplicates: true });
    return result;
  });
