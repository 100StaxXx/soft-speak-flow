import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Swords, CheckCircle2 } from "lucide-react";

interface QuestsTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuestsTutorialModal({ open, onClose }: QuestsTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Only allow closing via the button, not by clicking outside or ESC
      if (!isOpen) return;
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Swords className="h-6 w-6 text-primary" />
            Welcome to Quests!
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4 text-base">
            <p className="text-foreground">
              Quests are your daily tasks that help you level up and grow your companion. 
              They're the things you need to do each day—like laundry, meal prep, exercise, 
              or studying.
            </p>
            
            <div className="bg-accent/20 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Add up to 4 quests per day
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Unlock Bonus Quest by completing all 4 or reaching a 7-day streak
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Complete them to earn XP
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Main Quest = 1.5x XP boost
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Create Epics for long-term goals
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic">
              Your first quest is already waiting for you below. Check it off to get started!
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={onClose} size="lg">
            Got it, let's go!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
