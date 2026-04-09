import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { cn } from "@/lib/utils";

interface VoiceQuestCaptureDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (transcript: string) => void;
}

export function VoiceQuestCaptureDrawer({
  open,
  onOpenChange,
  onCapture,
}: VoiceQuestCaptureDrawerProps) {
  const [interimText, setInterimText] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAttemptedCapture, setHasAttemptedCapture] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const completedCaptureRef = useRef(false);
  const shouldAutoStartRef = useRef(false);

  const {
    isRecording,
    isAutoStopping,
    permissionStatus,
    startRecording,
    stopRecording,
    requestPermission,
  } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
      setErrorMessage(null);
    },
    onFinalResult: (text) => {
      setFinalTranscript((current) => `${current} ${text}`.trim());
      setInterimText("");
      setErrorMessage(null);
    },
    onError: (message) => {
      setInterimText("");
      setErrorMessage(message);
    },
    onPermissionNeeded: () => {
      setShowPermissionDialog(true);
    },
  });

  useEffect(() => {
    if (!open) {
      stopRecording();
      setInterimText("");
      setFinalTranscript("");
      setErrorMessage(null);
      setHasAttemptedCapture(false);
      setShowPermissionDialog(false);
      completedCaptureRef.current = false;
      shouldAutoStartRef.current = false;
      return;
    }

    shouldAutoStartRef.current = true;
  }, [open, stopRecording]);

  useEffect(() => {
    if (!open) return;
    if (!shouldAutoStartRef.current) return;
    if (isRecording) return;

    shouldAutoStartRef.current = false;
    setHasAttemptedCapture(true);
    void startRecording();
  }, [isRecording, open, startRecording]);

  useEffect(() => {
    if (!open || isRecording) return;

    const transcript = finalTranscript.trim();
    if (!transcript || completedCaptureRef.current) return;

    completedCaptureRef.current = true;
    onCapture(transcript);
    onOpenChange(false);
  }, [finalTranscript, isRecording, onCapture, onOpenChange, open]);

  const handleRetry = async () => {
    completedCaptureRef.current = false;
    setInterimText("");
    setFinalTranscript("");
    setErrorMessage(null);
    setHasAttemptedCapture(true);
    await startRecording();
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    const status = await requestPermission();
    setIsRequestingPermission(false);

    if (status === "granted") {
      setShowPermissionDialog(false);
      await handleRetry();
    }
  };

  const transcriptPreview = `${finalTranscript} ${interimText}`.trim();
  const hasTranscript = transcriptPreview.length > 0;
  const showRetryState = !isRecording && hasAttemptedCapture && (Boolean(errorMessage) || !hasTranscript);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[55dvh]">
          <DrawerHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Mic className="h-6 w-6" />
            </div>
            <DrawerTitle className="text-center">Add Quest With Voice</DrawerTitle>
            <DrawerDescription className="text-center">
              Say the quest naturally. I&apos;ll fill in the current quest creator so you can review and edit it.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-2">
            <div className="rounded-[24px] border border-border/60 bg-background/70 p-4 shadow-[0_12px_24px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-center gap-3">
                <AudioReactiveWaveform isActive={isRecording && !isAutoStopping} barCount={7} />
                <p
                  className={cn(
                    "text-sm font-medium",
                    isRecording ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {isRecording ? (isAutoStopping ? "Finishing up..." : "Listening...") : "Ready"}
                </p>
              </div>

              <div className="mt-4 min-h-[88px] rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-foreground">
                {hasTranscript ? (
                  transcriptPreview
                ) : showRetryState ? (
                  <span className="text-muted-foreground">
                    {errorMessage ?? "I didn&apos;t catch anything that time. Try again."}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Start speaking and your quest details will appear here.
                  </span>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="grid grid-cols-2 gap-2 pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                  return;
                }
                void handleRetry();
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {showRetryState ? "Try Again" : isRecording ? "Stop" : "Record Again"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <PermissionRequestDialog
        isOpen={showPermissionDialog}
        onClose={() => setShowPermissionDialog(false)}
        onRequestPermission={handleRequestPermission}
        permissionStatus={permissionStatus}
        isRequesting={isRequestingPermission}
      />
    </>
  );
}
