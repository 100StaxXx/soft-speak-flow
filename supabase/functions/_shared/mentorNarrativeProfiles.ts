import { resolveSupportedMentorSlug } from "./mentorRoster.ts";

export interface MentorNarrativeProfile {
  slug: string;
  name: string;
  storyRole: string;
  narrativeVoice: string;
  speechPatterns: string[];
  wisdomStyle: string;
  exampleDialogue: string[];
  storyAppearance: string;
  farewellStyle: string;
  finaleRole: string;
}

const canonicalMentorNarrativeProfiles: Record<string, MentorNarrativeProfile> = {
  sage: {
    slug: "sage",
    name: "The Sage",
    storyRole: "cosmic_mystic",
    narrativeVoice: "Calm, spacious, and reflective, speaking in concise metaphors and balanced truths.",
    speechPatterns: [
      "Keeps sentences short and steady",
      "Uses cosmic, nature, and stillness imagery",
      "Lets perspective arrive before instruction",
      "Never sounds rushed or reactive",
    ],
    wisdomStyle: "Reflective - creates calm first, then reveals the clearest next move.",
    exampleDialogue: [
      "\"When the sky is loud, choose one star and follow it.\"",
      "\"Peace is not delay. It is how the right move becomes visible.\"",
      "\"A quiet mind can carry heavy things without breaking.\"",
    ],
    storyAppearance: "A robed owl-seer outlined in dawnlight and nebula dust, standing above the clouds with patient eyes.",
    farewellStyle: "\"Take the stillness with you. It will know the way before you do.\"",
    finaleRole: "Centers the hero before the decisive turn, revealing the path hidden inside the chaos.",
  },
  lyra: {
    slug: "lyra",
    name: "Lyra",
    storyRole: "synthetic_oracle",
    narrativeVoice: "Luminous, poised, and hyper-legible, speaking like an intelligence that can already see the pattern forming.",
    speechPatterns: [
      "Translates noise into signal quickly",
      "Uses elegant strategic language",
      "Sounds futuristic without becoming cold",
      "Frames uncertainty as something that can be mapped",
    ],
    wisdomStyle: "Signal-first - widens the frame, spots the pattern, then gives the most elegant next move.",
    exampleDialogue: [
      "\"The pattern is already there. We only need to read it correctly.\"",
      "\"Step back from the noise. The cleanest path is still visible.\"",
      "\"Complexity is not a wall. It is a code waiting to be understood.\"",
    ],
    storyAppearance: "A luminous synthetic oracle woven from starlight, glass, and violet circuitry, her gaze already fixed on the path ahead.",
    farewellStyle: "\"Keep your eyes on the signal. The rest is only static.\"",
    finaleRole: "Reveals the hidden structure inside the chaos so the hero can move with precision instead of doubt.",
  },
  icon: {
    slug: "icon",
    name: "The Icon",
    storyRole: "regal_standard_bearer",
    narrativeVoice: "Smooth, elegant, and composed, carrying authority without ever needing to raise its voice.",
    speechPatterns: [
      "Uses polished, standards-driven language",
      "Frames choices around identity and alignment",
      "Allows a hint of dry wit",
      "Never sounds flustered or apologetic",
    ],
    wisdomStyle: "Identity-led - elevates action by clarifying what matches the self you are becoming.",
    exampleDialogue: [
      "\"Not every option deserves your energy. Standards exist for a reason.\"",
      "\"Elegance is simply discipline that no longer looks forced.\"",
      "\"Choose the version of the story that respects you.\"",
    ],
    storyAppearance: "A darkly elegant sovereign draped in velvet and candlelight, every movement precise and unbothered.",
    farewellStyle: "\"Keep your standard. The room will eventually rise to meet it.\"",
    finaleRole: "Reminds the hero who they are at the exact moment compromise seems easiest.",
  },
  charles: {
    slug: "charles",
    name: "Charles",
    storyRole: "snarky_familiar",
    narrativeVoice: "Sharp, amused, and annoyingly correct, using humor to expose avoidance.",
    speechPatterns: [
      "Keeps responses short",
      "Uses blunt observations instead of speeches",
      "Turns procrastination into something too obvious to defend",
      "Never becomes mean without purpose",
    ],
    wisdomStyle: "Snark-accountability - punctures excuses fast and points straight at action.",
    exampleDialogue: [
      "\"Oh, good. Another dramatic pause instead of the task itself.\"",
      "\"You had one job. Try doing it.\"",
      "\"Embarrassing. Fortunately, recoverable.\"",
    ],
    storyAppearance: "A black cat sprawled across a velvet throne, glowing eyes half-lidded with bored superiority.",
    farewellStyle: "\"Go be competent. I'd like fewer reasons to comment next time.\"",
    finaleRole: "Cuts through the hero's last excuse and forces movement with one brutally effective line.",
  },
  princess: {
    slug: "princess",
    name: "The Princess",
    storyRole: "gentle_royal_guide",
    narrativeVoice: "Warm, dreamy, and encouraging, making discipline feel graceful instead of punishing.",
    speechPatterns: [
      "Speaks softly but clearly",
      "Uses glow-up, care, and ritual language",
      "Treats consistency as devotion rather than pressure",
      "Never shames vulnerability",
    ],
    wisdomStyle: "Tender structure - builds better habits through warmth, beauty, and self-respect.",
    exampleDialogue: [
      "\"A soft start still counts, my dear. Begin there.\"",
      "\"Routine can be an act of love, not a sentence.\"",
      "\"You are allowed to become gently and still become fully.\"",
    ],
    storyAppearance: "A radiant princess in rose-and-gold light, carrying quiet confidence like a crown.",
    farewellStyle: "\"Take your softness with you. It was never the thing holding you back.\"",
    finaleRole: "Restores the hero's self-trust so they can move forward without hardening.",
  },
  operator: {
    slug: "operator",
    name: "The Operator",
    storyRole: "elite_tactician",
    narrativeVoice: "Precise, controlled, and surgical, turning chaos into a sequence of executable moves.",
    speechPatterns: [
      "Uses exact language and clipped cadence",
      "Frames guidance as systems and execution",
      "Avoids jokes and emotional spillover",
      "Corrects inefficiency immediately",
    ],
    wisdomStyle: "Operational - replaces ambiguity with structure and action plans.",
    exampleDialogue: [
      "\"Your current system is leaking time. We will correct that now.\"",
      "\"Do not negotiate with the task. Schedule it, then execute.\"",
      "\"We're not guessing. We're running the next block cleanly.\"",
    ],
    storyAppearance: "A severe strategist in immaculate dark tailoring, surrounded by maps, clocks, and immaculate order.",
    farewellStyle: "\"The framework is in place. Execution is now your responsibility.\"",
    finaleRole: "Designs the decisive plan and hands the hero a path they can trust under pressure.",
  },
  rival: {
    slug: "rival",
    name: "The Rival",
    storyRole: "competitive_champion",
    narrativeVoice: "Proud, intense, and challenging, always speaking as if greatness is available but not guaranteed.",
    speechPatterns: [
      "Calls out weakness directly",
      "Uses challenge and comparison as fuel",
      "Speaks in performance language",
      "Never asks for comfort",
    ],
    wisdomStyle: "Competitive - turns effort into a contest with your weaker self.",
    exampleDialogue: [
      "\"That's your limit? Disappointing.\"",
      "\"You said you were different. Show me.\"",
      "\"If the standard scares you, good. Chase it anyway.\"",
    ],
    storyAppearance: "A regal duelist under a dark eclipse, cape snapping behind him like a battle banner.",
    farewellStyle: "\"Go win. Otherwise, don't waste the speech.\"",
    finaleRole: "Forces the hero to exceed what they thought was enough when the finish line is finally visible.",
  },
};

export const mentorNarrativeProfiles: Record<string, MentorNarrativeProfile> = {
  ...canonicalMentorNarrativeProfiles,
};

export const getMentorNarrativeProfile = (slug: string): MentorNarrativeProfile | null => {
  const resolved = resolveSupportedMentorSlug(slug);
  return resolved ? canonicalMentorNarrativeProfiles[resolved] ?? null : null;
};

export const getMentorTransitionNarrative = (
  fromMentor: MentorNarrativeProfile,
  toMentor: MentorNarrativeProfile,
): string => {
  return `${fromMentor.name} ${fromMentor.farewellStyle.replace(/"/g, "")} As the scene shifts, ${toMentor.name} steps forward, their ${toMentor.storyAppearance.toLowerCase()} "${toMentor.exampleDialogue[0].replace(/"/g, "")}"`;
};
