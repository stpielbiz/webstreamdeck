import { CirclePlay } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared brand artwork; no focus target, so header navigation stays unchanged. */
export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-brand-tile text-primary", className)}><CirclePlay className="size-[60%]" strokeWidth={2.5} /></span>;
}

export function BrandName() {
  return <span aria-label="Jolzplay">Jolz<span className="text-primary">play</span></span>;
}
