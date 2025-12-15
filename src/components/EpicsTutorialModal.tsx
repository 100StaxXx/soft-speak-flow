import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, CheckCircle2, Star, Users } from "lucide-react";

interface EpicsTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function EpicsTutorialModal({ open, onClose }: EpicsTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) return;
    }}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="h-6 w-6 text-primary" />
            Welcome to Epics
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4 text-base">
            <p className="text-foreground">
              Epics are long-term goals with linked habits. Complete daily habits 
              to progress your Epic and achieve legendary milestones!
            </p>
            
            <div className="bg-accent/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Star className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Browse Star Paths for curated epic journeys
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Create custom epics with your own habits
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Join shared Epics (Guilds) with friends
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Earn bonus XP completing guild quests
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic">
              Start by browsing Star Paths or create your own epic below!
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
