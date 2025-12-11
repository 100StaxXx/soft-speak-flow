import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getDocument, getDocuments, updateDocument } from "@/lib/firebase/firestore";
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
import { getResolvedMentorId } from "@/utils/mentor";
import { Moon, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

type IndexProps = {
  enableOnboardingGuard?: boolean;
};

const Index = ({ enableOnboardingGuard = false }: IndexProps) => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hasActiveHabits, setHasActiveHabits] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mentorImage, setMentorImage] = useState<string>("");
  const [todaysQuote, setTodaysQuote] = useState<{
    text: string;
    author: string | null;
  } | null>(null);
  const hasBackfilledRef = useRef(false);
  const redirectCountRef = useRef(0);
  const lastRedirectTimeRef = useRef<number>(0);
  const companionLoadStartRef = useRef<number | null>(null);
  const COMPANION_LOAD_TIMEOUT = 30000; // 30 seconds

  // Combined initialization effect for better performance
  const resolvedMentorId = useMemo(() => getResolvedMentorId(profile), [profile]);

  // Backfill mentor selection for users who completed onboarding but never persisted the mentor ID
  // Only run once per profile/user combination to prevent multiple updates
  useEffect(() => {
    const syncMentorSelection = async () => {
      if (!user || !profile || hasBackfilledRef.current) return;

      const onboardingMentorId = (profile.onboarding_data as { mentorId?: string | null } | null)?.mentorId;
      const needsBackfill = profile.onboarding_completed && !profile.selected_mentor_id && onboardingMentorId;

      if (!needsBackfill) {
        hasBackfilledRef.current = true; // Mark as processed even if no backfill needed
        return;
      }

      hasBackfilledRef.current = true; // Mark as processing to prevent duplicate runs
      
      try {
        await updateDocument("profiles", user.uid, {
          selected_mentor_id: onboardingMentorId,
        });

        await queryClient.refetchQueries({ queryKey: ["profile", user.uid] });
      } catch (error) {
        console.error("Error backfilling mentor selection:", error);
        hasBackfilledRef.current = false; // Reset on error so it can retry
      }
    };

    void syncMentorSelection();
  }, [profile, queryClient, user]);

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);

    let isMounted = true;

    const fetchMentorData = async () => {
      if (!resolvedMentorId) return;

      try {
        const mentorData = await getDocument<{ avatar_url: string | null; slug: string }>(
          "mentors",
          resolvedMentorId
        );

        if (!isMounted || !mentorData) return;

        // Dynamically load only the mentor image we need (saves ~20MB!)
        const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'darius');
        if (isMounted) {
          setMentorImage(imageUrl);
        }

        // Get today's pep talk to find related quote
        const today = new Date().toLocaleDateString("en-CA");
        const dailyPepTalks = await getDocuments(
          "daily_pep_talks",
          [
            ["for_date", "==", today],
            ["mentor_slug", "==", mentorData.slug],
          ]
        );

        const dailyPepTalk = dailyPepTalks[0];
        if (!isMounted || !dailyPepTalk) return;

        // Try to fetch a quote that matches category first, then fall back to any quote
        let quotes = await getDocuments(
          "quotes",
          [["category", "==", dailyPepTalk.topic_category]],
          undefined,
          undefined,
          10
        );

        // If no category match, get any quotes
        if (quotes.length === 0) {
          quotes = await getDocuments("quotes", undefined, undefined, undefined, 20);
        }

        // Pick a random quote
        if (isMounted && quotes.length > 0) {
          const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
          setTodaysQuote({
            text: randomQuote.text || '',
            author: randomQuote.author || null,
          });
        }
      } catch (error) {
        console.error('Error fetching mentor data:', error);
        // Non-critical error - continue without quote
      }
    };

    const checkHabits = async () => {
      if (!user) return;
      try {
        const habits = await getDocuments(
          "habits",
          [
            ["user_id", "==", user.uid],
            ["is_active", "==", true],
          ],
          undefined,
          undefined,
          1
        );
        if (isMounted) {
          setHasActiveHabits(habits.length > 0);
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
  }, [resolvedMentorId, user]);

  // Track companion loading start time
  useEffect(() => {
    if (companionLoading && companionLoadStartRef.current === null) {
      // Start tracking when loading begins
      companionLoadStartRef.current = Date.now();
    } else if (!companionLoading) {
      // Reset when loading completes
      companionLoadStartRef.current = null;
    }
  }, [companionLoading]);

  // Check for companion loading timeout using interval
  useEffect(() => {
    if (!user || !companionLoading || companionLoadStartRef.current === null) {
      return;
    }

    // Check for timeout every second while loading
    const timeoutCheckInterval = setInterval(() => {
      // Check ref directly (always current) - effect only runs when companionLoading is true
      if (companionLoadStartRef.current !== null) {
        const loadDuration = Date.now() - companionLoadStartRef.current;
        if (loadDuration > COMPANION_LOAD_TIMEOUT) {
          console.warn('[Index] Companion loading timeout - proceeding without companion');
          setIsReady(true);
          companionLoadStartRef.current = null; // Reset to prevent multiple timeouts
        }
      }
    }, 1000); // Check every second

    return () => {
      clearInterval(timeoutCheckInterval);
    };
  }, [user, companionLoading]);

  // Wait for all critical data to load before marking ready
  useEffect(() => {
    if (!user) return;
    
    // Wait for both profile and companion to finish loading
    // (Timeout is handled in the effect above)
    if (!profileLoading && !companionLoading) {
      setIsReady(true);
    }
  }, [user, profileLoading, companionLoading]);

  // Redirect to onboarding if no profile exists (new user)
  useEffect(() => {
    if (user && !profileLoading && !companionLoading && !profile) {
      console.log('[Index] No profile found for new user, redirecting to onboarding');
      navigate('/onboarding');
    }
  }, [user, profile, profileLoading, companionLoading, navigate]);

  // Check for incomplete onboarding pieces and redirect (only after data is ready)
  // Includes redirect loop prevention and explicit onboarding completion check
  useEffect(() => {
    if (!enableOnboardingGuard) return;
    if (!user || !isReady || !profile) return;

    // CRITICAL: If onboarding is explicitly completed, NEVER redirect regardless of other conditions
    // This prevents loops where users complete onboarding but companion is missing
    if (profile.onboarding_completed === true) {
      // Reset redirect counter when onboarding is complete
      redirectCountRef.current = 0;
      lastRedirectTimeRef.current = 0;
      return;
    }

    // Redirect loop prevention: max 3 redirects within 5 seconds
    const now = Date.now();
    const timeSinceLastRedirect = now - lastRedirectTimeRef.current;
    
    if (timeSinceLastRedirect < 5000) {
      // Within 5 seconds of last redirect
      redirectCountRef.current += 1;
    } else {
      // Reset counter if more than 5 seconds have passed
      redirectCountRef.current = 1;
    }
    
    lastRedirectTimeRef.current = now;

    // Prevent infinite loops - max 3 redirects
    if (redirectCountRef.current > 3) {
      console.error('[Index] Redirect loop detected - stopping redirects to prevent infinite loop');
      console.error('[Index] Profile state:', {
        onboarding_completed: profile.onboarding_completed,
        selected_mentor_id: profile.selected_mentor_id,
        resolvedMentorId,
        companion: !!companion,
        companionLoading,
      });
      redirectCountRef.current = 0; // Reset for next attempt
      return;
    }

    const missingMentor = !resolvedMentorId;
    const explicitlyIncomplete = profile.onboarding_completed === false;
    // Only check for missing companion if onboarding is not completed
    // This prevents redirect loops when companion fails to load after onboarding
    const missingCompanion = !companion && !companionLoading && profile.onboarding_completed !== true;

    if (missingMentor || explicitlyIncomplete || missingCompanion) {
      console.log('[Index] Redirecting to onboarding:', {
        missingMentor,
        explicitlyIncomplete,
        missingCompanion,
        redirectCount: redirectCountRef.current,
      });
      navigate("/onboarding");
    }
  }, [enableOnboardingGuard, user, isReady, profile, companion, companionLoading, navigate, resolvedMentorId]);

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
  // But redirect to onboarding for new users instead of showing error
  if (!profileLoading && !companionLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (!enableOnboardingGuard && isReady && !resolvedMentorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-accent/10 px-4 py-12">
        <div className="max-w-lg mx-auto text-center space-y-6 bg-card/70 backdrop-blur-sm border border-border/50 rounded-3xl p-8 shadow-soft">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary shadow-glow">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Choose your mentor to get started</h1>
            <p className="text-muted-foreground">
              Pick a mentor to unlock personalized guidance. You can always change your mentor later.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate("/mentor-selection")} className="flex-1 min-w-[180px]">
              Select Mentor
            </Button>
            <Button variant="ghost" onClick={() => navigate("/tasks")} className="flex-1 min-w-[180px]">
              View Quests
            </Button>
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

            {/* Ask Mentor Section */}
            <CompanionErrorBoundary>
              <ErrorBoundary>
                <div className="cosmiq-glass rounded-2xl">
                  <MentorQuickChat />
                </div>
              </ErrorBoundary>
            </CompanionErrorBoundary>

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
