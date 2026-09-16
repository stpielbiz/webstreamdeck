import { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface VideoPlayerProps {
  src: string | null;
  /** Played instead of `src` when the proxied source is refused (e.g. blocked server IP). */
  fallbackSrc?: string | null;
  title?: string;
  poster?: string | null;
  live?: boolean;
  startPosition?: number;
  className?: string;
  onProgress?: (positionSeconds: number, durationSeconds: number | null) => void;
  onEnded?: () => void;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);
  const mm = hours ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  fallbackSrc = null,
  title,
  poster,
  live = false,
  startPosition = 0,
  className,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  // Show controls on any pointer activity; auto-hide after 3s while playing.
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) setControlsVisible(false);
    }, 3000);
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    },
    [],
  );

  // Attach the source: hls.js for HLS, native playback for progressive files.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) return;

    let destroyed = false;
    let hlsInstance: { destroy: () => void } | null = null;
    setStatus("loading");
    setErrorMessage(null);

    const useFallback = () => {
      if (!fallbackSrc || activeSrc === fallbackSrc) return false;
      setActiveSrc(fallbackSrc);
      return true;
    };

    const isHls = activeSrc.includes("m3u8") || live;

    const attach = async () => {
      let usedHls = false;
      if (isHls) {
        // Prefer hls.js wherever media source extensions exist. Android based
        // browsers (Fire TV Silk, Chrome) claim native HLS support but often
        // render a black screen, so native playback is the last resort.
        const { default: Hls } = await import("hls.js");
        if (destroyed) return;
        if (Hls.isSupported()) {
          usedHls = true;
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30 });
          hlsInstance = hls;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            setStatus("error");
            setErrorMessage(
              data.type === Hls.ErrorTypes.NETWORK_ERROR
                ? "The provider stopped responding for this stream."
                : "This stream can't be played in a browser.",
            );
          });
          hls.loadSource(src);
          hls.attachMedia(video);
        } else if (!video.canPlayType("application/vnd.apple.mpegurl")) {
          setStatus("error");
          setErrorMessage("This channel's format can't be played in this browser.");
          return;
        }
      }
      if (!usedHls) video.src = src;

      try {
        await video.play();
      } catch {
        // Some devices (Fire TV Silk included) block sound-on autoplay.
        // Start muted so a picture appears, then let the viewer unmute.
        video.muted = true;
        try {
          await video.play();
        } catch {
          setPlaying(false);
        }
      }
    };

    void attach();

    return () => {
      destroyed = true;
      hlsInstance?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, live]);

  // Report progress every 10 seconds for VOD.
  useEffect(() => {
    if (live || !src) return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || !video.currentTime) return;
      progressRef.current?.(video.currentTime, Number.isFinite(video.duration) ? video.duration : null);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [live, src]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else {
      video.pause();
      if (!live) progressRef.current?.(video.currentTime, Number.isFinite(video.duration) ? video.duration : null);
    }
  }, [live]);

  const skipBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video || live) return;
      const max = Number.isFinite(video.duration) ? video.duration : Infinity;
      video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), max);
    },
    [live],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const video = videoRef.current;
      if (!video) return;
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "f") toggleFullscreen();
      else if (event.key === "m") video.muted = !video.muted;
      else if (event.key === "ArrowRight" && !live) video.currentTime += 10;
      else if (event.key === "ArrowLeft" && !live) video.currentTime -= 10;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, live]);

  return (
    <div
      ref={shellRef}
      onMouseMove={showControls}
      onTouchStart={showControls}
      onClick={showControls}
      className={cn(
        "group relative isolate aspect-video w-full overflow-hidden rounded-lg border border-border bg-black",
        className,
      )}
    >
      {src ? (
        <video
          ref={videoRef}
          poster={poster ?? undefined}
          playsInline
          className="h-full w-full object-contain"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(Number.isFinite(video.duration) ? video.duration : 0);
            if (!live && startPosition > 5 && startPosition < video.duration - 10) {
              video.currentTime = startPosition;
            }
            setStatus("ready");
          }}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onPlay={() => {
            setPlaying(true);
            showControls();
          }}
          onPause={() => setPlaying(false)}
          onVolumeChange={(event) => {
            setMuted(event.currentTarget.muted);
            setVolume(event.currentTarget.volume);
          }}
          onEnded={() => {
            const video = videoRef.current;
            if (video && !live) {
              progressRef.current?.(video.duration, video.duration);
            }
            onEnded?.();
          }}
          onError={() => {
            setStatus("error");
            setErrorMessage("This stream can't be played in a browser.");
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Choose something to watch
        </div>
      )}

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center">
          <div>
            <AlertTriangle className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm font-medium">{errorMessage}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try another channel or check that your provider is online.
            </p>
          </div>
        </div>
      )}

      {src && status !== "error" && !playing && (
        <button
          type="button"
          data-tv-focus
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 grid place-items-center bg-black/30 outline-none"
        >
          <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-transparent transition group-focus-within:ring-primary/50">
            <Play className="size-10" />
          </span>
        </button>
      )}

      {src && muted && playing && (
        <button
          type="button"
          data-tv-focus
          onClick={() => {
            const video = videoRef.current;
            if (video) video.muted = false;
          }}
          className="absolute right-3 top-3 rounded-lg bg-black/70 px-4 py-2 text-base font-semibold text-white outline-none focus:ring-4 focus:ring-primary/50"
        >
          Sound off — press OK
        </button>
      )}



      {src && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-10 transition-all",
            controlsVisible || !playing
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0",
          )}
        >
          {title && (
            <p className="mb-2 truncate font-display text-sm font-semibold text-white">{title}</p>
          )}
          {!live && (
            <div className="mb-2 flex items-center gap-3 text-xs text-white/80">
              <span className="tabular-nums">{formatTime(position)}</span>
              <Slider
                value={[position]}
                max={duration || 1}
                step={1}
                onValueChange={([value]) => {
                  const video = videoRef.current;
                  if (video && typeof value === "number") video.currentTime = value;
                }}
                className="flex-1"
                aria-label="Seek"
              />
              <span className="tabular-nums">{formatTime(duration)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="rounded-md p-1.5 text-white transition hover:bg-white/15"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
            {!live && (
              <>
                <button
                  type="button"
                  onClick={() => skipBy(-10)}
                  className="rounded-md p-1.5 text-white transition hover:bg-white/15"
                  aria-label="Rewind 10 seconds"
                >
                  <RotateCcw className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => skipBy(10)}
                  className="rounded-md p-1.5 text-white transition hover:bg-white/15"
                  aria-label="Fast forward 10 seconds"
                >
                  <RotateCw className="size-5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (video) video.muted = !video.muted;
              }}
              className="rounded-md p-1.5 text-white transition hover:bg-white/15"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.05}
              onValueChange={([value]) => {
                const video = videoRef.current;
                if (video && typeof value === "number") {
                  video.volume = value;
                  video.muted = value === 0;
                }
              }}
              className="w-24"
              aria-label="Volume"
            />
            {live && (
              <span className="ml-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Live
              </span>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="ml-auto rounded-md p-1.5 text-white transition hover:bg-white/15"
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
