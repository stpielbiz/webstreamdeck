import { useCallback, useRef } from "react";

/**
 * Press-and-hold detection that works with a Fire TV remote (held OK sends
 * repeated Enter keydowns), a mouse, and touch. A quick press still triggers
 * the element's normal click; once the hold fires, the trailing click is
 * swallowed so the channel doesn't also start playing.
 */
export function useLongPress(onLongPress: () => void, ms = 600) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const start = useCallback(() => {
    if (timer.current !== null) return; // already holding (key repeat)
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      timer.current = null;
      onLongPress();
    }, ms);
  }, [onLongPress, ms]);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    "data-long-press": "true",
    // Buttons fire click on Enter keydown (and on every key repeat), which
    // started playback before a hold could register. Block that and decide
    // on release instead: quick press → click, hold → long-press action only.
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!event.repeat && timer.current === null) start();
    },
    onKeyUp: (event: React.KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const wasHeld = fired.current;
      cancel();
      if (wasHeld) {
        fired.current = false;
        return;
      }
      (event.currentTarget as HTMLElement).click();
    },
    onClickCapture: (event: React.SyntheticEvent) => {
      if (fired.current) {
        fired.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
