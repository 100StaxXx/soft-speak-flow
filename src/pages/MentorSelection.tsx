import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getMentors } from "@/lib/firebase/mentors";
import { updateProfile } from "@/lib/firebase/profiles";
import { MentorGrid } from "@/components/MentorGrid";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getResolvedMentorId } from "@/utils/mentor";
import { useProfile } from "@/hooks/useProfile";
import { getAllMentors, Mentor } from "@/lib/firebase/mentors";
import { updateProfile } from "@/lib/firebase/profiles";

const MentorSelection = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  const fetchData = async () => {
    try {
      // Load ALL mentors from Firestore - no filters (activeOnly = false)
      const mentorsData = await getMentors(false);

      console.log(`[MentorSelection] Loaded ${mentorsData?.length || 0} mentors from Firestore`);
      setMentors(mentorsData || []);

      if (!mentorsData || mentorsData.length === 0) {
        console.warn("[MentorSelection] No mentors found in Firestore database");
        toast({
          title: "No mentors available",
          description: "No mentors were found in the database. Please contact support.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[MentorSelection] Error loading mentors from Firestore:", error);
      toast({
        title: "Error loading mentors",
        description: error instanceof Error ? error.message : "Failed to load mentors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch mentors once on mount

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
      
      await updateProfile(user.uid, { selected_mentor_id: mentorId });

      // Invalidate profile query to refresh mentor data across the app
      await queryClient.invalidateQueries({ queryKey: ["profile", user.uid] });
      // Also invalidate mentor-related queries
      await queryClient.invalidateQueries({ queryKey: ["selected-mentor"] });
      await queryClient.invalidateQueries({ queryKey: ["mentor-personality"] });
      await queryClient.invalidateQueries({ queryKey: ["mentor"] });

      toast({
        title: "Mentor Selected!",
        description: "Your mentor has been updated successfully",
      });
      
      // Navigate without full reload
      navigate("/mentor", { replace: true });
    } catch (error) {
      console.error("Error selecting mentor:", error);
      toast({
        title: "Error selecting mentor",
        description: error instanceof Error ? error.message : "Failed to select mentor",
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
          currentMentorId={getResolvedMentorId(profile)}
          isSelecting={selecting}
        />
      </div>
    </div>
  );
};

export default MentorSelection;
