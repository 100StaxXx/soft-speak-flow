import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import Index from "./pages/Index";
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
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import MentorSelection from "./pages/MentorSelection";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Habits from "./pages/Habits";
import Challenges from "./pages/Challenges";
import AudioLibrary from "./pages/AudioLibrary";
import Lessons from "./pages/Lessons";
import FocusMode from "./pages/FocusMode";
import WeeklyReview from "./pages/WeeklyReview";
import MentorChat from "./pages/MentorChat";

const queryClient = new QueryClient();

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
        <Route path="/" element={<Index />} />
        <Route path="/library" element={<Library />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/video/:id" element={<VideoDetail />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/premium" element={<Premium />} />
        <Route path="/pep-talk/:id" element={<PepTalkDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/mentor-selection" element={<MentorSelection />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/audio" element={<AudioLibrary />} />
        <Route path="/lessons" element={<Lessons />} />
        <Route path="/focus" element={<FocusMode />} />
        <Route path="/review" element={<WeeklyReview />} />
        <Route path="/mentor-chat" element={<MentorChat />} />
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
