import * as React from "react";

import { cn } from "@/lib/utils";

type SettingToggleCardProps = {
  icon?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onToggle: (value: boolean) => void;
  focusKey: string;
};

/**
 * Whole-card on/off setting. The entire card is one switch button so the
 * remote (and a mouse) can toggle it from anywhere on the card, and the
 * highlighted border plus On/Off word make the current state unmistakable.
 */
export function SettingToggleCard({
  icon,
  title,
  description,
  checked,
  disabled,
  onToggle,
  focusKey,
}: SettingToggleCardProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      data-tv-focus
      data-remote-row
      data-zone-entry="true"
      data-focus-key={focusKey}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={cn(
        "flex w-full cursor-pointer items-start justify-between gap-6 rounded-xl border p-5 text-left transition-colors",
        "hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "border-primary/60 bg-primary/10" : "border-border bg-card",
      )}
    >
      <span className="min-w-0">
        <span className={cn("flex items-center gap-2 font-semibold", !checked && "text-muted-foreground")}>
          {icon}
          {title}
        </span>
        <span className={cn("mt-1 block text-sm", checked ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {description}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-5 w-9 items-center rounded-full border-2 border-transparent shadow-sm transition-colors",
            checked ? "bg-primary" : "bg-input",
          )}
        >
          <span
            className={cn(
              "block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
              checked ? "translate-x-4" : "translate-x-0",
            )}
          />
        </span>
        <span
          className={cn(
            "text-xs font-semibold tracking-wide",
            checked ? "text-primary" : "text-muted-foreground",
          )}
        >
          {checked ? "On" : "Off"}
        </span>
      </span>
    </button>
  );
}
