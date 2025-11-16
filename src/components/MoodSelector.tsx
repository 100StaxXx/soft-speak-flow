import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Smile, Meh, Frown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Mood = "good" | "neutral" | "tough";

export const MoodSelector = () => {
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);

  const moods: { value: Mood; icon: any; label: string }[] = [
    { value: "good", icon: Smile, label: "Good" },
    { value: "neutral", icon: Meh, label: "Okay" },
    { value: "tough", icon: Frown, label: "Tough" },
  ];

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
      
      // Reset form after short delay to show AI reply
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
    <Card className="p-6 bg-card border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">How was your day?</h3>
      
      <div className="flex gap-3 mb-4">
        {moods.map(({ value, icon: Icon, label }) => (
          <Button
            key={value}
            variant={selectedMood === value ? "default" : "outline"}
            className="flex-1 flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => setSelectedMood(value)}
          >
            <Icon className="w-6 h-6" />
            <span className="text-sm">{label}</span>
          </Button>
        ))}
      </div>

      {selectedMood && (
        <>
          <Textarea
            placeholder="Add a note (optional)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mb-4 bg-background border-border text-foreground"
            rows={3}
          />
          
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Reflection"}
          </Button>
        </>
      )}

      {aiReply && (
        <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-1">A little something for you:</p>
          <p className="text-foreground">{aiReply}</p>
        </div>
      )}
    </Card>
  );
};
