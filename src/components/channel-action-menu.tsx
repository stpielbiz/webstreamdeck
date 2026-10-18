import { useEffect, useState } from "react";
import { CircleDot, Clock, Minus, Plus, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { canRecord, defaultEnd, startRecording } from "@/lib/recordings";

export interface ProgrammeInfo {
  title: string;
  end: number;
}

type Step = "menu" | "when" | "later" | "length" | "unsupported";

const LENGTHS = [30, 60, 120, 180];

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Hold OK (Fire TV) or right-click (computer) on a channel: favourite or record.
 * Recording asks Now or Later; Later picks a date and time; then a length that
 * defaults to the end of the programme on at that time.
 */
export function ChannelActionMenu({
  channel,
  starred,
  onToggleFavorite,
  onClose,
  programmeAt,
  getStreamUrl,
  tv,
}: {
  channel: { name: string } | null;
  starred: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  programmeAt: (time: number) => ProgrammeInfo | null;
  getStreamUrl: () => Promise<string | null>;
  tv?: boolean;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (channel) setStep("menu");
  }, [channel]);

  const back = () => {
    if (step === "menu" || step === "unsupported") onClose();
    else if (step === "length") setStep(start > Date.now() + 60_000 ? "later" : "when");
    else if (step === "later") setStep("when");
    else setStep("menu");
  };

  const chooseNow = () => {
    const now = Date.now();
    setStart(now);
    setEnd(defaultEnd(now, programmeAt(now)?.end));
    setStep("length");
  };

  const chooseLater = () => {
    const base = Date.now() + 60 * 60_000;
    const rounded = Math.ceil(base / (15 * 60_000)) * 15 * 60_000;
    setStart(rounded);
    setStep("later");
  };

  const confirmLater = () => {
    setEnd(defaultEnd(start, programmeAt(start)?.end));
    setStep("length");
  };

  const shiftStart = (ms: number) => setStart((value) => Math.max(Date.now() + 5 * 60_000, value + ms));

  const save = async () => {
    if (!channel) return;
    setBusy(true);
    try {
      const url = await getStreamUrl();
      if (!url) throw new Error("no url");
      const programme = programmeAt(start)?.title ?? null;
      const id = startRecording({ title: channel.name, programme, url, startAt: start, endAt: end });
      if (!id) throw new Error("refused");
      toast.success(start > Date.now() + 60_000 ? `Recording of ${channel.name} scheduled for ${fmtDay(start)} ${fmtTime(start)}` : `Recording ${channel.name} until ${fmtTime(end)}`);
      onClose();
    } catch {
      toast.error("Couldn't start the recording. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const programmeEnd = start ? programmeAt(start)?.end : null;
  const minutes = Math.round((end - start) / 60_000);
  const btn = "h-12 w-full justify-start gap-3 text-base";

  return (
    <Dialog open={!!channel} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" data-tv-zone="channel-actions" onEscapeKeyDown={(event) => { event.preventDefault(); back(); }}>
        <DialogTitle className="truncate">{channel?.name}</DialogTitle>
        <DialogDescription>
          {step === "menu" && "Choose what to do with this channel."}
          {step === "when" && "When should the recording start?"}
          {step === "later" && "Pick the day and start time."}
          {step === "length" && "How long should it record?"}
          {step === "unsupported" && "Recording needs the Stream Deck Fire TV app."}
        </DialogDescription>

        <div className="mt-2 flex flex-col gap-2">
          {step === "menu" && (
            <>
              <Button data-tv-focus variant="secondary" className={btn} onClick={() => { onToggleFavorite(); onClose(); }}>
                <Star className={starred ? "size-5 fill-primary text-primary" : "size-5"} />
                {starred ? "Remove from favourites" : "Add to favourites"}
              </Button>
              <Button data-tv-focus variant="secondary" className={btn} onClick={() => setStep(canRecord() ? "when" : "unsupported")}>
                <CircleDot className="size-5 text-destructive" /> Record
              </Button>
            </>
          )}

          {step === "when" && (
            <>
              <Button data-tv-focus variant="secondary" className={btn} onClick={chooseNow}>
                <CircleDot className="size-5 text-destructive" /> Now
              </Button>
              <Button data-tv-focus variant="secondary" className={btn} onClick={chooseLater}>
                <Clock className="size-5" /> Later
              </Button>
            </>
          )}

          {step === "later" && (
            <>
              <Stepper label="Day" value={fmtDay(start)} onMinus={() => shiftStart(-24 * 3600_000)} onPlus={() => shiftStart(24 * 3600_000)} />
              <Stepper label="Hour" value={fmtTime(start)} onMinus={() => shiftStart(-3600_000)} onPlus={() => shiftStart(3600_000)} />
              <Stepper label="Minutes" value={fmtTime(start)} onMinus={() => shiftStart(-5 * 60_000)} onPlus={() => shiftStart(5 * 60_000)} />
              {programmeAt(start) && <p className="text-sm text-muted-foreground">On then: {programmeAt(start)?.title}</p>}
              <Button data-tv-focus className="mt-2 h-12" onClick={confirmLater}>Next</Button>
            </>
          )}

          {step === "length" && (
            <>
              <p className="text-sm text-muted-foreground">
                {fmtDay(start)} · {fmtTime(start)} – {fmtTime(end)} ({minutes} min)
              </p>
              {programmeEnd && programmeEnd > start + 60_000 && (
                <Button data-tv-focus variant={end === programmeEnd ? "default" : "secondary"} className={btn} onClick={() => setEnd(programmeEnd)}>
                  Until the programme ends ({fmtTime(programmeEnd)})
                </Button>
              )}
              <div className="grid grid-cols-4 gap-2" data-remote-row>
                {LENGTHS.map((length) => (
                  <Button key={length} data-tv-focus variant={minutes === length ? "default" : "secondary"} className="h-11" onClick={() => setEnd(start + length * 60_000)}>
                    {length < 60 ? `${length} min` : `${length / 60} h`}
                  </Button>
                ))}
              </div>
              <Stepper label="Custom" value={`${minutes} min`} onMinus={() => setEnd((value) => Math.max(start + 15 * 60_000, value - 15 * 60_000))} onPlus={() => setEnd((value) => Math.min(start + 12 * 3600_000, value + 15 * 60_000))} />
              <Button data-tv-focus className="mt-2 h-12" disabled={busy} onClick={() => void save()}>
                {start > Date.now() + 60_000 ? "Schedule recording" : "Start recording"}
              </Button>
              <p className="text-xs text-muted-foreground">Some providers allow only one connection at a time, so watching another channel while recording may not work.</p>
            </>
          )}

          {step === "unsupported" && (
            <div className="space-y-3 text-sm">
              <p>
                Recording works in the Stream Deck app on Fire TV. On a computer, a website can only record while its tab stays open, so recording is Fire TV only for now.
              </p>
              <p>What you need: a Fire TV Stick with the latest Stream Deck app, and some free storage on it.</p>
              {!tv && (
                <Button asChild data-tv-focus variant="secondary" className="h-11">
                  <Link to="/download">Get the Fire TV app</Link>
                </Button>
              )}
            </div>
          )}

          <Button data-tv-focus data-dialog-back variant="ghost" className="mt-1 h-11" onClick={back}>
            {step === "menu" || step === "unsupported" ? "Close" : "Back"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div data-remote-row className="flex items-center gap-2">
      <span className="w-20 text-sm text-muted-foreground">{label}</span>
      <Button data-tv-focus variant="secondary" size="icon" aria-label={`Earlier ${label}`} onClick={onMinus}><Minus className="size-4" /></Button>
      <span className="flex-1 text-center font-semibold tabular-nums">{value}</span>
      <Button data-tv-focus variant="secondary" size="icon" aria-label={`Later ${label}`} onClick={onPlus}><Plus className="size-4" /></Button>
    </div>
  );
}
