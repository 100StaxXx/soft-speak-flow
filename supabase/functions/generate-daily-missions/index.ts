import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratedMission {
  mission: string;
  xp: number;
  category: string;
  difficulty?: string;
}

interface ThemeDay {
  name: string;
  emoji: string;
  categories: string[];
}

type DegradedReason = "rate_limited" | "upstream_error" | "invalid_ai_output";

type GenerationMeta = {
  source: "ai" | "fallback";
  degraded: boolean;
  reason?: DegradedReason;
};

type AIFailureDetails = {
  status: number;
  code: "AI_RATE_LIMITED" | "AI_CREDITS_EXHAUSTED" | "AI_PROVIDER_AUTH" | "AI_UPSTREAM_UNAVAILABLE";
  message: string;
  reason: DegradedReason;
  retryAfterSeconds?: number;
  upstreamStatus?: number;
};

export class AIRequestError extends Error {
  details: AIFailureDetails;

  constructor(details: AIFailureDetails) {
    super(details.message);
    this.name = "AIRequestError";
    this.details = details;
  }
}

export class InvalidAIGenerationError extends Error {
  issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "InvalidAIGenerationError";
    this.issues = issues;
  }
}

const CANONICAL_RATE_LIMIT_KEY = "daily_missions";

// Theme days configuration - matches frontend
const THEME_DAYS: Record<number, ThemeDay> = {
  0: { name: "Reset Sunday", emoji: "🌅", categories: ["identity", "wellness", "growth"] },
  1: { name: "Momentum Monday", emoji: "🚀", categories: ["quick_win", "growth", "identity"] },
  2: { name: "Connection Tuesday", emoji: "💜", categories: ["connection", "gratitude", "wellness"] },
  3: { name: "Wellness Wednesday", emoji: "🧘", categories: ["wellness", "gratitude", "quick_win"] },
  4: { name: "Gratitude Thursday", emoji: "✨", categories: ["gratitude", "connection", "identity"] },
  5: { name: "Future Friday", emoji: "🔮", categories: ["identity", "growth", "quick_win"] },
  6: { name: "Soul Saturday", emoji: "🌟", categories: ["wellness", "gratitude", "connection"] },
};

// Bonus mission templates based on streak milestones
const BONUS_MISSIONS: Record<string, { text: string; xp: number; category: string; difficulty: string }> = {
  streak_3: { text: "Keep your momentum going - share your progress with someone", xp: 10, category: "connection", difficulty: "easy" },
  streak_7: { text: "Streak Master: Reflect on what's helped you stay consistent", xp: 12, category: "growth", difficulty: "medium" },
  streak_14: { text: "Two weeks strong! Do something kind for yourself today", xp: 12, category: "wellness", difficulty: "easy" },
  streak_30: { text: "30-day legend! Write a note to your future self", xp: 15, category: "identity", difficulty: "medium" },
};

const CATEGORY_GUIDELINES = `**MISSION CATEGORIES — Use these as creative direction, NOT templates to copy:**

1. **Connection** — Light positive human interaction. Could be: reaching out, active listening, appreciating someone, small acts of kindness. Think beyond texting — maybe it's making eye contact, learning someone's name, asking a real question. XP: 5-10, Difficulty: easy

2. **Quick Win** — Instant sense of progress in 1-5 minutes. Could be: clearing clutter, replying to something, fixing a tiny annoyance, organizing one shelf, deleting old photos. Get specific — "clean out your wallet" beats "organize something." XP: 5-10, Difficulty: easy/medium

3. **Identity** — Reinforces the person they want to become. Bigger, all-day vibes. Could be: planning ahead, acting as their future self for an hour, making a decision they've been avoiding, writing a personal rule. XP: 10-15, Difficulty: medium/hard

4. **Wellness** — Physical and mental well-being. Could be: breathwork, hydration, posture, stretching, sensory grounding, screen breaks, cold water on face, sunlight exposure. Get creative with body awareness. XP: 5-10, Difficulty: easy

5. **Gratitude** — Appreciation and positive reframing. Could be: thanking someone specific, noticing beauty, writing about a challenge that taught you something, appreciating a body part, savoring a meal. XP: 5-10, Difficulty: easy

6. **Growth** — Learning and comfort-zone expansion. Be SPECIFIC: "Look up why we dream," "Find out what the capital of a random country is," "Learn one word in a language you don't speak," "Watch a 2-min video about how something is made." Never say "learn something new" — always say WHAT to learn. XP: 10-15, Difficulty: medium/hard

**CREATIVE RULES:**
- Each mission MUST feel distinct from the others — vary the verb, the object, and the framing
- Use concrete, specific language (not vague "do something nice")
- Surprise the user — missions should feel like a fresh idea, not a checklist
- Never start two missions with the same word
- Growth missions MUST include a specific topic or question to explore`;

// Category-specific XP and difficulty validation
const CATEGORY_RULES: Record<string, { xpRange: [number, number]; difficulties: string[] }> = {
  connection: { xpRange: [5, 10], difficulties: ["easy"] },
  quick_win: { xpRange: [5, 10], difficulties: ["easy", "medium"] },
  identity: { xpRange: [10, 15], difficulties: ["medium", "hard"] },
  wellness: { xpRange: [5, 10], difficulties: ["easy"] },
  gratitude: { xpRange: [5, 10], difficulties: ["easy"] },
  growth: { xpRange: [10, 15], difficulties: ["medium", "hard"] },
};

const FALLBACK_MISSIONS: Record<string, string[]> = {
  connection: [
    "Send one genuine check-in text to someone you appreciate.",
    "Thank someone by name for one specific thing they did.",
    "Ask one person an intentional question and listen fully.",
    "Leave a short encouraging message for someone today.",
  ],
  quick_win: [
    "Clear one small surface and keep it clutter-free all day.",
    "Handle one task you've been postponing for under 5 minutes.",
    "Delete 20 unnecessary photos from your phone.",
    "Tidy your bag or wallet and remove old clutter.",
  ],
  identity: [
    "Write one rule your future self follows and use it today.",
    "Choose one hard task first and finish it before noon.",
    "Act like your best self for the next 30 minutes.",
    "Make one decision today that your future self will thank you for.",
  ],
  wellness: [
    "Drink a full glass of water before your next screen session.",
    "Take a 5-minute stretch break and relax your shoulders.",
    "Step outside for 5 minutes and take slow breaths.",
    "Do one 2-minute posture reset before your next task.",
  ],
  gratitude: [
    "Write down three things that went right today.",
    "Thank someone directly for a small moment you noticed.",
    "Pause for one minute and savor one simple good thing.",
    "Send one short message of appreciation to someone.",
  ],
  growth: [
    "Look up why we yawn and share one fact with someone.",
    "Learn one new word in another language and use it once.",
    "Watch a 2-minute video on how electricity reaches homes.",
    "Find the capital of a country you know little about.",
  ],
};

// Timezone utility - calculate effective date with 2 AM reset
const RESET_HOUR = 2;

function formatDateForTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });

  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  const year = map.get("year") ?? "1970";
  const month = map.get("month") ?? "01";
  const day = map.get("day") ?? "01";

  return `${year}-${month}-${day}`;
}

export function normalizeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return "UTC";

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

export function getEffectiveMissionDate(userTimezone: string): string {
  const now = new Date();
  const tz = normalizeTimezone(userTimezone);

  const localHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).format(now),
    10,
  );

  if (localHour < RESET_HOUR) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateForTimezone(yesterday, tz);
  }

  return formatDateForTimezone(now, tz);
}

export function getEffectiveDayOfWeek(userTimezone: string): number {
  const now = new Date();
  const tz = normalizeTimezone(userTimezone);

  const localHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).format(now),
    10,
  );

  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: tz,
  });

  let targetDate = now;
  if (localHour < RESET_HOUR) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const dayName = dayFormatter.format(targetDate);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return dayMap[dayName] ?? 0;
}

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}

export function mapAIHttpFailure(status: number, bodyText: string, retryAfterHeader: string | null): AIFailureDetails {
  if (status === 429) {
    return {
      status,
      code: "AI_RATE_LIMITED",
      message: "Mission generation is temporarily rate-limited.",
      reason: "rate_limited",
      retryAfterSeconds: parseRetryAfterSeconds(retryAfterHeader) ?? 60,
      upstreamStatus: status,
    };
  }

  if (status === 402) {
    return {
      status,
      code: "AI_CREDITS_EXHAUSTED",
      message: "Mission generation is temporarily unavailable due to provider credits.",
      reason: "upstream_error",
      upstreamStatus: status,
    };
  }

  if (status === 401 || status === 403) {
    return {
      status,
      code: "AI_PROVIDER_AUTH",
      message: "Mission generation is temporarily unavailable due to provider authentication.",
      reason: "upstream_error",
      upstreamStatus: status,
    };
  }

  if (status >= 500) {
    return {
      status,
      code: "AI_UPSTREAM_UNAVAILABLE",
      message: "Mission generation is temporarily unavailable.",
      reason: "upstream_error",
      upstreamStatus: status,
    };
  }

  console.warn("Unexpected AI status when generating missions:", status, bodyText.slice(0, 500));
  return {
    status: 502,
    code: "AI_UPSTREAM_UNAVAILABLE",
    message: "Mission generation is temporarily unavailable.",
    reason: "upstream_error",
    upstreamStatus: status,
  };
}

function getStreakBonus(streak: number): { key: string; mission: typeof BONUS_MISSIONS[string] } | null {
  if (streak >= 30) return { key: "streak_30", mission: BONUS_MISSIONS.streak_30 };
  if (streak >= 14) return { key: "streak_14", mission: BONUS_MISSIONS.streak_14 };
  if (streak >= 7) return { key: "streak_7", mission: BONUS_MISSIONS.streak_7 };
  if (streak >= 3) return { key: "streak_3", mission: BONUS_MISSIONS.streak_3 };
  return null;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sanitizeMissionText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function selectDeterministic<T>(items: T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

export function generateFallbackMissions(
  userId: string,
  missionDate: string,
  requiredCategories: string[],
  activeGoals: string[],
): GeneratedMission[] {
  const normalizedRequired = Array.from(
    new Set(requiredCategories.map((category) => category.toLowerCase().trim())),
  ).filter((category) => category in CATEGORY_RULES);

  const defaultOrder = ["connection", "quick_win", "identity", "wellness", "gratitude", "growth"];
  const categories = [...normalizedRequired];

  for (const category of defaultOrder) {
    if (categories.length >= 3) break;
    if (!categories.includes(category)) {
      categories.push(category);
    }
  }

  const safeCategories = categories.slice(0, 3);

  return safeCategories.map((category, index) => {
    const seed = `${userId}:${missionDate}:${category}:${index}`;
    const categoryRule = CATEGORY_RULES[category];
    const [minXp, maxXp] = categoryRule.xpRange;
    const xp = minXp + (hashString(`${seed}:xp`) % (maxXp - minXp + 1));
    const difficulty = selectDeterministic(categoryRule.difficulties, `${seed}:difficulty`);

    let mission = selectDeterministic(FALLBACK_MISSIONS[category], `${seed}:mission`);

    const goal = activeGoals[0]?.trim();
    if (goal && category === "identity") {
      const personalized = `Take one focused step on "${goal}" for 10 minutes.`;
      if (personalized.length <= 80) {
        mission = personalized;
      }
    }

    return {
      mission,
      xp,
      category,
      difficulty,
    };
  });
}

function stripMarkdownCodeFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

export function parseAIMissions(generatedText: string): { missions: unknown[] | null; error?: string } {
  const cleanedText = stripMarkdownCodeFences(generatedText);

  try {
    const parsed = JSON.parse(cleanedText);
    if (Array.isArray(parsed)) {
      return { missions: parsed };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { missions?: unknown[] }).missions)) {
      return { missions: (parsed as { missions: unknown[] }).missions };
    }
  } catch {
    const bracketStart = cleanedText.indexOf("[");
    const bracketEnd = cleanedText.lastIndexOf("]");

    if (bracketStart >= 0 && bracketEnd > bracketStart) {
      try {
        const sliced = cleanedText.slice(bracketStart, bracketEnd + 1);
        const parsed = JSON.parse(sliced);
        if (Array.isArray(parsed)) {
          return { missions: parsed };
        }
      } catch {
        return { missions: null, error: "Invalid AI response format" };
      }
    }

    return { missions: null, error: "Invalid AI response format" };
  }

  return { missions: null, error: "AI response did not include a missions array" };
}

export function validateAndNormalizeMissions(
  rawMissions: unknown[],
  requiredCategories: string[],
): { missions: GeneratedMission[] | null; errors: string[] } {
  const errors: string[] = [];
  const normalized: GeneratedMission[] = [];

  if (rawMissions.length !== 3) {
    errors.push(`Must have exactly 3 missions, got ${rawMissions.length}`);
  }

  for (const rawMission of rawMissions) {
    if (!rawMission || typeof rawMission !== "object") {
      errors.push("Mission item must be an object");
      continue;
    }

    const missionRecord = rawMission as Record<string, unknown>;
    const missionText = sanitizeMissionText(typeof missionRecord.mission === "string" ? missionRecord.mission : "");
    const category = typeof missionRecord.category === "string" ? missionRecord.category.toLowerCase().trim() : "";
    const xp = typeof missionRecord.xp === "number" ? missionRecord.xp : Number.NaN;
    const difficultyValue = typeof missionRecord.difficulty === "string"
      ? missionRecord.difficulty.toLowerCase().trim()
      : undefined;

    if (!missionText) {
      errors.push("Mission text is required");
    } else if (missionText.length > 80) {
      errors.push(`Mission text too long: ${missionText.length} chars (max 80)`);
    }

    if (!category || !(category in CATEGORY_RULES)) {
      errors.push(`Invalid mission category: ${String(missionRecord.category ?? "unknown")}`);
      continue;
    }

    const rules = CATEGORY_RULES[category];

    if (!Number.isFinite(xp)) {
      errors.push(`Mission XP must be a number for category ${category}`);
    } else {
      const [minXp, maxXp] = rules.xpRange;
      if (xp < minXp || xp > maxXp) {
        errors.push(`${category} mission XP should be ${minXp}-${maxXp}, got ${xp}`);
      }
    }

    const difficulty = difficultyValue ?? rules.difficulties[0];
    if (!rules.difficulties.includes(difficulty)) {
      errors.push(`${category} mission difficulty should be ${rules.difficulties.join("/")}, got ${difficulty}`);
    }

    normalized.push({
      mission: missionText,
      xp: Number.isFinite(xp) ? xp : rules.xpRange[0],
      category,
      difficulty,
    });
  }

  const categories = normalized.map((mission) => mission.category);
  const uniqueCategories = new Set(categories);
  if (categories.length !== uniqueCategories.size) {
    errors.push("Mission categories must be unique");
  }

  const required = requiredCategories.map((category) => category.toLowerCase());
  for (const category of required) {
    if (!uniqueCategories.has(category)) {
      errors.push(`Missing required category: ${category}`);
    }
  }

  if (errors.length > 0 || normalized.length !== 3) {
    return { missions: null, errors };
  }

  return { missions: normalized, errors: [] };
}

function getAutoComplete(missionText: string): boolean {
  const lowerText = missionText.toLowerCase();
  return (
    lowerText.includes("complete all your quests") ||
    lowerText.includes("complete all your habits") ||
    lowerText.includes("complete all habits")
  );
}

function buildMissionRows(
  missions: GeneratedMission[],
  userId: string,
  missionDate: string,
  streak: number,
) {
  const rows = missions.map((mission) => ({
    user_id: userId,
    mission_date: missionDate,
    mission_text: mission.mission,
    mission_type: mission.category || "general",
    category: mission.category || "general",
    xp_reward: mission.xp || 10,
    difficulty: mission.difficulty || "medium",
    auto_complete: getAutoComplete(mission.mission),
    completed: false,
    progress_target: 1,
    progress_current: 0,
    is_bonus: false,
  }));

  const streakBonus = getStreakBonus(streak);
  if (streakBonus) {
    rows.push({
      user_id: userId,
      mission_date: missionDate,
      mission_text: streakBonus.mission.text,
      mission_type: `bonus_${streakBonus.key}`,
      category: `bonus_${streakBonus.key}`,
      xp_reward: streakBonus.mission.xp,
      difficulty: streakBonus.mission.difficulty,
      auto_complete: false,
      completed: false,
      progress_target: 1,
      progress_current: 0,
      is_bonus: true,
    });
  }

  return rows;
}

function errorResponse(
  status: number,
  message: string,
  code: string,
  details: { retryAfterSeconds?: number; upstreamStatus?: number } = {},
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code,
      ...(typeof details.retryAfterSeconds === "number" ? { retryAfterSeconds: details.retryAfterSeconds } : {}),
      ...(typeof details.upstreamStatus === "number" ? { upstreamStatus: details.upstreamStatus } : {}),
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function successResponse(payload: {
  missions: unknown[];
  generated: boolean;
  theme: ThemeDay;
  meta?: GenerationMeta;
}): Response {
  return new Response(
    JSON.stringify(payload),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

export function resolveFallbackReason(error: unknown): DegradedReason {
  if (error instanceof AIRequestError) {
    return error.details.reason;
  }
  if (error instanceof InvalidAIGenerationError) {
    return "invalid_ai_output";
  }
  return "upstream_error";
}

export async function handleGenerateDailyMissions(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: "generate-daily-missions",
      allowServiceRole: false,
    });
    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }
    const { auth, supabase, requestId: protectedRequestId } = protectedRequest;
    requestId = protectedRequestId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return errorResponse(500, "Server configuration missing", "MISSING_ENV");
    }
    const userId = auth.userId;
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-daily-missions",
      featureKey: "ai_planner_text",
      userId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["text"],
      providers: ["openai"],
    });
    const body = await req.json().catch(() => ({}));
    const forceRegenerate = Boolean((body as { forceRegenerate?: unknown }).forceRegenerate);

    const { data: profileForTz, error: profileForTzError } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();

    if (profileForTzError) {
      console.warn("Failed to fetch profile timezone, defaulting to UTC:", profileForTzError.message);
    }

    const userTimezone = normalizeTimezone(profileForTz?.timezone);
    const today = getEffectiveMissionDate(userTimezone);
    const dayOfWeek = getEffectiveDayOfWeek(userTimezone);
    const themeDay = THEME_DAYS[dayOfWeek] ?? THEME_DAYS[0];

    console.log(`User timezone: ${userTimezone}, effective date: ${today}, day: ${dayOfWeek} (${themeDay.name})`);

    const { data: existing, error: existingError } = await supabase
      .from("daily_missions")
      .select("*")
      .eq("user_id", userId)
      .eq("mission_date", today);

    if (existingError) {
      console.error("Error loading existing missions:", existingError);
      return errorResponse(500, "Unable to load existing missions", "DB_FETCH_FAILED");
    }

    if (existing && existing.length > 0 && !forceRegenerate) {
      return successResponse({ missions: existing, generated: false, theme: themeDay });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_habit_streak")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.warn("Failed to fetch profile streak, defaulting to 0:", profileError.message);
    }

    const streak = profile?.current_habit_streak || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const [recentMissionsResult, activeEpicsResult, activeHabitsResult] = await Promise.all([
      supabase
        .from("daily_missions")
        .select("mission_text")
        .eq("user_id", userId)
        .gte("mission_date", sevenDaysAgoStr)
        .neq("mission_date", today),
      supabase
        .from("epics")
        .select("title")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("habits")
        .select("title")
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

    if (recentMissionsResult.error) {
      console.warn("Failed to fetch recent missions context:", recentMissionsResult.error.message);
    }
    if (activeEpicsResult.error) {
      console.warn("Failed to fetch active epics context:", activeEpicsResult.error.message);
    }
    if (activeHabitsResult.error) {
      console.warn("Failed to fetch active habits context:", activeHabitsResult.error.message);
    }

    const recentMissions = (recentMissionsResult.data ?? []).map((mission) => mission.mission_text);
    const activeGoals = [
      ...(activeEpicsResult.data ?? []).map((epic) => epic.title),
      ...(activeHabitsResult.data ?? []).map((habit) => habit.title),
    ];

    console.log(`Context: ${recentMissions.length} recent missions, ${activeGoals.length} active goals`);

    let generationMeta: GenerationMeta = { source: "ai", degraded: false };
    let missions: GeneratedMission[] | null = null;

    try {
      const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openAIApiKey) {
        throw new AIRequestError({
          status: 500,
          code: "AI_UPSTREAM_UNAVAILABLE",
          message: "OPENAI_API_KEY not configured",
          reason: "upstream_error",
        });
      }

      const promptBuilder = new PromptBuilder(supabaseUrl, supabaseServiceRoleKey);

      let userContext = `Today is ${themeDay.name} ${themeDay.emoji}. Generate one mission from each of these categories: ${themeDay.categories.join(", ")}.`;
      if (streak > 0) {
        userContext += ` The user has a ${streak} day streak - acknowledge their consistency!`;
      } else {
        userContext += " Make them encouraging to help build momentum.";
      }

      const recentHistoryBlock = recentMissions.length > 0
        ? `\n\nThe user has seen these missions in the last 7 days - generate COMPLETELY DIFFERENT ones. Do not repeat or closely paraphrase any of these:\n${recentMissions.map((mission) => `- \"${mission}\"`).join("\n")}`
        : "";

      const activeGoalsBlock = activeGoals.length > 0
        ? `\n\nThe user is currently working on these goals/habits: ${activeGoals.join(", ")}. You may optionally reference one of these to make a mission feel personal - but don't force it.`
        : "";

      const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
        templateKey: "daily_missions",
        userId,
        variables: {
          missionCount: 3,
          userStreak: streak,
          userContext: userContext + recentHistoryBlock + activeGoalsBlock,
          categoryGuidelines: CATEGORY_GUIDELINES,
          requiredCategories: themeDay.categories,
        },
      });

      const aiResponse = await guardedFetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new AIRequestError(mapAIHttpFailure(aiResponse.status, errorText, aiResponse.headers.get("Retry-After")));
      }

      const aiData = await aiResponse.json();
      const generatedText = aiData?.choices?.[0]?.message?.content;

      if (typeof generatedText !== "string") {
        throw new InvalidAIGenerationError("AI response missing content");
      }

      const parsed = parseAIMissions(generatedText);
      if (!parsed.missions) {
        throw new InvalidAIGenerationError(parsed.error ?? "Invalid AI response format");
      }

      const validator = new OutputValidator(validationRules, outputConstraints);
      const validationResult = validator.validate(parsed.missions);

      const normalizedResult = validateAndNormalizeMissions(parsed.missions, themeDay.categories);
      const allErrors = [...validationResult.errors, ...normalizedResult.errors];

      const responseTime = Date.now() - startTime;
      await supabase
        .from("ai_output_validation_log")
        .insert({
          user_id: userId,
          template_key: CANONICAL_RATE_LIMIT_KEY,
          input_data: { streak, userContext, themeDay: themeDay.name },
          output_data: { missions: parsed.missions },
          validation_passed: allErrors.length === 0,
          validation_errors: allErrors.length > 0 ? allErrors : null,
          model_used: "google/gemini-2.5-flash",
          response_time_ms: responseTime,
        });

      if (!normalizedResult.missions) {
        throw new InvalidAIGenerationError("AI missions failed validation", allErrors);
      }

      missions = normalizedResult.missions;
      console.log("Parsed missions:", missions);
    } catch (aiError) {
      const reason = resolveFallbackReason(aiError);
      console.warn("AI mission generation failed, using deterministic fallback:", aiError);
      missions = generateFallbackMissions(userId, today, themeDay.categories, activeGoals);
      generationMeta = {
        source: "fallback",
        degraded: true,
        reason,
      };

      if (!missions || missions.length !== 3) {
        if (aiError instanceof AIRequestError) {
          return errorResponse(aiError.details.status, aiError.details.message, aiError.details.code, {
            retryAfterSeconds: aiError.details.retryAfterSeconds,
            upstreamStatus: aiError.details.upstreamStatus,
          });
        }

        return errorResponse(500, "Unable to generate daily missions", "MISSION_GENERATION_FAILED");
      }
    }

    if (!missions || missions.length === 0) {
      return errorResponse(500, "No missions available right now", "NO_MISSIONS_AVAILABLE");
    }

    const missionRows = buildMissionRows(missions, userId, today, streak);

    if (forceRegenerate && existing && existing.length > 0) {
      const { error: deleteError } = await supabase
        .from("daily_missions")
        .delete()
        .eq("user_id", userId)
        .eq("mission_date", today);

      if (deleteError) {
        console.error("Error deleting existing missions during regenerate:", deleteError);
        return errorResponse(500, "Unable to replace existing missions", "DB_DELETE_FAILED");
      }
    }

    const { error: insertError } = await supabase
      .from("daily_missions")
      .upsert(missionRows, {
        onConflict: "user_id,mission_date,category",
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error("Error inserting missions:", insertError);
      return errorResponse(500, "Unable to save daily missions", "DB_WRITE_FAILED");
    }

    const { data: created, error: fetchError } = await supabase
      .from("daily_missions")
      .select("*")
      .eq("user_id", userId)
      .eq("mission_date", today);

    if (fetchError) {
      console.error("Error fetching missions:", fetchError);
      return errorResponse(500, "Unable to load generated missions", "DB_FETCH_FAILED");
    }

    console.log(`Generated ${created?.length || 0} missions for user ${userId} (${themeDay.name}) via ${generationMeta.source}`);

    return successResponse({
      missions: created ?? [],
      generated: true,
      theme: themeDay,
      meta: generationMeta,
    });
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error generating missions:", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "MISSION_GENERATION_FAILED",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve(handleGenerateDailyMissions);
}
