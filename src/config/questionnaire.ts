export const MENTOR_SLUGS = ["atlas", "darius", "kai", "eli", "nova", "sienna", "lumi", "stryker", "solace"] as const;

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  question: string;
  options: QuestionOption[];
}

export const QUESTIONNAIRE: Question[] = [
  {
    id: "q1",
    question: "How do you prefer to be spoken to?",
    options: [
      { id: "q1_a", label: "Direct and straightforward" },
      { id: "q1_b", label: "Calm and logical" },
      { id: "q1_c", label: "Soft and comforting" },
      { id: "q1_d", label: "Encouraging and uplifting" },
      { id: "q1_e", label: "Intense and brutally honest" },
      { id: "q1_f", label: "Spiritual, intuitive, reflective" }
    ]
  },
  {
    id: "q2",
    question: "What are you struggling with the most right now?",
    options: [
      { id: "q2_a", label: "Discipline / consistency" },
      { id: "q2_b", label: "Anxiety / overthinking" },
      { id: "q2_c", label: "Heartbreak or relationship issues" },
      { id: "q2_d", label: "Confidence / self-worth" },
      { id: "q2_e", label: "Focus / performance / goals" },
      { id: "q2_f", label: "Emotional healing / forgiveness" }
    ]
  },
  {
    id: "q3",
    question: "How much intensity do you want in your guidance?",
    options: [
      { id: "q3_a", label: "High intensity — push me hard" },
      { id: "q3_b", label: "Medium intensity — be firm but fair" },
      { id: "q3_c", label: "Low intensity — slow, gentle guidance" }
    ]
  },
  {
    id: "q4",
    question: "What's your emotional style?",
    options: [
      { id: "q4_a", label: "I respond well to tough love" },
      { id: "q4_b", label: "I need clarity and logic to feel grounded" },
      { id: "q4_c", label: "I need emotional validation and warmth" },
      { id: "q4_d", label: "I respond best to motivation and positive energy" },
      { id: "q4_e", label: "I connect more with spiritual or intuitive guidance" }
    ]
  },
  {
    id: "q5",
    question: "What's your current season of life?",
    options: [
      { id: "q5_a", label: "Building discipline and structure" },
      { id: "q5_b", label: "Healing from emotional pain" },
      { id: "q5_c", label: "Rebuilding confidence after setbacks" },
      { id: "q5_d", label: "Searching for purpose and clarity" },
      { id: "q5_e", label: "Improving relationships or breaking old patterns" },
      { id: "q5_f", label: "Entering a new level of ambition and performance" }
    ]
  },
  {
    id: "q6",
    question: "Which sentence feels closest to what you want right now?",
    options: [
      { id: "q6_a", label: "I need someone to help me stay disciplined." },
      { id: "q6_b", label: "I need someone to help me calm down and think clearly." },
      { id: "q6_c", label: "I need someone to help me heal and feel safe." },
      { id: "q6_d", label: "I need someone to encourage me and lift me up." },
      { id: "q6_e", label: "I need someone to push me to my highest level." },
      { id: "q6_f", label: "I need someone to help me listen to my intuition again." }
    ]
  },
  {
    id: "q7",
    question: "What do you value MOST in a mentor?",
    options: [
      { id: "q7_a", label: "Strength" },
      { id: "q7_b", label: "Calmness" },
      { id: "q7_c", label: "Compassion" },
      { id: "q7_d", label: "Motivation" },
      { id: "q7_e", label: "Wisdom" },
      { id: "q7_f", label: "Spiritual connection" }
    ]
  }
];

export const ANSWER_MENTOR_MAP: Record<string, string[]> = {
  // Q1: How do you prefer to be spoken to?
  "q1_a": ["darius", "stryker"],
  "q1_b": ["atlas", "nova"],
  "q1_c": ["sienna", "lumi"],
  "q1_d": ["eli", "lumi"],
  "q1_e": ["kai", "stryker"],
  "q1_f": ["solace", "nova"],

  // Q2: What are you struggling with the most right now?
  "q2_a": ["darius", "kai", "stryker", "atlas"],
  "q2_b": ["nova", "atlas", "solace"],
  "q2_c": ["lumi", "sienna"],
  "q2_d": ["eli", "darius"],
  "q2_e": ["stryker", "kai", "atlas"],
  "q2_f": ["sienna", "solace"],

  // Q3: How much intensity do you want?
  "q3_a": ["kai", "stryker"],
  "q3_b": ["darius", "atlas", "eli", "lumi"],
  "q3_c": ["sienna", "nova", "solace"],

  // Q4: What's your emotional style?
  "q4_a": ["darius", "kai", "stryker"],
  "q4_b": ["atlas", "nova"],
  "q4_c": ["sienna", "lumi"],
  "q4_d": ["eli"],
  "q4_e": ["solace"],

  // Q5: Current season of life
  "q5_a": ["darius", "kai", "atlas"],
  "q5_b": ["sienna", "solace", "lumi"],
  "q5_c": ["eli", "nova"],
  "q5_d": ["atlas", "solace"],
  "q5_e": ["lumi", "sienna"],
  "q5_f": ["stryker", "kai"],

  // Q6: Closest need right now
  "q6_a": ["darius", "kai", "atlas"],
  "q6_b": ["nova", "atlas"],
  "q6_c": ["sienna", "lumi"],
  "q6_d": ["eli"],
  "q6_e": ["stryker", "kai"],
  "q6_f": ["solace"],

  // Q7: What do you value MOST in a mentor?
  "q7_a": ["darius", "kai", "stryker"],
  "q7_b": ["nova", "atlas"],
  "q7_c": ["sienna", "lumi"],
  "q7_d": ["eli", "stryker"],
  "q7_e": ["atlas"],
  "q7_f": ["solace"]
};
