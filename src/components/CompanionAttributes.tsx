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

const GRID_STATS: AttributeType[] = ['vitality', 'power', 'wisdom', 'discipline', 'resolve', 'connection'];

export const CompanionAttributes = ({ companion }: CompanionAttributesProps) => {
  const [selectedAttribute, setSelectedAttribute] = useState<AttributeType | null>(null);
  
  const getStatValue = (key: AttributeType): number => {
    return companion[key] ?? 30;
  };

  const attributeDetails = selectedAttribute ? ATTRIBUTE_DESCRIPTIONS[selectedAttribute] : null;

  return (
    <>
      <Card className="p-3 bg-gradient-to-br from-secondary/30 to-secondary/10 border-primary/20">
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-center text-muted-foreground uppercase tracking-wide">
            Companion Stats
          </h3>
          
          {/* 2-column grid for 6 stats */}
          <div className="grid grid-cols-2 gap-2">
            {GRID_STATS.map((key) => {
              const info = ATTRIBUTE_DESCRIPTIONS[key];
              const value = getStatValue(key);
              
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
                    <span className="text-xs text-muted-foreground font-mono">{value}</span>
                  </div>
                  <div className="relative h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", info.progressColor)}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Alignment stat - full width at bottom */}
          <button
            onClick={() => setSelectedAttribute('alignment')}
            className="w-full p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-all text-left space-y-1.5 border border-transparent hover:border-primary/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{ATTRIBUTE_DESCRIPTIONS.alignment.icon}</span>
                <span className={cn("text-xs font-medium", ATTRIBUTE_DESCRIPTIONS.alignment.color)}>
                  {ATTRIBUTE_DESCRIPTIONS.alignment.name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{getStatValue('alignment')}</span>
            </div>
            <div className="relative h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div 
                className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", ATTRIBUTE_DESCRIPTIONS.alignment.progressColor)}
                style={{ width: `${getStatValue('alignment')}%` }}
              />
            </div>
          </button>
          
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
          
          {attributeDetails && (
            <div className="space-y-4 text-sm">
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
