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
import { Sparkles, Loader2 } from "lucide-react";

interface CompanionRegenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isRegenerating: boolean;
  regenerationsRemaining: number;
}

export const CompanionRegenerateDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isRegenerating,
  regenerationsRemaining,
}: CompanionRegenerateDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="cosmic-glass border-primary/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Regenerate Companion?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will create a new unique appearance for your companion while keeping 
              all stats, XP, and progress intact.
            </p>
            <p className="text-sm text-muted-foreground/80">
              You have <span className="font-semibold text-primary">{regenerationsRemaining}</span> regeneration
              {regenerationsRemaining === 1 ? '' : 's'} remaining (lifetime limit).
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRegenerating}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isRegenerating || regenerationsRemaining <= 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
