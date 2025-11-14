import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MentorCard } from "@/components/MentorCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

interface Mentor {
  id: string;
  name: string;
  mentor_type: string;
  description: string;
  tags: string[];
  voice_style: string;
  avatar_url?: string;
}

const MentorSelection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMentors();
  }, []);

  const fetchMentors = async () => {
    try {
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .order("created_at");

      if (error) throw error;
      setMentors(data || []);
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

  const handleConfirm = async () => {
    if (!selectedMentorId || !user) {
      toast({
        title: "Please select a mentor",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ selected_mentor_id: selectedMentorId })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Mentor selected!",
        description: "Your personalized experience is ready.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error saving mentor",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-secondary/30 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-secondary/30 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="flex justify-center mb-4">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <h1 className="font-heading text-5xl text-foreground">
            Choose Your Mentor
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select the guide that resonates with you. Your mentor will personalize your content, tone, and daily pushes.
          </p>
        </div>

        {/* Mentor Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {mentors.map((mentor) => (
            <MentorCard
              key={mentor.id}
              mentor={mentor}
              selected={selectedMentorId === mentor.id}
              onSelect={setSelectedMentorId}
            />
          ))}
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleConfirm}
            disabled={!selectedMentorId || saving}
            size="lg"
            className="rounded-full px-12 py-6 text-lg shadow-glow"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting Your Journey...
              </>
            ) : (
              "Begin Your Journey"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MentorSelection;
