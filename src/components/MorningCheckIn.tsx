import { useState, useRef } from "react";
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
import { logger } from "@/utils/logger";

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
  // Use ref for pollStartTime to avoid stale closure in refetchInterval callback
  const pollStartTimeRef = useRef<number | null>(null);

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
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.completed_at && !data?.mentor_response) {
        // Check if we've exceeded max poll duration (use ref to avoid stale closure)
        const startTime = pollStartTimeRef.current;
        if (startTime && Date.now() - startTime > MAX_POLL_DURATION) {
          logger.warn('Mentor response polling timeout exceeded');
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
        logger.error('Check-in error:', error);
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

      // Trigger astral encounter check
      window.dispatchEvent(new CustomEvent('quest-completed'));

      // Start polling timer (using ref to avoid stale closure)
      pollStartTimeRef.current = Date.now();

      // Generate mentor response in background with error handling
      try {
        const { error: invocationError } = await supabase.functions.invoke('generate-check-in-response', {
          body: { checkInId: checkIn.id }
        });
        
        if (invocationError) {
          logger.error('Edge function invocation error:', invocationError);
          // Don't block the UI - mentor response is optional
        }
      } catch (error) {
        logger.error('Edge function invocation failed:', error);
        // Don't block the UI - mentor response is optional
      }

      queryClient.invalidateQueries({ queryKey: ['morning-check-in'] });
    } catch (error) {
      logger.error('Check-in save error:', error);
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
      <Card data-tour="morning-checkin" className="p-6 bg-card/25 backdrop-blur-2xl border-celestial-blue/20">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-stardust-gold/20 flex items-center justify-center flex-shrink-0 ring-2 ring-stardust-gold/30">
            <Sunrise className="h-6 w-6 text-stardust-gold" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-bold text-lg">Check-in Complete</h3>
              <p className="text-sm text-muted-foreground">Focus: {existingCheckIn.intention}</p>
            </div>
            
            {/* Mentor Response Section */}
            {personality && (
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-4 border border-white/[0.08]">
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
                      <Sparkles className="h-3 w-3 text-stardust-gold" />
                    </div>
                    {existingCheckIn.mentor_response ? (
                      <p className="text-sm italic text-foreground/90 leading-relaxed">
                        "{existingCheckIn.mentor_response}"
                      </p>
                    ) : pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > MAX_POLL_DURATION ? (
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
    <div data-tour="morning-checkin" className="rounded-2xl bg-card/25 backdrop-blur-2xl border border-white/[0.08] overflow-hidden animate-scale-in shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-orange-500/5 to-amber-500/[0.02]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center border border-orange-500/30">
            <Sunrise className="h-5 w-5 text-orange-500" />
          </div>
          <h3 className="font-heading font-black text-2xl tracking-wide text-orange-500">CHECK-IN</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        <div data-tour="checkin-mood" className="space-y-3">
          <label className="text-sm font-bold text-foreground">How are you feeling?</label>
          <MoodSelector selected={mood} onSelect={setMood} />
        </div>

        <div className="h-px bg-border/30" />

        <div data-tour="checkin-intention" className="space-y-3">
          <label className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Target className="h-4 w-4 text-primary" />
            What's your main focus today?
          </label>
          <Textarea
            placeholder="I will..."
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            rows={3}
            className="resize-none transition-all duration-200 focus:shadow-glow bg-muted/30 border-border/50"
          />
        </div>

        <Button 
          onClick={submitCheckIn} 
          disabled={isSubmitting || !mood || !intention.trim() || !!existingCheckIn}
          variant="cta"
          className="w-full h-13 text-base"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              Setting Intention...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              {personality?.buttonText("Start My Day") || "Start My Day"}
              <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs">+{XP_REWARDS.CHECK_IN} XP</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export const MorningCheckIn = () => (
  <ErrorBoundary fallback={<CheckInErrorFallback />}>
    <MorningCheckInContent />
  </ErrorBoundary>
);
