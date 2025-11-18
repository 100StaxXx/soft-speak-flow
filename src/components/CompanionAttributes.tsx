import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, Target, Scale, Zap } from "lucide-react";
import { Companion } from "@/hooks/useCompanion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    description: "Grows with daily activity. Higher energy means a more vibrant companion!",
    color: "text-yellow-500",
  },
  resilience: {
    icon: Shield,
    label: "Resilience",
    description: "Develops from maintaining streaks and overcoming challenges.",
    color: "text-blue-500",
  },
  focus: {
    icon: Target,
    label: "Focus",
    description: "Strengthens by completing habits and missions consistently.",
    color: "text-purple-500",
  },
  balance: {
    icon: Scale,
    label: "Balance",
    description: "Cultivated through check-ins, reflections, and self-awareness.",
    color: "text-green-500",
  },
};

export const CompanionAttributes = ({ companion }: CompanionAttributesProps) => {
  const attributes = [
    { key: 'energy', value: companion.energy ?? 100 },
    { key: 'resilience', value: companion.resilience ?? 0 },
    { key: 'focus', value: companion.focus ?? 0 },
    { key: 'balance', value: companion.balance ?? 0 },
  ] as const;

  return (
    <Card className="p-4 bg-gradient-to-br from-secondary/30 to-secondary/10 border-primary/20">
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-center text-muted-foreground">Companion Attributes</h3>
        
        <TooltipProvider>
          <div className="space-y-3">
            {attributes.map(({ key, value }) => {
              const info = ATTRIBUTE_INFO[key];
              const Icon = info.icon;
              
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div className="space-y-1.5 cursor-help">
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
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">{info.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </Card>
  );
};