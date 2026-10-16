import { useCallback, useRef } from "react";

/**
 * How long after a press ends the element's normal activation stays swallowed.
 * The device can dispatch the click for the same OK press after we have already
 * acted on the hold, so the block has to outlast the release.
 */
const SUPPRESS_MS = 400;

/** Safety net: a press that never reported its release stops blocking after this. */
const HOLD_CAP_MS = 10_000;

/** Keys a remote OK (or a keyboard) uses to activate a focused element. */
function isActivateKey(key: string) {
  return key === "Enter" || key === " " || key === "Spacebar";
}

/**
 * Press-and-hold detection that works with a Fire TV remote (held OK sends
 * repeated Enter keydowns), a mouse, and touch. A quick press still triggers
 * the element's normal click. Once the hold fires, the element's normal click
 * is swallowed for as long as the button is still held down and briefly after
 * it is released — including a click the device dispatches on its own — so
 * holding a channel only changes favourites and never starts the stream.
 */
export function useLongPress(onLongPress: () => void, ms = 600) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const firedAt = useRef(0);
  const suppressUntil = useRef(0);

  /** True while the activation of this press must be ignored. */
  const blocked = useCallback(
    () =>
      (fired.current && Date.now() - firedAt.current < HOLD_CAP_MS) ||
      Date.now() < suppressUntil.current,
    [],
  );

  const fire = useCallback(() => {
    timer.current = null;
    fired.current = true;
    firedAt.current = Date.now();
    suppressUntil.current = Date.now() + SUPPRESS_MS;
    onLongPress();
  }, [onLongPress]);

  const start = useCallback(() => {
    if (timer.current !== null) return; // already holding (key repeat)
    if (blocked()) return; // tail of a previous hold
    fired.current = false;
    timer.current = window.setTimeout(fire, ms);
  }, [blocked, fire, ms]);

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
        // Still held down: keep swallowing until the button actually comes up.
        firedAt.current = Date.now();
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
