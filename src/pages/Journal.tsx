import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { Brain, Zap, Battery, Flame, Smile, Target, Focus, Sparkles } from "lucide-react";

type MoodType = "unmotivated" | "overthinking" | "stressed" | "low_energy" | "content" | "disciplined" | "focused" | "inspired";

const moods = [
  { value: "unmotivated" as MoodType, label: "Unmotivated", icon: Battery, gradient: "from-slate-500 to-slate-600" },
  { value: "overthinking" as MoodType, label: "Overthinking", icon: Brain, gradient: "from-purple-500 to-purple-600" },
  { value: "stressed" as MoodType, label: "Stressed", icon: Zap, gradient: "from-red-500 to-red-600" },
  { value: "low_energy" as MoodType, label: "Low Energy", icon: Battery, gradient: "from-gray-500 to-gray-600" },
  { value: "content" as MoodType, label: "Content", icon: Smile, gradient: "from-green-500 to-green-600" },
  { value: "disciplined" as MoodType, label: "Disciplined", icon: Target, gradient: "from-blue-500 to-blue-600" },
  { value: "focused" as MoodType, label: "Focused", icon: Focus, gradient: "from-indigo-500 to-indigo-600" },
  { value: "inspired" as MoodType, label: "Inspired", icon: Flame, gradient: "from-orange-500 to-orange-600" },
];

export default function Journal() {
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedMood || !user) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Insert reflection
      const { data: reflection, error: insertError } = await supabase
        .from("user_reflections")
        .insert({
          user_id: user.id,
          mood: selectedMood,
          note: note.trim() || null,
          reflection_date: today,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Generate AI reply
      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        "generate-reflection-reply",
        {
          body: {
            reflectionId: reflection.id,
            mood: selectedMood,
            note: note.trim() || null,
          },
        }
      );

      if (aiError) throw aiError;

      setAiReply(aiData.ai_reply);
      toast.success("Reflection saved!");
      
      // Reset form after showing AI reply
      setTimeout(() => {
        setSelectedMood(null);
        setNote("");
        setAiReply(null);
      }, 8000);
    } catch (error) {
      console.error("Error saving reflection:", error);
      toast.error("Failed to save reflection");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold text-foreground">Journal</h1>
          <p className="text-muted-foreground">How are you feeling today?</p>
        </div>

        <Card className="p-6 bg-card border-border">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {moods.map(({ value, label, icon: Icon, gradient }) => (
              <Button
                key={value}
                variant={selectedMood === value ? "default" : "outline"}
                className={`flex flex-col items-center gap-2 h-auto py-6 ${
                  selectedMood === value 
                    ? `bg-gradient-to-br ${gradient} text-white border-0` 
                    : "bg-card hover:bg-accent"
                }`}
                onClick={() => setSelectedMood(value)}
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm font-medium">{label}</span>
              </Button>
            ))}
          </div>

          {selectedMood && (
            <div className="space-y-4">
              <Textarea
                placeholder="Add a note about your day (optional)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-background border-border text-foreground min-h-[120px]"
                rows={5}
              />
              
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                size="lg"
              >
                {isSubmitting ? "Saving..." : "Save Reflection"}
              </Button>
            </div>
          )}

          {aiReply && (
            <div className="mt-6 p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg border border-primary/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary mb-2">A little something for you</p>
                  <p className="text-foreground leading-relaxed">{aiReply}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
