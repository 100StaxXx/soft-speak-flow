import { Trophy, Award, Medal, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AchievementBadgeProps {
  tier: "bronze" | "silver" | "gold" | "platinum";
  title: string;
  description: string;
  icon: string;
  earnedAt?: string;
  size?: "sm" | "md" | "lg";
}

const tierConfig = {
  bronze: {
    gradient: "from-orange-600 to-orange-800",
    shadow: "shadow-orange-500/20",
    icon: Medal,
  },
  silver: {
    gradient: "from-gray-400 to-gray-600",
    shadow: "shadow-gray-500/20",
    icon: Award,
  },
  gold: {
    gradient: "from-yellow-400 to-yellow-600",
    shadow: "shadow-yellow-500/20",
    icon: Trophy,
  },
  platinum: {
    gradient: "from-purple-400 to-purple-600",
    shadow: "shadow-purple-500/20",
    icon: Crown,
  },
};

export const AchievementBadge = ({
  tier,
  title,
  description,
  earnedAt,
  size = "md",
}: AchievementBadgeProps) => {
  const config = tierConfig[tier];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={cn(
        "relative rounded-xl bg-card border border-border/50 overflow-hidden group hover:scale-105 transition-all duration-300",
        config.shadow,
        sizeClasses[size]
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity",
          config.gradient
        )}
      />
      <div className="relative space-y-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-full p-2 bg-gradient-to-br",
              config.gradient
            )}
          >
            <Icon className={cn("text-white", iconSizes[size])} />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {earnedAt && (
          <p className="text-[10px] text-muted-foreground/60">
            Earned {new Date(earnedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
};
