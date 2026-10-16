import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { useLongPress } from "@/lib/use-long-press";

export const Route = createFileRoute("/long-press-probe")({
  component: Probe,
});

function Probe() {
  const [log, setLog] = useState<string[]>([]);
  const push = (entry: string) => setLog((previous) => [...previous, entry]);
  const longPress = useLongPress(() => push("favourite"));

  return (
    <main>
      <h1>Long press probe</h1>
      <button
        id="probe"
        type="button"
        data-tv-focus
        onClick={() => push("play")}
        {...longPress}
      >
        Channel
      </button>
      <ul id="log">
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </main>
  );
}
