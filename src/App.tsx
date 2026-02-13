import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useEffect, Suspense, lazy, memo, useState } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { TimeProvider } from "@/contexts/TimeContext";
import { XPProvider } from "@/contexts/XPContext";
import { EvolutionProvider } from "@/contexts/EvolutionContext";
import { CelebrationProvider } from "@/contexts/CelebrationContext";
import { CompanionPresenceProvider } from "@/contexts/CompanionPresenceContext";
import { DeepLinkProvider } from "@/contexts/DeepLinkContext";

import { useProfile } from "@/hooks/useProfile";
import { getResolvedMentorId } from "@/utils/mentor";
import { useAuth } from "@/hooks/useAuth";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalEvolutionListener } from "@/components/GlobalEvolutionListener";
import { RealtimeSyncProvider } from "@/components/RealtimeSyncProvider";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { queryRetryConfig } from "@/utils/retry";
import { InstallPWA } from "@/components/InstallPWA";
import { lockToPortrait } from "@/utils/orientationLock";


import { hideSplashScreen } from "@/utils/capacitor";
import { initializeNativePush, isNativePushSupported } from "@/utils/nativePushNotifications";
import { logger } from "@/utils/logger";
import { AstralEncounterProvider } from "@/components/astral-encounters";
import { WeeklyRecapModal } from "@/components/WeeklyRecapModal";
import { WeeklyRecapProvider } from "@/contexts/WeeklyRecapContext";
import { useCompanion } from "@/hooks/useCompanion";
import { useAuthSync } from "@/hooks/useAuthSync";
import { useAppResumeRefresh } from "@/hooks/useAppResumeRefresh";
import { safeSessionStorage } from "@/utils/storage";
 import { TalkPopupProvider } from "@/contexts/TalkPopupContext";
import { TutorialOrchestrator } from "@/components/TutorialOrchestrator";
import { MainTabsKeepAlive, isMainTabPath } from "@/components/MainTabsKeepAlive";
import { BottomNav } from "@/components/BottomNav";
import { MotionProfileProvider } from "@/contexts/MotionProfileContext";

// Lazy load pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Preview = lazy(() => import("./pages/Preview"));

const Profile = lazy(() => import("./pages/Profile"));
const Premium = lazy(() => import("./pages/Premium"));
const PepTalkDetail = lazy(() => import("./pages/PepTalkDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const MentorSelection = lazy(() => import("./pages/MentorSelection"));
const NotFound = lazy(() => import("./pages/NotFound"));
// Tasks removed - consolidated into Journeys
const Reflection = lazy(() => import("./pages/Reflection"));
const MentorChat = lazy(() => import("./pages/MentorChat"));
const Library = lazy(() => import("./pages/Library"));
const Challenges = lazy(() => import("./pages/Challenges"));
const Search = lazy(() => import("./pages/Search"));
const PepTalks = lazy(() => import("./pages/PepTalks"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PremiumSuccess = lazy(() => import("./pages/PremiumSuccess"));
const Epics = lazy(() => import("./pages/Epics"));
const SharedEpics = lazy(() => import("./pages/SharedEpics"));
const Partners = lazy(() => import("./pages/Partners"));
const JoinEpic = lazy(() => import("./pages/JoinEpic"));
// Campaigns consolidated into Journeys - redirect only
// HIDDEN: Astral Encounters feature disabled
// const AstralArcade = lazy(() => import("./pages/AstralArcade"));
// const Horoscope = lazy(() => import("./pages/Horoscope")); // Shelved
const Creator = lazy(() => import("./pages/Creator"));
const InfluencerDashboard = lazy(() => import("./pages/InfluencerDashboard"));

// const CosmiqDeepDive = lazy(() => import("./pages/CosmicDeepDive")); // Shelved
const AccountDeletionHelp = lazy(() => import("./pages/AccountDeletionHelp"));
const Recaps = lazy(() => import("./pages/Recaps"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const TestDayPlanner = lazy(() => import("./pages/TestDayPlanner"));
const TestScroll = lazy(() => import("./pages/TestScroll"));
const Contacts = lazy(() => import("./pages/Contacts"));
const IAPTest = lazy(() => import("./pages/IAPTest"));


// Create query client outside component for better performance and stability
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
      refetchOnWindowFocus: false, // Don't refetch on tab switch - saves API calls
      refetchOnReconnect: true, // Refetch on reconnect
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Prefetch critical routes during idle time for instant navigation
const prefetchCriticalRoutes = () => {
  const routes = [
    () => import('./pages/Profile'),
    () => import('./pages/MentorChat'),
  ];
  routes.forEach(route => route());
};

// Run prefetch when browser is idle
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(prefetchCriticalRoutes, { timeout: 3000 });
  } else {
    setTimeout(prefetchCriticalRoutes, 1500);
  }
}

// Memoized loading fallback to prevent recreation
const LoadingFallback = memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
));

LoadingFallback.displayName = 'LoadingFallback';

// Memoized scroll to top component
const ScrollToTop = memo(() => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isMainTabPath(pathname)) {
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
});

ScrollToTop.displayName = 'ScrollToTop';

// Separate component for evolution-aware features
const EvolutionAwareContent = memo(() => {
  return (
    <>
      <GlobalEvolutionListener />
      {/* SubscriptionGate removed - monetization disabled */}
      <WeeklyRecapModal />
    </>
  );
});

EvolutionAwareContent.displayName = 'EvolutionAwareContent';

const AppContent = memo(() => {
  const { profile, loading: profileLoading } = useProfile();
  const { session } = useAuth();
  const [splashHidden, setSplashHidden] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Sync auth state changes with query cache to prevent stale profile data
  useAuthSync();
  
  // Refresh critical data on app resume (iOS/Android) or tab visibility (web)
  useAppResumeRefresh();
  
  // Handle password recovery tokens BEFORE routes render - prevents paywall from blocking reset
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') && !location.pathname.includes('/auth/reset-password')) {
      // Redirect to reset password page, preserving the hash fragment
      navigate(`/auth/reset-password${hash}`, { replace: true });
    }
    setRecoveryChecked(true);
  }, [location.pathname, navigate]);
  
  // Ensure first app load starts on the Quests (Tasks) tab
  useEffect(() => {
    if (location.pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (!session?.user) return;
    if (profileLoading) return;
    if (profile?.onboarding_completed !== true) return;
    
    const hasRedirected = safeSessionStorage.getItem("initialRouteRedirected");
    if (!hasRedirected) {
      safeSessionStorage.setItem("initialRouteRedirected", "true");
      navigate("/journeys", { replace: true });
    }
  }, [location.pathname, navigate, profile?.onboarding_completed, profileLoading, session?.user]);
  
  // Respond to native push navigation events
  useEffect(() => {
    const handler = (event: Event) => {
      const url = (event as CustomEvent<string>).detail;
      if (typeof url === 'string') {
        navigate(url);
      }
    };
    window.addEventListener('native-push-navigation', handler as EventListener);
    return () => window.removeEventListener('native-push-navigation', handler as EventListener);
  }, [navigate]);
  
  // Respond to deep link navigation events (from widget taps)
  useEffect(() => {
    const handler = (event: Event) => {
      const { path } = (event as CustomEvent<{ path: string; taskId: string }>).detail;
      if (path) {
        navigate(path);
      }
    };
    window.addEventListener('deep-link-navigation', handler as EventListener);
    return () => window.removeEventListener('deep-link-navigation', handler as EventListener);
  }, [navigate]);
  
  // Initialize native push on login
  useEffect(() => {
    if (session?.user) {
      try {
        if (isNativePushSupported()) {
          initializeNativePush(session.user.id).catch(err => {
            logger.error('Failed to initialize native push:', err);
          });
        }
      } catch (error) {
        logger.log('Native push initialization skipped:', error);
      }
    }
  }, [session]);
  
  // Hide splash screen once profile data is loaded (or failed to load)
  useEffect(() => {
    if (!profileLoading && !splashHidden) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        hideSplashScreen();
        setSplashHidden(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [profileLoading, splashHidden]);

  // Block route rendering until recovery check is complete - prevents paywall flash
  if (!recoveryChecked && window.location.hash.includes('type=recovery')) {
    return <LoadingFallback />;
  }
  
  const resolvedMentorId = getResolvedMentorId(profile);
  const activeMainTabPath = isMainTabPath(location.pathname) ? location.pathname : null;

  return (
    <ThemeProvider mentorId={resolvedMentorId}>
      <ViewModeProvider>
        <XPProvider>
          <WeeklyRecapProvider>
            <CompanionPresenceProvider>
               <TalkPopupProvider>
                <RealtimeSyncProvider>
                <AstralEncounterProvider>
                <Suspense fallback={<LoadingFallback />}>
                <EvolutionAwareContent />
                {activeMainTabPath ? (
                  <ProtectedRoute>
                    <>
                      <MainTabsKeepAlive
                        activePath={activeMainTabPath}
                        transitionPreset="fade-slide"
                        transitionDurationMs={180}
                      />
                      <ErrorBoundary>
                        <BottomNav />
                      </ErrorBoundary>
                    </>
                  </ProtectedRoute>
                ) : (
                <AnimatePresence mode="sync" initial={false}>
                  <Routes location={location} key={location.pathname}>
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/preview" element={<Preview />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/creator" element={<Creator />} />
                  <Route path="/creator/dashboard" element={<InfluencerDashboard />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                  
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
                  <Route path="/premium/success" element={<ProtectedRoute><PremiumSuccess /></ProtectedRoute>} />
                  <Route path="/pep-talk/:id" element={<ProtectedRoute><PepTalkDetail /></ProtectedRoute>} />
                  <Route path="/mentor-selection" element={<ProtectedRoute><MentorSelection /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute requireMentor={false}><Admin /></ProtectedRoute>} />
                  <Route path="/tasks" element={<Navigate to="/journeys" replace />} />
                  <Route path="/epics" element={<ProtectedRoute><Epics /></ProtectedRoute>} />
                  <Route path="/join/:code" element={<JoinEpic />} />
                  <Route path="/shared-epics" element={<ProtectedRoute><SharedEpics /></ProtectedRoute>} />
                  {/* HIDDEN: Arcade route disabled */}
                  {/* <Route path="/arcade" element={<ProtectedRoute><AstralArcade /></ProtectedRoute>} /> */}
                  <Route path="/mentor-chat" element={<ProtectedRoute><MentorChat /></ProtectedRoute>} />
                  <Route path="/horoscope" element={<Navigate to="/journeys" replace />} />
                  <Route path="/cosmic/:placement/:sign" element={<Navigate to="/journeys" replace />} />
                  <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
                  <Route path="/reflection" element={<ProtectedRoute><Reflection /></ProtectedRoute>} />
                  <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                  <Route path="/pep-talks" element={<ProtectedRoute><PepTalks /></ProtectedRoute>} />
                  <Route path="/inspire" element={<Navigate to="/pep-talks" replace />} />
                  <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                  <Route path="/partners" element={<Partners />} />
                  <Route path="/account-deletion" element={<AccountDeletionHelp />} />
                  <Route path="/recaps" element={<ProtectedRoute><Recaps /></ProtectedRoute>} />
                  <Route path="/help" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />
                  <Route path="/campaigns" element={<Navigate to="/journeys" replace />} />
                  <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
                  <Route path="/iap-test" element={<IAPTest />} />
                  <Route path="/guilds" element={<Navigate to="/campaigns" replace />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/test-scroll" element={<TestScroll />} />
                  <Route path="/test-day-planner" element={<TestDayPlanner />} />
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </AnimatePresence>
                )}
                <TutorialOrchestrator />
                </Suspense>
                </AstralEncounterProvider>
                </RealtimeSyncProvider>
               </TalkPopupProvider>
            </CompanionPresenceProvider>
          </WeeklyRecapProvider>
        </XPProvider>
      </ViewModeProvider>
    </ThemeProvider>
  );
});

AppContent.displayName = 'AppContent';

const App = () => {
  useEffect(() => {
    // Lock orientation to portrait on native apps
    lockToPortrait();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TimeProvider>
          <EvolutionProvider>
            <CelebrationProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <InstallPWA />
                <MotionProfileProvider>
                  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <DeepLinkProvider>
                      <ScrollToTop />
                      <AppContent />
                    </DeepLinkProvider>
                  </BrowserRouter>
                </MotionProfileProvider>
              </TooltipProvider>
            </CelebrationProvider>
          </EvolutionProvider>
        </TimeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
