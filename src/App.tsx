import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, Suspense, lazy, memo, useState } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import { EvolutionProvider } from "@/contexts/EvolutionContext";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalEvolutionListener } from "@/components/GlobalEvolutionListener";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { CompanionEvolvingOverlay } from "@/components/CompanionEvolvingOverlay";
import { queryRetryConfig } from "@/utils/retry";
import { InstallPWA } from "@/components/InstallPWA";
import { lockToPortrait } from "@/utils/orientationLock";
import { AmbientMusicPlayer } from "@/components/AmbientMusicPlayer";
import { hideSplashScreen } from "@/utils/capacitor";
import { initializeNativePush, isNativePushSupported } from "@/utils/nativePushNotifications";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Profile = lazy(() => import("./pages/Profile"));
const Premium = lazy(() => import("./pages/Premium"));
const PepTalkDetail = lazy(() => import("./pages/PepTalkDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const MentorSelection = lazy(() => import("./pages/MentorSelection"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Reflection = lazy(() => import("./pages/Reflection"));
const MentorChat = lazy(() => import("./pages/MentorChat"));
const Library = lazy(() => import("./pages/Library"));
const Challenges = lazy(() => import("./pages/Challenges"));
const Search = lazy(() => import("./pages/Search"));
const Companion = lazy(() => import("./pages/Companion"));
const PepTalks = lazy(() => import("./pages/PepTalks"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PremiumSuccess = lazy(() => import("./pages/PremiumSuccess"));
const Epics = lazy(() => import("./pages/Epics"));
const SharedEpics = lazy(() => import("./pages/SharedEpics"));
const JoinEpic = lazy(() => import("./pages/JoinEpic"));
const BattleArena = lazy(() => import("./pages/BattleArena"));
const Horoscope = lazy(() => import("./pages/Horoscope"));
const Creator = lazy(() => import("./pages/Creator"));

const CosmiqDeepDive = lazy(() => import("./pages/CosmicDeepDive"));


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
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
});

ScrollToTop.displayName = 'ScrollToTop';

// Separate component for evolution-aware features
const EvolutionAwareContent = memo(() => {
  const { isEvolvingLoading } = useEvolution();
  
  return (
    <>
      <GlobalEvolutionListener />
      <CompanionEvolvingOverlay isVisible={isEvolvingLoading} />
      <SubscriptionGate />
    </>
  );
});

EvolutionAwareContent.displayName = 'EvolutionAwareContent';

const AppContent = memo(() => {
  const { profile, loading: profileLoading } = useProfile();
  const { session } = useAuth();
  const [splashHidden, setSplashHidden] = useState(false);
  
  // Initialize native push on login
  useEffect(() => {
    if (session?.user) {
      try {
        if (isNativePushSupported()) {
          initializeNativePush(session.user.id).catch(err => {
            console.error('Failed to initialize native push:', err);
          });
        }
      } catch (error) {
        console.debug('Native push initialization skipped:', error);
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
  
  return (
    <ThemeProvider mentorId={profile?.selected_mentor_id}>
      <XPProvider>
        <Suspense fallback={<LoadingFallback />}>
          <EvolutionAwareContent />
          <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/creator" element={<Creator />} />
          <Route path="/onboarding" element={<ProtectedRoute requireMentor={false}><Onboarding /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
          <Route path="/premium/success" element={<ProtectedRoute><PremiumSuccess /></ProtectedRoute>} />
          <Route path="/pep-talk/:id" element={<ProtectedRoute><PepTalkDetail /></ProtectedRoute>} />
          <Route path="/mentor-selection" element={<ProtectedRoute><MentorSelection /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireMentor={false}><Admin /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/epics" element={<ProtectedRoute><Epics /></ProtectedRoute>} />
          <Route path="/join/:code" element={<JoinEpic />} />
          <Route path="/shared-epics" element={<ProtectedRoute><SharedEpics /></ProtectedRoute>} />
          <Route path="/battle-arena" element={<ProtectedRoute><BattleArena /></ProtectedRoute>} />
          <Route path="/mentor-chat" element={<ProtectedRoute><MentorChat /></ProtectedRoute>} />
          <Route path="/horoscope" element={<ProtectedRoute><Horoscope /></ProtectedRoute>} />
          
          <Route path="/cosmic/:placement/:sign" element={<ProtectedRoute><CosmiqDeepDive /></ProtectedRoute>} />
          <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
          <Route path="/reflection" element={<ProtectedRoute><Reflection /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/pep-talks" element={<ProtectedRoute><PepTalks /></ProtectedRoute>} />
          <Route path="/inspire" element={<Navigate to="/pep-talks" replace />} />
          <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
          <Route path="/companion" element={<ProtectedRoute><Companion /></ProtectedRoute>} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </XPProvider>
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
        <EvolutionProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <InstallPWA />
            <AmbientMusicPlayer />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ScrollToTop />
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </EvolutionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
