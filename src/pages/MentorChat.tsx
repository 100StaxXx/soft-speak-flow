import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AskMentorChat } from "@/components/AskMentorChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { MentorChatTour } from "@/components/MentorChatTour";

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
        .single();
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
    <>
      <MentorChatTour />
      <div className="min-h-screen bg-background pb-24">
        <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-3 md:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-heading font-black text-foreground truncate">Ask {mentor.name}</h1>
              <p className="text-sm text-muted-foreground">Get guidance from your motivator</p>
            </div>
          </div>

          <AskMentorChat
            mentorName={mentor.name}
            mentorTone={mentor.tone_description}
          />
        </div>
        <BottomNav />
      </div>
    </>
  );
}
