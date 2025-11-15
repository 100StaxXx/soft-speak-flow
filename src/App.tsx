import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Eager load critical routes
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";

// Lazy load non-critical routes
const Library = lazy(() => import("./pages/Library"));
const Videos = lazy(() => import("./pages/Videos"));
const VideoDetail = lazy(() => import("./pages/VideoDetail"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Playlists = lazy(() => import("./pages/Playlists"));
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const Saved = lazy(() => import("./pages/Saved"));
const Profile = lazy(() => import("./pages/Profile"));
const Premium = lazy(() => import("./pages/Premium"));
const PepTalkDetail = lazy(() => import("./pages/PepTalkDetail"));
const About = lazy(() => import("./pages/About"));
const Admin = lazy(() => import("./pages/Admin"));
const MentorSelection = lazy(() => import("./pages/MentorSelection"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Habits = lazy(() => import("./pages/Habits"));
const Challenges = lazy(() => import("./pages/Challenges"));
const AudioLibrary = lazy(() => import("./pages/AudioLibrary"));
const Lessons = lazy(() => import("./pages/Lessons"));
const FocusMode = lazy(() => import("./pages/FocusMode"));
const WeeklyReview = lazy(() => import("./pages/WeeklyReview"));
const MentorChat = lazy(() => import("./pages/MentorChat"));
const ContentGenerator = lazy(() => import("./pages/ContentGenerator"));
const AdaptivePushes = lazy(() => import("./pages/AdaptivePushes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

const AppContent = () => {
  const { profile } = useProfile();
  
  return (
    <ThemeProvider mentorId={profile?.selected_mentor_id}>
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<ProtectedRoute requireMentor={false}><Onboarding /></ProtectedRoute>} />
        
        {/* Protected routes - require authentication and mentor selection */}
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
        <Route path="/videos" element={<ProtectedRoute><Videos /></ProtectedRoute>} />
        <Route path="/video/:id" element={<ProtectedRoute><VideoDetail /></ProtectedRoute>} />
        <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
        <Route path="/playlists" element={<ProtectedRoute><Playlists /></ProtectedRoute>} />
        <Route path="/playlist/:id" element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>} />
        <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
        <Route path="/pep-talk/:id" element={<ProtectedRoute><PepTalkDetail /></ProtectedRoute>} />
        <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
        <Route path="/mentor-selection" element={<ProtectedRoute><MentorSelection /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
        <Route path="/audio" element={<ProtectedRoute><AudioLibrary /></ProtectedRoute>} />
        <Route path="/lessons" element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
        <Route path="/focus" element={<ProtectedRoute><FocusMode /></ProtectedRoute>} />
        <Route path="/review" element={<ProtectedRoute><WeeklyReview /></ProtectedRoute>} />
        <Route path="/mentor-chat" element={<ProtectedRoute><MentorChat /></ProtectedRoute>} />
        <Route path="/content-generator" element={<ProtectedRoute><ContentGenerator /></ProtectedRoute>} />
        <Route path="/adaptive-pushes" element={<ProtectedRoute><AdaptivePushes /></ProtectedRoute>} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
