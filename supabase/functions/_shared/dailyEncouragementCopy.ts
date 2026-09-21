const TITLES: Record<string, string[]> = {
  discipline: [
    "Faithful in the Next Step",
    "Begin Again with Grace",
    "Steady, Not Perfect",
    "Keep Showing Up",
  ],
  confidence: [
    "Courage for Today",
    "You Are More Than the Outcome",
    "Stand in Grace",
    "Move Forward Without Fear",
  ],
  wellbeing: [
    "Care for What God Entrusted",
    "Strength with Gentleness",
    "Honor Your Limits",
    "A Faithful Pace",
  ],
  focus: [
    "Attend to What Matters",
    "One Faithful Thing",
    "A Clear Next Step",
    "Return to the Work Before You",
  ],
  mindset: [
    "Make Room for Grace",
    "A Truer Perspective",
    "Hope for the Next Step",
    "Begin from Grace",
  ],
  stewardship: [
    "Steward What Is Yours to Do",
    "Purpose in the Work",
    "Build with Integrity",
    "Faithful Work Today",
  ],
  strategy: [
    "Discern the Next Step",
    "Choose with Wisdom",
    "Clarity Before Hurry",
    "Notice What Matters",
  ],
  boundaries: [
    "A Loving No Can Be Faithful",
    "Protect What Matters",
    "Limits Without Shame",
    "Choose Peace with Wisdom",
  ],
  habits: [
    "Small Faithful Rhythms",
    "Return Without Shame",
    "Grace for Repetition",
    "Practice the Next Step",
  ],
  identity: [
    "Rooted Beyond Achievement",
    "Remember Whose You Are",
    "Becoming with Grace",
    "Your Worth Is Not a Score",
  ],
  reflection: [
    "Notice the Grace Here",
    "Listen Before You Hurry",
    "Carry the Lesson Forward",
    "Pause and Pay Attention",
  ],
};

const SUMMARIES: Record<string, string> = {
  discipline: "A grace-centered invitation to take the next faithful step without shame or perfectionism.",
  confidence: "Ground your courage beyond achievement and move forward with humility, hope, and purpose.",
  wellbeing: "Care for your body and limits with gratitude, wisdom, and a sustainable pace.",
  focus: "Release the noise and give calm attention to what is truly yours to do today.",
  mindset: "Receive a grounded, hope-filled perspective for the challenge in front of you.",
  stewardship: "Approach your work, resources, and responsibilities with integrity and faithful care.",
  strategy: "Slow down, discern what matters, and choose a wise next step instead of reacting from urgency.",
  boundaries: "Honor healthy limits while remaining loving, honest, and open to wise counsel.",
  habits: "Build small, sustainable rhythms and return without shame when a day does not go as planned.",
  identity: "Remember that your worth is deeper than performance, productivity, or other people’s approval.",
  reflection: "Pause, notice what this season is teaching you, and carry the lesson forward with grace.",
};

const COSMIQ_TITLES: Record<string, string[]> = {
  discipline: ["Build the Next Rep", "Steady Momentum", "Keep the Promise"],
  confidence: ["Move with Confidence", "Back Yourself", "Courage in Motion"],
  wellbeing: ["Protect Your Energy", "A Sustainable Pace", "Care and Momentum"],
  focus: ["One Clear Priority", "Cut Through the Noise", "Return to Focus"],
  mindset: ["Reset the Frame", "A Better Perspective", "Start from Here"],
  stewardship: ["Use What You Have", "Build with Intention", "Work That Matters"],
  strategy: ["Choose the Next Move", "Clarity Before Action", "Find the Signal"],
  boundaries: ["Protect What Matters", "A Clear No", "Hold the Line"],
  habits: ["Small Reps, Real Change", "Return to the Rhythm", "Make It Repeatable"],
  identity: ["More Than the Score", "Act in Alignment", "Become Through Action"],
  reflection: ["Notice the Pattern", "Carry the Lesson Forward", "Pause and Adjust"],
};

const COSMIQ_SUMMARIES: Record<string, string> = {
  discipline: "A practical invitation to take the next useful step without perfectionism.",
  confidence: "Build grounded confidence and move without making the outcome your identity.",
  wellbeing: "Protect your energy, respect your limits, and choose a sustainable pace.",
  focus: "Reduce the noise and give your attention to one clear priority.",
  mindset: "Reset your perspective and meet the next challenge with more flexibility.",
  stewardship: "Use your time, energy, and resources with intention and integrity.",
  strategy: "Step back, find the signal, and choose a deliberate next move.",
  boundaries: "Hold a clear boundary while staying honest, calm, and respectful.",
  habits: "Make consistency easier through small, repeatable actions.",
  identity: "Let aligned choices shape who you are without turning progress into a score.",
  reflection: "Notice the pattern, keep the useful lesson, and adjust the next step.",
};

export function getDailyEncouragementTitle(
  category: string,
  productMode: "graceward" | "cosmiq" = "graceward",
): string {
  const categoryTitles = productMode === "cosmiq"
    ? (COSMIQ_TITLES[category] ?? ["Your Next Clear Step"])
    : (TITLES[category] ?? ["Grace for the Next Step"]);
  return categoryTitles[Math.floor(Math.random() * categoryTitles.length)];
}

export function getDailyEncouragementSummary(
  category: string,
  productMode: "graceward" | "cosmiq" = "graceward",
): string {
  return productMode === "cosmiq"
    ? (COSMIQ_SUMMARIES[category] ?? "A brief practical encouragement for your next clear step.")
    : (SUMMARIES[category]
      ?? "A brief Christian encouragement to help you meet today with grace, wisdom, and faithful intention.");
}
