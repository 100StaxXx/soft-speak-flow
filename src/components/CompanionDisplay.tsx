import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { CompanionSkeleton } from "@/components/CompanionSkeleton";
import { AttributeTooltip } from "@/components/AttributeTooltip";
import { CompanionAttributes } from "@/components/CompanionAttributes";
import { CompanionBadge } from "@/components/CompanionBadge";
import { useState, useEffect } from "react";

// Convert hex color to color name
const getColorName = (hexColor: string): string => {
  const colorMap: Record<string, string> = {
    '#FF0000': 'Red', '#FF4500': 'Orange Red', '#FF6347': 'Tomato',
    '#FFA500': 'Orange', '#FFD700': 'Gold', '#FFFF00': 'Yellow',
    '#00FF00': 'Lime', '#00FA9A': 'Spring Green', '#008000': 'Green',
    '#00FFFF': 'Cyan', '#00CED1': 'Turquoise', '#4169E1': 'Royal Blue',
    '#0000FF': 'Blue', '#000080': 'Navy', '#4B0082': 'Indigo',
    '#9370DB': 'Purple', '#8B008B': 'Dark Magenta', '#FF00FF': 'Magenta',
    '#FF1493': 'Deep Pink', '#FF69B4': 'Hot Pink', '#FFC0CB': 'Pink',
    '#FFFFFF': 'White', '#C0C0C0': 'Silver', '#808080': 'Gray',
    '#000000': 'Black', '#A52A2A': 'Brown', '#D2691E': 'Chocolate',
  };

  // Direct match
  const upperHex = hexColor.toUpperCase();
  if (colorMap[upperHex]) return colorMap[upperHex];

  // Convert hex to RGB for color detection
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Determine dominant color channel
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  // Grayscale
  if (max - min < 30) {
    if (max > 200) return 'White';
    if (max > 150) return 'Light Gray';
    if (max > 100) return 'Gray';
    if (max > 50) return 'Dark Gray';
    return 'Black';
  }

  // Color detection
  if (r === max) {
    if (g > b) return g > 150 ? 'Yellow' : 'Orange';
    return r > 150 ? 'Red' : 'Dark Red';
  } else if (g === max) {
    if (r > b) return 'Yellow Green';
    return g > 150 ? 'Green' : 'Dark Green';
  } else {
    if (r > g) return b > 150 ? 'Purple' : 'Dark Purple';
    return b > 150 ? 'Blue' : 'Dark Blue';
  }
};

const STAGE_NAMES = {
  0: "Dormant Egg",
  1: "Cracking Awakening",
  2: "Newborn Emergence",
  3: "Early Infant Form",
  4: "Juvenile Form",
  5: "Young Explorer",
  6: "Adolescent Guardian",
  7: "Initiate Protector",
  8: "Seasoned Guardian",
  9: "Mature Protector",
  10: "Veteran Form",
  11: "Elevated Form",
  12: "Ascended Form",
  13: "Ether-Born Avatar",
  14: "Primordial Aspect",
  15: "Colossus Form",
  16: "Cosmic Guardian",
  17: "Astral Overlord",
  18: "Universal Sovereign",
  19: "Mythic Apex",
  20: "Origin of Creation",
};

export const CompanionDisplay = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { companion, nextEvolutionXP, progressToNext, evolveCompanion, isLoading, error } = useCompanion();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<{ stage: number; imageUrl: string } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!evolveCompanion.isSuccess || !evolveCompanion.data) return;
    setEvolutionData({
      stage: evolveCompanion.data.current_stage,
      imageUrl: evolveCompanion.data.current_image_url || "",
    });
    setIsEvolving(true);
  }, [evolveCompanion.isSuccess, evolveCompanion.data]);

  if (isLoading) return <CompanionSkeleton />;
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
        
        <div className="relative p-6 space-y-6">
          {/* Stage Badge */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <h2 className={`text-3xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent ${!prefersReducedMotion ? 'animate-gradient' : ''}`}>
                  {stageName}
                </h2>
                <AttributeTooltip title="Stage" description="Your companion's evolution stage" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Stage {companion.current_stage}
              </p>
            </div>
            <div className={`h-14 w-14 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shadow-glow ${!prefersReducedMotion ? 'animate-pulse' : ''}`} aria-hidden="true">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          </div>

          {/* Companion Image */}
          <div className="flex justify-center py-8 relative group">
            {/* Body-based glow effect */}
            <div 
              className={`absolute inset-0 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 ${prefersReducedMotion ? 'animate-none' : ''}`}
              style={{
                background: `radial-gradient(circle, hsl(var(--primary) / ${(companion.body ?? 100) / 200}), hsl(var(--accent) / ${(companion.body ?? 100) / 200}), transparent)`,
              }}
              aria-hidden="true" 
            />
            <div className={`absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 ${prefersReducedMotion ? 'animate-none' : ''}`} aria-hidden="true" />
            <div className="relative">
              <div className={`absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-2xl blur-xl ${!prefersReducedMotion ? 'animate-[breathe_4s_ease-in-out_infinite]' : ''}`} aria-hidden="true" />
              {!imageLoaded && !imageError && (
                <div className="relative w-64 h-64 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse flex items-center justify-center" role="status" aria-label="Loading companion image">
                  <Sparkles className="h-12 w-12 text-primary/50 animate-spin" />
                </div>
              )}
              {imageError && (
                <div className="relative w-64 h-64 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center border-2 border-destructive/30" role="alert">
                  <div className="text-center p-4">
                    <p className="text-sm text-muted-foreground mb-2">Image unavailable</p>
                    <button 
                      onClick={() => {
                        setImageError(false);
                        setImageLoaded(false);
                      }}
                      className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                      aria-label="Try again"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
              <img
                src={companion.current_image_url || ""}
                alt={`${stageName} companion at stage ${companion.current_stage}`}
                className={`relative w-64 h-64 object-cover rounded-2xl shadow-2xl ring-4 ring-primary/30 transition-transform duration-300 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageError(true);
                  setImageLoaded(false);
                }}
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-center mb-3">
              <CompanionBadge 
                element={companion.core_element} 
                stage={companion.current_stage}
                showStage={true}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2" id="xp-progress-label">
                {companion.current_xp} / {nextEvolutionXP} XP to next evolution
              </p>
              <Progress 
                value={progressToNext} 
                className="h-3 rounded-full shadow-inner" 
                aria-labelledby="xp-progress-label"
                aria-valuenow={companion.current_xp}
                aria-valuemin={0}
                aria-valuemax={nextEvolutionXP}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 hover:border-primary/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Color</p>
                <p className="font-medium text-sm">{getColorName(companion.favorite_color)}</p>
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

          {/* Companion Attributes */}
          <CompanionAttributes companion={{ 
            body: companion.body, 
            mind: companion.mind,
            soul: companion.soul
          }} />
        </div>
      </Card>
    </>
  );
};
