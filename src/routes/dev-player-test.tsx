import { createFileRoute } from "@tanstack/react-router";
import { VideoPlayer } from "@/components/video-player";

export const Route = createFileRoute("/dev-player-test")({
  component: () => (
    <div className="p-8">
      <VideoPlayer
        src="http://localhost:9/dead.m3u8"
        fallbackSrc="http://localhost:9/dead-direct.m3u8"
        title="Test stream"
      />
    </div>
  ),
});
