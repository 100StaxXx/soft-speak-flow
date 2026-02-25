import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResilience } from "@/contexts/ResilienceContext";

interface QueuedActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  queued: "secondary",
  syncing: "outline",
  synced: "default",
  failed: "destructive",
  dropped: "outline",
};

const prettyAction = (actionKind: string) => {
  switch (actionKind) {
    case "TASK_CREATE":
      return "Create quest";
    case "TASK_UPDATE":
      return "Update quest";
    case "TASK_COMPLETE":
      return "Toggle quest";
    case "TASK_DELETE":
      return "Delete quest";
    case "MENTOR_FEEDBACK":
      return "Mentor feedback";
    case "SUPPORT_REPORT":
      return "Support report";
    default:
      return actionKind;
  }
};

export function QueuedActionsSheet({ open, onOpenChange }: QueuedActionsSheetProps) {
  const { receipts, retryAll, retryAction, discardAction, queueCount } = useResilience();

  const hasFailures = receipts.some((receipt) => receipt.status === "failed");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Queued Actions</SheetTitle>
          <SheetDescription>
            {queueCount} pending action{queueCount === 1 ? "" : "s"}. Failed actions stay here until you retry or discard them.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={() => void retryAll()} disabled={!hasFailures}>
            Retry all failed
          </Button>
        </div>

        <ScrollArea className="mt-4 h-[75vh] pr-2">
          <div className="space-y-3">
            {receipts.length === 0 ? (
              <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                No queued actions.
              </div>
            ) : (
              receipts
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((receipt) => (
                  <div key={receipt.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{prettyAction(receipt.actionKind)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(receipt.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANT[receipt.status] ?? "outline"}>{receipt.status}</Badge>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>Entity: {receipt.entityType}{receipt.entityId ? ` (${receipt.entityId})` : ""}</p>
                      <p>Retries: {receipt.retryCount}</p>
                      {receipt.lastError && <p className="text-destructive">{receipt.lastError}</p>}
                    </div>

                    {(receipt.status === "failed" || receipt.status === "queued") && (
                      <div className="mt-3 flex items-center gap-2">
                        {receipt.status === "failed" && (
                          <Button size="sm" onClick={() => void retryAction(receipt.id)}>
                            Retry
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => void discardAction(receipt.id)}>
                          Discard
                        </Button>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
