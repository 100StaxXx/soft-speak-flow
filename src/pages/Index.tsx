import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCompanion } from "@/hooks/useCompanion";
import { IntroScreen } from "@/components/IntroScreen";
import { BottomNav } from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MentorQuickChat } from "@/components/MentorQuickChat";
import { TodaysPepTalk } from "@/components/TodaysPepTalk";
import { MorningCheckIn } from "@/components/MorningCheckIn";
import { MentorNudges } from "@/components/MentorNudges";
import { OnboardingTour } from "@/components/OnboardingTour";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import dariusImage from "@/assets/darius-sage.png";
import novaImage from "@/assets/nova-sage.png";
import lumiImage from "@/assets/lumi-sage.png";
import kaiImage from "@/assets/kai-sage.png";
import atlasImage from "@/assets/atlas-sage.png";
import siennaImage from "@/assets/sienna-sage.png";
import eliImage from "@/assets/eli-sage.png";
import strykerImage from "@/assets/stryker-sage.png";
import solaceImage from "@/assets/solace-sage.png";

const Index = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(() => {
    return !localStorage.getItem('hasSeenIntro');
  });
  const [hasActiveHabits, setHasActiveHabits] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mentorImage, setMentorImage] = useState<string>("");
  const [todaysQuote, setTodaysQuote] = useState<{
    text: string;
    author: string | null;
  } | null>(null);

  // Map mentor slugs to local images
  const mentorImages: Record<string, string> = {
    'darius': dariusImage,
    'nova': novaImage,
    'lumi': lumiImage,
    'kai': kaiImage,
    'atlas': atlasImage,
    'sienna': siennaImage,
    'eli': eliImage,
    'stryker': strykerImage,
    'solace': solaceImage,
  };

  // Fetch mentor image and quote
  useEffect(() => {
    const fetchMentorData = async () => {
      if (!profile?.selected_mentor_id) return;

      const { data: mentorData } = await supabase
        .from("mentors")
        .select("avatar_url, slug")
        .eq("id", profile.selected_mentor_id)
        .maybeSingle();

      if (mentorData) {
        const imageUrl = mentorData.avatar_url || mentorImages[mentorData.slug] || mentorImages['darius'];
        setMentorImage(imageUrl);

        // Get today's pep talk to find related quote
        const today = new Date().toISOString().split("T")[0];
        const { data: dailyPepTalk } = await supabase
          .from("daily_pep_talks")
          .select("emotional_triggers, topic_category")
          .eq("for_date", today)
          .eq("mentor_slug", mentorData.slug)
          .maybeSingle();

        if (dailyPepTalk) {
          // Fetch a quote that matches the pep talk's themes
          const { data: quote } = await supabase
            .from("quotes")
            .select("text, author")
            .or(`emotional_triggers.ov.{${dailyPepTalk.emotional_triggers?.join(',') || ''}},category.eq.${dailyPepTalk.topic_category}`)
            .limit(1)
            .maybeSingle();

          if (quote) {
            setTodaysQuote(quote);
          }
        }
      }
    };

    fetchMentorData();
  }, [profile?.selected_mentor_id]);

  useEffect(() => {
    localStorage.setItem('hasSeenIntro', 'true');
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const checkHabits = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("habits")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);
      setHasActiveHabits(!!data && data.length > 0);
    };
    checkHabits();
  }, [user]);

  // Wait for all critical data to load before marking ready
  useEffect(() => {
    if (!user) return;
    
    // Wait for both profile and companion to finish loading
    if (!profileLoading && !companionLoading) {
      setIsReady(true);
    }
  }, [user, profileLoading, companionLoading]);

  // Check for incomplete onboarding and redirect (only after data is ready)
  useEffect(() => {
    if (!user || !isReady) return;
    
    // Check localStorage first to avoid race conditions with profile updates
    const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
    
    if (profile && !onboardingComplete) {
      // If onboarding is not complete or user has no mentor, redirect to onboarding
      if (!profile.onboarding_completed || !profile.selected_mentor_id) {
        navigate("/onboarding");
      }
    }
  }, [user, isReady, profile, navigate]);

  // Show intro first, before any checks
  if (showIntro) {
    return <IntroScreen onComplete={() => setShowIntro(false)} />;
  }

  // Show loading state while critical data loads
  if (isTransitioning || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">
            {isTransitioning ? "Switching mentor..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Simple loading fallback
  const ComponentLoader = () => <div className="h-20" />;

  return (
    <>
      <ErrorBoundary>
        <OnboardingFlow 
          open={showOnboarding} 
          onComplete={() => {
            setShowOnboarding(false);
          }} 
        />
      </ErrorBoundary>
      <PageTransition>
        {/* Fixed Background Image */}
        {mentorImage && (
          <div className="fixed inset-0 z-0">
            <img 
              src={mentorImage} 
              alt="Mentor background"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-background/85" />
          </div>
        )}

        {/* Scrollable Content */}
        <div className="relative z-10 min-h-screen pb-24 sm:pb-24">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-48 sm:pt-32 md:pt-24 space-y-4 sm:space-y-6 md:space-y-8">
            <ErrorBoundary>
              <MentorNudges />
            </ErrorBoundary>

            {/* Quote of the Day */}
            {todaysQuote && (
              <div className="text-right px-4 sm:px-6">
                <blockquote className="max-w-2xl ml-auto">
                  <p className="font-serif italic text-lg sm:text-xl md:text-2xl text-[hsl(30,100%,60%)] leading-relaxed">
                    "{todaysQuote.text}"
                  </p>
                  {todaysQuote.author && (
                    <footer className="mt-2 font-serif italic text-sm sm:text-base text-[hsl(30,100%,60%)]/80">
                      — {todaysQuote.author}
                    </footer>
                  )}
                </blockquote>
              </div>
            )}
            
            <ErrorBoundary>
              <MorningCheckIn />
            </ErrorBoundary>
          
            <div data-tour="todays-pep-talk">
              <ErrorBoundary>
                <TodaysPepTalk />
              </ErrorBoundary>
            </div>
            
            <div data-tour="ask-mentor">
              <ErrorBoundary>
                <MentorQuickChat />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </PageTransition>
      <BottomNav />
      <ErrorBoundary>
        <OnboardingTour />
      </ErrorBoundary>
    </>
  );
};

export default Index;
