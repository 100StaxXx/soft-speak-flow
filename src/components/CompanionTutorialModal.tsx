import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Heart } from "lucide-react";

interface CompanionTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function CompanionTutorialModal({ open, onClose }: CompanionTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) return;
    }}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Your Companion Awaits
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4 text-base">
            <p className="text-foreground">
              Your companion is a magical creature that evolves as you grow. 
              Complete quests and build habits to watch it transform through 21 stages!
            </p>
            
            <div className="bg-accent/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Complete quests to earn XP and level up
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Stats reflect your Mind, Body, and Soul focus
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Keep streaks going to boost evolution speed
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Heart className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Don't neglect them—they'll miss you!
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic">
              View your companion's stats, cards, and story below!
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
