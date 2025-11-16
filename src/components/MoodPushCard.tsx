import { Card } from "./ui/card";
import { Sparkles } from "lucide-react";

interface MoodPushCardProps {
  selectedMood: string | null;
  pushData: {
    quote: string;
    mini_pep_talk: string;
    audio_url: string | null;
    image_url: string | null;
  } | null;
  isLoading: boolean;
}

export function MoodPushCard({ selectedMood, pushData, isLoading }: MoodPushCardProps) {
  if (!selectedMood && !pushData) {
    return (
      <Card className="p-8 text-center border-dashed">
        <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-muted-foreground">
          Tap how you feel to get a lil push.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-20 bg-muted rounded"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (!pushData) return null;

  return (
    <Card className="p-6 space-y-4 bg-gradient-to-br from-card to-accent/20">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-heading text-foreground">Your Lil Push</h3>
      </div>
      
      {selectedMood && (
        <div className="text-sm text-muted-foreground">
          {selectedMood} → Time to move
        </div>
      )}
      
      <blockquote className="text-xl font-heading text-foreground leading-relaxed border-l-4 border-primary pl-4">
        "{pushData.quote}"
      </blockquote>
      
      <p className="text-foreground/90 leading-relaxed">
        {pushData.mini_pep_talk}
      </p>
      
      {pushData.audio_url && (
        <button className="text-sm text-primary hover:underline">
          ▶ Play Audio
        </button>
      )}
    </Card>
  );
}