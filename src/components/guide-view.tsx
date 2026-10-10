import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { getCategories, getItems, getNowNext, getSchedule } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { EmptyState } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function timeLabel(iso: string | null) {
  if (!iso) return "--:--";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function GuideView({ tv = false }: { tv?: boolean }) {
  const navigate = useNavigate();
  const { activeId, active, playlists } = usePlaylists();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);
  const fetchNowNext = useServerFn(getNowNext);
  const fetchSchedule = useServerFn(getSchedule);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [channelId, setChannelId] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ["categories", activeId, "live"], queryFn: () => {
    if (!activeId) throw new Error("No active playlist");
    return fetchCategories({ data: { playlistId: activeId, kind: "live" } });
  }, enabled: !!activeId, staleTime: 10 * 60_000 });
  const channels = useQuery({ queryKey: ["items", activeId, "live", categoryId ?? "all", ""], queryFn: () => {
    if (!activeId) throw new Error("No active playlist");
    return fetchItems({ data: { playlistId: activeId, kind: "live", categoryId } });
  }, enabled: !!activeId, staleTime: 5 * 60_000 });
  const visible = useMemo(() => (channels.data ?? []).slice(0, 40), [channels.data]);
  const epg = useQuery({ queryKey: ["nownext", activeId, visible.map((item) => item.id).join(",")], queryFn: () => {
    if (!activeId) throw new Error("No active playlist");
    return fetchNowNext({ data: { playlistId: activeId, channelIds: visible.map((item) => item.id) } });
  }, enabled: !!activeId && visible.length > 0, staleTime: 5 * 60_000 });
  const epgMap = useMemo(() => new Map((epg.data ?? []).map((entry) => [entry.channelId, entry])), [epg.data]);
  const schedule = useQuery({ queryKey: ["schedule", activeId, channelId], queryFn: () => {
    if (!activeId || !channelId) throw new Error("No channel selected");
    return fetchSchedule({ data: { playlistId: activeId, channelId } });
  }, enabled: !!activeId && !!channelId, staleTime: 5 * 60_000 });

  if (playlists.length === 0) {
    return <div className="p-6"><EmptyState title="No playlist yet" description="Add a playlist and, if your provider supplies listings, the guide will fill in automatically." action={<Button asChild><Link to="/playlists" search={tv ? { mode: "tv" } : {}}>Add a playlist</Link></Button>} /></div>;
  }

  return (
    <div data-tv-zone="content" className="space-y-6 p-3 sm:p-6">
      <Button data-layer-back data-tv-focus variant="ghost" onClick={() => void navigate({ to: tv ? "/tv" : "/dashboard" })}><ArrowLeft className="size-4" /> Home</Button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-display text-2xl font-bold">TV guide</h1><p className="mt-1 text-sm text-muted-foreground">{active?.kind === "m3u" ? "Plain M3U links usually carry no listings, so this page may stay empty." : "Now and next for the first 40 channels in a category."}</p></div>
        <Select value={categoryId ?? "all"} onValueChange={(value) => setCategoryId(value === "all" ? undefined : value)}><SelectTrigger className="w-64"><SelectValue placeholder="All channels" /></SelectTrigger><SelectContent><SelectItem value="all">All channels</SelectItem>{(categories.data ?? []).map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>
      </div>
      {channels.isLoading || epg.isLoading ? <div className="space-y-2">{Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : visible.length === 0 ? <EmptyState title="No channels" description="This category has no channels in it." /> : (
        <div className="overflow-hidden rounded-lg border border-border">
          {visible.map((item) => {
            const entry = epgMap.get(item.id);
            return <div key={item.id} className={cn("grid gap-3 border-b border-border/60 px-4 py-3 last:border-0 md:grid-cols-[16rem_1fr_1fr]", channelId === item.id && "bg-muted")}>
              <button type="button" data-tv-focus onClick={() => setChannelId(channelId === item.id ? null : item.id)} className="truncate text-left text-sm font-medium hover:text-primary">{item.name}</button>
              <div className="min-w-0 text-sm"><span className="mr-2 text-xs font-semibold uppercase tracking-wide text-primary">Now</span>{entry?.now ? <span className="truncate">{timeLabel(entry.now.start)} {entry.now.title}</span> : <span className="text-muted-foreground">No listing</span>}</div>
              <div className="min-w-0 text-sm text-muted-foreground"><span className="mr-2 text-xs font-semibold uppercase tracking-wide">Next</span>{entry?.next ? <span className="truncate">{timeLabel(entry.next.start)} {entry.next.title}</span> : <span>No listing</span>}</div>
              {channelId === item.id && <div className="md:col-span-3">{schedule.isLoading ? <Skeleton className="h-24 w-full" /> : (schedule.data ?? []).length === 0 ? <p className="py-2 text-sm text-muted-foreground">Your provider sent no listings for this channel.</p> : <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-2 text-sm">{(schedule.data ?? []).map((programme, index) => <li key={`${programme.start}-${index}`} className="flex gap-3"><span className="w-24 shrink-0 tabular-nums text-muted-foreground">{timeLabel(programme.start)}</span><span className="min-w-0"><span className="block font-medium">{programme.title}</span>{programme.description && <span className="block text-xs text-muted-foreground">{programme.description}</span>}</span></li>)}</ul>}<div className="mt-3"><Button asChild size="sm" variant="outline"><Link to={tv ? "/tv/live" : "/live"} search={{ channel: item.id }}>Watch this channel</Link></Button></div></div>}
            </div>;
          })}
        </div>
      )}
    </div>
  );
}