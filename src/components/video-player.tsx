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
  Copy,
  ExternalLink,
  Tv,
} from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { externalPlayerLinks, hasNativePlayer, playNative } from "@/lib/external-player";

const DEVICE_ONLY_MESSAGE =
  "Your provider only allows streams from your own device. Open it in VLC or use the Stream Deck TV app.";

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
  /** Fired once per stream when playback is handed to an external player. */
  onExternalLaunch?: () => void;
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
  onExternalLaunch,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  const [activeSrc, setActiveSrc] = useState<string | null>(src);
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
  const sourceAttemptRef = useRef(0);
  const fallbackRef = useRef(fallbackSrc);
  fallbackRef.current = fallbackSrc;
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const externalLaunchRef = useRef(onExternalLaunch);
  externalLaunchRef.current = onExternalLaunch;
  const [nativeActive, setNativeActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoLaunched, setAutoLaunched] = useState(false);
  const autoLaunchRef = useRef<string | null>(null);

  // Inside the Stream Deck TV app, hand playback to its built-in player, which
  // fetches the stream over the device's own connection.
  const startNative = useCallback(() => {
    if (!fallbackSrc) return false;
    return playNative({ url: fallbackSrc, title: title ?? "", live, startPosition });
  }, [fallbackSrc, title, live, startPosition]);

  useEffect(() => {
    if (!src || !fallbackSrc || !hasNativePlayer()) {
      setNativeActive(false);
      return;
    }
    window.__streamDeckProgress = (position, duration) => {
      if (!live) progressRef.current?.(position, Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    window.__streamDeckEnded = () => endedRef.current?.();
    setNativeActive(startNative());
    return () => {
      window.__streamDeckProgress = undefined;
      window.__streamDeckEnded = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbackSrc, live]);

  const externalLinks = fallbackSrc ? externalPlayerLinks(fallbackSrc) : [];

  // Launch the device's external player (VLC etc.) without a click.
  const launchExternal = useCallback((href: string) => {
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = href;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 4000);
  }, []);

  // Tell the parent the stream left the browser — once per stream.
  const externalNotifiedRef = useRef<string | null>(null);
  const notifyExternalLaunch = useCallback((href: string) => {
    if (externalNotifiedRef.current === href) return;
    externalNotifiedRef.current = href;
    externalLaunchRef.current?.();
  }, []);

  // When playback fails for good, hand the stream to the external player
  // automatically — once per stream.
  useEffect(() => {
    const link = externalLinks[0];
    if (status !== "error" || !link || autoLaunchRef.current === link.href) return;
    autoLaunchRef.current = link.href;
    setAutoLaunched(true);
    launchExternal(link.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fallbackSrc]);

  useEffect(() => {
    autoLaunchRef.current = null;
    setAutoLaunched(false);
  }, [src, fallbackSrc]);

  const copyLink = async () => {
    if (!fallbackSrc) return;
    try {
      await navigator.clipboard.writeText(fallbackSrc);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this stream link", fallbackSrc);
    }
  };

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

  useEffect(() => {
    setActiveSrc(src);
    setStatus(src ? "loading" : "idle");
    setErrorMessage(null);
  }, [src]);

  // Attach the source: hls.js for HLS, native playback for progressive files.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) return;
    if (hasNativePlayer() && fallbackRef.current) return;

    let destroyed = false;
    const attempt = ++sourceAttemptRef.current;
    let hlsInstance: { destroy: () => void } | null = null;
    setStatus("loading");
    setErrorMessage(null);

    const useFallback = () => {
      const fallback = fallbackRef.current;
      if (!fallback || activeSrc === fallback) return false;
      setActiveSrc(fallback);
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
            if (!data.fatal || destroyed || attempt !== sourceAttemptRef.current) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && useFallback()) return;
            setStatus("error");
            setErrorMessage(
              fallbackRef.current && activeSrc === fallbackRef.current
                ? DEVICE_ONLY_MESSAGE
                : data.type === Hls.ErrorTypes.NETWORK_ERROR
                  ? "The provider stopped responding for this stream."
                  : "This stream can't be played in a browser.",
            );
          });
          hls.loadSource(activeSrc);
          hls.attachMedia(video);
        }
      }
      if (!usedHls) video.src = activeSrc;

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
      sourceAttemptRef.current += 1;
      hlsInstance?.destroy();
    };
  }, [activeSrc, live]);

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
          onError={(event) => {
            const mediaError = event.currentTarget.error;
            if (!mediaError || mediaError.code === MediaError.MEDIA_ERR_ABORTED) return;
            const fallback = fallbackRef.current;
            if (fallback && activeSrc !== fallback) {
              setActiveSrc(fallback);
              return;
            }
            setStatus("error");
            setErrorMessage(
              fallback && activeSrc === fallback
                ? DEVICE_ONLY_MESSAGE
                : mediaError.code === MediaError.MEDIA_ERR_NETWORK
                ? "The provider stopped responding for this stream."
                : "This stream's video format isn't supported on this device.",
            );
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Choose something to watch
        </div>
      )}

      {nativeActive && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/90 px-6 text-center">
          <div>
            <Tv className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm font-medium text-white">Playing in the Stream Deck player</p>
            <button
              type="button"
              data-tv-focus
              onClick={() => startNative()}
              className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground outline-none focus:ring-4 focus:ring-primary/50"
            >
              Play again
            </button>
          </div>
        </div>
      )}

      {!nativeActive && status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center">
          <div>
            {autoLaunched ? (
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            ) : (
              <AlertTriangle className="mx-auto size-8 text-primary" />
            )}
            <p className="mt-3 text-sm font-medium">{errorMessage}</p>
            {externalLinks.length > 0 ? (
              <>
                {autoLaunched && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Opening in {(externalLinks[0]?.label ?? "VLC").replace("Play in ", "")}… come back here when you're done.
                    Resume position isn't saved while watching there.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                {externalLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    data-tv-focus
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none focus:ring-4 focus:ring-primary/50"
                  >
                    <ExternalLink className="size-4" />
                    {link.label}
                  </a>
                ))}
                <button
                  type="button"
                  data-tv-focus
                  onClick={copyLink}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold outline-none focus:ring-4 focus:ring-primary/50"
                >
                  <Copy className="size-4" />
                  {copied ? "Copied" : "Copy stream link"}
                </button>
              </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Try another channel or check that your provider is online.
              </p>
            )}
          </div>
        </div>
      )}

      {src && !nativeActive && status !== "error" && !playing && (
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
            {externalLinks[0] && (
              <a
                href={externalLinks[0].href}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                aria-label={externalLinks[0].label}
                title={externalLinks[0].label}
              >
                <ExternalLink className="size-4" />
                VLC
              </a>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={cn(
                "rounded-md p-1.5 text-white transition hover:bg-white/15",
                !externalLinks[0] && "ml-auto",
              )}
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
