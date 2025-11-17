import { useProfile } from "./useProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MentorPersonality {
  name: string;
  tone: string;
  style: string;
  avatar_url?: string;
  buttonText: (action: string) => string;
  emptyState: (context: string) => string;
  encouragement: () => string;
  nudge: () => string;
}

const personalityTemplates: Record<string, Partial<MentorPersonality>> = {
  tough: {
    buttonText: (action) => `${action}. Now.`,
    emptyState: (context) => `No excuses. Start ${context}.`,
    encouragement: () => "You're tougher than this. Prove it.",
    nudge: () => "Stop waiting. Act."
  },
  direct: {
    buttonText: (action) => action,
    emptyState: (context) => `Time to ${context}.`,
    encouragement: () => "Keep pushing forward.",
    nudge: () => "Get it done."
  },
  empathetic: {
    buttonText: (action) => `${action} when you're ready`,
    emptyState: (context) => `Take your time with ${context}. I'm here.`,
    encouragement: () => "You're doing great. Keep going.",
    nudge: () => "Just checking in on you."
  },
  supportive: {
    buttonText: (action) => `Let's ${action.toLowerCase()}`,
    emptyState: (context) => `Ready to ${context}? I believe in you.`,
    encouragement: () => "You've got this!",
    nudge: () => "How are you feeling today?"
  },
  wise: {
    buttonText: (action) => `${action} mindfully`,
    emptyState: (context) => `Consider ${context} as your next step.`,
    encouragement: () => "Every step forward is progress.",
    nudge: () => "Reflect on your path."
  }
};

export const useMentorPersonality = (): MentorPersonality | null => {
  const { profile } = useProfile();

  const { data: mentor } = useQuery({
    queryKey: ['mentor-personality', profile?.selected_mentor_id],
    queryFn: async () => {
      if (!profile?.selected_mentor_id) return null;
      const { data } = await supabase
        .from('mentors')
        .select('name, tone_description, style, avatar_url')
        .eq('id', profile.selected_mentor_id)
        .single();
      return data;
    },
    enabled: !!profile?.selected_mentor_id,
  });

  if (!mentor) return null;

  // Determine personality type from tone
  const toneKeyword = mentor.tone_description.toLowerCase();
  let template = personalityTemplates.supportive; // default
  
  if (toneKeyword.includes('tough') || toneKeyword.includes('hard')) {
    template = personalityTemplates.tough;
  } else if (toneKeyword.includes('direct')) {
    template = personalityTemplates.direct;
  } else if (toneKeyword.includes('empathetic')) {
    template = personalityTemplates.empathetic;
  } else if (toneKeyword.includes('wise') || toneKeyword.includes('calm')) {
    template = personalityTemplates.wise;
  }

  return {
    name: mentor.name,
    tone: mentor.tone_description,
    style: mentor.style || '',
    avatar_url: mentor.avatar_url || undefined,
    buttonText: template.buttonText!,
    emptyState: template.emptyState!,
    encouragement: template.encouragement!,
    nudge: template.nudge!,
  };
};
