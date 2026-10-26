import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { contactSchema } from "./contact-schema";

// Bounded best-effort per-worker abuse guard; managed sending also enforces workspace limits.
const recent = new Map<string, number>();
export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const now = Date.now();
    const key = data.accountEmail.toLowerCase();
    if (now - (recent.get(key) ?? 0) < 60_000) return { sent: false, message: "Please wait a minute before sending another message." };
    for (const [sender, time] of recent) if (now - time > 60_000) recent.delete(sender);
    if (recent.size >= 1000) return { sent: false, message: "Please try again in a minute." };
    recent.set(key, now);
    try {
      const request = getRequest();
      let signedIn = false;
      const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (bearer) {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env["SUPABASE_URL"];
        const publicKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (url && publicKey) {
          const client = createClient(url, publicKey, { auth: { persistSession: false } });
          const { data: auth } = await client.auth.getUser(bearer);
          signedIn = !!auth.user;
        }
      }
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const result = await sendTemplateEmail("contact-message", "payment@jolzplay.com", {
        templateData: { ...data, signedIn, sentAt: new Date(now).toISOString() },
        replyTo: data.accountEmail,
        idempotencyKey: `contact-message-${data.submissionId}`,
      });
      return result.sent ? { sent: true, message: "Thanks, we got your message." } : { sent: false, message: "Your message could not be delivered. Please try again later." };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      recent.delete(key);
      return { sent: false, message: code === "domain_not_verified" ? "Contact messages are not available yet. Please try again once email setup is complete." : "We couldn't send your message. Please try again later." };
    }
  });