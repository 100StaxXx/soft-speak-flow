import { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PageInfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: LucideIcon;
  description: string;
  features: string[];
  tip?: string;
}

export const PageInfoModal = ({
  open,
  onClose,
  title,
  icon: Icon,
  description,
  features,
  tip,
}: PageInfoModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground flex-1">{feature}</p>
            </div>
          ))}
        </div>

        {tip && (
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <p className="text-sm italic text-muted-foreground">{tip}</p>
          </div>
        )}

        <Button onClick={onClose} className="w-full">
          Got it!
        </Button>
      </DialogContent>
    </Dialog>
  );
};
