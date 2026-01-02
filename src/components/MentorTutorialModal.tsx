import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, Sparkles } from "lucide-react";

interface MentorTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function MentorTutorialModal({ open, onClose }: MentorTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) return;
    }}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <MessageCircle className="h-6 w-6 text-primary" />
            Meet Your Mentor
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-4 text-base text-muted-foreground">
              <p className="text-foreground">
                Your mentor is your personal guide on this journey. They're here to 
                motivate, encourage, and help you stay on track with your goals.
              </p>
              
              <div className="bg-accent/20 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">
                    Listen to daily pep talks for motivation
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">
                    Morning & evening check-ins to track your mood
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">
                    Ask questions anytime for personalized guidance
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">
                    Your mentor adapts to your zodiac profile
                  </span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground italic">
                Chat with your mentor below to get started!
              </p>
            </div>
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
