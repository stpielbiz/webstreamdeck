import { Mic } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { startVoiceSearch, voiceSearchAvailable } from "@/lib/voice-search";
import { cn } from "@/lib/utils";

/** On-screen mic next to a search box; the remote's mic button does the same. */
export function VoiceButton({ className }: { className?: string }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(voiceSearchAvailable()), []);
  if (!available) return null;
  return (
    <Button type="button" variant="ghost" size="icon" data-tv-focus aria-label="Search by voice" title="Search by voice (or press the mic button on your remote)" className={cn("shrink-0", className)} onClick={startVoiceSearch}>
      <Mic className="size-4" />
    </Button>
  );
}
