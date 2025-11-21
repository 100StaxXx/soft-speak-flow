import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, Suspense, lazy, memo } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import { EvolutionProvider } from "@/contexts/EvolutionContext";
import { useProfile } from "@/hooks/useProfile";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalEvolutionListener } from "@/components/GlobalEvolutionListener";
import { CompanionEvolvingOverlay } from "@/components/CompanionEvolvingOverlay";
import { queryRetryConfig } from "@/utils/retry";
import { InstallPWA } from "@/components/InstallPWA";
import { lockToPortrait } from "@/utils/orientationLock";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
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

// Import AppWalkthrough eagerly since it needs to persist across all pages
import { AppWalkthrough } from "@/components/AppWalkthrough";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
      refetchOnWindowFocus: false, // Don't refetch on tab switch
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

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// Separate component for evolution-aware features
const EvolutionAwareContent = memo(() => {
  const { isEvolvingLoading } = useEvolution();
  
  return (
    <>
      <GlobalEvolutionListener />
      <CompanionEvolvingOverlay isVisible={isEvolvingLoading} />
      <AppWalkthrough />
    </>
  );
});

EvolutionAwareContent.displayName = 'EvolutionAwareContent';

const AppContent = memo(() => {
  const { profile } = useProfile();
  
  return (
    <ThemeProvider mentorId={profile?.selected_mentor_id}>
      <XPProvider>
        <Suspense fallback={<LoadingFallback />}>
          <EvolutionAwareContent />
          <Routes>
          <Route path="/auth" element={<Auth />} />
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
          <Route path="/mentor-chat" element={<ProtectedRoute><MentorChat /></ProtectedRoute>} />
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
            <BrowserRouter>
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
