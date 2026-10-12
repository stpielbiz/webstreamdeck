/** Reload the app with the newest published files. Saved device data is kept. */
export async function hardReload() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  const native = window.StreamDeckNative as { reloadApp?: (u: string) => void } | undefined;
  if (typeof native?.reloadApp === "function") native.reloadApp(url.toString());
  else window.location.replace(url.toString());
}
