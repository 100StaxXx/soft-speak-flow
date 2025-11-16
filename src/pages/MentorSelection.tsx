import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MentorGrid } from "@/components/MentorGrid";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const MentorSelection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [currentMentorId, setCurrentMentorId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch mentors
      const { data: mentorsData, error: mentorsError } = await supabase
        .from("mentors")
        .select("*")
        .eq("is_active", true)
        .order("created_at");

      if (mentorsError) throw mentorsError;
      setMentors(mentorsData || []);

      // Fetch current mentor if user is logged in
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("selected_mentor_id")
          .eq("id", user.id)
          .single();

        if (profile?.selected_mentor_id) {
          setCurrentMentorId(profile.selected_mentor_id);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading mentors",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMentor = async (mentorId: string) => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to select a mentor",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      setSelecting(true);
      
      const { error } = await supabase
        .from("profiles")
        .update({ 
          selected_mentor_id: mentorId,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Mentor Selected!",
        description: "Your mentor has been updated successfully",
      });
      
      // Navigate without full reload
      navigate("/", { replace: true });
    } catch (error: any) {
      toast({
        title: "Error selecting mentor",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-royal-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian py-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-6 animate-fade-in">
          <div className="h-1 w-24 bg-royal-gold mx-auto animate-scale-in" />
          <h1 className="text-5xl md:text-7xl font-black text-pure-white uppercase tracking-tight">
            Choose Your Mentor
          </h1>
          <p className="text-xl md:text-2xl text-steel max-w-2xl mx-auto">
            Pick the voice you want guiding you.
          </p>
        </div>

        {/* Mentor Grid */}
        <MentorGrid 
          mentors={mentors}
          onSelectMentor={handleSelectMentor}
          currentMentorId={currentMentorId}
          isSelecting={selecting}
        />
      </div>
    </div>
  );
};

export default MentorSelection;
