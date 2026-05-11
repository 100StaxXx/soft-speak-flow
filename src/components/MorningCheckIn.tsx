import { useState, useRef, useEffect, memo } from "react";
import { Card, clearShellCardClassName } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useAchievements } from "@/hooks/useAchievements";
import { Textarea } from "@/components/ui/textarea";
import { MoodSelector } from "./MoodSelector";
import { Sunrise, Target, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CheckInErrorFallback } from "@/components/ErrorFallback";
import { logger } from "@/utils/logger";
import { useLivingCompanionSafe } from "@/hooks/useLivingCompanion";
import {
  getDirectMentorAvatarUrl,
  loadMentorImage,
  resolveMentorImageSource,
} from "@/utils/mentorImageLoader";
import { setPendingMentorMood } from "@/utils/mentorMoodSignal";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { cn } from "@/lib/utils";
import {
  clearMorningCheckInDraftSnapshot,
  readMorningCheckInDraftSnapshot,
  writeMorningCheckInDraftSnapshot,
} from "@/utils/draftPersistence";
import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";
import { getEffectiveDailyDate } from "@/utils/timezone";

type MentorResponseIssue =
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "timeout";
      message: string;
    }
  | null;

type DailyCheckInRow = Database["public"]["Tables"]["daily_check_ins"]["Row"];
type DailyCheckInInsert = Database["public"]["Tables"]["daily_check_ins"]["Insert"];
type DailyCheckInUpdate = Database["public"]["Tables"]["daily_check_ins"]["Update"];

const CHECK_IN_TIMEOUT_MESSAGE =
  "Your check-in was saved, but your guide's personalized reply is taking longer than expected.";

const getErrorField = (error: unknown, field: "code" | "message" | "details" | "hint") => {
  if (!error || typeof error !== "object" || !(field in error)) return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
};

const getErrorText = (error: unknown) => [
  getErrorField(error, "message"),
  getErrorField(error, "details"),
  getErrorField(error, "hint"),
].join(" ").toLowerCase();

const isDuplicateCheckInError = (error: unknown) => {
  const code = getErrorField(error, "code");
  const text = getErrorText(error);

  return (
    code === "23505"
    || code === "PGRST409"
    || (text.includes("duplicate key") && text.includes("daily_check_ins"))
  );
};

const isAuthPolicyWriteError = (error: unknown) => {
  const code = getErrorField(error, "code");
  const text = getErrorText(error);

  return (
    code === "42501"
    || text.includes("row-level security")
    || text.includes("jwt")
    || text.includes("not authenticated")
  );
};

const MorningCheckInContent = () => {
  const { user, refreshSession } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const personality = useMentorPersonality();
  const { isActive: isTutorialActive, currentStep: tutorialStep } = usePostOnboardingMentorGuidance();
  const queryClient = useQueryClient();
  const { awardCheckInComplete, XP_REWARDS } = useXPRewards();
  const { checkDailyCompletionAchievement, checkFirstTimeAchievements } = useAchievements();
  const { triggerReaction } = useLivingCompanionSafe();
  const [mood, setMood] = useState<string>("");
  const [intention, setIntention] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentorPortraitUrl, setMentorPortraitUrl] = useState("");
  const [mentorResponseIssue, setMentorResponseIssue] = useState<MentorResponseIssue>(null);
  // Use ref for pollStartTime to avoid stale closure in refetchInterval callback
  const pollStartTimeRef = useRef<number | null>(null);
  const hasHydratedDraftRef = useRef(false);
  const isTutorialMorningCheckinStep = isTutorialActive && tutorialStep === "morning_checkin";

  const today = getEffectiveDailyDate(profile?.timezone ?? undefined);
  const MAX_POLL_DURATION = 30000; // 30 seconds max polling

  useEffect(() => {
    if (!personality) {
      setMentorPortraitUrl("");
      return;
    }

    const mentorSlug = (personality.slug || "").trim().toLowerCase();
    if (!mentorSlug) {
      setMentorPortraitUrl("");
      return;
    }

    const directAvatarUrl = getDirectMentorAvatarUrl(mentorSlug, personality.avatar_url);
    if (directAvatarUrl) {
      setMentorPortraitUrl(directAvatarUrl);
      return;
    }

    let cancelled = false;

    resolveMentorImageSource(mentorSlug, personality.avatar_url)
      .then((imageUrl) => {
        if (!cancelled) {
          setMentorPortraitUrl(imageUrl || "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMentorPortraitUrl("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [personality?.avatar_url, personality?.slug, personality?.name]);

  const handleMentorPortraitError = () => {
    const mentorSlug = (personality?.slug || "").trim().toLowerCase();
    if (!mentorSlug) {
      setMentorPortraitUrl("");
      return;
    }

    loadMentorImage(mentorSlug)
      .then((imageUrl) => {
        setMentorPortraitUrl(imageUrl && imageUrl !== mentorPortraitUrl ? imageUrl : "");
      })
      .catch(() => {
        setMentorPortraitUrl("");
      });
  };

  const fetchTodayMorningCheckIn = async (): Promise<DailyCheckInRow | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('daily_check_ins')
      .select('*')
      .eq('user_id', user.id)
      .eq('check_in_type', 'morning')
      .eq('check_in_date', today)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const {
    data: existingCheckIn,
    error: existingCheckInError,
    refetch: refetchExistingCheckIn,
  } = useQuery({
    queryKey: ['morning-check-in', today, user?.id],
    queryFn: fetchTodayMorningCheckIn,
    enabled: !!user,
    // Poll every 2 seconds if check-in exists but mentor response is still pending
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.completed_at && !data?.mentor_response) {
        // Check if we've exceeded max poll duration (use ref to avoid stale closure)
        const completedAtTime = new Date(data.completed_at).getTime();
        const startTime = pollStartTimeRef.current
          ?? (Number.isFinite(completedAtTime) ? completedAtTime : null);
        if (startTime && Date.now() - startTime > MAX_POLL_DURATION) {
          logger.warn('Mentor response polling timeout exceeded');
          return false; // Stop polling after 30 seconds
        }
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling once we have the response
    },
  });

  useEffect(() => {
    hasHydratedDraftRef.current = false;
  }, [today, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      hasHydratedDraftRef.current = true;
      return;
    }

    if (existingCheckIn?.completed_at) {
      clearMorningCheckInDraftSnapshot(user.id);
      hasHydratedDraftRef.current = true;
      return;
    }

    const savedDraft = readMorningCheckInDraftSnapshot(user.id);
    if (!savedDraft) {
      hasHydratedDraftRef.current = true;
      return;
    }

    if (savedDraft.date !== today) {
      clearMorningCheckInDraftSnapshot(user.id);
      hasHydratedDraftRef.current = true;
      return;
    }

    setMood(savedDraft.mood);
    setIntention(savedDraft.intention);
    hasHydratedDraftRef.current = true;
  }, [existingCheckIn?.completed_at, today, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!hasHydratedDraftRef.current) return;
    if (existingCheckIn?.completed_at) return;

    if (!mood && !intention.trim()) {
      clearMorningCheckInDraftSnapshot(user.id);
      return;
    }

    writeMorningCheckInDraftSnapshot(user.id, {
      mood,
      intention,
      date: today,
      updatedAt: new Date().toISOString(),
    });
  }, [existingCheckIn?.completed_at, intention, mood, today, user?.id]);

  useEffect(() => {
    if (existingCheckIn?.completed_at) {
      setPendingMentorMood(null);
      return;
    }

    setPendingMentorMood(mood || null);
  }, [existingCheckIn?.completed_at, mood]);

  useEffect(() => {
    if (existingCheckIn?.mentor_response) {
      setMentorResponseIssue(null);
      pollStartTimeRef.current = null;
      return;
    }

    if (!existingCheckIn?.completed_at || mentorResponseIssue) {
      return;
    }

    const completedAtTime = new Date(existingCheckIn.completed_at).getTime();
    const startTime = pollStartTimeRef.current
      ?? (Number.isFinite(completedAtTime) ? completedAtTime : null);

    if (startTime && Date.now() - startTime > MAX_POLL_DURATION) {
      setMentorResponseIssue({
        kind: "timeout",
        message: CHECK_IN_TIMEOUT_MESSAGE,
      });
    }
  }, [existingCheckIn?.completed_at, existingCheckIn?.mentor_response, mentorResponseIssue, MAX_POLL_DURATION]);

  useEffect(() => {
    if (existingCheckInError) {
      console.error("Failed to load morning check-in:", existingCheckInError);
    }
  }, [existingCheckInError]);

  const submitCheckIn = async () => {
    if (!user || !mood || !intention.trim()) {
      toast({ title: "Please complete all fields", variant: "destructive" });
      return;
    }

    // Prevent duplicate submissions
    if (existingCheckIn?.completed_at || isSubmitting) {
      toast({ 
        title: "Already checked in", 
        description: "You've already completed your check-in today",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    setMentorResponseIssue(null);

    try {
      const checkInPayload: DailyCheckInInsert = {
        user_id: user.id,
        check_in_type: 'morning',
        check_in_date: today,
        mood,
        intention: intention.trim(),
        completed_at: new Date().toISOString(),
      };
      const checkInCompletionPatch: DailyCheckInUpdate = {
        mood: checkInPayload.mood,
        intention: checkInPayload.intention,
        completed_at: checkInPayload.completed_at,
      };

      const updateExistingCheckIn = (checkInId: string) => supabase
        .from('daily_check_ins')
        .update(checkInCompletionPatch)
        .eq('id', checkInId)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      // Double-check right before insert (cache could be stale)
      const { data: recentCheck, error: recentCheckError } = await supabase
        .from('daily_check_ins')
        .select('*')
        .eq('user_id', user.id)
        .eq('check_in_type', 'morning')
        .eq('check_in_date', today)
        .maybeSingle();

      if (recentCheckError) throw recentCheckError;

      if (recentCheck?.completed_at) {
        await finishSavedCheckIn(recentCheck, { awardCompletion: false });
        return;
      }

      if (recentCheck?.id) {
        let { data: updatedCheckIn, error: updateError } = await updateExistingCheckIn(recentCheck.id);

        if (updateError && isAuthPolicyWriteError(updateError)) {
          logger.warn('Check-in update hit auth policy; refreshing session and retrying:', updateError);
          await refreshSession();
          ({ data: updatedCheckIn, error: updateError } = await updateExistingCheckIn(recentCheck.id));
        }

        if (updateError) throw updateError;
        if (!updatedCheckIn) throw new Error("Existing check-in row could not be completed");

        await finishSavedCheckIn(updatedCheckIn, { awardCompletion: true });
        return;
      }

      const insertCheckIn = () => supabase
        .from('daily_check_ins')
        .insert(checkInPayload)
        .select()
        .maybeSingle();

      let awardCompletion = true;
      let { data: checkIn, error } = await insertCheckIn();

      if (error && isAuthPolicyWriteError(error)) {
        logger.warn('Check-in write hit auth policy; refreshing session and retrying:', error);
        await refreshSession();
        ({ data: checkIn, error } = await insertCheckIn());
      }

      if (error && isDuplicateCheckInError(error)) {
        logger.warn('Check-in already exists for this day; loading saved row:', error);
        const duplicateError = error;
        const savedCheckIn = await fetchTodayMorningCheckIn();

        if (!savedCheckIn) {
          throw duplicateError;
        }

        if (savedCheckIn.completed_at) {
          checkIn = savedCheckIn;
          error = null;
          awardCompletion = false;
        } else {
          ({ data: checkIn, error } = await updateExistingCheckIn(savedCheckIn.id));
          if (error && isAuthPolicyWriteError(error)) {
            logger.warn('Check-in duplicate recovery update hit auth policy; refreshing session and retrying:', error);
            await refreshSession();
            ({ data: checkIn, error } = await updateExistingCheckIn(savedCheckIn.id));
          }
          awardCompletion = true;
        }
      }

      if (error) {
        logger.error('Check-in error:', error);
        throw error;
      }

      if (!checkIn) {
        throw new Error("Check-in row was inserted but could not be read back");
      }

      await finishSavedCheckIn(checkIn, { awardCompletion });
    } catch (error) {
      logger.error('Check-in save error:', error);
      toast({
        title: "Couldn't save check-in",
        description: "Please try again. We couldn't save your check-in.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishSavedCheckIn = async (
    checkIn: DailyCheckInRow,
    options: { awardCompletion: boolean },
  ) => {
    if (!user) throw new Error("No user found");

    queryClient.setQueryData(['morning-check-in', today, user.id], checkIn);

    // Award XP only on successful INSERT (not update)
    if (options.awardCompletion) {
      void Promise.resolve(awardCheckInComplete()).catch((err) => {
        logger.warn("XP award failed after check-in:", err);
      });

      // Trigger mentor companion reaction for check-in completion
      triggerReaction('mentor', { momentType: 'discipline_win' }).catch(err =>
        logger.log('[LivingCompanion] Mentor reaction failed:', err)
      );

      try {
        const { count, error: countError } = await supabase
          .from('daily_check_ins')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) {
          throw countError;
        }

        if (count === 1) {
          await checkFirstTimeAchievements('checkin');
        }
      } catch (achievementErr) {
        logger.warn('First-time check-in achievement check failed:', achievementErr);
      }

      try {
        await checkDailyCompletionAchievement(today);
      } catch (achievementErr) {
        logger.warn('Daily completion achievement check failed:', achievementErr);
      }
    }

    // Trigger astral encounter check
    window.dispatchEvent(new CustomEvent('quest-completed'));
    window.dispatchEvent(new CustomEvent('morning-checkin-completed'));
    setPendingMentorMood(null);
    clearMorningCheckInDraftSnapshot(user.id);

    // Start polling timer (using ref to avoid stale closure)
    pollStartTimeRef.current = Date.now();

    // Generate mentor response in background with error handling
    if (!checkIn.mentor_response) {
      try {
        const { error: invocationError } = await supabase.functions.invoke('generate-check-in-response', {
          body: { checkInId: checkIn.id }
        });

        if (invocationError) {
          logger.error('Edge function invocation error:', invocationError);
          const parsedError = await parseFunctionInvokeError(invocationError);
          setMentorResponseIssue({
            kind: "error",
            message: toUserFacingFunctionError(parsedError, {
              action: "load your guide's personalized check-in reply",
            }),
          });
        }
      } catch (error) {
        logger.error('Edge function invocation failed:', error);
        const parsedError = await parseFunctionInvokeError(error);
        setMentorResponseIssue({
          kind: "error",
          message: toUserFacingFunctionError(parsedError, {
            action: "load your guide's personalized check-in reply",
          }),
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['morning-check-in'] });
  };

  if (existingCheckInError) {
    return (
      <div
        data-tour="morning-checkin"
        data-testid="morning-checkin-shell"
        className={cn(
          "rounded-2xl border border-white/[0.08] overflow-hidden",
          clearShellCardClassName,
        )}
      >
        <div data-testid="morning-checkin-header" className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
              <Sunrise className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-heading font-black text-2xl tracking-wide text-primary">CHECK-IN</h3>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm font-medium text-destructive">Couldn't load today's check-in.</p>
          <p className="text-sm text-muted-foreground">
            Please try again before checking in.
          </p>
          <Button variant="outline" onClick={() => void refetchExistingCheckIn()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (existingCheckIn?.completed_at) {
    return (
      <Card
        data-tour="morning-checkin"
        data-testid="morning-checkin-shell"
        className={cn("p-5 sm:p-6 border-celestial-blue/20", clearShellCardClassName)}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-stardust-gold/20 flex items-center justify-center flex-shrink-0 ring-1 ring-stardust-gold/30">
              <Sunrise className="h-5 w-5 text-stardust-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg">Check-in Complete</h3>
              <p className="text-sm text-muted-foreground">Focus: {existingCheckIn.intention}</p>
            </div>
          </div>

          {/* Mentor Response Section */}
          {personality && (
            <div
              data-testid="mentor-response-panel"
              className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/[0.08]"
            >
              <span
                aria-hidden="true"
                className="absolute -left-1 -top-7 text-7xl leading-none font-serif text-white/[0.08] select-none"
              >
                "
              </span>
              <div className="relative space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 border border-white/10">
                  <p className="text-xs sm:text-sm font-semibold text-foreground">{personality.name}</p>
                  <Sparkles className="h-3.5 w-3.5 text-stardust-gold" />
                </div>
                <div data-testid="mentor-response-body" className="flow-root">
                  {mentorPortraitUrl && (
                    <img
                      data-testid="mentor-portrait-tile"
                      src={mentorPortraitUrl}
                      alt={`${personality.name} portrait`}
                      className="float-right ml-3 mb-2 h-16 w-12 sm:h-20 sm:w-14 rounded-xl object-cover border border-white/10 shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                      style={{ objectPosition: "center 25%" }}
                      loading="lazy"
                      decoding="async"
                      onError={handleMentorPortraitError}
                    />
                  )}
                  {existingCheckIn.mentor_response ? (
                    <p className="text-base italic text-foreground/90 leading-relaxed">
                      "{existingCheckIn.mentor_response}"
                    </p>
                  ) : mentorResponseIssue ? (
                    <p
                      data-testid="mentor-response-status"
                      className="text-sm text-muted-foreground leading-relaxed"
                    >
                      {mentorResponseIssue.message}
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
      </Card>
    );
  }

  return (
    <div
      data-tour="morning-checkin"
      data-testid="morning-checkin-shell"
      className={cn(
        "rounded-2xl border border-white/[0.08] overflow-hidden animate-scale-in",
        clearShellCardClassName,
      )}
    >
      {/* Header */}
      <div data-testid="morning-checkin-header" className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
            <Sunrise className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-heading font-black text-2xl tracking-wide text-primary">CHECK-IN</h3>
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
          data-tour="checkin-submit"
          data-tutorial-highlight={isTutorialMorningCheckinStep ? "true" : undefined}
          disabled={isSubmitting || !mood || !intention.trim() || !!existingCheckIn?.completed_at}
          variant="gradient"
          className={cn(
            "w-full h-13 text-base",
            isTutorialMorningCheckinStep && "tutorial-checkin-cta"
          )}
          size="lg"
        >
          <span className="relative z-[1] inline-flex items-center gap-2">
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Setting Intention...
              </>
            ) : (
              <>
                Check in
                <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs">+{XP_REWARDS.CHECK_IN} XP</span>
              </>
            )}
          </span>
        </Button>
      </div>
    </div>
  );
};

export const MorningCheckIn = memo(() => (
  <ErrorBoundary fallback={<CheckInErrorFallback />}>
    <MorningCheckInContent />
  </ErrorBoundary>
));

MorningCheckIn.displayName = 'MorningCheckIn';
