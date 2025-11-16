import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MoodSelector } from "./MoodSelector";
import { Sunrise, Target, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { useAchievements } from "@/hooks/useAchievements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const MorningCheckIn = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const personality = useMentorPersonality();
  const queryClient = useQueryClient();
  const { checkAndAwardAchievement } = useAchievements();
  const [mood, setMood] = useState<string>("");
  const [intention, setIntention] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data: existingCheckIn } = useQuery({
    queryKey: ['morning-check-in', today, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('daily_check_ins')
        .select('*')
        .eq('user_id', user.id)
        .eq('check_in_type', 'morning')
        .eq('check_in_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const submitCheckIn = async () => {
    if (!user || !mood || !intention.trim()) {
      toast({ title: "Please complete all fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: checkIn, error } = await supabase
        .from('daily_check_ins')
        .upsert({
          user_id: user.id,
          check_in_type: 'morning',
          check_in_date: today,
          mood,
          intention: intention.trim(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Generate mentor response in background
      supabase.functions.invoke('generate-check-in-response', {
        body: { checkInId: checkIn.id }
      });

      // Check for morning warrior achievement (7 check-ins)
      const { count } = await supabase
        .from('daily_check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('check_in_type', 'morning')
        .not('completed_at', 'is', null);

      if (count === 7) {
        await checkAndAwardAchievement('morning_warrior', { check_in_count: count });
      }

      queryClient.invalidateQueries({ queryKey: ['morning-check-in'] });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save check-in", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (existingCheckIn?.completed_at) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sunrise className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-bold text-lg">Morning Check-in Complete</h3>
              <p className="text-sm text-muted-foreground">Focus: {existingCheckIn.intention}</p>
            </div>
            {existingCheckIn.mentor_response && (
              <div className="bg-secondary/50 rounded-lg p-4 border-l-2 border-primary">
                <p className="text-sm italic">{existingCheckIn.mentor_response}</p>
                <p className="text-xs text-muted-foreground mt-2">— {personality?.name}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Sunrise className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-bold text-lg">Morning Check-in</h3>
            <p className="text-sm text-muted-foreground">
              {personality?.name} wants to know: How are we starting today?
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">How are you feeling?</label>
            <MoodSelector selected={mood} onSelect={setMood} />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              What's your main focus today?
            </label>
            <Textarea
              placeholder="I will..."
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <Button 
            onClick={submitCheckIn} 
            disabled={isSubmitting || !mood || !intention.trim()}
            className="w-full"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {personality?.buttonText("Start My Day") || "Start My Day"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
