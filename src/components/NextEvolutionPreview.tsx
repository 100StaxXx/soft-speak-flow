import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp } from "lucide-react";
import { AttributeTooltip } from "./AttributeTooltip";
import { getStageName } from "@/config/companionStages";

interface NextEvolutionPreviewProps {
  currentStage: number;
  currentXP: number;
  nextEvolutionXP: number;
  progressPercent: number;
}

const XP_TIPS = [
  { action: "Complete a habit", xp: "5-20 XP", icon: "✓" },
  { action: "Finish all daily habits", xp: "+10 XP bonus", icon: "🎯" },
  { action: "Complete daily missions", xp: "5-30 XP each", icon: "⚡" },
  { action: "Weekly challenge day", xp: "20 XP", icon: "💪" },
  { action: "Streak milestones", xp: "15 XP", icon: "🔥" },
];

export const NextEvolutionPreview = ({
  currentStage,
  currentXP,
  nextEvolutionXP,
  progressPercent,
}: NextEvolutionPreviewProps) => {
  const nextStage = Math.min(currentStage + 1, 20);
  const nextStageName = getStageName(nextStage);
  const xpNeeded = nextEvolutionXP - currentXP;
  const isMaxStage = currentStage >= 20;

  if (isMaxStage) {
    return (
      <Card className="p-5 bg-gradient-to-br from-accent/10 via-card to-primary/10 border-accent/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm">Maximum Evolution!</h3>
            <p className="text-xs text-muted-foreground">
              Your companion has reached its final form
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-gradient-to-br from-primary/10 via-card to-accent/10 border-primary/30 hover:border-primary/50 transition-all duration-300">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="font-heading font-bold text-sm">Next Evolution</h3>
              <AttributeTooltip 
                title="Stage" 
                description="Your companion's evolution progress"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {nextStageName}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-primary">
              {xpNeeded} XP needed
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {currentXP} / {nextEvolutionXP} XP
          </p>
        </div>

        {/* XP Tips */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground">Quick XP Tips:</p>
          <div className="space-y-1.5">
            {XP_TIPS.slice(0, 3).map((tip, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span>{tip.icon}</span>
                  {tip.action}
                </span>
                <span className="font-medium text-primary">{tip.xp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
