import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, Sparkles } from "lucide-react";

interface SearchTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchTutorialModal({ open, onClose }: SearchTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) return;
    }}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Search className="h-6 w-6 text-primary" />
            Discover & Explore
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4 text-base">
            <p className="text-foreground">
              This is your discovery hub! Search for content, explore quotes, 
              and find pep talks to fuel your journey.
            </p>
            
            <div className="bg-accent/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Search for quests, quotes, and pep talks
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Browse featured quotes for daily inspiration
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Discover pep talks from your mentor
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic">
              Start typing to search or explore featured content below!
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
