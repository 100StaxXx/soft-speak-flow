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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl cursor-pointer group"
            onClick={() => navigate('/horoscope')}
          >
            {/* Animated cosmic background */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-pink-600/20" />
            
            {/* Content */}
            <div className="relative p-8 backdrop-blur-sm bg-background/60 border-2 border-purple-500/30 group-hover:border-purple-500/60 transition-all duration-500">
              <div className="flex items-center justify-center gap-4">
                {/* Glowing moon icon */}
                <motion.div
                  animate={{
                    scale: [1, 1.15, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-purple-500/40 blur-xl rounded-full" />
                  <div className="relative p-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-2xl">
                    <Moon className="w-8 h-8 text-white" />
                  </div>
                </motion.div>

                {/* Rainbow text */}
                <div className="flex-1 text-center">
                  <motion.h2
                    className="text-3xl md:text-4xl font-black mb-2"
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
                    ✨ Cosmic Insight ✨
                  </motion.h2>
                  <p className="text-base text-foreground/80 font-medium">Discover your daily celestial guidance</p>
                </div>

                {/* Sparkle indicator */}
                <motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </motion.div>
              </div>
            </div>

            {/* Shine effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>
          </motion.div>

          <AskMentorChat
            mentorName={mentor.name}
            mentorTone={mentor.tone_description}
          />
        </div>
        <BottomNav />
      </div>
  );
}
