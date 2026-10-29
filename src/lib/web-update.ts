import { useEffect } from "react";

/** Fingerprint of the deployed site: the script bundles the page loads. */
function fingerprint(html: string) {
  return [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).sort().join("|");
}

function playing() {
  return [...document.querySelectorAll("video")].some((v) => !v.paused && !v.ended);
}

/** Someone is filling in a form — reloading would throw away what they typed. */
export function busyWithForm(doc: Document = document) {
  const active = doc.activeElement as HTMLElement | null;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return true;
  return !!doc.querySelector("[data-unsaved-form]");
}

/**
 * Detects a newly published website version (e.g. after the Fire TV app wakes
 * from sleep) and reloads the page when nothing is playing and no form is open.
 */
export function useWebUpdateWatcher() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const current = fingerprint(document.documentElement.outerHTML);
    if (!current) return;
    let pending = false;
    const check = async () => {
      try {
        if (!pending) {
          const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store" });
          const next = fingerprint(await res.text());
          if (next && next !== current) pending = true;
        }
      } catch { /* offline */ }
      if (pending && !playing() && !busyWithForm()) window.location.reload();
    };
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = window.setInterval(check, 10 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(interval);
    };
  }, []);
}
