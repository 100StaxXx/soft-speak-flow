import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Compass, Milestone, Users, Sparkles } from "lucide-react";

interface EpicsTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function EpicsTutorialModal({ open, onClose }: EpicsTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) return;
    }}>
      <DialogContent className="max-w-md bg-gradient-to-br from-background to-primary/5" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Compass className="h-6 w-6 text-primary" />
            Your Adventure Awaits
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4 text-base">
            <p className="text-foreground">
              Every great journey begins with a single step. Campaigns turn your big goals 
              into daily adventures—complete rituals, track your progress, and watch your story unfold.
            </p>
            
            <div className="bg-accent/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Build your own adventure with custom rituals
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Milestone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Track progress with milestones along the way
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Join guilds to adventure alongside others
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Celebrate victories and earn bonus XP
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic">
              Your first adventure is just a tap away!
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={onClose} size="lg">
            Let's Begin
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
