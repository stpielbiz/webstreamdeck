import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Small confirmation shown after press-and-hold on a favourite or a
 * continue-watching title. Nothing is removed unless Remove is chosen;
 * the remote Back key activates Cancel (data-dialog-back).
 */
export function RemoveConfirmDialog({
  title,
  mode,
  onConfirm,
  onClose,
}: {
  title: string | null;
  mode: "favourite" | "continue";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={title !== null} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "favourite" ? "Remove from favourites?" : "Remove from continue watching?"}</DialogTitle>
        </DialogHeader>
        <p className="truncate text-sm text-muted-foreground">{title}</p>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" data-dialog-back data-tv-focus>Cancel</Button>
          </DialogClose>
          <Button
            data-tv-focus
            autoFocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
