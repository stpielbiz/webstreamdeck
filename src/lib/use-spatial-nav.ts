import { useEffect } from "react";

const SELECTOR = "[data-tv-focus]:not([disabled]):not([tabindex='-1'])";

function rects() {
  return Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))
    .filter((element) => element.offsetParent !== null)
    .map((element) => ({ element, rect: element.getBoundingClientRect() }));
}

function centre(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Remote / D-pad navigation: arrow keys move focus to the nearest element in
 * that direction, Enter activates it, Backspace goes back.
 */
export function useSpatialNav(options?: { onBack?: () => void; enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const onBack = options?.onBack;

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((event.key === "Backspace" || event.key === "Escape") && !typing) {
        event.preventDefault();
        onBack?.();
        return;
      }

      const direction = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      }[event.key];
      if (!direction) return;
      if (typing && (direction === "left" || direction === "right")) return;

      const allCandidates = rects();
      const active = document.activeElement as HTMLElement | null;
      const activeZone = active?.closest<HTMLElement>("[data-tv-zone]")?.dataset.tvZone;
      const candidates = activeZone
        ? allCandidates.filter((item) => item.element.closest<HTMLElement>("[data-tv-zone]")?.dataset.tvZone === activeZone)
        : allCandidates;
      if (candidates.length === 0) return;

      const current = candidates.find((item) => item.element === active);

      if (!current) {
        event.preventDefault();
        candidates[0]!.element.focus();
        return;
      }

      const from = centre(current.rect);
      let best: { element: HTMLElement; score: number } | null = null;

      for (const { element, rect } of candidates) {
        if (element === current.element) continue;
        const to = centre(rect);
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        const forward =
          direction === "up"
            ? -dy
            : direction === "down"
              ? dy
              : direction === "left"
                ? -dx
                : dx;
        if (forward <= 4) continue;

        const drift = direction === "up" || direction === "down" ? Math.abs(dx) : Math.abs(dy);
        const score = forward + drift * 2;
        if (!best || score < best.score) best = { element, score };
      }

      if (best) {
        event.preventDefault();
        best.element.focus();
        best.element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      } else {
        // Never let a D-pad boundary escape into browser or injected page chrome.
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onBack]);
}
