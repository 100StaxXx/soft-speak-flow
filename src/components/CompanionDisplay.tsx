import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";

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
    <Card className="relative overflow-hidden">
      {/* Background gradient based on element */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
      
      <div className="relative p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Your Companion
            </h3>
            <p className="text-sm text-muted-foreground">{stageName}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
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
            <div className="relative">
              <img
                src={companion.current_image_url}
                alt={`${stageName} companion`}
                className="max-w-full h-auto max-h-64 rounded-lg shadow-glow"
              />
              <div 
                className="absolute inset-0 rounded-lg opacity-30 blur-xl"
                style={{ backgroundColor: companion.favorite_color }}
              />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-lg bg-muted animate-pulse flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* XP Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Experience: {companion.current_xp} XP
            </span>
            {nextEvolutionXP && (
              <span className="font-medium text-primary">
                Next: {nextEvolutionXP} XP
              </span>
            )}
          </div>
          {nextEvolutionXP && (
            <Progress value={progressToNext} className="h-2" />
          )}
        </div>

        {/* Traits */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Color</div>
            <div 
              className="w-8 h-8 rounded-full mx-auto mt-1 border-2 border-border"
              style={{ backgroundColor: companion.favorite_color }}
            />
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Animal</div>
            <div className="font-medium mt-1 text-sm">{companion.spirit_animal}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Element</div>
            <div className="font-medium mt-1 text-sm">{companion.core_element}</div>
          </div>
        </div>
      </div>
    </Card>
    </>
  );
};