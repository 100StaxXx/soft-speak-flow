import { memo } from "react";
import { getFactionById, FactionType } from "@/config/factions";
import { cn } from "@/lib/utils";

interface FactionBadgeProps {
  faction: FactionType | string | null | undefined;
  variant?: "full" | "compact" | "icon-only";
  className?: string;
  showMotto?: boolean;
  showTraits?: boolean;
}

export const FactionBadge = memo(({ 
  faction, 
  variant = "compact", 
  className,
  showMotto = true,
  showTraits = true,
}: FactionBadgeProps) => {
  const factionData = getFactionById(faction);
  
  if (!factionData) return null;

  const Icon = factionData.icon;

  if (variant === "icon-only") {
    return (
      <div 
        className={cn(
          "p-1.5 rounded-lg",
          className
        )}
        style={{ backgroundColor: `${factionData.color}30` }}
        title={factionData.name}
      >
        <Icon 
          className="h-4 w-4" 
          style={{ color: factionData.color }}
        />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div 
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          className
        )}
        style={{ backgroundColor: `${factionData.color}20` }}
      >
        <Icon 
          className="h-4 w-4" 
          style={{ color: factionData.color }}
        />
        <span 
          className="text-sm font-medium"
          style={{ color: factionData.color }}
        >
          {factionData.name}
        </span>
      </div>
    );
  }

  // Full variant
  return (
    <div 
      className={cn(
        "rounded-xl overflow-hidden border",
        className
      )}
      style={{ borderColor: `${factionData.color}40` }}
    >
      {/* Header with image */}
      <div className="relative h-32">
        <img
          src={factionData.image}
          alt={factionData.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-3 left-4 flex items-center gap-3">
          <div 
            className="p-2 rounded-lg backdrop-blur-sm"
            style={{ backgroundColor: `${factionData.color}30` }}
          >
            <Icon 
              className="h-5 w-5" 
              style={{ color: factionData.color }}
            />
          </div>
          <div>
            <h3 
              className="text-lg font-bold"
              style={factionData.nameStyle}
            >
              {factionData.name}
            </h3>
            <p className="text-xs text-muted-foreground">{factionData.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 bg-card/50">
        {showMotto && (
          <div 
            className="p-3 rounded-lg border-l-2"
            style={{ 
              borderColor: factionData.color,
              backgroundColor: `${factionData.color}10`
            }}
          >
            <p className="text-sm italic text-foreground/90">
              "{factionData.motto}"
            </p>
          </div>
        )}

        {showTraits && (
          <div className="flex flex-wrap gap-2">
            {factionData.traits.map((trait, i) => (
              <span 
                key={i}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: `${factionData.color}20`,
                  color: factionData.color
                }}
              >
                {trait}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
FactionBadge.displayName = 'FactionBadge';
