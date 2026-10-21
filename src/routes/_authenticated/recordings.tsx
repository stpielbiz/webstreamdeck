import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordingsList } from "@/components/recordings-list";

export const Route = createFileRoute("/_authenticated/recordings")({
  head: () => ({
    meta: [
      { title: "Recordings — Streamivo" },
      { name: "description", content: "Record live TV channels on your Fire TV and watch them later." },
      { property: "og:title", content: "Recordings — Streamivo" },
      { property: "og:description", content: "Live TV recordings saved on your Fire TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordingsPage,
});

function RecordingsPage() {
  const navigate = useNavigate();
  return (
    <div data-tv-zone="content" className="space-y-4 p-6">
      <div className="mb-4"><Button data-layer-back data-tv-focus variant="ghost" onClick={() => void navigate({ to: "/dashboard" })}><ArrowLeft className="size-4" /> Home</Button></div>
      <h1 className="font-display text-2xl font-bold">Recordings</h1>
      <RecordingsList />
    </div>
  );
}
