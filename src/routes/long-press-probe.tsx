import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { useLongPress } from "@/lib/use-long-press";

export const Route = createFileRoute("/long-press-probe")({
  component: Probe,
});

function Probe() {
  const [log, setLog] = useState<string[]>([]);
  const push = (entry: string) => setLog((previous) => [...previous, entry]);
  const lp = useLongPress(() => push("favourite"));
  const handlers = {
    ...lp,
    onKeyDown: (event: React.KeyboardEvent) => {
      push(`keydown repeat=${event.repeat}`);
      lp.onKeyDown(event);
    },
    onKeyUp: (event: React.KeyboardEvent) => {
      push(`keyup repeat=${event.repeat}`);
      lp.onKeyUp(event);
    },
  };

  return (
    <main>
      <h1>Long press probe</h1>
      <button
        id="probe"
        type="button"
        data-tv-focus
        onClick={() => push("play")}
        {...handlers}
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
