import { Badge } from "@/components/ui/badge";
import { Sparkles, Flame, Zap, Droplet, Wind, Leaf, Mountain, Star, Snowflake, Moon } from "lucide-react";
import { getStageName } from "@/config/companionStages";
import { formatDisplayLabel } from "@/lib/utils";
import { deriveCompanionPalette } from "@/lib/companionPalette";

interface CompanionBadgeProps {
  element: string;
  stage?: number;
  showStage?: boolean;
  favoriteColor?: string;
  companionId?: string;
  className?: string;
}

const elementIcons: Record<string, typeof Sparkles> = {
  fire: Flame,
  water: Droplet,
  earth: Mountain,
  air: Wind,
  lightning: Zap,
  ice: Snowflake,
  light: Star,
  shadow: Moon,
  cosmic: Star,
  nature: Leaf,
  energy: Zap,
  spirit: Sparkles
};

export const CompanionBadge = ({
  element,
  stage = 1,
  showStage = true,
  favoriteColor,
  companionId,
  className = "",
}: CompanionBadgeProps) => {
  const Icon = elementIcons[element.toLowerCase()] || Sparkles;
  const palette = deriveCompanionPalette({
    coreElement: element,
    favoriteColor,
    stage,
    companionId,
  });
  const stageName = getStageName(stage);
  
  // Get stage tier overlay
  const getStageOverlay = () => {
    if (stage >= 16) return "bg-gradient-to-r from-stage-tier-4-start/10 via-stage-tier-4-mid/10 to-stage-tier-4-end/10"; // Prismatic
    if (stage >= 11) return "bg-gradient-to-r from-stage-tier-3/10"; // Gold shimmer
    if (stage >= 6) return "bg-gradient-to-r from-stage-tier-2/10"; // Silver shimmer
    return ""; // Base tier
  };
  
  return (
    <Badge 
      variant="outline" 
      className={`px-3 py-1 ${getStageOverlay()} ${className} flex items-center gap-2`}
      style={{
        background: palette.badgeBg,
        borderColor: palette.badgeBorder,
        color: palette.badgeText,
        boxShadow: `0 0 16px ${palette.glow}`,
      }}
    >
      <Icon className="h-3 w-3" />
      <span className="text-xs font-semibold">{formatDisplayLabel(element)}</span>
      {showStage && stage !== undefined && (
        <>
          <span className="text-xs opacity-50">•</span>
          <span className="text-xs font-medium">{stageName}</span>
        </>
      )}
    </Badge>
  );
};
