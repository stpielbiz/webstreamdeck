import { useEffect, useRef } from "react";

export const APP_SEARCH_EVENT = "streamdeck-app-search";

export function focusAppSearch(preferredKey?: string) {
  const preferred = preferredKey ? document.querySelector<HTMLInputElement>(`[data-focus-key="${preferredKey}"]`) : null;
  const input = preferred ?? document.querySelector<HTMLInputElement>('[data-app-search="true"]');
  if (!input) return false;
  input.focus();
  input.click();
  return true;
}

export function useAppSearchFocus(preferredKey: string) {
  const key = useRef(preferredKey);
  key.current = preferredKey;
  useEffect(() => {
    const handler = () => focusAppSearch(key.current);
    window.addEventListener(APP_SEARCH_EVENT, handler);
    return () => window.removeEventListener(APP_SEARCH_EVENT, handler);
  }, []);
}