import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AskMentorChat } from "@/components/AskMentorChat";
import { MentorAvatar } from "@/components/MentorAvatar";
import { MentorSwitcher } from "@/components/MentorSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { PageTransition } from "@/components/PageTransition";
import { CinematicPageBackground } from "@/components/CinematicPageBackground";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { fetchProductMentorById } from "@/services/productMentorCatalog";
import {
  getConsultMentorIdFromState,
  withConsultMentorState,
} from "@/utils/mentorChatLocationState";
import { useDailyGuideThread } from "@/hooks/useDailyGuideThread";
import { buildDailyGuideContinuityContext } from "@/lib/dailyGuideThread";
import { PRODUCT } from "@/config/product";


export default function MentorChat() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const haptics = useHapticFeedback();
  const { thread: dailyGuideThread, previousThread } = useDailyGuideThread();
  const {
    mentorId: resolvedMentorId,
    status: mentorConnectionStatus,
    refreshConnection,
  } = useMentorConnection();

  // Get briefing context from navigation state
  const briefingContext = location.state?.briefingContext;
  const comprehensiveMode = location.state?.comprehensiveMode || false;
  const consultMentorId = getConsultMentorIdFromState(location.state);
  const isConsultMode = Boolean(
    consultMentorId &&
    resolvedMentorId &&
    consultMentorId !== resolvedMentorId,
  );
  const currentChatMentorId = isConsultMode ? consultMentorId : resolvedMentorId;
  const dailyContinuityContext = buildDailyGuideContinuityContext({
    current: dailyGuideThread ? {
      threadDate: dailyGuideThread.thread_date,
      focusLabel: dailyGuideThread.focus_label,
      focusCategory: dailyGuideThread.focus_category,
      companionAnswerLabel: dailyGuideThread.companion_answer_label,
      practiceKey: dailyGuideThread.practice_key,
      practiceCompletedAt: dailyGuideThread.practice_completed_at,
      eveningReflectedAt: dailyGuideThread.evening_reflected_at,
    } : null,
    previous: previousThread ? {
      threadDate: previousThread.thread_date,
      focusLabel: previousThread.focus_label,
      focusCategory: previousThread.focus_category,
      companionAnswerLabel: previousThread.companion_answer_label,
      practiceKey: previousThread.practice_key,
      practiceCompletedAt: previousThread.practice_completed_at,
      eveningReflectedAt: previousThread.evening_reflected_at,
    } : null,
  });
  const connectedBriefingContext = [briefingContext, dailyContinuityContext]
    .filter((value): value is string => Boolean(value))
    .join("\n\n") || undefined;

  const { data: mentor, isLoading: mentorLoading, isFetching: mentorFetching, error: mentorError, refetch: refetchMentor } = useQuery({
    queryKey: ['mentor', currentChatMentorId],
    queryFn: async () => {
      if (!currentChatMentorId) return null;
      return fetchProductMentorById(currentChatMentorId);
    },
    enabled: !!currentChatMentorId,
  });

  const { data: primaryMentor } = useQuery({
    queryKey: ['mentor-primary', resolvedMentorId],
    queryFn: async () => {
      if (!resolvedMentorId) return null;
      return fetchProductMentorById(resolvedMentorId);
    },
    enabled: Boolean(resolvedMentorId && isConsultMode),
  });

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await refetchProfile();
      await refreshConnection();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentor'] }),
        queryClient.invalidateQueries({ queryKey: ['selected-mentor'] }),
      ]);
      if (resolvedMentorId) {
        await refetchMentor();
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleReturnToPrimary = () => {
    navigate("/mentor-chat", {
      replace: true,
      state: withConsultMentorState(location.state, null, location.pathname),
    });
  };

  // Show loading state while profile or mentor is loading
  if (!user || profileLoading || mentorLoading || mentorConnectionStatus === "recovering") {
    return (
      <>
        <CinematicPageBackground preset="guide" />
        <div className="daily-way-page daily-way-scenic-page relative z-10 flex min-h-screen items-center justify-center p-4">
          <div className="space-y-3 rounded-3xl border border-white/35 bg-card/[0.82] p-6 text-center shadow-lg backdrop-blur-xl">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-foreground/75 text-sm">Loading your Guide...</p>
          </div>
        </div>
      </>
    );
  }

  if (profileError && !profile) {
    return (
      <>
        <CinematicPageBackground preset="guide" />
        <div className="daily-way-page daily-way-scenic-page relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md rounded-3xl border border-white/35 bg-card/[0.82] p-6 shadow-lg backdrop-blur-xl">
          <p className="text-lg font-semibold">We couldn't load your profile</p>
          <p className="text-muted-foreground">
            Connection may have dropped while the app was in the background. Try again.
          </p>
          <Button onClick={() => void handleRetry()} disabled={isRetrying || mentorFetching}>
            {isRetrying || mentorFetching ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
        </div>
      </>
    );
  }

  if (mentorConnectionStatus === "missing") {
    return (
      <>
        <CinematicPageBackground preset="guide" />
        <div className="daily-way-page daily-way-scenic-page relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md rounded-3xl border border-white/35 bg-card/[0.82] p-6 shadow-lg backdrop-blur-xl">
          <p className="text-lg font-semibold">No guide selected</p>
          <p className="text-muted-foreground">
            Please select a guide to continue.
          </p>
          <Button onClick={() => navigate('/mentor-selection')}>
            Choose Your Guide
          </Button>
        </div>
        </div>
      </>
    );
  }

  if (mentorError && !mentor) {
    return (
      <>
        <CinematicPageBackground preset="guide" />
        <div className="daily-way-page daily-way-scenic-page relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md rounded-3xl border border-white/35 bg-card/[0.82] p-6 shadow-lg backdrop-blur-xl">
          <p className="text-lg font-semibold">We couldn't load your guide</p>
          <p className="text-muted-foreground">
            Connection may have dropped while the app was in the background. Try again.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={() => void handleRetry()} disabled={isRetrying || mentorFetching}>
              {isRetrying || mentorFetching ? 'Retrying...' : 'Retry'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/mentor-selection')}>
              Choose Guide
            </Button>
          </div>
        </div>
        </div>
      </>
    );
  }

  if (!mentor) {
    return (
      <>
        <CinematicPageBackground preset="guide" />
        <div className="daily-way-page daily-way-scenic-page relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md rounded-3xl border border-white/35 bg-card/[0.82] p-6 shadow-lg backdrop-blur-xl">
          <p className="text-lg font-semibold">Guide unavailable</p>
          <p className="text-muted-foreground">
            We couldn't find your selected guide right now.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={() => void handleRetry()} disabled={isRetrying || mentorFetching}>
              {isRetrying || mentorFetching ? 'Retrying...' : 'Retry'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/mentor-selection')}>
              Choose Guide
            </Button>
          </div>
        </div>
        </div>
      </>
    );
  }

  return (
    <PageTransition>
      <CinematicPageBackground preset="guide" />
      <div className="daily-way-page daily-way-scenic-page min-h-screen pb-nav-safe pt-safe relative z-10">
        {/* Hero Banner - Pokemon TCG Pocket Style */}
        <div className="relative h-48 md:h-64 overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background animate-gradient-shift" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent" />
          
          {/* Floating particles */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/60 rounded-full animate-float-slow" />
            <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-accent/60 rounded-full animate-float-medium" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-primary/40 rounded-full animate-float-fast" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-accent/50 rounded-full animate-float-slow" style={{ animationDelay: '1.5s' }} />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl animate-pulse" />
              <MentorAvatar
                mentorSlug={mentor.slug || mentor.name}
                mentorName={mentor.name}
                primaryColor={mentor.primary_color || "#7c3aed"}
                avatarUrl={mentor.avatar_url || undefined}
                size="md"
                className="relative !h-24 !w-24 md:!h-32 md:!w-32 border-4 border-background shadow-glow-lg"
              />
            </div>
          </div>
          
          {/* Buttons Container */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between safe-area-top">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(PRODUCT.mode === "christian" ? "/guide" : "/mentor")}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-soft"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <MentorSwitcher variant="button" />
              <PageInfoButton onClick={() => {
                haptics.tap();
                setShowPageInfo(true);
              }} />
            </div>
          </div>
          
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6 pb-4">
            <h1 className="text-2xl md:text-3xl font-heading font-black text-foreground text-center">
              {isConsultMode ? `Consult ${mentor.name}` : `Ask ${mentor.name}`}
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              {isConsultMode && primaryMentor?.name
                ? `${primaryMentor.name} remains your primary guide`
                : `Reflect and plan with your ${PRODUCT.name} Guide`}
            </p>
          </div>
        </div>

        <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {resolvedMentorId && (
              <Badge variant="gold">
                Primary: {isConsultMode ? primaryMentor?.name || "Your guide" : mentor.name}
              </Badge>
            )}
            {isConsultMode && (
              <>
                <Badge variant="info">Consulting: {mentor.name}</Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReturnToPrimary}
                >
                  Return to {primaryMentor?.name || "primary guide"}
                </Button>
              </>
            )}
          </div>

          {isConsultMode && (
            <div
              role="note"
              aria-label="Temporary consult details"
              className="rounded-2xl border border-primary/25 bg-card/[0.94] p-4 shadow-soft backdrop-blur-xl"
            >
              <p className="text-sm font-semibold">Temporary consult</p>
              <p className="mt-1 text-sm leading-6 text-foreground/80">
                You&apos;re consulting {mentor.name} for this conversation. {primaryMentor?.name || "Your primary Guide"} still shapes your briefings, check-ins, and daily encouragement unless you explicitly make a change.
              </p>
            </div>
          )}

          {dailyGuideThread?.focus_label && (
            <div
              role="note"
              aria-label="Today’s Guide thread"
              className="rounded-2xl border border-primary/25 bg-card/[0.94] p-4 shadow-soft backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-full bg-primary/12 p-2 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Today’s thread</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/80">
                    {dailyGuideThread.companion_answered_at ? "Your Companion opened " : "This morning you chose "}
                    <span className="font-semibold text-foreground">{dailyGuideThread.focus_label}</span>
                    {dailyGuideThread.companion_answered_at
                      ? ", and your Guide has the thread."
                      : dailyGuideThread.mentor_name
                        ? ` with ${dailyGuideThread.mentor_name}.`
                        : " with your Guide."}
                  </p>
                  {dailyGuideThread.practice_key ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground/65">
                      {dailyGuideThread.practice_completed_at ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-primary/45" aria-hidden="true" />
                      )}
                      {dailyGuideThread.practice_completed_at
                        ? "Connected quest completed"
                        : "Connected quest still open"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <AskMentorChat
            key={mentor.id}
            mentorName={mentor.name}
            mentorTone={mentor.tone_description}
            mentorSlug={mentor.slug}
            mentorId={mentor.id}
            briefingContext={connectedBriefingContext}
            comprehensiveMode={comprehensiveMode}
          />
        </div>
      </div>
      
      
      <PageInfoModal
        open={showPageInfo}
        onClose={() => setShowPageInfo(false)}
        title={isConsultMode ? `About Consulting ${mentor.name}` : "About Your Guide"}
        icon={MessageCircle}
        description={
          isConsultMode
            ? `${mentor.name} is joining this conversation as a consult. ${primaryMentor?.name || "Your primary guide"} is still your main guide across the app.`
            : `Your ${PRODUCT.name} Guide offers a consistent voice for reflection, encouragement, and practical next steps.`
        }
        features={[
          "Reflect on what you are carrying",
          "Turn intentions into practical next steps",
          "Receive encouragement in your Guide's tone",
          PRODUCT.mode === "christian"
            ? "Bring weightier spiritual questions to Scripture and trusted pastoral care"
            : "Review important health, legal, financial, or safety questions with a qualified professional"
        ]}
        tip={
          isConsultMode
            ? `Return to ${primaryMentor?.name || "your primary guide"} anytime, or make ${mentor.name} primary if this voice fits better.`
            : "Your Guide is here to help you reflect without adding another system to manage."
        }
      />
    </PageTransition>
  );
}
