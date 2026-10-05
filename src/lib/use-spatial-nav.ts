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
      const zone = active?.closest<HTMLElement>("[data-tv-zone]");
      const group = zone?.closest<HTMLElement>("[data-tv-zone-group]");
      const order = Number(zone?.dataset['tvZoneOrder']);
      const horizontalZone = zone?.dataset['horizontalNav'] === "true";
      const crossingZones = group && Number.isFinite(order)
        && ((direction === "right" && order === 1)
          || (direction === "left" && order > 1 && (!horizontalZone || active?.dataset['zoneEdgeLeft'] === "true")));
      if (crossingZones) {
        event.preventDefault();
        const nextOrder = order + (direction === "right" ? 1 : -1);
        const nextZone = group.querySelector<HTMLElement>(`[data-tv-zone-order="${nextOrder}"]`);
        const destination = nextZone?.querySelector<HTMLElement>("[data-zone-entry='true']")
          ?? nextZone?.querySelector<HTMLElement>(SELECTOR);
        destination?.focus();
        destination?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        return;
      }
      const activeZone = zone?.dataset['tvZone'];
      const candidates = activeZone
        ? allCandidates.filter((item) => item.element.closest<HTMLElement>("[data-tv-zone]")?.dataset['tvZone'] === activeZone)
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
        if (group && Number.isFinite(order) && (direction === "left" || direction === "right")) {
          const nextOrder = order + (direction === "right" ? 1 : -1);
          const nextZone = group.querySelector<HTMLElement>(`[data-tv-zone-order="${nextOrder}"]`);
          const destination = nextZone?.querySelector<HTMLElement>("[data-zone-entry='true']")
            ?? nextZone?.querySelector<HTMLElement>(SELECTOR);
          if (destination) {
            event.preventDefault();
            destination.focus();
            destination.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
          }
        }
      }
    };

    const nativeBack = (event: Event) => {
      event.preventDefault();
      onBack?.();
    };
    window.addEventListener("streamdeck-back", nativeBack);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("streamdeck-back", nativeBack);
      window.removeEventListener("keydown", handler);
    };
  }, [enabled, onBack]);
}
