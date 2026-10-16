import { createFileRoute } from "@tanstack/react-router";

import { VideoPlayer } from "@/components/video-player";

// Temporary harness: renders the recent-channel strip so its tiles can be
// measured in a real browser without needing a playlist or a live stream.
export const Route = createFileRoute("/recent-tiles-probe")({
  head: () => ({ meta: [{ title: "Recent tiles probe — Stream Deck" }] }),
  component: Probe,
});

const RECENTS = [
  { title: "Sky Sports NHL 2026 Live", url: "http://localhost:8080/a.ts" },
  { title: "BBC One", url: "http://localhost:8080/b.ts" },
  { title: "CNN International HD", url: "http://localhost:8080/c.ts" },
];

function Probe() {
  return (
    <div className="w-[900px] p-6">
      <VideoPlayer
        src="http://localhost:8080/missing-stream.ts"
        title="Probe channel"
        live
        recents={RECENTS}
        onPickRecent={(title) => {
          document.documentElement.dataset.picked = title;
        }}
        className="aspect-video w-full"
      />
    </div>
  );
}
