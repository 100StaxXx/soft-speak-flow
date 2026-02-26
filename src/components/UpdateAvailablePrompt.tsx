import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUpdateAvailability } from "@/hooks/useUpdateAvailability";

export const UpdateAvailablePrompt = () => {
  const {
    hasUpdate,
    channel,
    currentVersion,
    latestVersion,
    updateAction,
    dismiss,
  } = useUpdateAvailability();

  if (!hasUpdate || !channel) return null;

  const actionLabel = channel === "ios_store" ? "Open App Store" : "Update now";
  const versionKey = latestVersion ?? currentVersion ?? "";

  return (
    <Card className="fixed bottom-24 left-4 right-4 z-[60] p-4 bg-card border-border shadow-lg md:left-auto md:right-4 md:max-w-sm">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">A new update is available</h3>
          <p className="text-xs text-muted-foreground">
            Update now for the latest fixes and improvements.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => dismiss(versionKey)}
          >
            Later
          </Button>
          <Button size="sm" className="flex-1" onClick={() => void updateAction()}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
};
