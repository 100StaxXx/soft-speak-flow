import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useAchievements } from "@/hooks/useAchievements";
import { Textarea } from "@/components/ui/textarea";
import { MoodSelector } from "./MoodSelector";
import { Sunrise, Target, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MentorAvatar } from "@/components/MentorAvatar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CheckInErrorFallback } from "@/components/ErrorFallback";

const MorningCheckInContent = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const personality = useMentorPersonality();
  const queryClient = useQueryClient();
  const { awardCheckInComplete, XP_REWARDS } = useXPRewards();
  const { checkFirstTimeAchievements } = useAchievements();
  const [mood, setMood] = useState<string>("");
  const [intention, setIntention] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollStartTime, setPollStartTime] = useState<number | null>(null);

  const today = new Date().toLocaleDateString('en-CA');
  const MAX_POLL_DURATION = 30000; // 30 seconds max polling

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
    // Poll every 2 seconds if check-in exists but mentor response is still pending
    refetchInterval: (data) => {
      if (data?.completed_at && !data?.mentor_response) {
        // Check if we've exceeded max poll duration
        if (pollStartTime && Date.now() - pollStartTime > MAX_POLL_DURATION) {
          console.warn('Mentor response polling timeout exceeded');
          return false; // Stop polling after 30 seconds
        }
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling once we have the response
    },
  });

  const submitCheckIn = async () => {
    if (!user || !mood || !intention.trim()) {
      toast({ title: "Please complete all fields", variant: "destructive" });
      return;
    }

    // Prevent duplicate submissions
    if (existingCheckIn || isSubmitting) {
      toast({ 
        title: "Already checked in", 
        description: "You've already completed your check-in today",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Double-check right before insert (cache could be stale)
      const { data: recentCheck } = await supabase
        .from('daily_check_ins')
        .select('id')
        .eq('user_id', user.id)
        .eq('check_in_type', 'morning')
        .eq('check_in_date', today)
        .maybeSingle();

      if (recentCheck) {
        toast({ 
          title: "Already checked in", 
          description: "You've already completed your check-in today",
          variant: "destructive" 
        });
        setIsSubmitting(false);
        queryClient.invalidateQueries({ queryKey: ['morning-check-in'] });
        return;
      }

      const { data: checkIn, error } = await supabase
        .from('daily_check_ins')
        .insert({
          user_id: user.id,
          check_in_type: 'morning',
          check_in_date: today,
          mood,
          intention: intention.trim(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Check-in error:', error);
        throw error;
      }

      // Award XP only on successful INSERT (not update)
      awardCheckInComplete();
      
      // Check for first check-in achievement
      const { count } = await supabase
        .from('daily_check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (count === 1) {
        await checkFirstTimeAchievements('checkin');
      }

      // Start polling timer
      setPollStartTime(Date.now());

      // Generate mentor response in background with error handling
      try {
        const { error: invocationError } = await supabase.functions.invoke('generate-check-in-response', {
          body: { checkInId: checkIn.id }
        });
        
        if (invocationError) {
          console.error('Edge function invocation error:', invocationError);
          // Don't block the UI - mentor response is optional
        }
      } catch (error) {
        console.error('Edge function invocation failed:', error);
        // Don't block the UI - mentor response is optional
      }

      queryClient.invalidateQueries({ queryKey: ['morning-check-in'] });
    } catch (error) {
      console.error('Check-in save error:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to save check-in", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (existingCheckIn?.completed_at) {
    return (
      <Card data-tour="morning-checkin" className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sunrise className="h-6 w-6 text-orange-500" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-bold text-lg">Check-in Complete</h3>
              <p className="text-sm text-muted-foreground">Focus: {existingCheckIn.intention}</p>
            </div>
            
            {/* Mentor Response Section */}
            {personality && (
              <div className="bg-gradient-to-br from-secondary/50 to-accent/5 rounded-lg p-4 border border-primary/10">
                <div className="flex items-start gap-3">
                  <MentorAvatar
                    mentorSlug={(personality.slug || '').toLowerCase()}
                    mentorName={personality.name}
                    primaryColor={personality.primary_color || '#000'}
                    avatarUrl={personality.avatar_url || undefined}
                    size="sm"
                    className="flex-shrink-0"
                    showBorder={true}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{personality.name}</p>
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                    {existingCheckIn.mentor_response ? (
                      <p className="text-sm italic text-foreground/90 leading-relaxed">
                        "{existingCheckIn.mentor_response}"
                      </p>
                    ) : pollStartTime && Date.now() - pollStartTime > MAX_POLL_DURATION ? (
                      <p className="text-sm text-foreground/80 italic leading-relaxed">
                        "Great work on setting your intention today. Stay focused and crush it."
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Preparing your personalized message...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card data-tour="morning-checkin" className="p-5 md:p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 hover:border-primary/30 transition-all duration-300 animate-scale-in">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sunrise className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-heading font-black text-2xl md:text-3xl text-[hsl(30,100%,60%)]">CHECK-IN</h3>
          </div>
        </div>

        <div className="space-y-4">
          <div data-tour="checkin-mood">
            <label className="text-sm font-bold mb-2 block">How are you feeling?</label>
            <MoodSelector selected={mood} onSelect={setMood} />
          </div>

          <div data-tour="checkin-intention">
            <label className="text-sm font-bold mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              What's your main focus today?
            </label>
            <Textarea
              placeholder="I will..."
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              rows={3}
              className="resize-none transition-all duration-200 focus:shadow-glow"
            />
          </div>

          <Button 
            onClick={submitCheckIn} 
            disabled={isSubmitting || !mood || !intention.trim() || !!existingCheckIn}
            variant="cta"
            className="w-full h-12"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                Setting Intention...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {personality?.buttonText("Start My Day") || "Start My Day"} (+{XP_REWARDS.CHECK_IN} XP)
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export const MorningCheckIn = () => (
  <ErrorBoundary fallback={<CheckInErrorFallback />}>
    <MorningCheckInContent />
  </ErrorBoundary>
);
