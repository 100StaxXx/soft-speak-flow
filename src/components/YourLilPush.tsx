import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface YourLilPushProps {
  mood: string | null;
  push: {
    quote: string;
    mini_pep_talk: string;
    audio_url?: string | null;
    image_url?: string | null;
  } | null;
  isLoading: boolean;
}

export function YourLilPush({ mood, push, isLoading }: YourLilPushProps) {
  if (!mood && !push) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Tap how you feel to get a lil push.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">Getting your push...</p>
      </Card>
    );
  }

  if (!push) return null;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-sm text-muted-foreground mb-2">Your Lil Push</h3>
        <p className="text-xs text-primary font-medium">{mood}</p>
      </div>
      
      <blockquote className="text-2xl font-heading leading-tight">
        "{push.quote}"
      </blockquote>
      
      <p className="text-foreground/90 leading-relaxed">
        {push.mini_pep_talk}
      </p>
    </Card>
  );
}