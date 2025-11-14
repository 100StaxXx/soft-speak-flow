import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MentorMessageProps {
  mentorId?: string;
  type?: "welcome" | "motivation" | "success" | "habit";
  className?: string;
}

export const MentorMessage = ({ mentorId, type = "motivation", className = "" }: MentorMessageProps) => {
  const [message, setMessage] = useState("");
  const [mentorName, setMentorName] = useState("Your Mentor");

  useEffect(() => {
    const fetchMessage = async () => {
      if (!mentorId) return;

      try {
        const { data: mentor } = await supabase
          .from("mentors")
          .select("name, welcome_message, tone_description")
          .eq("id", mentorId)
          .single();

        if (mentor) {
          setMentorName(mentor.name);
          
          switch (type) {
            case "welcome":
              setMessage(mentor.welcome_message || `Welcome back. Let's push forward.`);
              break;
            case "success":
              setMessage(getSuccessMessage(mentor.tone_description));
              break;
            case "habit":
              setMessage(getHabitMessage(mentor.tone_description));
              break;
            default:
              setMessage(getMotivationMessage(mentor.tone_description));
          }
        }
      } catch (error) {
        console.error("Error fetching mentor message:", error);
      }
    };

    fetchMessage();
  }, [mentorId, type]);

  const getMotivationMessage = (tone: string) => {
    const messages = [
      "Time to level up.",
      "Push through. You've got this.",
      "Every rep counts. Keep going.",
      "Focus. Execute. Dominate.",
      "Your grind defines you.",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getSuccessMessage = (tone: string) => {
    const messages = [
      "That's how it's done!",
      "Crushing it. Keep that momentum.",
      "You're building something special.",
      "Progress. That's what matters.",
      "One step closer to greatness.",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getHabitMessage = (tone: string) => {
    const messages = [
      "Locked in. This is the way.",
      "Building discipline, one day at a time.",
      "You showed up. That's what counts.",
      "Consistency is your superpower.",
      "Small wins create big transformations.",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  if (!mentorId || !message) return null;

  return (
    <Card className={`p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/30 shadow-glow animate-velocity-fade-in ${className}`}>
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/20 border border-primary/40">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading text-xl text-primary mb-2">{mentorName}</h3>
          <p className="text-foreground/90 text-lg font-medium">{message}</p>
        </div>
      </div>
    </Card>
  );
};
