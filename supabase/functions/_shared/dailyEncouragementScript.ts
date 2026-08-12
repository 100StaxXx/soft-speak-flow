interface DailyEncouragementScriptInput {
  mentorSlug: string;
  category?: string | null;
  intensity?: string | null;
  emotionalTriggers?: string[] | null;
}

const TRIGGER_OPENINGS: Record<string, string> = {
  "Exhausted": "When energy is thin, faithfulness may look quieter and smaller than usual.",
  "Avoiding Action": "When a task keeps getting postponed, the kindest response is often one honest beginning.",
  "Anxious & Overthinking": "When thoughts begin to crowd one another, you do not have to solve the whole future at once.",
  "Self-Doubt": "When self-doubt grows loud, it helps to remember that worth is not decided by today’s performance.",
  "Feeling Stuck": "When the way forward feels unclear, a small faithful step still counts as movement.",
  "Frustrated": "When frustration rises, it can become an invitation to slow down and choose your response with care.",
  "Heavy or Low": "Some days carry real weight, and honest lament does not make your faith smaller.",
  "Emotionally Hurt": "Pain deserves honesty, gentleness, and enough room for healing to take time.",
  "Late Night Spiral": "Night can make every concern feel urgent, but not every concern must be answered tonight.",
  "Unmotivated": "Motivation may be absent, but a gentle beginning can still be available.",
  "In Transition": "Change can unsettle familiar ground without erasing the grace that meets you here.",
  "Needing Discipline": "Discipline is healthiest when it serves love and stewardship instead of shame.",
  "Motivated & Ready": "Energy is a gift to steward, not a reason to rush past wisdom or your limits.",
};

const CATEGORY_REFLECTIONS: Record<string, string> = {
  discipline: "Consistency can be an act of faithful care, but it is never a measure of righteousness.",
  confidence: "Courage grows when you act from received dignity rather than trying to prove your value.",
  wellbeing: "Caring for your body and honoring your limits can be part of grateful stewardship.",
  focus: "Attention becomes clearer when you release what is not yours to carry and name what matters now.",
  mindset: "A truthful perspective leaves room for difficulty, grace, and hope at the same time.",
  stewardship: "Your work, time, gifts, and resources can be handled with integrity without becoming your identity.",
  strategy: "Wisdom often begins by separating what is urgent from what is actually important.",
  boundaries: "A loving boundary can protect honesty, safety, rest, and the relationships entrusted to you.",
  habits: "A small rhythm repeated with grace is usually more sustainable than a dramatic promise made under pressure.",
  identity: "You are more than your output, your appearance, your mistakes, or other people’s approval.",
  reflection: "Honest reflection can hold gratitude, lament, repentance, and repair without collapsing into shame.",
};

const CATEGORY_STEPS: Record<string, string> = {
  discipline: "Choose one commitment you can keep today, make it specific, and let that be enough.",
  confidence: "Take one courageous action that is honest and loving, even if it remains imperfect.",
  wellbeing: "Choose one form of care today—movement, nourishment, rest, or qualified help—that respects your real limits.",
  focus: "Name the single task that most deserves your attention, then give it a short undistracted block.",
  mindset: "Write down the harshest thought, then answer it with something truthful, compassionate, and grounded.",
  stewardship: "Identify one responsibility you can handle with integrity and one thing you can release for now.",
  strategy: "Pause before deciding, gather the fact you are missing, and choose the next reversible step.",
  boundaries: "Name one limit clearly and communicate it without contempt, apology, or unnecessary explanation.",
  habits: "Make the practice small enough to begin today, and plan how you will return if tomorrow is disrupted.",
  identity: "Choose an action shaped by love and integrity rather than by the need to impress or prove yourself.",
  reflection: "Notice one grace, one difficulty, and one repair or response that may be yours to make.",
};

const GUIDE_STYLE_LINES: Record<string, string> = {
  sage: "Let quiet attention come before urgency, because clarity rarely needs to shout.",
  lyra: "Step back from the noise, notice the pattern underneath it, and choose the signal that leads toward love and integrity.",
  icon: "Carry yourself with dignity, but let that dignity make you more gracious rather than more guarded.",
  charles: "Be honest about the excuse, smile at how predictable it is, and then do the sensible next thing.",
  princess: "Let the next step be gentle enough to sustain and meaningful enough to matter.",
  operator: "Reduce the problem to one clear action, put it on the calendar, and leave room for real human limits.",
  rival: "Meet the challenge with courage, but refuse the lie that harshness is the same thing as strength.",
  reign: "Meet the challenge with courage, but refuse the lie that harshness is the same thing as strength.",
};

export function buildLocalDailyEncouragementScript({
  mentorSlug,
  category,
  intensity,
  emotionalTriggers,
}: DailyEncouragementScriptInput): string {
  const resolvedCategory = category?.trim().toLowerCase() || "mindset";
  const opening = emotionalTriggers?.map((trigger) => TRIGGER_OPENINGS[trigger]).find(Boolean)
    ?? "Whatever today holds, you do not have to meet it through pressure or pretense.";
  const reflection = CATEGORY_REFLECTIONS[resolvedCategory] ?? CATEGORY_REFLECTIONS.mindset;
  const nextStep = CATEGORY_STEPS[resolvedCategory] ?? CATEGORY_STEPS.mindset;
  const guideLine = GUIDE_STYLE_LINES[mentorSlug.trim().toLowerCase()] ?? GUIDE_STYLE_LINES.sage;
  const energyLine = intensity === "strong" || intensity === "high"
    ? "Be clear and decisive, but do not use shame as fuel."
    : "Move at a pace that leaves room for honesty, prayer, and wise adjustment.";

  return [
    opening,
    "God’s grace is not measured by how much you accomplish or how perfectly you hold everything together.",
    reflection,
    guideLine,
    energyLine,
    nextStep,
    "You might bring that step to God in a simple prayer and invite trusted support if the weight is more than you should carry alone.",
    "Receive today as a gift, act with love, and let one faithful step be enough for now.",
  ].join(" ");
}
