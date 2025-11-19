import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, Target, Scale, Zap } from "lucide-react";
import { Companion } from "@/hooks/useCompanion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ATTRIBUTE_DESCRIPTIONS, AttributeType } from "@/config/attributeDescriptions";

interface CompanionAttributesProps {
  companion: Companion & {
    energy?: number;
    resilience?: number;
    focus?: number;
    balance?: number;
  };
}

const ATTRIBUTE_INFO = {
  energy: {
    icon: Zap,
    label: "Energy",
    color: "text-yellow-500",
  },
  resilience: {
    icon: Shield,
    label: "Resilience",
    color: "text-blue-500",
  },
  focus: {
    icon: Target,
    label: "Focus",
    color: "text-purple-500",
  },
  balance: {
    icon: Scale,
    label: "Balance",
    color: "text-green-500",
  },
};

export const CompanionAttributes = ({ companion }: CompanionAttributesProps) => {
  const [selectedAttribute, setSelectedAttribute] = useState<AttributeType | null>(null);
  
  const attributes = [
    { key: 'energy' as AttributeType, value: companion.energy ?? 100 },
    { key: 'resilience' as AttributeType, value: companion.resilience ?? 0 },
    { key: 'focus' as AttributeType, value: companion.focus ?? 0 },
    { key: 'balance' as AttributeType, value: companion.balance ?? 0 },
  ];

  const attributeDetails = selectedAttribute ? ATTRIBUTE_DESCRIPTIONS[selectedAttribute] : null;

  return (
    <>
      <Card className="p-4 bg-gradient-to-br from-secondary/30 to-secondary/10 border-primary/20">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-center text-muted-foreground">Companion Attributes</h3>
          
          <div className="space-y-3">
            {attributes.map(({ key, value }) => {
              const info = ATTRIBUTE_INFO[key];
              const Icon = info.icon;
              
              return (
                <button
                  key={key}
                  onClick={() => setSelectedAttribute(key)}
                  className="w-full space-y-1.5 cursor-pointer hover:opacity-80 transition-opacity text-left"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${info.color}`} />
                      <span className="font-medium">{info.label}</span>
                    </div>
                    <span className="text-muted-foreground font-mono">{value}/100</span>
                  </div>
                  <Progress 
                    value={value} 
                    className="h-1.5"
                  />
                </button>
              );
            })}
          </div>
          
          <p className="text-[10px] text-center text-muted-foreground/70 italic">
            Tap an attribute to learn more
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
                <h4 className="font-semibold text-foreground mb-2">Boosted by habits like:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  {attributeDetails.boostedBy.map((habit, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{habit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t">
                <h4 className="font-semibold text-foreground mb-1">When this grows:</h4>
                <p className="text-muted-foreground italic">{attributeDetails.whenGrows}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};