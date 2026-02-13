export type RequestUrgency = "gentle" | "important" | "critical";

interface RequestTemplate {
  requestType: string;
  title: string;
  prompt: string;
  consequenceHint: string;
}

const REQUEST_TEMPLATES: Record<RequestUrgency, RequestTemplate[]> = {
  gentle: [
    {
      requestType: "check_in",
      title: "A Small Check-In",
      prompt: "Could we spend two quiet minutes together before the day gets loud?",
      consequenceHint: "A gentle check-in helps your companion feel seen.",
    },
    {
      requestType: "micro_reflection",
      title: "Moment of Reflection",
      prompt: "Tell me one thing you handled well today. I want to remember it.",
      consequenceHint: "Sharing small wins improves emotional stability.",
    },
    {
      requestType: "presence_ping",
      title: "Presence Ping",
      prompt: "A quick hello would help me hold our rhythm.",
      consequenceHint: "Frequent touchpoints strengthen routine consistency.",
    },
  ],
  important: [
    {
      requestType: "ritual_support",
      title: "Ritual Support Needed",
      prompt: "Our routine is drifting. Can we complete one grounding ritual together?",
      consequenceHint: "Completing this restores routine stability.",
    },
    {
      requestType: "repair_invite",
      title: "Repair Invitation",
      prompt: "I felt distance today. Can we repair it before nightfall?",
      consequenceHint: "Repair moments prevent fatigue spikes.",
    },
    {
      requestType: "focus_anchor",
      title: "Focus Anchor",
      prompt: "Pick one meaningful action and finish it with me. I need your intent.",
      consequenceHint: "Intentional actions improve care responsiveness.",
    },
  ],
  critical: [
    {
      requestType: "bond_alert",
      title: "Bond Alert",
      prompt: "I am slipping into silence. Please reconnect with me now.",
      consequenceHint: "Immediate care prevents deeper withdrawal.",
    },
    {
      requestType: "recovery_protocol",
      title: "Recovery Protocol",
      prompt: "I need a full recovery sequence tonight so we do not lose momentum.",
      consequenceHint: "Recovery actions reduce dormant-risk pressure.",
    },
    {
      requestType: "trust_repair",
      title: "Trust Repair",
      prompt: "Please choose me first for one focused ritual. I need to feel priority.",
      consequenceHint: "Responding now stabilizes emotional arc volatility.",
    },
  ],
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hashString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function seededFloat(seed: string): number {
  return (hashString(seed) % 1000) / 1000;
}

export function pickUrgency(careScore: number, requestFatigue: number, seed: string, careConsistency = 0.5): RequestUrgency {
  const driftPressure = (1 - careScore) + requestFatigue * 0.065 + (1 - careConsistency) * 0.35;
  const roll = seededFloat(seed);

  if (driftPressure >= 1.1 || roll > 0.89) return "critical";
  if (driftPressure >= 0.68 || roll > 0.48) return "important";
  return "gentle";
}

export function determineEmotionalArc(params: {
  careScore: number;
  routineStability: number;
  requestFatigue: number;
  isDormant: boolean;
}): string {
  if (params.isDormant) return "dormant_recovery";
  if (params.requestFatigue >= 5 || params.routineStability < 30) return "repair_sequence";
  if (params.careScore < 0.4 || params.routineStability < 45) return "fragile_echo";
  if (params.careScore < 0.55 || params.routineStability < 58) return "routine_drift";
  if (params.careScore >= 0.75 && params.routineStability >= 75) return "resonant_growth";
  if (params.careScore >= 0.58 && params.routineStability >= 58) return "steady_bloom";
  return "forming";
}

export function computeRoutineStability(params: {
  careScore: number;
  careConsistency: number;
  requestFatigue: number;
  priorStability: number;
  isDormant: boolean;
}): number {
  const careScore = clamp(params.careScore, 0, 1);
  const careConsistency = clamp(params.careConsistency, 0, 1);
  const requestFatigue = clamp(params.requestFatigue, 0, 10);
  const priorStability = clamp(params.priorStability, 0, 100);

  const careDrift = (careScore - 0.5) * 16;
  const consistencyDrift = (careConsistency - 0.5) * 12;
  const fatiguePenalty = requestFatigue * 1.4;
  const dormancyPenalty = params.isDormant ? 8 : 0;
  const nextStability = priorStability + careDrift + consistencyDrift - fatiguePenalty - dormancyPenalty;

  return clamp(Math.round(nextStability * 100) / 100, 0, 100);
}

export function computeNextRequestFatigue(params: {
  careScore: number;
  careConsistency: number;
  requestFatigue: number;
  isDormant: boolean;
}): number {
  const careScore = clamp(params.careScore, 0, 1);
  const careConsistency = clamp(params.careConsistency, 0, 1);
  const requestFatigue = clamp(params.requestFatigue, 0, 10);

  const recovery = careConsistency >= 0.75 ? 1.35 : careConsistency >= 0.55 ? 0.95 : 0.55;
  const routinePenalty = careScore < 0.35 ? 1.1 : careScore < 0.5 ? 0.5 : 0;
  const overloadPenalty = requestFatigue >= 6 ? 0.45 : 0;
  const dormancyPenalty = params.isDormant ? 0.9 : 0;
  const shift = routinePenalty + overloadPenalty + dormancyPenalty - recovery;

  return clamp(Math.round((requestFatigue + shift) * 100) / 100, 0, 10);
}

export function computeRitualTargetCount(careScore: number, careConsistency: number): number {
  const pressure = (1 - clamp(careScore, 0, 1)) + (1 - clamp(careConsistency, 0, 1)) * 0.55;
  if (pressure >= 1.1) return 5;
  if (pressure >= 0.72) return 4;
  return 3;
}

export function computeDesiredRequestCount(params: {
  careScore: number;
  careConsistency: number;
  requestFatigue: number;
  slotsAvailable: number;
}): number {
  const slotsAvailable = Math.max(0, Math.floor(params.slotsAvailable));
  if (slotsAvailable === 0) return 0;

  const pressure = (1 - clamp(params.careScore, 0, 1))
    + clamp(params.requestFatigue, 0, 10) * 0.07
    + (1 - clamp(params.careConsistency, 0, 1)) * 0.4;
  const desiredCount = pressure >= 1.15 ? 3 : pressure >= 0.7 ? 2 : 1;

  return Math.min(desiredCount, slotsAvailable);
}

export function buildRequestRecord(params: {
  companionId: string;
  userId: string;
  urgency: RequestUrgency;
  index: number;
  baseSeed: string;
  dueAtIso: string;
}) {
  const templates = REQUEST_TEMPLATES[params.urgency];
  const templateIndex = hashString(`${params.baseSeed}:template:${params.index}`) % templates.length;
  const template = templates[templateIndex];

  return {
    user_id: params.userId,
    companion_id: params.companionId,
    request_type: template.requestType,
    title: template.title,
    prompt: template.prompt,
    urgency: params.urgency,
    status: "pending",
    due_at: params.dueAtIso,
    consequence_hint: template.consequenceHint,
    request_context: {
      seed: params.baseSeed,
      requestIndex: params.index,
    },
  };
}

export function toDateKey(input: Date): string {
  return `${input.getUTCFullYear()}-${String(input.getUTCMonth() + 1).padStart(2, "0")}-${String(input.getUTCDate()).padStart(2, "0")}`;
}
