import { Badge } from "@/components/ui/badge";
import { Sparkles, Flame, Zap, Droplet, Wind, Leaf, Mountain, Star } from "lucide-react";
import { getStageName } from "@/config/companionStages";
import { formatDisplayLabel } from "@/lib/utils";

interface CompanionBadgeProps {
  element: string;
  stage?: number;
  showStage?: boolean;
  className?: string;
}

const elementIcons: Record<string, typeof Sparkles> = {
  fire: Flame,
  water: Droplet,
  earth: Mountain,
  air: Wind,
  light: Star,
  nature: Leaf,
  energy: Zap,
  spirit: Sparkles
};

const elementColors: Record<string, string> = {
  fire: "bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border-orange-500/30",
  water: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border-blue-500/30",
  earth: "bg-gradient-to-r from-amber-600/20 to-yellow-700/20 text-amber-300 border-amber-600/30",
  air: "bg-gradient-to-r from-sky-400/20 to-indigo-400/20 text-sky-300 border-sky-400/30",
  light: "bg-gradient-to-r from-yellow-300/20 to-amber-300/20 text-yellow-200 border-yellow-300/30",
  nature: "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-500/30",
  energy: "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30",
  spirit: "bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 border-indigo-500/30"
};

export const CompanionBadge = ({ element, stage = 1, showStage = true, className = "" }: CompanionBadgeProps) => {
  const Icon = elementIcons[element.toLowerCase()] || Sparkles;
  const colorClass = elementColors[element.toLowerCase()] || elementColors.spirit;
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
      className={`px-3 py-1 ${colorClass} ${getStageOverlay()} ${className} flex items-center gap-2`}
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
