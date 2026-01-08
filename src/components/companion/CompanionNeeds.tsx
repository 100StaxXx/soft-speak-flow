import { memo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Utensils, Heart, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanionNeedsProps {
  hunger: number;
  happiness: number;
  health: number;
  isRecovering: boolean;
  recoveryProgress: number;
  className?: string;
}

const NeedIndicator = memo(({ 
  icon: Icon, 
  label, 
  value, 
  color,
  critical = false,
}: { 
  icon: typeof Utensils; 
  label: string; 
  value: number; 
  color: string;
  critical?: boolean;
}) => {
  const isCritical = value < 30;
  
  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-lg transition-colors",
      isCritical && "bg-destructive/10 animate-pulse"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center",
        isCritical ? "bg-destructive/20" : "bg-muted/50"
      )}>
        <Icon className={cn(
          "w-4 h-4",
          isCritical ? "text-destructive" : color
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={cn(
            "text-xs font-medium",
            isCritical ? "text-destructive" : "text-foreground"
          )}>
            {value}%
          </span>
        </div>
        <Progress 
          value={value} 
          className={cn(
            "h-1.5",
            isCritical && "[&>div]:bg-destructive"
          )}
        />
      </div>
    </div>
  );
});

NeedIndicator.displayName = 'NeedIndicator';

export const CompanionNeeds = memo(({
  hunger,
  happiness,
  health,
  isRecovering,
  recoveryProgress,
  className,
}: CompanionNeedsProps) => {
  // Calculate overall health for body stat
  const overallHealth = Math.round((hunger + happiness + health) / 3);
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Recovery Banner */}
      {isRecovering && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-500">Recovering</p>
            <p className="text-[10px] text-amber-500/70">
              Keep caring for your companion ({recoveryProgress}% healed)
            </p>
          </div>
        </div>
      )}
      
      {/* Need Indicators */}
      <div className="grid gap-1.5">
        <NeedIndicator
          icon={Utensils}
          label="Hunger"
          value={hunger}
          color="text-amber-500"
        />
        <NeedIndicator
          icon={Heart}
          label="Happiness"
          value={happiness}
          color="text-pink-500"
        />
        <NeedIndicator
          icon={Activity}
          label="Health"
          value={health}
          color="text-emerald-500"
        />
      </div>
    </div>
  );
});

CompanionNeeds.displayName = 'CompanionNeeds';
