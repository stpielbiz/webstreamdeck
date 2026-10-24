import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TvShell } from "@/components/tv-shell";
import { RecordingsList } from "@/components/recordings-list";

export const Route = createFileRoute("/_authenticated/tv/recordings")({
  head: () => ({
    meta: [
      { title: "Recordings on your TV — Jolzplay" },
      { name: "description", content: "Play, stop and delete live TV recordings saved on this Fire TV." },
      { property: "og:title", content: "Recordings on your TV — Jolzplay" },
      { property: "og:description", content: "Live TV recordings saved on your Fire TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvRecordings,
});

function TvRecordings() {
  const navigate = useNavigate();
  return (
    <TvShell title="Recordings">
      <div className="mb-4"><Button data-layer-back data-tv-focus data-zone-entry="true" variant="ghost" onClick={() => void navigate({ to: "/tv" })}><ArrowLeft className="size-4" /> Home</Button></div>
      <RecordingsList tv />
    </TvShell>
  );
}
