import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MentorMessageProps {
  mentorId?: string;
  type?: "welcome" | "motivation" | "success" | "habit";
  className?: string;
}

// Generate a stable pseudo-random index based on seed string
// This ensures the same mentor + type + day combination returns the same message
const getStableRandomIndex = (seed: string, arrayLength: number): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % arrayLength;
};

export const MentorMessage = ({ mentorId, type = "motivation", className = "" }: MentorMessageProps) => {
  const [message, setMessage] = useState("");
  const [mentorName, setMentorName] = useState("Your Motivator");
  
  // Create a stable seed based on mentorId, type, and today's date
  // This ensures consistent message selection for the same inputs on the same day
  const messageSeed = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
    return `${mentorId}-${type}-${today}`;
  }, [mentorId, type]);

  useEffect(() => {
    const fetchMessage = async () => {
      if (!mentorId) return;

      try {
        const { data: mentor } = await supabase
          .from("mentors")
          .select("name, welcome_message, tone_description")
          .eq("id", mentorId)
          .maybeSingle();

        if (mentor) {
          setMentorName(mentor.name);
          
          switch (type) {
            case "welcome":
              setMessage(mentor.welcome_message || `Welcome back. Let's push forward.`);
              break;
            case "success":
              setMessage(getSuccessMessage(mentor.tone_description, messageSeed));
              break;
            case "habit":
              setMessage(getHabitMessage(mentor.tone_description, messageSeed));
              break;
            default:
              setMessage(getMotivationMessage(mentor.tone_description, messageSeed));
          }
        }
      } catch (error) {
        console.error("Error fetching mentor message:", error);
      }
    };

    fetchMessage();
  }, [mentorId, type, messageSeed]);

  const getMotivationMessage = (tone: string, seed: string) => {
    const isTough = /tough|direct|discipline/i.test(tone);
    const isEmpathetic = /empathetic|supportive|gentle/i.test(tone);
    
    if (isTough) {
      const messages = [
        "No excuses. Time to execute.",
        "Push through. Weakness is temporary.",
        "Your grind defines you. Get after it.",
        "Focus. Execute. Dominate.",
        "Comfort is the enemy. Level up.",
      ];
      return messages[getStableRandomIndex(seed + 'motivation-tough', messages.length)];
    }
    
    if (isEmpathetic) {
      const messages = [
        "You're doing great. Keep going.",
        "Every step forward counts.",
        "I believe in you. You've got this.",
        "Progress, not perfection.",
        "You're stronger than you know.",
      ];
      return messages[getStableRandomIndex(seed + 'motivation-empathetic', messages.length)];
    }
    
    const messages = [
      "Time to level up.",
      "Push through. You've got this.",
      "Every rep counts. Keep going.",
      "Focus on what matters.",
      "Your potential is limitless.",
    ];
    return messages[getStableRandomIndex(seed + 'motivation-default', messages.length)];
  };

  const getSuccessMessage = (tone: string, seed: string) => {
    const isTough = /tough|direct|discipline/i.test(tone);
    const isEmpathetic = /empathetic|supportive|gentle/i.test(tone);
    
    if (isTough) {
      const messages = [
        "That's what I'm talking about.",
        "Keep that intensity up.",
        "One down. Keep stacking wins.",
        "This is who you are. A winner.",
        "Momentum is everything. Don't stop.",
      ];
      return messages[getStableRandomIndex(seed + 'success-tough', messages.length)];
    }
    
    if (isEmpathetic) {
      const messages = [
        "I'm so proud of you!",
        "You did it! Celebrate this win.",
        "See? You're capable of amazing things.",
        "This is beautiful progress.",
        "Your effort is paying off.",
      ];
      return messages[getStableRandomIndex(seed + 'success-empathetic', messages.length)];
    }
    
    const messages = [
      "That's how it's done!",
      "Crushing it. Keep that momentum.",
      "You're building something special.",
      "Progress. That's what matters.",
      "One step closer to greatness.",
    ];
    return messages[getStableRandomIndex(seed + 'success-default', messages.length)];
  };

  const getHabitMessage = (tone: string, seed: string) => {
    const isTough = /tough|direct|discipline/i.test(tone);
    const isEmpathetic = /empathetic|supportive|gentle/i.test(tone);
    
    if (isTough) {
      const messages = [
        "Discipline over motivation. Always.",
        "You showed up. That's non-negotiable.",
        "Habits build empires. Keep stacking.",
        "Consistency separates winners from dreamers.",
        "No days off from greatness.",
      ];
      return messages[getStableRandomIndex(seed + 'habit-tough', messages.length)];
    }
    
    if (isEmpathetic) {
      const messages = [
        "You showed up for yourself today.",
        "Building habits takes courage. You have it.",
        "Every time you show up, you grow.",
        "Be proud - this is real growth.",
        "You're becoming who you want to be.",
      ];
      return messages[getStableRandomIndex(seed + 'habit-empathetic', messages.length)];
    }
    
    const messages = [
      "Locked in. This is the way.",
      "Building discipline, one day at a time.",
      "You showed up. That's what counts.",
      "Consistency is your superpower.",
      "Small wins create big transformations.",
    ];
    return messages[getStableRandomIndex(seed + 'habit-default', messages.length)];
  };

  if (!mentorId || !message) return null;

  return (
    <Card className={`p-5 md:p-6 bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30 shadow-glow animate-velocity-fade-in relative overflow-hidden ${className}`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
      
      <div className="flex items-start gap-3 md:gap-4 relative z-10">
        <div className="p-2.5 md:p-3 rounded-lg bg-primary/20 border border-primary/40 flex-shrink-0">
          <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-lg md:text-xl font-black text-primary mb-2">{mentorName}</h3>
          <p className="text-foreground/90 text-base md:text-lg font-medium leading-relaxed">{message}</p>
        </div>
      </div>
    </Card>
  );
};
