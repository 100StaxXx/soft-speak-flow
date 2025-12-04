import { QUESTIONNAIRE } from "@/config/questionnaire";

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
  darius: [
    "Strengthens your self-respect and personal standards",
    "Empowers you to lead yourself with discipline",
    "Helps you set boundaries and stand firm"
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
  solace: [
    "Reconnects you with your inner wisdom",
    "Helps you trust your intuition again",
    "Guides you toward spiritual alignment and peace"
  ]
};

export function generateMentorExplanation(
  mentor: Mentor,
  selectedAnswers: Record<string, string>
): MentorExplanation {
  const title = `Your Mentor is: ${mentor.name}`;
  const subtitle = mentor.short_title;

  // Get Q1, Q2, Q6 labels
  const q1Label = getAnswerLabel("q1", selectedAnswers["q1"]);
  const q2Label = getAnswerLabel("q2", selectedAnswers["q2"]);
  const q6Label = getAnswerLabel("q6", selectedAnswers["q6"]);

  // Build paragraph
  let paragraph = "";

  const toneDescription = mentor.tone_description?.toLowerCase() ?? "supportive";
  const targetUser = mentor.target_user?.toLowerCase();

  if (q1Label && q2Label) {
    const commStyle = formatCommunicationStyle(q1Label);
    const focusArea = formatFocusArea(q2Label);
    
    paragraph = `You said you prefer ${commStyle} and that you're ${focusArea}. ${mentor.name} is ${toneDescription} `;
    
    if (targetUser) {
      paragraph += `and is ideal for ${targetUser} `;
    }

    if (mentor.themes && mentor.themes.length > 0) {
      const topThemes = mentor.themes.slice(0, 2).join(" and ");
      paragraph += `They'll support your growth in ${topThemes} in a way that fits how you like to be guided.`;
    }
  } else {
    // Fallback if answers missing
    paragraph = `${mentor.name} is ${toneDescription} ${targetUser ? `and is best for ${targetUser}` : ''}`;
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

function getAnswerLabel(questionId: string, optionId: string): string {
  const question = QUESTIONNAIRE.find(q => q.id === questionId);
  if (!question) return "";
  
  const option = question.options.find(o => o.id === optionId);
  return option?.label || "";
}

function formatCommunicationStyle(q1Label: string): string {
  return q1Label.toLowerCase() + " guidance";
}

function formatFocusArea(q2Label: string): string {
  return "focused on " + q2Label.toLowerCase();
}
