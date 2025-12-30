import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Compass, CheckCircle2, Target, Sparkles, Repeat } from "lucide-react";

interface JourneysTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function JourneysTutorialModal({ open, onClose }: JourneysTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="sm:max-w-md" 
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
            <Compass className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">Welcome to Your Quest Hub</DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-4">
            <p className="text-center text-muted-foreground">
              This is where daily quests and epic campaigns come together.
            </p>
            
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Complete daily quests</span>
                  <span className="text-muted-foreground"> to earn XP and keep your streak alive</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Launch campaigns</span>
                  <span className="text-muted-foreground"> to turn big goals into guided adventures</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Unlock postcards</span>
                  <span className="text-muted-foreground"> as your companion reaches milestones</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Repeat className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Link rituals to campaigns</span>
                  <span className="text-muted-foreground"> for bonus progress each day</span>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <Button onClick={onClose} className="w-full mt-4">
          Let's explore!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
