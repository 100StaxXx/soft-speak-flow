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

  useEffect(() => {
    if (!evolveCompanion.isSuccess || !evolveCompanion.data) return;
    setEvolutionData({
      stage: evolveCompanion.data.current_stage,
      imageUrl: evolveCompanion.data.current_image_url || "",
    });
    setIsEvolving(true);
  }, [evolveCompanion.isSuccess, evolveCompanion.data]);

  if (!companion) return null;

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

      <Card className="relative overflow-hidden shadow-glow-lg border-primary/40 hover:border-primary/70 transition-all duration-500 hover:shadow-neon animate-scale-in bg-gradient-to-br from-card via-card to-secondary/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,hsl(var(--accent)/0.15),transparent_50%)]" />
        
        <div className="relative p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl md:text-2xl font-heading font-black flex items-center gap-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                <Sparkles className="h-6 w-6 text-primary animate-pulse drop-shadow-[0_0_8px_hsl(var(--primary))]" />
                Your Companion
              </h3>
              <p className="text-sm md:text-base text-muted-foreground font-medium mt-1">{stageName}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl md:text-4xl font-heading font-black bg-gradient-to-br from-primary via-accent to-primary bg-clip-text text-transparent drop-shadow-lg">
                Stage {companion.current_stage}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground font-medium mt-1">
                {companion.spirit_animal}
              </div>
            </div>
          </div>

          <div className="flex justify-center py-4">
            {companion.current_image_url ? (
              <div className="relative group">
                <div className="absolute -inset-3 bg-gradient-to-r from-primary via-accent to-primary rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-all duration-500 animate-pulse" />
                <div className="absolute -inset-2 bg-gradient-to-r from-accent via-primary to-accent rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-all duration-500" />
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-2xl blur opacity-50 group-hover:opacity-75 transition-all duration-300" />
                <img
                  src={companion.current_image_url}
                  alt={`${stageName} companion`}
                  className="relative max-w-full h-auto max-h-80 md:max-h-96 rounded-2xl shadow-glow-lg transition-all duration-700 group-hover:scale-105 group-hover:shadow-neon animate-[breathe_4s_ease-in-out_infinite] border-2 border-primary/20"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20 animate-pulse flex items-center justify-center shadow-glow-lg">
                <Sparkles className="h-20 w-20 md:h-24 md:w-24 text-primary animate-pulse drop-shadow-[0_0_12px_hsl(var(--primary))]" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {companion.current_xp} / {nextEvolutionXP} XP to next evolution
              </p>
              <Progress value={progressToNext} className="h-3 rounded-full shadow-inner" />
            </div>
            
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 hover:border-primary/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Color</p>
                <p className="font-medium text-sm capitalize">{companion.favorite_color}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-accent/5 to-primary/5 border border-accent/10 hover:border-accent/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Spirit</p>
                <p className="font-medium text-sm capitalize">{companion.spirit_animal}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 hover:border-primary/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Element</p>
                <p className="font-medium text-sm capitalize">{companion.core_element}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};
