import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <Card className="p-12 text-center space-y-6 bg-gradient-to-br from-celestial-blue/5 via-muted/20 to-stardust-gold/5 border-dashed border-celestial-blue/20">
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
    </Card>
  );
};
