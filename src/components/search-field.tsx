import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFieldProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
  containerClassName?: string;
};

/** Keep keyboard edits local until the user finishes entering the search. */
export function SearchField({ value, onValueChange, containerClassName, className, onKeyDown, onBlur, ...props }: SearchFieldProps) {
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const clear = useRef<HTMLButtonElement>(null);
  const draftRef = useRef(draft);
  const commitRef = useRef(onValueChange);
  draftRef.current = draft;
  commitRef.current = onValueChange;
  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    const finish = (event: Event) => {
      if (document.activeElement !== input.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.current?.blur();
      clear.current?.focus();
    };
    // Consume keyboard Back before any page or dialog Back handler.
    window.addEventListener("streamdeck-back", finish, true);
    const viewport = window.visualViewport;
    let previousHeight = viewport?.height ?? 0;
    let keyboardOpened = false;
    const resize = () => {
      const height = viewport?.height ?? 0;
      if (document.activeElement === input.current) {
        if (previousHeight - height > 100) keyboardOpened = true;
        if (keyboardOpened && height - previousHeight > 100) {
          commitRef.current(draftRef.current);
          keyboardOpened = false;
        }
      } else keyboardOpened = false;
      previousHeight = height;
    };
    viewport?.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("streamdeck-back", finish, true);
      viewport?.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className={cn("flex min-w-0 items-center gap-2", containerClassName)}>
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input {...props} ref={input} type="text" inputMode="search" enterKeyHint="next" autoComplete="off"
          aria-label={props["aria-label"] ?? props.placeholder}
          value={draft} className={cn("pl-9", className)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => { commitRef.current(event.currentTarget.value); onBlur?.(event); }}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "BrowserBack" || event.key === "GoBack") {
              event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); clear.current?.focus(); return;
            }
            if (event.key === "Enter") {
              event.preventDefault(); event.stopPropagation();
              commitRef.current(event.currentTarget.value);
              event.currentTarget.blur();
              clear.current?.focus();
              return;
            }
            if (event.key === "ArrowRight" && event.currentTarget.selectionStart === draft.length) {
              event.preventDefault(); event.stopPropagation(); clear.current?.focus(); return;
            }
            onKeyDown?.(event);
          }} />
      </div>
      <Button ref={clear} type="button" variant="outline" size="sm" data-tv-focus
        aria-label={`Clear ${props["aria-label"] ?? props.placeholder ?? "search"}`}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); event.stopPropagation(); input.current?.focus(); }
        }}
        onClick={() => { draftRef.current = ""; setDraft(""); commitRef.current(""); }}>
        Clear
      </Button>
    </div>
  );
}