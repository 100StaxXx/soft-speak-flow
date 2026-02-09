import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center space-y-6 py-20">
      <div className="mx-auto w-20 h-20 rounded-full bg-celestial-blue/10 flex items-center justify-center">
        <Icon className="h-10 w-10 text-celestial-blue" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="lg" className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
