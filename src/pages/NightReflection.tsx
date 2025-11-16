import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Smile, Meh, Frown, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mood = "good" | "neutral" | "tough";

export default function NightReflection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todaysReflection, setTodaysReflection] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTodaysReflection();
  }, [user]);

  const loadTodaysReflection = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from("user_reflections")
      .select("*")
      .eq("user_id", user.id)
      .eq("reflection_date", today)
      .maybeSingle();

    setTodaysReflection(data);
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !mood) return;

    setIsSubmitting(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data: reflection, error } = await supabase
        .from("user_reflections")
        .upsert({
          user_id: user.id,
          reflection_date: today,
          mood,
          note: note.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger AI reply generation in background
      if (reflection) {
        supabase.functions.invoke("generate-reflection-reply", {
          body: { 
            reflection_id: reflection.id,
            mood,
            note: note.trim() || null
          }
        }).then(({ error }) => {
          if (error) console.error("Error generating AI reply:", error);
        });
      }

      toast.success("Nice work. You checked in for today.");
      setTodaysReflection(reflection);
    } catch (error: any) {
      console.error("Error saving reflection:", error);
      toast.error("Failed to save reflection");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (todaysReflection) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Card className="p-8">
            <h1 className="text-3xl font-heading mb-2">Today's Reflection</h1>
            <p className="text-muted-foreground mb-6">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>

            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Your mood:</p>
                <div className="flex gap-2">
                  {todaysReflection.mood === "good" && (
                    <div className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 flex items-center gap-2">
                      <Smile className="w-5 h-5" />
                      <span>Good</span>
                    </div>
                  )}
                  {todaysReflection.mood === "neutral" && (
                    <div className="px-4 py-2 rounded-lg bg-muted text-foreground flex items-center gap-2">
                      <Meh className="w-5 h-5" />
                      <span>Neutral</span>
                    </div>
                  )}
                  {todaysReflection.mood === "tough" && (
                    <div className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 flex items-center gap-2">
                      <Frown className="w-5 h-5" />
                      <span>Tough</span>
                    </div>
                  )}
                </div>
              </div>

              {todaysReflection.note && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Your note:</p>
                  <p className="text-foreground">{todaysReflection.note}</p>
                </div>
              )}

              {todaysReflection.ai_reply && (
                <div className="border-t pt-6">
                  <p className="text-sm text-muted-foreground mb-2">A Lil Push says:</p>
                  <p className="text-foreground font-medium">{todaysReflection.ai_reply}</p>
                </div>
              )}

              <Button onClick={() => navigate("/")} className="w-full">
                Back to Home
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container max-w-2xl mx-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <Card className="p-8">
          <h1 className="text-3xl font-heading mb-2">Night Reflection</h1>
          <p className="text-muted-foreground mb-8">How did today feel?</p>

          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setMood("good")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  mood === "good"
                    ? "border-green-500 bg-green-500/20"
                    : "border-border hover:border-green-500/50"
                }`}
              >
                <Smile className="w-12 h-12 mx-auto mb-2 text-green-400" />
                <p className="font-medium">Good</p>
              </button>

              <button
                onClick={() => setMood("neutral")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  mood === "neutral"
                    ? "border-foreground bg-muted"
                    : "border-border hover:border-foreground/50"
                }`}
              >
                <Meh className="w-12 h-12 mx-auto mb-2" />
                <p className="font-medium">Neutral</p>
              </button>

              <button
                onClick={() => setMood("tough")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  mood === "tough"
                    ? "border-red-500 bg-red-500/20"
                    : "border-border hover:border-red-500/50"
                }`}
              >
                <Frown className="w-12 h-12 mx-auto mb-2 text-red-400" />
                <p className="font-medium">Tough</p>
              </button>
            </div>

            {mood && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Anything you want to get off your chest?
                  </label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional..."
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Finish Check-In"
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}