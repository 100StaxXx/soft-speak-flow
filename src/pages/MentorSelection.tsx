import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MentorGrid } from "@/components/MentorGrid";
import { useToast } from "@/hooks/use-toast";
import { MentorSelectionSkeleton } from "@/components/skeletons/MentorSelectionSkeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";

const MentorSelection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [currentMentorId, setCurrentMentorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
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
          .maybeSingle();

        if (profile?.selected_mentor_id) {
          setCurrentMentorId(profile.selected_mentor_id);
        }
      }
    } catch (error) {
      console.error("Error loading mentors:", error);
      const message = error instanceof Error ? error.message : "Failed to load guides";
      setLoadError(message);
      toast({
        title: "Error loading guides",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
     
  }, [user?.id]); // fetchData depends on user indirectly via user.id check

  const handleSelectMentor = async (mentorId: string) => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to select a guide",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      setSelecting(true);

      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const onboardingData =
        existingProfile?.onboarding_data &&
        typeof existingProfile.onboarding_data === "object" &&
        !Array.isArray(existingProfile.onboarding_data)
          ? (existingProfile.onboarding_data as Record<string, unknown>)
          : {};
      
      const { error } = await supabase
        .from("profiles")
        .update({ 
          selected_mentor_id: mentorId,
          onboarding_data: {
            ...onboardingData,
            mentorId,
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;

      // Invalidate and refetch profile cache so mentor shows immediately
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });

      toast({
        title: "Guide Selected!",
        description: "Your guide has been updated successfully",
      });
      
      // Navigate without full reload
      navigate("/mentor", { replace: true });
    } catch (error) {
      console.error("Error selecting mentor:", error);
      toast({
        title: "Error selecting guide",
        description: error instanceof Error ? error.message : "Failed to select guide",
        variant: "destructive",
      });
    } finally {
      setSelecting(false);
    }
  };

  if (loading) {
    return <MentorSelectionSkeleton />;
  }

  return (
    <div
      className="min-h-screen bg-obsidian px-4 md:px-8"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 4rem)",
        paddingBottom: "calc(var(--bottom-nav-runtime-offset, var(--bottom-nav-safe-offset)) + 2rem)",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-16">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-pure-white hover:bg-white/10 hover:text-pure-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="text-center space-y-6 animate-fade-in">
          <div className="h-1 w-24 bg-royal-gold mx-auto animate-scale-in" />
          <h1 className="text-5xl md:text-7xl font-black text-pure-white uppercase tracking-tight">
            Choose Your Guide
          </h1>
          <p className="text-xl md:text-2xl text-steel max-w-2xl mx-auto">
            Pick the voice you want guiding you.
          </p>
        </div>

        {loadError && mentors.length === 0 ? (
          <div role="alert" className="mx-auto max-w-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-pure-white">
            <p className="font-semibold">We couldn&apos;t load your guides.</p>
            <p className="mt-2 text-sm text-steel">{loadError}</p>
            <Button type="button" className="mt-5" onClick={() => { void fetchData(); }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        ) : (
          <MentorGrid
            mentors={mentors}
            onSelectMentor={handleSelectMentor}
            currentMentorId={currentMentorId}
            isSelecting={selecting}
          />
        )}
      </div>
    </div>
  );
};

export default MentorSelection;
