import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function CatalogLoading({ title, tv = false }: { title: "Movies" | "Shows"; tv?: boolean }) {
  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "grid min-h-[calc(100dvh-3.5rem)] grid-cols-[minmax(10rem,20%)_minmax(0,80%)] overflow-hidden bg-background p-4",
        tv && "min-h-[calc(100dvh-4.5rem)]",
      )}
    >
      <div className="border-r border-border pr-4">
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="relative min-w-0 pl-5">
        <div className="flex items-center gap-3 py-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" />
          <span className="font-display text-lg font-semibold text-foreground">Opening {title}…</span>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CatalogGridLoading({ title }: { title: "Movies" | "Shows" }) {
  return (
    <div role="status" aria-live="polite" className="py-2">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" />
        <span className="font-display text-base font-semibold text-foreground">Loading {title}…</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
        {Array.from({ length: 20 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}