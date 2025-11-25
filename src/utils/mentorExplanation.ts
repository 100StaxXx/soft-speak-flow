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
    "Helps you think clearly when emotions are loud",
    "Keeps you grounded in principles, not impulses",
    "Perfect when you feel overwhelmed or overthinking"
  ],
  darius: [
    "Builds your self-respect and personal standards",
    "Teaches you to lead yourself with discipline",
    "Helps you set boundaries and stand firm"
  ],
  kai: [
    "Gives you the push you've been avoiding",
    "Holds you to a high standard, no excuses",
    "Best when you're ready for serious change"
  ],
  eli: [
    "Reminds you of your strength when you forget",
    "Helps you rebuild confidence after setbacks",
    "Encourages steady progress, not perfection"
  ],
  nova: [
    "Slows you down when your mind is racing",
    "Creates space for clarity and calm",
    "Perfect for managing anxiety and stress"
  ],
  sienna: [
    "Validates your feelings while guiding you forward",
    "Helps you heal without rushing the process",
    "Creates emotional safety while building strength"
  ],
  lumi: [
    "Brings clarity to confusing relationship patterns",
    "Helps you understand attachment and boundaries",
    "Guides you to healthier love without losing yourself"
  ],
  stryker: [
    "Maximizes your focus and execution",
    "Treats your goals like an athlete treats competition",
    "Pushes you toward peak performance daily"
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
    const struggle = formatStruggle(q2Label);
    
    paragraph = `You said you prefer ${commStyle} and that you're ${struggle}. ${mentor.name} is ${toneDescription} `;
    
    if (targetUser) {
      paragraph += `and is best for ${targetUser} `;
    }

    if (mentor.themes && mentor.themes.length > 0) {
      const topThemes = mentor.themes.slice(0, 2).join(" and ");
      paragraph += `They'll help you with ${topThemes} in a way that fits how you like to be guided.`;
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

function formatStruggle(q2Label: string): string {
  if (q2Label.includes("/")) {
    return "struggling most with " + q2Label.toLowerCase();
  }
  return "struggling most with " + q2Label.toLowerCase();
}
