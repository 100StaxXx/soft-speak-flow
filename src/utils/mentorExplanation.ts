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
  kai: [
    "Ignites the drive you've been looking for",
    "Holds you to a high standard, no excuses",
    "Accelerates your growth when you're ready to level up"
  ],
  eli: [
    "Reminds you of the strength you already have",
    "Celebrates your progress, not just perfection",
    "Fuels your confidence with steady encouragement"
  ],
  nova: [
    "Creates space for calm and clear thinking",
    "Helps you find peace in the present moment",
    "Unlocks mental clarity and inner stillness"
  ],
  sienna: [
    "Honors your journey while moving you forward",
    "Creates emotional safety while building strength",
    "Validates your feelings and guides you gently"
  ],
  lumi: [
    "Illuminates patterns in how you connect",
    "Strengthens your understanding of boundaries",
    "Guides you toward deeper, healthier relationships"
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
  elizabeth: [
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
};

export function generateMentorExplanation(
  mentor: Mentor,
  selectedAnswers: Record<string, string>
): MentorExplanation {
  const title = `Your Mentor is: ${mentor.name}`;
  const subtitle = mentor.short_title;

  // Get tags from the new StoryQuestionnaire format
  const growthTag = selectedAnswers["growth_focus"] || "";
  const guidanceTag = selectedAnswers["guidance_style"] || "";
  const energyTag = selectedAnswers["energy_preference"] || "";

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
