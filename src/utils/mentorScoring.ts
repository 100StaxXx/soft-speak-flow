import { MENTOR_SLUGS, ANSWER_MENTOR_MAP, QUESTIONNAIRE } from "@/config/questionnaire";

interface Mentor {
  id: string;
  slug: string;
  name: string;
  themes?: string[];
}

export interface MentorScoreResult {
  scores: Record<string, number>;
  winnerSlug: string;
  rankedMentors: string[];
}

export function calculateMentorScores(
  selectedAnswers: Record<string, string>,
  mentors: Mentor[]
): MentorScoreResult {
  // Initialize scores
  const scores: Record<string, number> = {};
  MENTOR_SLUGS.forEach(slug => {
    scores[slug] = 0;
  });

  // Calculate scores
  Object.values(selectedAnswers).forEach(optionId => {
    const mentorSlugs = ANSWER_MENTOR_MAP[optionId];
    if (mentorSlugs) {
      mentorSlugs.forEach(slug => {
        scores[slug] = (scores[slug] || 0) + 10;
      });
    }
  });

  // Find highest score
  const maxScore = Math.max(...Object.values(scores));
  const tiedMentors = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([slug]) => slug);

  let winnerSlug: string;

  if (tiedMentors.length === 1) {
    winnerSlug = tiedMentors[0];
  } else {
    // Tie-breaking logic
    winnerSlug = breakTie(tiedMentors, selectedAnswers, mentors);
  }

  // Rank all mentors by score
  const rankedMentors = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([slug]) => slug);

  return { scores, winnerSlug, rankedMentors };
}

function breakTie(
  tiedMentors: string[],
  selectedAnswers: Record<string, string>,
  mentors: Mentor[]
): string {
  // 1. Use Q1 as primary tie-breaker
  const q1Answer = selectedAnswers["q1"];
  if (q1Answer) {
    const q1Mentors = ANSWER_MENTOR_MAP[q1Answer] || [];
    const q1Match = tiedMentors.find(m => q1Mentors.includes(m));
    if (q1Match && tiedMentors.filter(m => q1Mentors.includes(m)).length === 1) {
      return q1Match;
    }
  }

  // 2. Use Q3 intensity as secondary tie-breaker
  const q3Answer = selectedAnswers["q3"];
  if (q3Answer === "q3_a") {
    // High intensity: prioritize kai/stryker
    const match = tiedMentors.find(m => m === "kai" || m === "stryker");
    if (match) return match;
  } else if (q3Answer === "q3_c") {
    // Low intensity: prioritize sienna/nova/solace
    const match = tiedMentors.find(m => ["sienna", "nova", "solace"].includes(m));
    if (match) return match;
  }

  // 3. Use theme overlap with Q2/Q5
  const q2Answer = selectedAnswers["q2"];
  const q5Answer = selectedAnswers["q5"];
  const themeKeywords = getThemeKeywords(q2Answer, q5Answer);

  if (themeKeywords.length > 0) {
    const themeScores = tiedMentors.map(slug => {
      const mentor = mentors.find(m => m.slug === slug);
      if (!mentor?.themes) return { slug, score: 0 };

      const overlap = mentor.themes.filter(theme =>
        themeKeywords.some(keyword => theme.toLowerCase().includes(keyword.toLowerCase()))
      ).length;

      return { slug, score: overlap };
    });

    const maxThemeScore = Math.max(...themeScores.map(t => t.score));
    if (maxThemeScore > 0) {
      const bestThemeMatch = themeScores.find(t => t.score === maxThemeScore);
      if (bestThemeMatch) return bestThemeMatch.slug;
    }
  }

  // 4. Default to alphabetical order
  return tiedMentors.sort()[0];
}

function getThemeKeywords(q2Answer?: string, q5Answer?: string): string[] {
  const keywords: string[] = [];

  // Q2 keywords
  const q2Map: Record<string, string[]> = {
    "q2_a": ["discipline", "consistency"],
    "q2_b": ["anxiety", "calm", "mindfulness"],
    "q2_c": ["relationships", "heartbreak", "love"],
    "q2_d": ["confidence", "self_worth"],
    "q2_e": ["focus", "performance", "goals"],
    "q2_f": ["healing", "emotional"]
  };

  // Q5 keywords
  const q5Map: Record<string, string[]> = {
    "q5_a": ["discipline", "structure"],
    "q5_b": ["healing", "emotional"],
    "q5_c": ["confidence"],
    "q5_d": ["purpose", "clarity"],
    "q5_e": ["relationships", "patterns"],
    "q5_f": ["performance", "ambition"]
  };

  if (q2Answer && q2Map[q2Answer]) {
    keywords.push(...q2Map[q2Answer]);
  }

  if (q5Answer && q5Map[q5Answer]) {
    keywords.push(...q5Map[q5Answer]);
  }

  return keywords;
}
