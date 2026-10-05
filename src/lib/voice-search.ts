import { useEffect, useRef } from "react";

/**
 * Voice search: the Fire TV app turns the remote's mic/search button into
 * speech recognition and sends the words as a `streamdeck-voice-search` event.
 * Browsers with the Web Speech API use it as a fallback for the on-screen mic.
 */
export const VOICE_EVENT = "streamdeck-voice-search";

export function voiceSearchAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof window.StreamDeckNative?.startVoiceSearch === "function" || !!w["SpeechRecognition"] || !!w["webkitSpeechRecognition"];
}

export function startVoiceSearch(): void {
  if (typeof window === "undefined") return;
  if (typeof window.StreamDeckNative?.startVoiceSearch === "function") {
    window.StreamDeckNative.startVoiceSearch();
    return;
  }
  const w = window as unknown as Record<string, new () => {
    lang: string;
    interimResults: boolean;
    onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
    start: () => void;
  }>;
  const Recognition = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
  if (!Recognition) return;
  const recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const query = event.results[0]?.[0]?.transcript?.trim();
    if (query) window.dispatchEvent(new CustomEvent(VOICE_EVENT, { detail: { query } }));
  };
  recognition.start();
}

/** Calls `onResult` with the spoken words whenever a voice search completes. */
export function useVoiceSearch(onResult: (query: string) => void): void {
  const ref = useRef(onResult);
  ref.current = onResult;
  useEffect(() => {
    const handler = (event: Event) => {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query?.trim();
      if (query) ref.current(query);
    };
    window.addEventListener(VOICE_EVENT, handler);
    return () => window.removeEventListener(VOICE_EVENT, handler);
  }, []);
}
