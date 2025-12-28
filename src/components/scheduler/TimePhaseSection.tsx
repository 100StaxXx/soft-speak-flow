import { ReactNode } from "react";
import { Sunrise, Sun, Sunset, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimePhase = "dawn" | "day" | "twilight" | "night";

interface TimePhaseSectionProps {
  phase: TimePhase;
  children: ReactNode;
  count: number;
}

const phaseConfig: Record<TimePhase, {
  label: string;
  icon: typeof Sunrise;
  hours: string;
  gradient: string;
  iconColor: string;
}> = {
  dawn: {
    label: "Dawn",
    icon: Sunrise,
    hours: "5 AM - 12 PM",
    gradient: "from-orange-500/10 to-yellow-500/5",
    iconColor: "text-orange-400",
  },
  day: {
    label: "Solar Peak",
    icon: Sun,
    hours: "12 PM - 5 PM",
    gradient: "from-yellow-500/10 to-amber-500/5",
    iconColor: "text-yellow-400",
  },
  twilight: {
    label: "Twilight",
    icon: Sunset,
    hours: "5 PM - 9 PM",
    gradient: "from-purple-500/10 to-pink-500/5",
    iconColor: "text-purple-400",
  },
  night: {
    label: "Midnight",
    icon: Moon,
    hours: "9 PM - 5 AM",
    gradient: "from-indigo-500/10 to-blue-500/5",
    iconColor: "text-indigo-400",
  },
};

export function TimePhaseSection({ phase, children, count }: TimePhaseSectionProps) {
  const config = phaseConfig[phase];
  const Icon = config.icon;

  if (count === 0) return null;

  return (
    <div className="space-y-2">
      {/* Phase header */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-gradient-to-r",
        config.gradient
      )}>
        <Icon className={cn("h-4 w-4", config.iconColor)} />
        <span className="text-sm font-medium">{config.label}</span>
        <span className="text-xs text-muted-foreground">({config.hours})</span>
        <span className="ml-auto text-xs bg-background/50 px-2 py-0.5 rounded-full">
          {count} quest{count !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Phase content */}
      <div className="pl-2 space-y-2">
        {children}
      </div>
    </div>
  );
}

export function getTimePhase(time: string): TimePhase {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour >= 5 && hour < 12) return "dawn";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "twilight";
  return "night";
}
