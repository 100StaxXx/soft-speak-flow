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
  atlas: [
    "Brings clarity when life gets noisy",
    "Keeps you grounded in principles, not impulses",
    "Unlocks clear thinking even in emotional moments"
  ],
  eli: [
    "Reminds you of the strength you already have",
    "Celebrates your progress, not just perfection",
    "Fuels your confidence with steady encouragement"
  ],
  sienna: [
    "Honors your journey while moving you forward",
    "Creates emotional safety while building strength",
    "Validates your feelings and guides you gently"
  ],
  stryker: [
    "Maximizes your focus and execution",
    "Treats your goals like an athlete treats competition",
    "Elevates you toward peak performance daily"
  ],
  carmen: [
    "Pushes you to meet your full potential",
    "Holds you accountable with fierce compassion",
    "Builds your leadership and executive presence"
  ],
  reign: [
    "Demands peak performance in body and mind",
    "Transforms you through relentless discipline",
    "Elevates your physical and professional standards"
  ],
  solace: [
    "Celebrates your wins with genuine warmth",
    "Builds your confidence through steady support",
    "Reminds you of your strength when you forget"
  ]
};

// Map tags to readable text for explanation paragraph
const TAG_TO_TEXT: Record<string, string> = {
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
  feminine_preference: "feminine mentor energy",
  masculine_preference: "masculine mentor energy",
};

export function generateMentorExplanation(
  mentor: Mentor,
  selectedAnswers: Record<string, string>
): MentorExplanation {
  const title = `Your Mentor is: ${mentor.name}`;
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
  const shortTitle = mentor.short_title || mentor.name || "mentor";
  const bullets = MENTOR_BULLETS[mentor.slug] || [
    `Guides you with ${shortTitle.toLowerCase()}`,
    `Matches your communication style`,
    `Helps you reach your goals`
  ];

  return { title, subtitle, paragraph, bullets };
}
