import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, Trophy, Megaphone } from "lucide-react";

interface CommunityTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function CommunityTutorialModal({ open, onClose }: CommunityTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) return;
    }}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Users className="h-6 w-6 text-primary" />
            Welcome to Community
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4 text-base">
            <p className="text-foreground">
              Connect with others on their growth journey! Create or join communities 
              to share progress and encourage each other.
            </p>
            
            <div className="bg-accent/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Create your own community or join with an invite code
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Trophy className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Compete on leaderboards and track your XP contributions
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Megaphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Send shouts to encourage and motivate your community
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic">
              Discover public communities or create your own to get started!
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={onClose} size="lg">
            Let's go!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
