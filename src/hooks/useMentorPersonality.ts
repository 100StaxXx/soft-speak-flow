import { useProfile } from "./useProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getResolvedMentorId } from "@/utils/mentor";

interface MentorPersonality {
  name: string;
  slug: string;
  tone: string;
  style: string;
  avatar_url?: string;
  primary_color: string;
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
  const resolvedMentorId = getResolvedMentorId(profile);

  const { data: mentor } = useQuery({
    queryKey: ['mentor-personality', resolvedMentorId],
    queryFn: async () => {
      if (!resolvedMentorId) return null;
      const { data } = await supabase
        .from('mentors')
        .select('name, slug, tone_description, style, avatar_url, primary_color')
        .eq('id', resolvedMentorId)
        .maybeSingle();
      return data;
    },
    enabled: !!resolvedMentorId,
  });

  if (!mentor) return null;

  const toneDescription = mentor.tone_description?.toLowerCase() ?? "";

  // Determine personality type from tone
  const toneKeyword = toneDescription;
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
    slug: mentor.slug || '',
    tone: mentor.tone_description ?? "",
    style: mentor.style || '',
    avatar_url: mentor.avatar_url || undefined,
    primary_color: mentor.primary_color || '#000',
    buttonText: template.buttonText!,
    emptyState: template.emptyState!,
    encouragement: template.encouragement!,
    nudge: template.nudge!,
  };
};
