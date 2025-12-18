import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Moon, Sparkles } from 'lucide-react';

interface DisableEncountersDialogProps {
  open: boolean;
  onDisable: () => void;
  onKeepOn: () => void;
  passCount: number;
}

export const DisableEncountersDialog = ({
  open,
  onDisable,
  onKeepOn,
  passCount,
}: DisableEncountersDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onKeepOn()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Moon className="w-8 h-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center">
            Taking a Break from Encounters?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            You've passed on {passCount} encounters today. Would you like to disable Astral Encounters? 
            You can re-enable them anytime in your Profile settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction 
            onClick={onDisable}
            className="w-full"
          >
            <Moon className="w-4 h-4 mr-2" />
            Disable Encounters
          </AlertDialogAction>
          <AlertDialogCancel 
            onClick={onKeepOn}
            className="w-full mt-0"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Keep Them On
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
