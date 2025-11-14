import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MentorCard } from "@/components/MentorCard";
import { MentorArrival } from "@/components/MentorArrival";
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
  const [showArrival, setShowArrival] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);

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

    const mentor = mentors.find(m => m.id === selectedMentorId);
    if (!mentor) return;

    setSelectedMentor(mentor);
    setShowArrival(true);
  };

  const handleArrivalComplete = async () => {
    if (!selectedMentorId || !user) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("profiles")
        .update({ 
          selected_mentor_id: selectedMentorId,
          updated_at: new Date().toISOString()
        })
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
    <>
      {showArrival && selectedMentor && (
        <MentorArrival
          mentorName={selectedMentor.name}
          mentorDescription={selectedMentor.description}
          onComplete={handleArrivalComplete}
        />
      )}
      
      <div className="min-h-screen bg-obsidian py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 space-y-6">
            <div className="h-1 w-24 bg-royal-gold mx-auto mb-8 animate-sweep-line" />
            <h1 className="text-6xl font-black text-pure-white uppercase tracking-tight animate-velocity-fade-in">
              Choose Your Mentor
            </h1>
            <p className="text-xl text-steel max-w-2xl mx-auto animate-velocity-fade-in">
              Select the guide that resonates with you. Your mentor will personalize your journey.
            </p>
          </div>

          {/* Mentor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
              className="px-16 py-7 text-lg font-black uppercase tracking-wider"
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
    </>
  );
};

export default MentorSelection;
