import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCompanion } from "@/hooks/useCompanion";
import { BottomNav } from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MentorQuickChat } from "@/components/MentorQuickChat";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { TodaysPepTalk } from "@/components/TodaysPepTalk";
import { MorningCheckIn } from "@/components/MorningCheckIn";
import { MentorNudges } from "@/components/MentorNudges";
import { loadMentorImage } from "@/utils/mentorImageLoader";

const Index = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const [hasActiveHabits, setHasActiveHabits] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mentorImage, setMentorImage] = useState<string>("");
  const [todaysQuote, setTodaysQuote] = useState<{
    text: string;
    author: string | null;
  } | null>(null);

  // Fetch mentor image and quote (optimized - only loads needed image)
  useEffect(() => {
    const fetchMentorData = async () => {
      if (!profile?.selected_mentor_id) return;

      try {
        const { data: mentorData } = await supabase
          .from("mentors")
          .select("avatar_url, slug")
          .eq("id", profile.selected_mentor_id)
          .maybeSingle();

        if (mentorData) {
          // Dynamically load only the mentor image we need (saves ~20MB!)
          const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'darius');
          setMentorImage(imageUrl);

          // Get today's pep talk to find related quote
          const today = new Date().toLocaleDateString("en-CA");
          const { data: dailyPepTalk } = await supabase
            .from("daily_pep_talks")
            .select("emotional_triggers, topic_category")
            .eq("for_date", today)
            .eq("mentor_slug", mentorData.slug)
            .maybeSingle();

          if (dailyPepTalk) {
            // Try to fetch a quote that matches category first, then fall back to any quote
            let { data: quotes } = await supabase
              .from("quotes")
              .select("text, author")
              .eq("category", dailyPepTalk.topic_category)
              .limit(10);

            // If no category match, get any quotes
            if (!quotes || quotes.length === 0) {
              const { data: allQuotes } = await supabase
                .from("quotes")
                .select("text, author")
                .limit(20);
              quotes = allQuotes;
            }

            // Pick a random quote
            if (quotes && quotes.length > 0) {
              const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
              setTodaysQuote(randomQuote);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching mentor data:', error);
        // Non-critical error - continue without quote
      }
    };

    // Properly handle async function in useEffect
    fetchMentorData().catch(error => {
      console.error('Unhandled error in fetchMentorData:', error);
    });
  }, [profile?.selected_mentor_id]);

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
    
    if (profile) {
      // If onboarding is not complete or user has no mentor, redirect to onboarding
      if (!profile.onboarding_completed || !profile.selected_mentor_id) {
        navigate("/onboarding");
      }
    }
  }, [user, isReady, profile, navigate]);

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

  // Show error state if critical data failed to load
  if (!profileLoading && !companionLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Unable to Load Profile</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't load your profile data. Please check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Simple loading fallback
  const ComponentLoader = () => <div className="h-20" />;

  return (
    <>
      <PageTransition>
        {/* Fixed Background Image */}
        {mentorImage && (
          <div className="fixed inset-0 z-0">
            <img
              src={mentorImage}
              alt="Mentor background"
              className="w-full h-full object-cover object-center"
              loading="eager"
              decoding="async"
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
          
            <ErrorBoundary>
              <TodaysPepTalk />
            </ErrorBoundary>
            
            <CompanionErrorBoundary>
              <ErrorBoundary>
                <MentorQuickChat />
              </ErrorBoundary>
            </CompanionErrorBoundary>
          </div>
        </div>
      </PageTransition>
      <ErrorBoundary>
        <BottomNav />
      </ErrorBoundary>
    </>
  );
};

export default Index;
