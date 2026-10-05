import { Mic } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { startVoiceSearch, voiceSearchAvailable } from "@/lib/voice-search";
import { cn } from "@/lib/utils";

/** "Speak" button placed first in a search bar; OK starts voice search. */
export function VoiceButton({ className, zoneEntry, focusKey }: { className?: string; zoneEntry?: boolean; focusKey?: string }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(voiceSearchAvailable()), []);
  if (!available) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      data-tv-focus
      data-zone-entry={zoneEntry ? "true" : undefined}
      data-focus-key={focusKey}
      aria-label="Search by voice"
      title="Search by voice"
      className={cn("h-9 shrink-0 gap-1.5 px-3 focus:ring-2 focus:ring-primary", className)}
      onClick={startVoiceSearch}
    >
      <Mic className="size-4 text-primary" /> Speak
    </Button>
  );
}
