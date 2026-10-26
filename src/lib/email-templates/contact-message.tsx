import * as React from "react";
import { Html, Head, Body, Container, Heading, Preview, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  type?: string; name?: string; accountEmail?: string; subject?: string;
  message?: string; device?: string; signedIn?: boolean; sentAt?: string;
}
function ContactMessage({ type = "Support", name, accountEmail, subject, message, device, signedIn, sentAt }: Props) {
  return <Html lang="en"><Head /><Preview>{`${type}: ${subject ?? "New message"}`}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#121826" }}>
      <Container style={{ padding: "28px", maxWidth: "600px" }}>
        <Heading>Jolzplay · {type}</Heading>
        <Text><strong>{subject}</strong></Text>
        <Text>Name: {name}<br />Jolzplay account: {accountEmail}<br />Signed in: {signedIn ? "Yes" : "No"}<br />Device: {device}<br />Sent (UTC): {sentAt}</Text>
        <Hr /><Text style={{ whiteSpace: "pre-wrap" }}>{message}</Text>
      </Container>
    </Body></Html>;
}
export const template = {
  component: ContactMessage,
  subject: (data) => `[${data.type === "Feedback" ? "Feedback" : "Support"}] ${data.subject ?? "Jolzplay contact"}`,
  displayName: "Contact us — Support or Feedback",
  to: "payment@jolzplay.com",
  previewData: { type: "Support", name: "Alex", accountEmail: "alex@example.com", subject: "Playlist question", message: "I have a question about adding my playlist.", device: "Browser", signedIn: true, sentAt: "2026-10-26T00:00:00Z" },
} satisfies TemplateEntry;