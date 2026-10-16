import { useCallback, useRef } from "react";

/**
 * How long after a hold the element's normal activation stays swallowed. The
 * device can dispatch the click for the same OK press after we have already
 * acted on the hold, so the block has to outlast the release.
 */
const SUPPRESS_MS = 300;

/** Keys a remote OK (or a keyboard) uses to activate a focused element. */
function isActivateKey(key: string) {
  return key === "Enter" || key === " " || key === "Spacebar";
}

/**
 * Press-and-hold detection that works with a Fire TV remote (held OK sends
 * repeated Enter keydowns), a mouse, and touch. A quick press still triggers
 * the element's normal click; once the hold fires, every later activation of
 * the element is swallowed — including the click a device dispatches when the
 * button is released — so holding a channel only changes favourites and never
 * starts the stream.
 */
export function useLongPress(onLongPress: () => void, ms = 600) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const suppressUntil = useRef(0);

  const blocked = useCallback(() => Date.now() < suppressUntil.current, []);

  const fire = useCallback(() => {
    timer.current = null;
    fired.current = true;
    suppressUntil.current = Date.now() + SUPPRESS_MS;
    onLongPress();
  }, [onLongPress]);

  const start = useCallback(() => {
    if (timer.current !== null) return; // already holding (key repeat)
    if (Date.now() < suppressUntil.current) return; // tail of a previous hold
    fired.current = false;
    timer.current = window.setTimeout(fire, ms);
  }, [fire, ms]);

  /** End of a press: stop the timer and cover the click that may still come. */
  const release = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (fired.current) {
      fired.current = false;
      suppressUntil.current = Date.now() + SUPPRESS_MS;
    }
  }, []);

  return {
    onPointerDown: start,
    onPointerUp: release,
    onPointerLeave: release,
    onPointerCancel: release,
    "data-long-press": "true",
    // Buttons fire click on Enter keydown (and on every key repeat), which
    // started playback before a hold could register. Block that and decide on
    // release instead: quick press → click, hold → long-press action only.
    onKeyDown: (event: React.KeyboardEvent) => {
      if (!isActivateKey(event.key)) return;
      event.preventDefault();
      if (fired.current) {
        // Still held: keep swallowing until the button actually comes up.
        suppressUntil.current = Date.now() + SUPPRESS_MS;
        return;
      }
      if (!event.repeat && timer.current === null) start();
    },
    onKeyUp: (event: React.KeyboardEvent) => {
      if (!isActivateKey(event.key)) return;
      event.preventDefault();
      const held = fired.current;
      release();
      if (held || blocked()) return;
      (event.currentTarget as HTMLElement).click();
    },
    onClickCapture: (event: React.SyntheticEvent) => {
      if (blocked()) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
