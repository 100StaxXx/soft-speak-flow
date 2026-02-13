import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles } from "lucide-react";
import { ImageGenerationProgress, type GenerationPhase } from "./ImageGenerationProgress";

interface CompanionRegenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isRegenerating: boolean;
  regenerationsRemaining: number;
  generationPhase?: GenerationPhase;
  retryCount?: number;
}

export const CompanionRegenerateDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isRegenerating,
  regenerationsRemaining,
  generationPhase = 'starting',
  retryCount = 0,
}: CompanionRegenerateDialogProps) => {
  const isComplete = generationPhase === 'complete' || generationPhase === 'warning';

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && !isRegenerating && onClose()}>
      <AlertDialogContent className="cosmic-glass border-primary/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isRegenerating ? "Creating New Look..." : "Refresh Companion Look?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {isRegenerating ? (
              <div className="py-2">
                <ImageGenerationProgress 
                  phase={generationPhase}
                  retryCount={retryCount}
                  estimatedTime={15}
                />
                {retryCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    We're ensuring your companion looks perfect
                  </p>
                )}
              </div>
            ) : (
              <>
                <p>
                  This will create a new unique appearance for your companion while keeping 
                  all stats, XP, and progress intact.
                </p>
                <p className="text-sm text-muted-foreground/80">
                  You have <span className="font-semibold text-primary">{regenerationsRemaining}</span> look refresh
                  {regenerationsRemaining === 1 ? '' : 'es'} remaining (lifetime limit).
                </p>
                <p className="text-xs text-muted-foreground/60">
                  This usually takes 10-20 seconds. We'll ensure quality by validating the result.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!isRegenerating && !isComplete && (
            <>
              <AlertDialogCancel disabled={isRegenerating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                }}
                disabled={isRegenerating || regenerationsRemaining <= 0}
                className="bg-primary hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Refresh Look
              </AlertDialogAction>
            </>
          )}
          {isComplete && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onClose();
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Done
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
