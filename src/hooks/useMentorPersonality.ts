import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { resolveMentorSlugAlias } from "@/lib/mentorRoster";

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
  sage: {
    buttonText: (action) => `${action} with calm`,
    emptyState: (context) => `One clear step is enough. Begin with ${context}.`,
    encouragement: () => "Small steps still move mountains.",
    nudge: () => "Breathe first. Then continue.",
  },
  icon: {
    buttonText: (action) => `${action} with intention`,
    emptyState: (context) => `Does ${context} match your standard?`,
    encouragement: () => "We don't shrink to make the choice easier.",
    nudge: () => "Stay aligned with who you're becoming.",
  },
  charles: {
    buttonText: (action) => `${action}. Obviously.`,
    emptyState: (context) => `We're avoiding ${context} now? Cute.`,
    encouragement: () => "Embarrassing would be stopping now.",
    nudge: () => "You know better. Do better.",
  },
  princess: {
    buttonText: (action) => `Let's ${action.toLowerCase()}`,
    emptyState: (context) => `A soft start still counts. Begin with ${context}.`,
    encouragement: () => "A gentle, productive day is enough.",
    nudge: () => "Let's take care of ourselves today.",
  },
  operator: {
    buttonText: (action) => `${action}. Execute.`,
    emptyState: (context) => `Your current system lacks ${context}. Let's correct it.`,
    encouragement: () => "We're not guessing. We're executing.",
    nudge: () => "Start the next block.",
  },
  rival: {
    buttonText: (action) => `${action}. Show me.`,
    emptyState: (context) => `That's the standard? Raise it while you ${context}.`,
    encouragement: () => "You said you were different. Prove it.",
    nudge: () => "Try harder.",
  },
  reign: {
    buttonText: (action) => `${action}. No excuses.`,
    emptyState: (context) => `Excellence still applies to ${context}.`,
    encouragement: () => "Stand tall and make today count.",
    nudge: () => "Lock in.",
  },
};

export const useMentorPersonality = (): MentorPersonality | null => {
  const { mentorId: resolvedMentorId } = useMentorConnection();

  const { data: mentor } = useQuery({
    queryKey: ['mentor-personality', resolvedMentorId],
    queryFn: async () => {
      if (!resolvedMentorId) return null;
      const { data, error } = await supabase
        .from('mentors')
        .select('name, slug, tone_description, style, avatar_url, primary_color')
        .eq('id', resolvedMentorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!resolvedMentorId,
  });

  if (!mentor) return null;

  const resolvedSlug = resolveMentorSlugAlias(mentor.slug) ?? mentor.slug ?? "sage";
  const template = personalityTemplates[resolvedSlug] ?? personalityTemplates.sage;

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
