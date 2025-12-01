import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageInfoButtonProps {
  onClick: () => void;
  className?: string;
}

export const PageInfoButton = ({ onClick, className }: PageInfoButtonProps) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "h-8 w-8 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
      aria-label="Page information"
    >
      <Info className="h-4 w-4" />
    </Button>
  );
};
