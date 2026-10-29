import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Small notice shown while the device has no internet; saved lists stay usable. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4" />
      You're offline. Saved channels, movies and shows still work; playback returns when the connection does.
    </div>
  );
}
