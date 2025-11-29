import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AskMentorChat } from "@/components/AskMentorChat";
import { TodaysPepTalk } from "@/components/TodaysPepTalk";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";


export default function MentorChat() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const { data: mentor } = useQuery({
    queryKey: ['mentor', profile?.selected_mentor_id],
    queryFn: async () => {
      if (!profile?.selected_mentor_id) return null;
      const { data } = await supabase
        .from('mentors')
        .select('*')
        .eq('id', profile.selected_mentor_id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.selected_mentor_id,
  });

  if (!user || !mentor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your motivator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
        {/* Hero Banner - Pokemon TCG Pocket Style */}
        <div className="relative h-48 md:h-64 overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background animate-gradient-shift" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent" />
          
          {/* Floating particles */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/60 rounded-full animate-float-slow" />
            <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-accent/60 rounded-full animate-float-medium" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-primary/40 rounded-full animate-float-fast" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-accent/50 rounded-full animate-float-slow" style={{ animationDelay: '1.5s' }} />
          </div>
          
          {/* Mentor Avatar */}
          {mentor.avatar_url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full animate-pulse" />
                <img
                  src={mentor.avatar_url}
                  alt={mentor.name}
                  className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background shadow-glow-lg object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          )}
          
          {/* Back button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')} 
            className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-soft"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6 pb-4">
            <h1 className="text-2xl md:text-3xl font-heading font-black text-foreground text-center">
              Ask {mentor.name}
            </h1>
            <p className="text-sm text-muted-foreground text-center">Get guidance from your motivator</p>
          </div>
        </div>

        <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <TodaysPepTalk />
          
          {/* Cosmic Insight Section */}
          <div
            className="relative overflow-hidden rounded-2xl cursor-pointer p-8 bg-gradient-to-br from-purple-600/30 via-blue-600/30 to-pink-600/30 border-2 border-purple-500/50 hover:border-purple-400 transition-all"
            onClick={() => navigate('/horoscope')}
          >
            <div className="flex items-center justify-center gap-4">
              <Moon className="w-10 h-10 text-purple-400" />
              <h2 className="text-4xl font-black text-center bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                ✨ Cosmic Insight ✨
              </h2>
              <Sparkles className="w-10 h-10 text-purple-400" />
            </div>
            <p className="text-center mt-4 text-lg text-foreground/90 font-medium">
              Discover your daily celestial guidance
            </p>
          </div>

          <AskMentorChat
            mentorName={mentor.name}
            mentorTone={mentor.tone_description}
          />
        </div>
        <BottomNav />
      </div>
  );
}
