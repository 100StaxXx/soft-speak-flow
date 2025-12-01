import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Moon, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Button } from "@/components/ui/button";

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

  // Combined initialization effect for better performance
  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);

    let isMounted = true;

    const fetchMentorData = async () => {
      if (!profile?.selected_mentor_id) return;

      try {
        const { data: mentorData } = await supabase
          .from("mentors")
          .select("avatar_url, slug")
          .eq("id", profile.selected_mentor_id)
          .maybeSingle();

        if (!isMounted || !mentorData) return;

        // Dynamically load only the mentor image we need (saves ~20MB!)
        const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'darius');
        if (isMounted) {
          setMentorImage(imageUrl);
        }

        // Get today's pep talk to find related quote
        const today = new Date().toLocaleDateString("en-CA");
        const { data: dailyPepTalk } = await supabase
          .from("daily_pep_talks")
          .select("emotional_triggers, topic_category")
          .eq("for_date", today)
          .eq("mentor_slug", mentorData.slug)
          .maybeSingle();

        if (!isMounted || !dailyPepTalk) return;

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
        if (isMounted && quotes && quotes.length > 0) {
          const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
          setTodaysQuote(randomQuote);
        }
      } catch (error) {
        console.error('Error fetching mentor data:', error);
        // Non-critical error - continue without quote
      }
    };

    const checkHabits = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("habits")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);
        if (isMounted) {
          setHasActiveHabits(!!data && data.length > 0);
        }
      } catch (error) {
        console.error('Error checking habits:', error);
      }
    };

    // Run both async operations in parallel
    Promise.all([
      fetchMentorData(),
      checkHabits()
    ]).catch(error => {
      console.error('Error in initialization:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [profile?.selected_mentor_id, user]);

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
        {/* Cosmiq Starfield Background */}
        <StarfieldBackground />
        
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

            {/* Cosmiq Insight Section - Enhanced */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden rounded-3xl mx-4"
            >
              {/* Animated background layers */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-blue-600/30 to-pink-600/30" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent animate-pulse" />
              
              {/* Floating stars decoration */}
              <div className="absolute top-4 left-6 text-yellow-300/40 animate-pulse">✨</div>
              <div className="absolute top-8 right-8 text-purple-300/40 animate-pulse" style={{ animationDelay: '0.5s' }}>🌙</div>
              <div className="absolute bottom-6 left-12 text-blue-300/40 animate-pulse" style={{ animationDelay: '1s' }}>⭐</div>
              
              {/* Content */}
              <div className="relative p-8 backdrop-blur-sm bg-background/40 border-2 border-purple-500/40 space-y-6">
                {/* Header */}
                <div className="text-center space-y-3">
                  <motion.h2
                    className="text-3xl md:text-4xl font-black"
                    style={{
                      background: "linear-gradient(90deg, #a855f7, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                      backgroundSize: "200% 100%",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                    animate={{
                      backgroundPosition: ["0% 50%", "200% 50%"],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    ✨ Cosmiq Insight ✨
                  </motion.h2>
                  <p className="text-base text-foreground/90 font-medium">
                    Discover your daily celestial guidance
                  </p>
                </div>

                {/* Description */}
                <div className="max-w-md mx-auto text-center space-y-2">
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Unlock personalized cosmic wisdom tailored to your zodiac sign. Get daily guidance for your Mind, Body, and Soul aligned with the stars.
                  </p>
                </div>

                {/* Features List */}
                <div className="flex flex-wrap justify-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                    <span className="text-purple-300">🌟</span>
                    <span className="text-foreground/80">Daily Horoscope</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30">
                    <span className="text-blue-300">🔮</span>
                    <span className="text-foreground/80">Cosmic Profile</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/30">
                    <span className="text-pink-300">✨</span>
                    <span className="text-foreground/80">Energy Forecast</span>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={() => navigate('/horoscope')}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-8 py-6 rounded-2xl shadow-glow-lg hover:shadow-neon transition-all duration-300 hover:scale-105"
                  >
                    <span className="text-lg">Explore Your Cosmiq Insight</span>
                  </Button>
                </div>
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[slide-in-right_2s_ease-in-out_infinite]" />
              </div>
            </motion.div>
            
            <CompanionErrorBoundary>
              <ErrorBoundary>
                <div className="cosmiq-glass rounded-2xl">
                  <MentorQuickChat />
                </div>
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
