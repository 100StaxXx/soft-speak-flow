import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AskMentorChat } from "@/components/AskMentorChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

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
        <p className="text-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-heading text-foreground">Ask {mentor.name}</h1>
            <p className="text-muted-foreground">Get guidance from your mentor</p>
          </div>
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
