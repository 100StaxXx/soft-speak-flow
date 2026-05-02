import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { resolveCosmiqTitleCard } from "../_shared/cosmiqTitleCard.ts";
import {
  type CompanionStatAnalysis,
  type CompanionStatBand,
} from "../../../src/shared/companionStatAnalysis.ts";
import {
  COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION,
  buildCompanionCosmiqTitleCardProfileKey,
  type CompanionCosmiqTitle,
} from "../../../src/shared/companionStatCosmiqTitles.ts";
import type { CompanionStatAttribute } from "../../../src/shared/companionStatSignals.ts";

interface SeedCosmiqTitleCardLibraryDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  resolveCosmiqTitleCard: typeof resolveCosmiqTitleCard;
}

interface ExistingSeedRow {
  profile_key?: string | null;
  status?: string | null;
  image_url?: string | null;
}

const defaultDeps: SeedCosmiqTitleCardLibraryDeps = {
  authenticate: requireRequestAuth,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseKey);
  },
  fetchImpl: fetch,
  resolveCosmiqTitleCard,
};

const ATTRIBUTE_ORDER: CompanionStatAttribute[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];
const TARGET_READY_COUNT_DEFAULT = 10;
const TARGET_READY_COUNT_MAX = 10;
const SEED_ANALYSIS_DATE = "2026-01-01";
const VISUAL_PERSONA = "neutral";

const BAND_BY_SCORE = (score: number): CompanionStatBand => {
  if (score <= 299) return "Emerging";
  if (score <= 499) return "Building";
  if (score <= 699) return "Strong";
  return "Exceptional";
};

const parseTargetReadyCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return TARGET_READY_COUNT_DEFAULT;
  return Math.max(1, Math.min(TARGET_READY_COUNT_MAX, Math.round(value)));
};

const toExistingSeedRows = (value: unknown): ExistingSeedRow[] =>
  Array.isArray(value)
    ? value.filter((row): row is ExistingSeedRow => row && typeof row === "object" && !Array.isArray(row))
    : [];

const buildScores = (
  dominantStat: CompanionStatAttribute,
  secondaryStat: CompanionStatAttribute,
  rebalanceStat: CompanionStatAttribute,
) => {
  const scores = Object.fromEntries(ATTRIBUTE_ORDER.map((attribute) => [attribute, 460])) as Record<
    CompanionStatAttribute,
    number
  >;
  scores[dominantStat] = 680;
  scores[secondaryStat] = 610;
  scores[rebalanceStat] = 340;
  return scores;
};

const buildStatNeeds = (rebalanceStat: CompanionStatAttribute): CompanionStatAnalysis["statNeeds"] => {
  const statNeeds = {} as CompanionStatAnalysis["statNeeds"];
  for (const attribute of ATTRIBUTE_ORDER) {
    statNeeds[attribute] = {
      level: attribute === rebalanceStat ? "medium" : "low",
      reasons: [],
    };
  }
  return statNeeds;
};

const buildSeedAnalysis = (
  cosmiqTitle: CompanionCosmiqTitle,
  index: number,
): CompanionStatAnalysis => {
  const scores = buildScores(
    cosmiqTitle.dominantStat,
    cosmiqTitle.secondaryStat,
    cosmiqTitle.rebalanceStat,
  );
  const statBreakdowns = ATTRIBUTE_ORDER.map((attribute) => {
    const score = scores[attribute];
    const band = BAND_BY_SCORE(score);
    return {
      attribute,
      score,
      band,
      status: `${band} score in a shared starter title-card profile`,
      primaryReasons: [`${attribute} is part of this shared title-card seed profile.`],
      recentDrivers: [],
    };
  });

  return {
    analysisDate: SEED_ANALYSIS_DATE,
    timezone: "UTC",
    generatedAt: `${SEED_ANALYSIS_DATE}T00:00:00.000Z`,
    mentor: {
      id: null,
      name: "Cosmiq Archive",
      tone: "Atmospheric and concise",
      avatarUrl: null,
      primaryColor: null,
    },
    companion: {
      id: `cosmiq-seed-${index + 1}`,
      currentStage: 3,
      currentXp: 600,
    },
    activitySnapshot: {
      activityStartDate: SEED_ANALYSIS_DATE,
      activityEndDate: SEED_ANALYSIS_DATE,
      provenanceStartDate: SEED_ANALYSIS_DATE,
      provenanceEndDate: SEED_ANALYSIS_DATE,
      morningCheckIns: 0,
      eveningReflections: 0,
      habitCompletions: 0,
      onTimeTasks: 0,
      trackedAttributeEvents: 0,
      streakMilestones: 0,
      hardTaskWins: 0,
      recoveryActions: 0,
      healthActions: 0,
      creativeActions: 0,
      relationshipActions: 0,
      epicLinkedCompletions: 0,
      bounceBackDays: 0,
    },
    statProfile: {
      scores,
      dominantStat: cosmiqTitle.dominantStat,
      secondaryStat: cosmiqTitle.secondaryStat,
    },
    statNeeds: buildStatNeeds(cosmiqTitle.rebalanceStat),
    cosmiqTitle,
    fantasyTitle: {
      title: cosmiqTitle.title,
      archetype: `${cosmiqTitle.dominantStat} / ${cosmiqTitle.secondaryStat}`,
      explanation: cosmiqTitle.rebalancePath,
    },
    momentumState: "coasting",
    recentMissInterpretation: "normal_variance",
    narrativeBrief: "Shared starter profile for the Cosmiq title-card library.",
    dailyNarrative: "Archive seed",
    weeklyNarrative: "Archive seed",
    identityBootstrap: "Shared title-card seed profile.",
    strongestRecentDrivers: [],
    statBreakdowns,
    summary: "Shared starter profile for title-card loading art.",
    suggestedAction: "Keep the reveal alive while current title art is generated.",
  };
};

const SEED_TITLES: CompanionCosmiqTitle[] = [
  {
    title: "The Oathbound Pathfinder",
    rarity: "rare",
    momentum: "steady",
    dominantStat: "discipline",
    secondaryStat: "alignment",
    rebalanceStat: "creativity",
    fusion: true,
    rebalancePath: "Strengthen Creativity to evolve toward The Soulforged Creator.",
    titleStability: "stable",
  },
  {
    title: "The Reality Weaver",
    rarity: "epic",
    momentum: "rising",
    dominantStat: "wisdom",
    secondaryStat: "creativity",
    rebalanceStat: "vitality",
    fusion: true,
    rebalancePath: "Strengthen Vitality to keep the vision embodied.",
    titleStability: "stable",
  },
  {
    title: "The Verdant Guardian",
    rarity: "uncommon",
    momentum: "steady",
    dominantStat: "vitality",
    secondaryStat: "discipline",
    rebalanceStat: "wisdom",
    fusion: false,
    rebalancePath: "Strengthen Wisdom to guide the growth with clearer pattern-reading.",
    titleStability: "stable",
  },
  {
    title: "The Storm-Breaker",
    rarity: "epic",
    momentum: "recovering",
    dominantStat: "resolve",
    secondaryStat: "vitality",
    rebalanceStat: "alignment",
    fusion: false,
    rebalancePath: "Strengthen Alignment so resilience stays pointed at the right path.",
    titleStability: "stable",
  },
  {
    title: "The Star-Eyed Oracle",
    rarity: "rare",
    momentum: "rising",
    dominantStat: "wisdom",
    secondaryStat: "alignment",
    rebalanceStat: "discipline",
    fusion: false,
    rebalancePath: "Strengthen Discipline to turn insight into repeatable action.",
    titleStability: "stable",
  },
  {
    title: "The Soulforged Creator",
    rarity: "epic",
    momentum: "steady",
    dominantStat: "creativity",
    secondaryStat: "alignment",
    rebalanceStat: "resolve",
    fusion: true,
    rebalancePath: "Strengthen Resolve to protect the creative path when friction rises.",
    titleStability: "stable",
  },
  {
    title: "The Iron Vanguard",
    rarity: "rare",
    momentum: "steady",
    dominantStat: "vitality",
    secondaryStat: "discipline",
    rebalanceStat: "creativity",
    fusion: true,
    rebalancePath: "Strengthen Creativity to keep strength from becoming too rigid.",
    titleStability: "stable",
  },
  {
    title: "The Clockwork Sage",
    rarity: "rare",
    momentum: "steady",
    dominantStat: "discipline",
    secondaryStat: "wisdom",
    rebalanceStat: "vitality",
    fusion: true,
    rebalancePath: "Strengthen Vitality so the system has enough fuel.",
    titleStability: "stable",
  },
  {
    title: "The Blooming Titan",
    rarity: "legendary",
    momentum: "rising",
    dominantStat: "vitality",
    secondaryStat: "creativity",
    rebalanceStat: "resolve",
    fusion: false,
    rebalancePath: "Strengthen Resolve to sustain the bloom under pressure.",
    titleStability: "stable",
  },
  {
    title: "Keeper of the Inner Map",
    rarity: "uncommon",
    momentum: "recovering",
    dominantStat: "alignment",
    secondaryStat: "wisdom",
    rebalanceStat: "discipline",
    fusion: false,
    rebalancePath: "Strengthen Discipline to follow the map one step at a time.",
    titleStability: "stable",
  },
];

const SEED_ANALYSES = SEED_TITLES.map(buildSeedAnalysis);

const getSeedProfileKey = (analysis: CompanionStatAnalysis) =>
  buildCompanionCosmiqTitleCardProfileKey({
    cosmiqTitle: analysis.cosmiqTitle,
    statBreakdowns: analysis.statBreakdowns,
    promptVersion: COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION,
    visualPersona: VISUAL_PERSONA,
  });

async function getReadyLibraryCount(supabase: any, targetReadyCount: number): Promise<number> {
  const { data, error } = await supabase
    .from("companion_cosmiq_title_cards")
    .select("profile_key")
    .eq("status", "ready")
    .not("image_url", "is", null)
    .limit(targetReadyCount);

  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}

async function getExistingSeedRows(supabase: any): Promise<Map<string, ExistingSeedRow>> {
  const seedProfileKeys = SEED_ANALYSES.map(getSeedProfileKey);
  const { data, error } = await supabase
    .from("companion_cosmiq_title_cards")
    .select("profile_key,status,image_url")
    .in("profile_key", seedProfileKeys);

  if (error) throw error;

  return new Map(
    toExistingSeedRows(data)
      .filter((row) => typeof row.profile_key === "string")
      .map((row) => [row.profile_key as string, row]),
  );
}

function chooseSeedAnalysis(existingRows: Map<string, ExistingSeedRow>) {
  const annotated = SEED_ANALYSES.map((analysis) => {
    const profileKey = getSeedProfileKey(analysis);
    return {
      analysis,
      profileKey,
      existing: existingRows.get(profileKey) ?? null,
    };
  });

  return (
    annotated.find(({ existing }) => !existing)
    ?? annotated.find(({ existing }) => existing?.status === "unavailable")
    ?? annotated.find(({ existing }) => existing?.status === "generating")
    ?? null
  );
}

export async function handleSeedCosmiqTitleCardLibrary(
  req: Request,
  deps: SeedCosmiqTitleCardLibraryDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await deps.authenticate(req, corsHeaders);
    if (auth instanceof Response) return auth;
    if (auth.isServiceRole) {
      return new Response(JSON.stringify({ error: "User authentication required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetReadyCount = parseTargetReadyCount(body?.targetReadyCount);
    const supabase = deps.createSupabaseClient();
    const readyCount = await getReadyLibraryCount(supabase, targetReadyCount);

    if (readyCount >= targetReadyCount) {
      return new Response(
        JSON.stringify({
          action: "already_ready",
          readyCount,
          targetReadyCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const existingRows = await getExistingSeedRows(supabase);
    const seed = chooseSeedAnalysis(existingRows);
    if (!seed) {
      return new Response(
        JSON.stringify({
          action: "seed_catalog_exhausted",
          readyCount,
          targetReadyCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const card = await deps.resolveCosmiqTitleCard({
      supabase,
      userId: auth.userId,
      analysis: seed.analysis,
      visualPersona: VISUAL_PERSONA,
      fetchImpl: deps.fetchImpl,
    });
    const nextReadyCount = card.status === "ready" ? Math.min(targetReadyCount, readyCount + 1) : readyCount;

    return new Response(
      JSON.stringify({
        action: card.status === "ready" ? "generated" : card.status,
        readyCount: nextReadyCount,
        targetReadyCount,
        profileKey: seed.profileKey,
        card,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in seed-cosmiq-title-card-library:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleSeedCosmiqTitleCardLibrary(req));
}
