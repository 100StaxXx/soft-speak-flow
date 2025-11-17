import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { useState, useEffect } from "react";

const STAGE_NAMES = {
  0: "Mysterious Egg",
  1: "Sparkling Egg",
  2: "Young Hatchling",
  3: "Noble Guardian",
  4: "Ascended Form",
  5: "Mythic Being",
  6: "Eternal Titan",
};

export const CompanionDisplay = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { companion, nextEvolutionXP, progressToNext, evolveCompanion } = useCompanion();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<{ stage: number; imageUrl: string } | null>(null);

  // Listen for evolution events
  useEffect(() => {
    if (!evolveCompanion.isSuccess || !evolveCompanion.data) return;
    
    setEvolutionData({
      stage: evolveCompanion.data.current_stage,
      imageUrl: evolveCompanion.data.current_image_url || "",
    });
    setIsEvolving(true);
  }, [evolveCompanion.isSuccess, evolveCompanion.data]);

  if (!companion) {
    return null;
  }

  const stageName = STAGE_NAMES[companion.current_stage as keyof typeof STAGE_NAMES] || "Unknown";

  return (
    <>
      <CompanionEvolution
        isEvolving={isEvolving}
        newStage={evolutionData?.stage || 0}
        newImageUrl={evolutionData?.imageUrl || ""}
        mentorSlug={profile?.selected_mentor_id}
        userId={user?.id}
        onComplete={() => {
          setIsEvolving(false);
          setEvolutionData(null);
        }}
      />

      <Card className="relative overflow-hidden shadow-glow border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-glow-lg animate-scale-in">
      {/* Background gradient based on element */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
      
      <div className="relative p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              Your Companion
            </h3>
            <p className="text-sm text-muted-foreground">{stageName}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl md:text-3xl font-heading font-black text-primary">
              Stage {companion.current_stage}
            </div>
            <div className="text-xs text-muted-foreground">
              {companion.spirit_animal}
            </div>
          </div>
        </div>

        {/* Companion Image */}
        <div className="flex justify-center">
          {companion.current_image_url ? (
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-300 animate-pulse" />
              <img
                src={companion.current_image_url}
                alt={`${stageName} companion`}
                className="relative max-w-full h-auto max-h-64 rounded-2xl shadow-glow transition-all duration-700 group-hover:scale-105 animate-[breathe_4s_ease-in-out_infinite]"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse flex items-center justify-center">
              <Sparkles className="h-16 w-16 text-primary animate-pulse" />
            </div>
          )}
        </div>

        {/* XP Progress */}
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              Stage {companion.current_stage} • {companion.current_xp} / {nextEvolutionXP || '∞'} XP
            </div>
          </div>
          {nextEvolutionXP && (
            <div className="relative">
              <Progress value={progressToNext} className="h-3" />
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="h-full w-full bg-gradient-shimmer animate-shimmer" />
              </div>
            </div>
          )}
          
          {/* Dynamic micro-prompt */}
          <div className="text-center">
            {nextEvolutionXP && (nextEvolutionXP - companion.current_xp) <= 15 ? (
              <p className="text-sm font-medium text-primary animate-pulse">
                Your companion is close to evolving...
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {companion.current_xp % 2 === 0
                  ? "Do your habits to feed your companion."
                  : "Complete a challenge to accelerate evolution."}
              </p>
            )}
          </div>
        </div>

        {/* Traits */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Color</div>
            <div 
              className="w-10 h-10 rounded-full mx-auto border-2 border-border shadow-soft transition-transform hover:scale-110"
              style={{ backgroundColor: companion.favorite_color }}
            />
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Animal</div>
            <div className="font-bold text-sm">{companion.spirit_animal}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Element</div>
            <div className="font-bold text-sm">{companion.core_element}</div>
          </div>
        </div>
      </div>
    </Card>
    </>
  );
};