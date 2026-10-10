import { useEffect } from "react";

const SELECTOR = ":is(button,a[href],input,select,textarea)[data-tv-focus]:not([disabled]):not([tabindex='-1'])";

function focusElement(element: HTMLElement | undefined | null) {
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
}

function rects(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR))
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
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((event.key === "Backspace" || event.key === "Escape") && !typing) {
        event.preventDefault();
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        const back = dialog?.querySelector<HTMLElement>('[data-dialog-back]');
        if (back) back.click();
        else onBack?.();
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

      const active = document.activeElement as HTMLElement | null;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      // A portal is outside the workspace: never navigate into the page behind it.
      const root = dialog ?? document;
      const zone = active?.closest<HTMLElement>("[data-tv-zone]");
      const scope = dialog ?? zone ?? document;
      const elements = Array.from(scope.querySelectorAll<HTMLElement>(SELECTOR))
        .filter((element) => element.offsetParent !== null);
      const row = active?.closest<HTMLElement>('[data-remote-row]');
      // Menus and ordered rows need no layout measurements on held remote keys.
      if ((zone?.dataset['tvZone'] === 'sections' && (direction === 'up' || direction === 'down')) || row) {
        const horizontal = direction === 'left' || direction === 'right';
        const rows = Array.from(scope.querySelectorAll<HTMLElement>('[data-remote-row]'))
          .filter((entry) => Array.from(entry.querySelectorAll<HTMLElement>(SELECTOR)).some((item) => item.offsetParent !== null && item.closest('[data-remote-row]') === entry));
        const inRow = row ? elements.filter((entry) => entry.closest('[data-remote-row]') === row) : elements;
        const index = inRow.findIndex((entry) => entry === active);
        let destination: HTMLElement | undefined;
        if (row && !horizontal) {
          const nextRow = rows[rows.indexOf(row) + (direction === 'down' ? 1 : -1)];
          const nextItems = nextRow ? Array.from(nextRow.querySelectorAll<HTMLElement>(SELECTOR)).filter((entry) => entry.offsetParent !== null && entry.closest('[data-remote-row]') === nextRow) : [];
          destination = nextItems[Math.min(Math.max(0, index), nextItems.length - 1)];
        } else {
          destination = inRow[index + (direction === 'right' || direction === 'down' ? 1 : -1)];
        }
        if (destination) { event.preventDefault(); focusElement(destination); return; }
        if (dialog || !horizontal) { event.preventDefault(); return; }
      }
      // Only measure elements in the current zone — scanning the whole page on
      // every key press is what made held Up/Down feel laggy.
      const allCandidates = rects(dialog ?? zone ?? root);
      const group = zone?.closest<HTMLElement>("[data-tv-zone-group]");
      const order = Number(zone?.dataset['tvZoneOrder']);
      const horizontalZone = zone?.dataset['horizontalNav'] === "true";
      const crossingZones = !dialog && group && Number.isFinite(order)
        && ((direction === "right" && order === 1)
          || (direction === "left" && order > 1 && (!horizontalZone || active?.dataset['zoneEdgeLeft'] === "true")));
      if (crossingZones) {
        event.preventDefault();
        const nextOrder = order + (direction === "right" ? 1 : -1);
        const nextZone = group.querySelector<HTMLElement>(`[data-tv-zone-order="${nextOrder}"]`);
        const destination = nextZone?.querySelector<HTMLElement>("[data-zone-entry='true']")
          ?? nextZone?.querySelector<HTMLElement>(SELECTOR);
        focusElement(destination);
        return;
      }
      const activeZone = dialog ? undefined : zone?.dataset['tvZone'];
      const candidates = activeZone
        ? allCandidates.filter((item) => item.element.closest<HTMLElement>("[data-tv-zone]")?.dataset['tvZone'] === activeZone)
        : allCandidates;
      if (candidates.length === 0) return;

      const current = candidates.find((item) => item.element === active);

      if (!current) {
        event.preventDefault();
        focusElement(candidates[0]?.element);
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
        focusElement(best.element);
      } else {
        if (group && Number.isFinite(order) && (direction === "left" || direction === "right")) {
          const nextOrder = order + (direction === "right" ? 1 : -1);
          const nextZone = group.querySelector<HTMLElement>(`[data-tv-zone-order="${nextOrder}"]`);
          const destination = nextZone?.querySelector<HTMLElement>("[data-zone-entry='true']")
            ?? nextZone?.querySelector<HTMLElement>(SELECTOR);
          if (destination) {
            event.preventDefault();
            focusElement(destination);
          }
        }
      }
    };

    const nativeBack = (event: Event) => {
      event.preventDefault();
      const back = document.querySelector<HTMLElement>('[role="dialog"] [data-dialog-back]');
      if (back) back.click();
      else onBack?.();
    };
    window.addEventListener("streamdeck-back", nativeBack);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("streamdeck-back", nativeBack);
      window.removeEventListener("keydown", handler);
    };
  }, [enabled, onBack]);
}
