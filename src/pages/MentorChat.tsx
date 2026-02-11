import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AskMentorChat } from "@/components/AskMentorChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { MentorTutorialModal } from "@/components/MentorTutorialModal";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { PageTransition } from "@/components/PageTransition";
import { getResolvedMentorId } from "@/utils/mentor";


export default function MentorChat() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPageInfo, setShowPageInfo] = useState(false);
  const haptics = useHapticFeedback();
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('mentor');
  const resolvedMentorId = getResolvedMentorId(profile);

  // Get briefing context from navigation state
  const briefingContext = location.state?.briefingContext;
  const comprehensiveMode = location.state?.comprehensiveMode || false;

  const { data: mentor, isLoading: mentorLoading, error: mentorError } = useQuery({
    queryKey: ['mentor', resolvedMentorId],
    queryFn: async () => {
      if (!resolvedMentorId) return null;
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('id', resolvedMentorId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!resolvedMentorId,
  });

  // Show loading state while profile or mentor is loading
  if (!user || profileLoading || mentorLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your motivator...</p>
        </div>
      </div>
    );
  }

  // Show error state if mentor not found or failed to load
  if (!mentor || mentorError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-lg font-semibold">No mentor selected</p>
          <p className="text-muted-foreground">
            {mentorError 
              ? "We couldn't load your mentor. Please try again."
              : "Please select a mentor to continue."}
          </p>
          <Button onClick={() => navigate('/mentor-selection')}>
            Choose Your Mentor
          </Button>
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
            <PageInfoButton onClick={() => {
              haptics.tap();
              setShowPageInfo(true);
            }} />
          </div>
          
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6 pb-4">
            <h1 className="text-2xl md:text-3xl font-heading font-black text-foreground text-center">
              Ask {mentor.name}
            </h1>
            <p className="text-sm text-muted-foreground text-center">Get guidance from your motivator</p>
          </div>
        </div>

        <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <AskMentorChat
            mentorName={mentor.name}
            mentorTone={mentor.tone_description}
            mentorId={mentor.id}
            briefingContext={briefingContext}
            comprehensiveMode={comprehensiveMode}
          />
        </div>
      </div>
      
      <BottomNav />
      
      <PageInfoModal
        open={showPageInfo}
        onClose={() => setShowPageInfo(false)}
        title="About Your Mentor"
        icon={MessageCircle}
        description="Your personal motivator is here to guide and support you on your journey."
        features={[
          "Ask questions and get personalized advice",
          "Receive guidance tailored to your goals",
          "Get encouragement when you need it most",
          "Chat anytime for instant motivation"
        ]}
        tip="Your mentor's tone and style match your preferences from onboarding."
      />
      
      <MentorTutorialModal open={showTutorial} onClose={dismissTutorial} />
    </PageTransition>
  );
}
