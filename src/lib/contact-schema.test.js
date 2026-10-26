import { describe, expect, it } from "vitest";
import { contactSchema } from "./contact-schema";
import { template } from "./email-templates/contact-message";
const valid = { type: "Support", name: "Alex", accountEmail: "alex@example.com", subject: "Help", message: "Playlist question", device: "Browser", submissionId: "51d61f75-f207-42da-a63f-d5c5852ac967", website: "" };
describe("contact rules", () => {
  it("requires the Jolzplay account email", () => { expect(contactSchema.safeParse({ ...valid, accountEmail: "" }).success).toBe(false); });
  it("only accepts support and feedback", () => { expect(contactSchema.safeParse({ ...valid, type: "Other" }).success).toBe(false); });
  it("sends to the owner's fixed recipient", () => { expect(template.to).toBe("payment@jolzplay.com"); });
  it("labels support subjects", () => { expect(template.subject(valid)).toBe("[Support] Help"); });
  it("labels feedback subjects", () => { expect(template.subject({ ...valid, type: "Feedback" })).toBe("[Feedback] Help"); });
});