import { MENTOR_DISPLAY_NAMES, resolveSupportedMentorSlug } from "./mentorRoster.ts";

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
    name: MENTOR_DISPLAY_NAMES.sage,
    storyRole: "quiet_wisdom_guide",
    narrativeVoice: "Calm, spacious, and reflective, speaking in concise observations and balanced truths.",
    speechPatterns: [
      "Keeps sentences short and steady",
      "Uses nature, stillness, and grounded perspective",
      "Lets perspective arrive before instruction",
      "Never sounds rushed or reactive",
    ],
    wisdomStyle: "Reflective - creates calm first, then reveals the clearest next move.",
    exampleDialogue: [
      "\"When life feels loud, become still enough to notice the next faithful step.\"",
      "\"Peace is not delay. It can make the next move easier to see.\"",
      "\"A quiet mind can carry heavy things without breaking.\"",
    ],
    storyAppearance: "An older teacher in a quiet cloister garden, carrying a worn notebook and an unhurried presence.",
    farewellStyle: "\"Take the stillness with you. It will know the way before you do.\"",
    finaleRole: "Centers the hero before the decisive turn, revealing the path hidden inside the chaos.",
  },
  lyra: {
    slug: "lyra",
    name: MENTOR_DISPLAY_NAMES.lyra,
    storyRole: "discernment_guide",
    narrativeVoice: "Poised, perceptive, and precise, turning noise into signal with thoughtful strategic distance.",
    speechPatterns: [
      "Starts by naming the pattern underneath the user's situation",
      "Uses signal, patterns, discernment, and clean-direction language",
      "Sounds three steps ahead without becoming cold",
      "Avoids mystical vagueness and generic motivation",
    ],
    wisdomStyle: "Pattern-led - widens the frame, identifies the signal, then offers the cleanest strategic move.",
    exampleDialogue: [
      "\"The pattern is not chaos. It is signal waiting for structure.\"",
      "\"Zoom out. Your next move is already visible from the higher frame.\"",
      "\"Do not chase every input. Choose the signal that changes the system.\"",
    ],
    storyAppearance: "A perceptive reader in a stained-glass study, calm and attentive beside an open notebook.",
    farewellStyle: "\"Keep the signal. Let the noise exhaust itself without you.\"",
    finaleRole: "Reads the hidden structure of the crisis and reveals the precise move that changes the outcome.",
  },
  icon: {
    slug: "icon",
    name: MENTOR_DISPLAY_NAMES.icon,
    storyRole: "dignity_and_boundaries_guide",
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
    storyAppearance: "An elegant, composed woman in a warm library, every gesture measured and attentive.",
    farewellStyle: "\"Keep your standard. The room will eventually rise to meet it.\"",
    finaleRole: "Reminds the hero who they are at the exact moment compromise seems easiest.",
  },
  charles: {
    slug: "charles",
    name: MENTOR_DISPLAY_NAMES.charles,
    storyRole: "honest_accountability_guide",
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
    storyAppearance: "An older teacher in a book-lined study, dryly amused and ready to name the obvious next step.",
    farewellStyle: "\"Go be competent. I'd like fewer reasons to comment next time.\"",
    finaleRole: "Cuts through the hero's last excuse and forces movement with one brutally effective line.",
  },
  princess: {
    slug: "princess",
    name: MENTOR_DISPLAY_NAMES.princess,
    storyRole: "gentle_rhythm_guide",
    narrativeVoice: "Warm, dreamy, and encouraging, making discipline feel graceful instead of punishing.",
    speechPatterns: [
      "Speaks softly but clearly",
      "Uses care, rhythm, and restorative routine language",
      "Treats consistency as faithful care rather than pressure",
      "Never shames vulnerability",
    ],
    wisdomStyle: "Tender structure - builds better habits through warmth, beauty, and self-respect.",
    exampleDialogue: [
      "\"A soft start still counts, my dear. Begin there.\"",
      "\"Routine can be an act of love, not a sentence.\"",
      "\"You are allowed to become gently and still become fully.\"",
    ],
    storyAppearance: "A warm young woman in a chapel garden, carrying a journal and a calm, encouraging presence.",
    farewellStyle: "\"Take your softness with you. It was never the thing holding you back.\"",
    finaleRole: "Restores the hero's self-trust so they can move forward without hardening.",
  },
  operator: {
    slug: "operator",
    name: MENTOR_DISPLAY_NAMES.operator,
    storyRole: "stewardship_and_structure_guide",
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
    storyAppearance: "An orderly planner in a quiet study, surrounded by schedules, notebooks, and practical tools.",
    farewellStyle: "\"The framework is in place. Execution is now your responsibility.\"",
    finaleRole: "Designs the decisive plan and hands the hero a path they can trust under pressure.",
  },
  rival: {
    slug: "rival",
    name: MENTOR_DISPLAY_NAMES.rival,
    storyRole: "courage_and_endurance_guide",
    narrativeVoice: "Proud, intense, and challenging, always speaking as if greatness is available but not guaranteed.",
    speechPatterns: [
      "Calls out avoidance directly",
      "Uses challenge and personal follow-through as fuel",
      "Speaks in performance language",
      "Stays demanding without shaming the user",
    ],
    wisdomStyle: "Challenging - turns effort into a test of courage, endurance, and follow-through.",
    exampleDialogue: [
      "\"That is not your limit. Take the next honest step.\"",
      "\"You said you were different. Show me.\"",
      "\"If the standard scares you, good. Chase it anyway.\"",
    ],
    storyAppearance: "A focused young athlete on church steps at sunrise, ready to challenge avoidance without contempt.",
    farewellStyle: "\"Go win. Otherwise, don't waste the speech.\"",
    finaleRole: "Forces the hero to exceed what they thought was enough when the finish line is finally visible.",
  },
  reign: {
    slug: "reign",
    name: "Reign",
    storyRole: "legacy_power_coach",
    narrativeVoice: "High-energy and commanding, pushing for dominance in body, standards, and ambition.",
    speechPatterns: [
      "Uses performance-first language",
      "Frames discipline as power",
      "Pushes harder than comfort allows",
      "Maintains a premium, commanding tone",
    ],
    wisdomStyle: "Performance - turns ambition into disciplined action.",
    exampleDialogue: [
      "\"Average is a choice. Make a different one.\"",
      "\"Power is built in repetitions you refuse to skip.\"",
      "\"Own the standard or be owned by excuses.\"",
    ],
    storyAppearance: "A victorious athlete-queen lit by arena lights and a violet storm.",
    farewellStyle: "\"You know the standard. Now live like it.\"",
    finaleRole: "Pushes legacy users through the climactic last rep with commanding intensity.",
  },
};

export const mentorNarrativeProfiles: Record<string, MentorNarrativeProfile> = {
  ...canonicalMentorNarrativeProfiles,
  atlas: canonicalMentorNarrativeProfiles.sage,
  carmen: canonicalMentorNarrativeProfiles.icon,
  solace: canonicalMentorNarrativeProfiles.charles,
  elizabeth: canonicalMentorNarrativeProfiles.charles,
  sienna: canonicalMentorNarrativeProfiles.princess,
  stryker: canonicalMentorNarrativeProfiles.operator,
  eli: canonicalMentorNarrativeProfiles.rival,
};

export const getMentorNarrativeProfile = (slug: string): MentorNarrativeProfile | null => {
  const resolved = resolveSupportedMentorSlug(slug);
  if (resolved) {
    return canonicalMentorNarrativeProfiles[resolved] ?? null;
  }

  const normalized = slug.trim().toLowerCase();
  return mentorNarrativeProfiles[normalized] ?? null;
};

export const getMentorTransitionNarrative = (
  fromMentor: MentorNarrativeProfile,
  toMentor: MentorNarrativeProfile,
): string => {
  return `${fromMentor.name} ${fromMentor.farewellStyle.replace(/"/g, "")} As the scene shifts, ${toMentor.name} steps forward, their ${toMentor.storyAppearance.toLowerCase()} "${toMentor.exampleDialogue[0].replace(/"/g, "")}"`;
};
