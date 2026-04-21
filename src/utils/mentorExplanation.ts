import { resolveMentorSlugAlias } from "@/lib/mentorRoster";

interface Mentor {
  id: string;
  slug: string;
  name: string;
  short_title: string;
  tone_description: string;
  target_user: string;
  themes?: string[];
}

export interface MentorExplanation {
  title: string;
  subtitle: string;
  paragraph: string;
  bullets: string[];
}

const MENTOR_BULLETS: Record<string, string[]> = {
  sage: [
    "Brings perspective when your mind feels crowded",
    "Keeps you calm enough to hear what actually matters",
    "Turns overwhelm into one steady next step"
  ],
  lyra: [
    "Turns noise into signal when your thoughts feel scattered",
    "Helps you spot the pattern before the problem keeps snowballing",
    "Brings elegant strategy without losing emotional clarity"
  ],
  icon: [
    "Helps you choose from standards instead of insecurity",
    "Sharpens your boundaries without making you louder",
    "Keeps your actions aligned with the version of you you're building"
  ],
  charles: [
    "Calls out procrastination before it turns into a whole day",
    "Keeps accountability sharp, short, and memorable",
    "Turns avoidance into action with a little attitude"
  ],
  princess: [
    "Makes consistency feel supportive instead of punishing",
    "Builds routines that still leave room for softness",
    "Pairs self-respect with steady forward motion"
  ],
  operator: [
    "Builds structure where your day keeps leaking time",
    "Turns intentions into clean execution",
    "Treats your routine like a system worth optimizing"
  ],
  rival: [
    "Uses challenge to wake up your competitive side",
    "Pushes past excuses fast",
    "Makes effort feel like something to prove"
  ]
};

// Map tags to readable text for explanation paragraph
const TAG_TO_TEXT: Record<string, string> = {
  clarity_signal: "clarity, signal, and perspective",
  clarity_perspective: "clarity, calm, and perspective",
  standards_identity: "identity, self-respect, and higher standards",
  gentle_routines: "gentle habits and steady consistency",
  execution_pressure: "execution, pressure, and accountability",
  systems_execution: "structure and clean execution",
  competitive_performance: "performance and intensity",
  procrastination_accountability: "ending procrastination with accountability",

  calm_reflective: "calm, reflective guidance",
  direct_challenging: "direct, challenging guidance",
  composed_polished: "composed, polished guidance",
  warm_encouraging: "warm, encouraging guidance",
  precise_no_nonsense: "precise, no-nonsense guidance",
  aggressive_challenging: "aggressive, challenging guidance",
  sharp_sarcastic: "sharp, sarcastic accountability",

  perspective_next_step: "finding the clearest next step",
  perspective_first: "slowing down and finding the clearest next step",
  identity_alignment: "acting in a way that matches your standards",
  gentle_accountability: "gentle accountability without shame",
  hard_accountability: "hard accountability that pushes you to execute",
  soft_support: "gentle support without shame",
  system_building: "a tighter system and stronger structure",
  pressure_prove_it: "pressure that pushes you to prove it",
  callout_avoidance: "having your excuses called out quickly",
  calm_perspective: "calm perspective",
  pattern_strategy: "pattern strategy",
  standards_self_command: "standards and self-command",
  systems_precision: "systems precision",
  prove_it_pressure: "prove-it pressure",
  sarcastic_callout: "sarcastic callout",

  // Growth focus tags
  discipline: "building discipline",
  performance: "peak performance",
  calm: "finding calm",
  mindfulness: "mental clarity",
  healer: "emotional healing",
  healing: "healing and recovery",
  supportive: "supportive growth",
  uplifting: "building confidence",
  confidence: "confidence building",
  momentum: "building momentum",
  
  // Guidance style tags
  tough_love: "direct, no-nonsense guidance",
  direct: "straightforward guidance",
  warm: "gentle, nurturing guidance",
  soft: "soft, compassionate guidance",
  stoic: "calm, thoughtful wisdom",
  high_energy: "high-energy motivation",
  
  // Energy tags
  intense: "intense energy",
  grounded: "grounded energy",
  spiritual: "spiritual guidance",
  intuition: "intuitive guidance",
  neutral_presence: "neutral energy from your guide",
  either_works: "any guide energy",
  feminine_presence: "feminine energy from your guide",
  masculine_presence: "masculine energy from your guide",
  feminine_preference: "a woman as your guide",
  masculine_preference: "a man as your guide",
};

export function generateMentorExplanation(
  mentor: Mentor,
  selectedAnswers: Record<string, string>
): MentorExplanation {
  const title = `Your Guide is: ${mentor.name}`;
  const subtitle = mentor.short_title;

  // Support current onboarding question IDs with backward compatibility for legacy keys.
  const growthTag = selectedAnswers["focus_area"] || selectedAnswers["growth_focus"] || "";
  const guidanceTag = selectedAnswers["guidance_tone"] || selectedAnswers["guidance_style"] || "";
  const energyTag = selectedAnswers["mentor_energy"] || selectedAnswers["energy_preference"] || "";

  // Build paragraph
  let paragraph = "";

  const toneDescription = mentor.tone_description?.toLowerCase() ?? "supportive";
  const targetUser = mentor.target_user?.toLowerCase();

  const growthText = TAG_TO_TEXT[growthTag] || growthTag.replace(/_/g, " ");
  const guidanceText = TAG_TO_TEXT[guidanceTag] || guidanceTag.replace(/_/g, " ");

  if (growthTag && guidanceTag) {
    paragraph = `You're focused on ${growthText} and prefer ${guidanceText}. ${mentor.name} is ${toneDescription}`;
    
    if (targetUser) {
      paragraph += ` and is ideal for ${targetUser}.`;
    } else {
      paragraph += ".";
    }

    if (mentor.themes && mentor.themes.length > 0) {
      const topThemes = mentor.themes.slice(0, 2).join(" and ");
      paragraph += ` They'll support your growth in ${topThemes} in a way that fits how you like to be guided.`;
    }

    const energyText = TAG_TO_TEXT[energyTag];
    if (energyText) {
      paragraph += ` You also asked for ${energyText}.`;
    }
  } else {
    // Fallback if answers missing
    paragraph = `${mentor.name} is ${toneDescription}${targetUser ? ` and is best for ${targetUser}` : ""}.`;
    
    if (mentor.themes && mentor.themes.length > 0) {
      const topThemes = mentor.themes.slice(0, 2).join(" and ");
      paragraph += ` They specialize in ${topThemes}.`;
    }
  }

  // Get bullets
  const shortTitle = mentor.short_title || mentor.name || "guide";
  const resolvedSlug = resolveMentorSlugAlias(mentor.slug) ?? mentor.slug;
  const bullets = MENTOR_BULLETS[resolvedSlug] || [
    `Guides you with ${shortTitle.toLowerCase()}`,
    `Matches your communication style`,
    `Helps you reach your goals`
  ];

  return { title, subtitle, paragraph, bullets };
}
