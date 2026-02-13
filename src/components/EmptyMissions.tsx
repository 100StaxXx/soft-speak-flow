import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Sparkles, RefreshCcw } from "lucide-react";

interface EmptyMissionsProps {
  onRetry?: () => Promise<unknown> | unknown;
  isRetrying?: boolean;
  errorMessage?: string | null;
}

export const EmptyMissions = ({ onRetry, isRetrying, errorMessage }: EmptyMissionsProps) => {
  const handleRetry = () => {
    if (!onRetry || isRetrying) return;
    const result = onRetry();
    if (result instanceof Promise) {
      void result;
    }
  };

  return (
    <Card className="p-8 text-center bg-gradient-to-br from-accent/5 to-primary/5 border-dashed border-2 border-muted-foreground/20">
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
          <Target className="h-8 w-8 text-accent" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-heading font-bold text-foreground">
            Missions Refresh Daily
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete daily missions to earn bonus XP and help your companion evolve faster!
            Check back tomorrow for new challenges.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          <span>New missions arrive at midnight</span>
        </div>
        {errorMessage && (
          <p className="text-xs text-destructive mt-2">
            {errorMessage}
          </p>
        )}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-2 gap-2"
          >
            {isRetrying ? (
              <>
                <RefreshCcw className="h-3 w-3 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCcw className="h-3 w-3" />
                Try Refresh Again
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
};
