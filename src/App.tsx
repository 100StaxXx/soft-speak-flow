import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Import all pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Library from "./pages/Library";
import Videos from "./pages/Videos";
import VideoDetail from "./pages/VideoDetail";
import Quotes from "./pages/Quotes";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import Saved from "./pages/Saved";
import Profile from "./pages/Profile";
import Premium from "./pages/Premium";
import PepTalkDetail from "./pages/PepTalkDetail";
import About from "./pages/About";
import Admin from "./pages/Admin";
import MentorSelection from "./pages/MentorSelection";
import NotFound from "./pages/NotFound";
import Habits from "./pages/Habits";
import Challenges from "./pages/Challenges";
import AudioLibrary from "./pages/AudioLibrary";
import Lessons from "./pages/Lessons";
import FocusMode from "./pages/FocusMode";
import WeeklyReview from "./pages/WeeklyReview";
import MentorChat from "./pages/MentorChat";
import ContentGenerator from "./pages/ContentGenerator";
import AdaptivePushes from "./pages/AdaptivePushes";
import Dashboard from "./pages/Dashboard";

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
        
        {/* Protected routes - require authentication */}
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
        <Route path="/admin" element={<ProtectedRoute requireMentor={false}><Admin /></ProtectedRoute>} />
        <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
        <Route path="/audio" element={<ProtectedRoute><AudioLibrary /></ProtectedRoute>} />
        <Route path="/lessons" element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
        <Route path="/focus" element={<ProtectedRoute><FocusMode /></ProtectedRoute>} />
        <Route path="/review" element={<ProtectedRoute><WeeklyReview /></ProtectedRoute>} />
        <Route path="/mentor-chat" element={<ProtectedRoute><MentorChat /></ProtectedRoute>} />
        <Route path="/content-generator" element={<ProtectedRoute><ContentGenerator /></ProtectedRoute>} />
        <Route path="/adaptive-pushes" element={<ProtectedRoute><AdaptivePushes /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/weekly-review" element={<ProtectedRoute><WeeklyReview /></ProtectedRoute>} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
};

const App = () => (
  <ErrorBoundary>
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
  </ErrorBoundary>
);

export default App;
