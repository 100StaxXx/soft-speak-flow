import { Clock } from "lucide-react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { cn } from "@/lib/utils";

interface TrialBadgeProps {
  className?: string;
}

export const TrialBadge = ({ className }: TrialBadgeProps) => {
  const { isInTrial, trialDaysRemaining, isSubscribed, loading } = useTrialStatus();

  // Don't show if loading, subscribed, or not in trial
  if (loading || isSubscribed || !isInTrial) {
    return null;
  }

  const isUrgent = trialDaysRemaining <= 2;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
        isUrgent
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "bg-accent/10 text-accent-foreground border border-accent/20",
        className
      )}
    >
      <Clock className="h-3 w-3" />
      <span>
        {trialDaysRemaining === 1
          ? "1 day left"
          : `${trialDaysRemaining} days left`}
      </span>
    </div>
  );
};
