import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ATTRIBUTE_DESCRIPTIONS, AttributeType } from "@/config/attributeDescriptions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CompanionAttributesProps {
  companion: Record<string, any>;
}

// All 6 stats in a clean 2x3 grid
const GRID_STATS: AttributeType[] = ['vitality', 'wisdom', 'discipline', 'resolve', 'creativity', 'alignment'];

// Stats are on a 100-1000 scale
const STAT_MIN = 100;
const STAT_MAX = 1000;
const STAT_DEFAULT = 300;

export const CompanionAttributes = ({ companion }: CompanionAttributesProps) => {
  const [selectedAttribute, setSelectedAttribute] = useState<AttributeType | null>(null);
  
  const getStatValue = (key: AttributeType): number => {
    return companion[key] ?? STAT_DEFAULT;
  };

  const getStatPercentage = (value: number): number => {
    // Convert 100-1000 scale to 0-100% for progress bar
    return ((value - STAT_MIN) / (STAT_MAX - STAT_MIN)) * 100;
  };

  const attributeDetails = selectedAttribute ? ATTRIBUTE_DESCRIPTIONS[selectedAttribute] : null;

  return (
    <>
      <Card className="p-3 bg-gradient-to-br from-secondary/30 to-secondary/10 border-primary/20">
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-center text-muted-foreground uppercase tracking-wide">
            Companion Stats
          </h3>
          
          {/* 2-column grid for all 6 stats */}
          <div className="grid grid-cols-2 gap-2">
            {GRID_STATS.map((key) => {
              const info = ATTRIBUTE_DESCRIPTIONS[key];
              const value = getStatValue(key);
              const percentage = getStatPercentage(value);
              
              return (
                <button
                  key={key}
                  onClick={() => setSelectedAttribute(key)}
                  className="p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-all text-left space-y-1.5 border border-transparent hover:border-primary/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{info.icon}</span>
                      <span className={cn("text-xs font-medium", info.color)}>{info.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{value}</span>
                  </div>
                  <div className="relative h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", info.progressColor)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          
          <p className="text-[10px] text-center text-muted-foreground/70 italic">
            Tap a stat to learn more
          </p>
        </div>
      </Card>

      <Dialog open={!!selectedAttribute} onOpenChange={(open) => !open && setSelectedAttribute(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {attributeDetails?.icon} {attributeDetails?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Learn about the {attributeDetails?.name} attribute
            </DialogDescription>
          </DialogHeader>
          
          {attributeDetails && selectedAttribute && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Level:</span>
                <span className="font-mono font-semibold">{getStatValue(selectedAttribute)} / {STAT_MAX}</span>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-1">What it means:</h4>
                <p className="text-muted-foreground">{attributeDetails.whatItMeans}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">Boosted by:</h4>
                <ul className="space-y-1.5 text-muted-foreground">
                  {attributeDetails.boostedBy.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="pt-2 border-t border-border/50">
                <h4 className="font-semibold text-foreground mb-1">When it grows:</h4>
                <p className="text-muted-foreground italic">{attributeDetails.whenGrows}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
