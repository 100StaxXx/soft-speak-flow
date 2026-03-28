import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AskMentorChat } from "@/components/AskMentorChat";
import { MentorSwitcher } from "@/components/MentorSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { PageTransition } from "@/components/PageTransition";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import {
  getConsultMentorIdFromState,
  withConsultMentorState,
} from "@/utils/mentorChatLocationState";


export default function MentorChat() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const haptics = useHapticFeedback();
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

  const { data: mentor, isLoading: mentorLoading, isFetching: mentorFetching, error: mentorError, refetch: refetchMentor } = useQuery({
    queryKey: ['mentor', currentChatMentorId],
    queryFn: async () => {
      if (!currentChatMentorId) return null;
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('id', currentChatMentorId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentChatMentorId,
  });

  const { data: primaryMentor } = useQuery({
    queryKey: ['mentor-primary', resolvedMentorId],
    queryFn: async () => {
      if (!resolvedMentorId) return null;
      const { data, error } = await supabase
        .from('mentors')
        .select('id, name')
        .eq('id', resolvedMentorId)
        .maybeSingle();

      if (error) throw error;
      return data;
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your motivator...</p>
        </div>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-lg font-semibold">We couldn't load your profile</p>
          <p className="text-muted-foreground">
            Connection may have dropped while the app was in the background. Try again.
          </p>
          <Button onClick={() => void handleRetry()} disabled={isRetrying || mentorFetching}>
            {isRetrying || mentorFetching ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      </div>
    );
  }

  if (mentorConnectionStatus === "missing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-lg font-semibold">No guide selected</p>
          <p className="text-muted-foreground">
            Please select a guide to continue.
          </p>
          <Button onClick={() => navigate('/mentor-selection')}>
            Choose Your Guide
          </Button>
        </div>
      </div>
    );
  }

  if (mentorError && !mentor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
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
    );
  }

  if (!mentor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
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
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-nav-safe pt-safe relative z-10">
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
          
          {/* Mentor Avatar */}
          {mentor.avatar_url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full animate-pulse" />
                <img
                  src={mentor.avatar_url}
                  alt={mentor.name}
                  className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background shadow-glow-lg object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          )}
          
          {/* Buttons Container */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between safe-area-top">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/mentor')} 
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
                : "Get guidance from your motivator"}
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
            <div className="rounded-2xl border border-primary/25 bg-card/45 p-4 backdrop-blur-xl">
              <p className="text-sm font-semibold">Temporary consult</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;re consulting {mentor.name} for this conversation. {primaryMentor?.name || "Your primary guide"} still powers your briefings, check-ins, and daily pep talks unless you explicitly make a change.
              </p>
            </div>
          )}

          <AskMentorChat
            key={mentor.id}
            mentorName={mentor.name}
            mentorTone={mentor.tone_description}
            mentorId={mentor.id}
            briefingContext={briefingContext}
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
            : "Your personal motivator is here to guide and support you on your journey."
        }
        features={[
          "Ask questions and get personalized advice",
          "Receive guidance tailored to your goals",
          "Get encouragement when you need it most",
          "Chat anytime for instant motivation"
        ]}
        tip={
          isConsultMode
            ? `Return to ${primaryMentor?.name || "your primary guide"} anytime, or make ${mentor.name} primary if this voice fits better.`
            : "Your guide's tone and style match your preferences from onboarding."
        }
      />
    </PageTransition>
  );
}
