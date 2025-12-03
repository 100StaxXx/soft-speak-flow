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
import { ErrorBoundaryRoute } from "@/components/RouteErrorBoundary";
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
const Partners = lazy(() => import("./pages/Partners"));
const JoinEpic = lazy(() => import("./pages/JoinEpic"));
const BattleArena = lazy(() => import("./pages/BattleArena"));
const Horoscope = lazy(() => import("./pages/Horoscope"));
const Creator = lazy(() => import("./pages/Creator"));
const InfluencerDashboard = lazy(() => import("./pages/InfluencerDashboard"));

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
          {/* Public routes */}
          <Route path="/auth" element={<ErrorBoundaryRoute name="Auth"><Auth /></ErrorBoundaryRoute>} />
          <Route path="/auth/reset-password" element={<ErrorBoundaryRoute name="Reset Password"><ResetPassword /></ErrorBoundaryRoute>} />
          <Route path="/creator" element={<ErrorBoundaryRoute name="Creator"><Creator /></ErrorBoundaryRoute>} />
          <Route path="/creator/dashboard" element={<ErrorBoundaryRoute name="Influencer Dashboard"><InfluencerDashboard /></ErrorBoundaryRoute>} />
          <Route path="/partners" element={<ErrorBoundaryRoute name="Partners"><Partners /></ErrorBoundaryRoute>} />
          <Route path="/terms" element={<ErrorBoundaryRoute name="Terms"><TermsOfService /></ErrorBoundaryRoute>} />
          <Route path="/privacy" element={<ErrorBoundaryRoute name="Privacy"><PrivacyPolicy /></ErrorBoundaryRoute>} />
          
          {/* Protected routes with error boundaries */}
          <Route path="/onboarding" element={
            <ErrorBoundaryRoute name="Onboarding">
              <ProtectedRoute requireMentor={false}><Onboarding /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/" element={
            <ErrorBoundaryRoute name="Home">
              <ProtectedRoute><Index /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/profile" element={
            <ErrorBoundaryRoute name="Profile">
              <ProtectedRoute><Profile /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/premium" element={
            <ErrorBoundaryRoute name="Premium">
              <ProtectedRoute><Premium /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/premium/success" element={
            <ErrorBoundaryRoute name="Premium Success">
              <ProtectedRoute><PremiumSuccess /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/pep-talk/:id" element={
            <ErrorBoundaryRoute name="Pep Talk">
              <ProtectedRoute><PepTalkDetail /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/mentor-selection" element={
            <ErrorBoundaryRoute name="Mentor Selection">
              <ProtectedRoute><MentorSelection /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/admin" element={
            <ErrorBoundaryRoute name="Admin">
              <ProtectedRoute requireMentor={false}><Admin /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          {/* Core features with error boundaries */}
          <Route path="/tasks" element={
            <ErrorBoundaryRoute name="Tasks">
              <ProtectedRoute><Tasks /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/epics" element={
            <ErrorBoundaryRoute name="Epics">
              <ProtectedRoute><Epics /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/join/:code" element={
            <ErrorBoundaryRoute name="Join Epic">
              <JoinEpic />
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/shared-epics" element={
            <ErrorBoundaryRoute name="Shared Epics">
              <ProtectedRoute><SharedEpics /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/battle-arena" element={
            <ErrorBoundaryRoute name="Battle Arena">
              <ProtectedRoute><BattleArena /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/mentor-chat" element={
            <ErrorBoundaryRoute name="Mentor Chat">
              <ProtectedRoute><MentorChat /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/horoscope" element={
            <ErrorBoundaryRoute name="Horoscope">
              <ProtectedRoute><Horoscope /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/cosmic/:placement/:sign" element={
            <ErrorBoundaryRoute name="Cosmic Deep Dive">
              <ProtectedRoute><CosmiqDeepDive /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/challenges" element={
            <ErrorBoundaryRoute name="Challenges">
              <ProtectedRoute><Challenges /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/reflection" element={
            <ErrorBoundaryRoute name="Reflection">
              <ProtectedRoute><Reflection /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/library" element={
            <ErrorBoundaryRoute name="Library">
              <ProtectedRoute><Library /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/pep-talks" element={
            <ErrorBoundaryRoute name="Pep Talks">
              <ProtectedRoute><PepTalks /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/inspire" element={<Navigate to="/pep-talks" replace />} />
          
          <Route path="/search" element={
            <ErrorBoundaryRoute name="Search">
              <ProtectedRoute><Search /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="/companion" element={
            <ErrorBoundaryRoute name="Companion">
              <ProtectedRoute><Companion /></ProtectedRoute>
            </ErrorBoundaryRoute>
          } />
          
          <Route path="*" element={<ErrorBoundaryRoute name="Not Found"><NotFound /></ErrorBoundaryRoute>} />
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
