import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildCompanionStatAnalysisPreludeCardImageUrl,
  COMPANION_STAT_ANALYSIS_PRELUDE_CARD_BUCKET,
  COMPANION_STAT_ANALYSIS_PRELUDE_CARDS,
  type CompanionStatAnalysisPreludeCard,
} from "../src/shared/companionStatAnalysisPreludeCards";

type CompanionStatAttribute =
  | "vitality"
  | "wisdom"
  | "discipline"
  | "resolve"
  | "creativity"
  | "alignment";

type CompanionStatBand = "Emerging" | "Building" | "Strong" | "Exceptional";

type CosmiqTitleRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "cosmic";

type CosmiqTitleMomentum = "rising" | "steady" | "recovering" | "slipping";

interface TemplateProfile {
  rarity: CosmiqTitleRarity;
  momentum: CosmiqTitleMomentum;
  dominantStat: CompanionStatAttribute;
  secondaryStat: CompanionStatAttribute;
  rebalanceStat: CompanionStatAttribute;
  fusion: boolean;
  scores: Record<CompanionStatAttribute, number>;
}

interface GeneratedCardResponse {
  card?: {
    profileKey?: string;
    imageUrl?: string | null;
    imageUrls?: string[];
    status?: string;
    failureCode?: string | null;
    failureMessage?: string | null;
  };
  error?: string;
  details?: string;
}

interface FixtureUser {
  userId: string;
  email: string;
  password: string;
  companionId: string;
}

const PROJECT_ROOT = process.cwd();
const SUPABASE_CONFIG_PATH = path.join(PROJECT_ROOT, "supabase/config.toml");
const DEFAULT_SUPABASE_PROJECT_REF = "opbfpbbqvuksuvmtmssd";
const FUNCTION_NAME = "generate-cosmiq-title-card";
const ATTRIBUTE_KEYS: CompanionStatAttribute[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];

const TEMPLATE_PROFILES: Record<string, TemplateProfile> = {
  "the-wandering-seeker": {
    rarity: "common",
    momentum: "slipping",
    dominantStat: "wisdom",
    secondaryStat: "alignment",
    rebalanceStat: "vitality",
    fusion: false,
    scores: {
      vitality: 322,
      wisdom: 328,
      discipline: 331,
      resolve: 315,
      creativity: 306,
      alignment: 364,
    },
  },
  "the-verdant-guardian": {
    rarity: "uncommon",
    momentum: "recovering",
    dominantStat: "vitality",
    secondaryStat: "alignment",
    rebalanceStat: "wisdom",
    fusion: false,
    scores: {
      vitality: 645,
      wisdom: 410,
      discipline: 520,
      resolve: 505,
      creativity: 390,
      alignment: 560,
    },
  },
  "the-astral-scholar": {
    rarity: "rare",
    momentum: "steady",
    dominantStat: "wisdom",
    secondaryStat: "creativity",
    rebalanceStat: "resolve",
    fusion: false,
    scores: {
      vitality: 430,
      wisdom: 690,
      discipline: 520,
      resolve: 405,
      creativity: 610,
      alignment: 555,
    },
  },
  "the-iron-vanguard": {
    rarity: "rare",
    momentum: "rising",
    dominantStat: "discipline",
    secondaryStat: "vitality",
    rebalanceStat: "creativity",
    fusion: true,
    scores: {
      vitality: 660,
      wisdom: 480,
      discipline: 690,
      resolve: 585,
      creativity: 365,
      alignment: 535,
    },
  },
  "the-unbroken-sentinel": {
    rarity: "epic",
    momentum: "steady",
    dominantStat: "discipline",
    secondaryStat: "resolve",
    rebalanceStat: "vitality",
    fusion: true,
    scores: {
      vitality: 430,
      wisdom: 510,
      discipline: 720,
      resolve: 700,
      creativity: 380,
      alignment: 565,
    },
  },
  "the-reality-weaver": {
    rarity: "epic",
    momentum: "rising",
    dominantStat: "creativity",
    secondaryStat: "wisdom",
    rebalanceStat: "discipline",
    fusion: true,
    scores: {
      vitality: 455,
      wisdom: 715,
      discipline: 405,
      resolve: 530,
      creativity: 735,
      alignment: 610,
    },
  },
  "the-soulforged-creator": {
    rarity: "rare",
    momentum: "rising",
    dominantStat: "creativity",
    secondaryStat: "alignment",
    rebalanceStat: "resolve",
    fusion: true,
    scores: {
      vitality: 480,
      wisdom: 560,
      discipline: 510,
      resolve: 420,
      creativity: 690,
      alignment: 650,
    },
  },
  "the-inner-oracle": {
    rarity: "epic",
    momentum: "steady",
    dominantStat: "alignment",
    secondaryStat: "wisdom",
    rebalanceStat: "vitality",
    fusion: true,
    scores: {
      vitality: 405,
      wisdom: 690,
      discipline: 515,
      resolve: 560,
      creativity: 590,
      alignment: 735,
    },
  },
  "the-storm-breaker": {
    rarity: "legendary",
    momentum: "rising",
    dominantStat: "resolve",
    secondaryStat: "vitality",
    rebalanceStat: "alignment",
    fusion: false,
    scores: {
      vitality: 705,
      wisdom: 510,
      discipline: 650,
      resolve: 790,
      creativity: 455,
      alignment: 430,
    },
  },
  "the-cosmic-harmonizer": {
    rarity: "cosmic",
    momentum: "steady",
    dominantStat: "alignment",
    secondaryStat: "wisdom",
    rebalanceStat: "creativity",
    fusion: false,
    scores: {
      vitality: 610,
      wisdom: 755,
      discipline: 690,
      resolve: 670,
      creativity: 585,
      alignment: 835,
    },
  },
};

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex < 1) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
};

const loadEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};

  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(PROJECT_ROOT, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed) env[parsed[0]] = parsed[1];
    }
  }

  return {
    ...env,
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };
};

const readProjectRef = (env: Record<string, string>) => {
  if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF;

  if (fs.existsSync(SUPABASE_CONFIG_PATH)) {
    const match = fs
      .readFileSync(SUPABASE_CONFIG_PATH, "utf8")
      .match(/^project_id\s*=\s*"([^"]+)"/m);
    if (match?.[1]) return match[1];
  }

  return DEFAULT_SUPABASE_PROJECT_REF;
};

const isJwtLike = (value: string) => value.startsWith("eyJ") && value.split(".").length >= 3;

const getCliApiKeys = (projectRef: string) => {
  let rawJson = "";
  try {
    rawJson = execFileSync(
      "supabase",
      ["projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    return {};
  }

  const parsed = JSON.parse(rawJson) as unknown;
  const keys: { anonKey?: string; serviceRoleKey?: string } = {};

  const visit = (value: unknown, hint = "") => {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, hint));
      return;
    }

    const record = value as Record<string, unknown>;
    const objectHint = [
      hint,
      record.name,
      record.type,
      record.role,
      record.key,
      record.id,
    ]
      .filter((item): item is string => typeof item === "string")
      .join(" ")
      .toLowerCase();

    for (const [key, item] of Object.entries(record)) {
      const keyHint = `${objectHint} ${key}`.toLowerCase();
      if (typeof item === "string" && isJwtLike(item)) {
        if (keyHint.includes("service")) {
          keys.serviceRoleKey ??= item;
        } else if (keyHint.includes("anon") || keyHint.includes("publishable")) {
          keys.anonKey ??= item;
        }
      } else {
        visit(item, keyHint);
      }
    }
  };

  visit(parsed);
  return keys;
};

const resolveSupabaseConfig = () => {
  const env = loadEnv();
  const projectRef = readProjectRef(env);
  const cliKeys = getCliApiKeys(projectRef);
  const supabaseUrl =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    `https://${projectRef}.supabase.co`;
  const anonKey =
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    cliKeys.anonKey;
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    cliKeys.serviceRoleKey;

  if (!anonKey) {
    throw new Error(
      "Missing Supabase anon/publishable key. Set SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY or run `supabase login` so the CLI can resolve project API keys.",
    );
  }

  return {
    anonKey,
    projectRef,
    serviceRoleKey,
    supabaseUrl,
  };
};

const createSupabaseClient = (supabaseUrl: string, key: string, clientInfo: string) =>
  createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "x-client-info": clientInfo,
      },
    },
  });

const getBandForScore = (score: number): CompanionStatBand => {
  if (score <= 299) return "Emerging";
  if (score <= 499) return "Building";
  if (score <= 699) return "Strong";
  return "Exceptional";
};

const buildDriver = (attribute: CompanionStatAttribute) => ({
  key: `${attribute}:preload-template`,
  label: `${attribute[0].toUpperCase()}${attribute.slice(1)} signal`,
  detail: `Template generation profile emphasizes ${attribute}.`,
  sourceType: "attribute_event",
  window: "30d",
  count: 3,
  amount: 18,
});

const buildAnalysisPayload = ({
  card,
  companionId,
  userId,
  analysisDate,
}: {
  card: CompanionStatAnalysisPreludeCard;
  companionId: string;
  userId: string;
  analysisDate: string;
}) => {
  const profile = TEMPLATE_PROFILES[card.id];
  if (!profile) {
    throw new Error(`Missing template profile for ${card.id}`);
  }

  const statBreakdowns = ATTRIBUTE_KEYS.map((attribute) => ({
    attribute,
    score: profile.scores[attribute],
    band: getBandForScore(profile.scores[attribute]),
    status: `${getBandForScore(profile.scores[attribute])} template signal`,
    primaryReasons: [`${card.title} uses ${attribute} as part of its archetype profile.`],
    recentDrivers: attribute === profile.dominantStat ? [buildDriver(attribute)] : [],
  }));

  return {
    analysisDate,
    timezone: "America/Los_Angeles",
    generatedAt: `${analysisDate}T18:30:00.000Z`,
    mentor: {
      id: null,
      name: "Cosmiq",
      tone: "Mythic and specific",
      avatarUrl: null,
      primaryColor: "#8b5cf6",
    },
    companion: {
      id: companionId,
      currentStage: 3,
      currentXp: 240,
    },
    activitySnapshot: {
      activityStartDate: "2026-04-12",
      activityEndDate: analysisDate,
      provenanceStartDate: "2026-03-20",
      provenanceEndDate: analysisDate,
      morningCheckIns: 4,
      eveningReflections: 3,
      habitCompletions: 5,
      onTimeTasks: 2,
      trackedAttributeEvents: 6,
      streakMilestones: 1,
      hardTaskWins: 2,
      recoveryActions: 1,
      healthActions: 2,
      creativeActions: 1,
      relationshipActions: 1,
      epicLinkedCompletions: 1,
      bounceBackDays: 1,
    },
    statProfile: {
      scores: profile.scores,
      dominantStat: profile.dominantStat,
      secondaryStat: profile.secondaryStat,
    },
    statNeeds: Object.fromEntries(
      ATTRIBUTE_KEYS.map((attribute) => [
        attribute,
        {
          level: attribute === profile.rebalanceStat ? "high" : "low",
          reasons: attribute === profile.rebalanceStat
            ? [`${attribute} is the growth path for this template card.`]
            : [],
        },
      ]),
    ),
    cosmiqTitle: {
      title: card.title,
      rarity: profile.rarity,
      momentum: profile.momentum,
      dominantStat: profile.dominantStat,
      secondaryStat: profile.secondaryStat,
      rebalanceStat: profile.rebalanceStat,
      fusion: profile.fusion,
      rebalancePath: card.description,
      titleStability: "new",
    },
    cosmiqTitleCard: {
      profileKey: `preload-template-card/${card.id}`,
      imageUrl: null,
      imageUrls: [],
      status: "generating",
      cached: false,
      promptVersion: 1,
    },
    fantasyTitle: {
      title: card.title,
      archetype: `${profile.dominantStat} / ${profile.secondaryStat}`,
      explanation: `${card.title} is a template archetype used while Cosmiq stats are loading.`,
    },
    momentumState: profile.momentum === "slipping" ? "slipping" : "coasting",
    recentMissInterpretation: "normal_variance",
    narrativeBrief: `${card.title} template preload art.`,
    dailyNarrative: `${card.title} template signal.`,
    weeklyNarrative: `${card.title} template signal for preload card art.`,
    identityBootstrap: `${card.title} represents a reusable Cosmiq title-card archetype.`,
    strongestRecentDrivers: [buildDriver(profile.dominantStat)],
    statBreakdowns,
    summary: `${card.title} preload card generated for the loading slideshow.`,
    suggestedAction: `Use ${card.title} as a visual template while the personal card loads.`,
  };
};

const createFixtureUser = async (
  serviceSupabase: SupabaseClient,
  userSupabase: SupabaseClient,
): Promise<FixtureUser> => {
  const randomToken = crypto.randomUUID();
  const email = `cosmiq-preload-${Date.now()}-${randomToken.slice(0, 8)}@example.invalid`;
  const password = `Cosmiq-preload-${randomToken}!`;

  const { data: createData, error: createError } =
    await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        purpose: "cosmiq-title-preload-card-generation",
      },
    });

  if (createError || !createData.user?.id) {
    throw new Error(`Failed to create preload fixture user: ${createError?.message ?? "missing user id"}`);
  }

  const userId = createData.user.id;

  const { error: profileError } = await serviceSupabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        onboarding_completed: true,
        stats_enabled: true,
        timezone: "America/Los_Angeles",
      },
      { onConflict: "id" },
    );

  if (profileError) {
    throw new Error(`Failed to upsert preload fixture profile: ${profileError.message}`);
  }

  const { data: companionData, error: companionError } = await serviceSupabase
    .from("user_companion")
    .insert({
      user_id: userId,
      favorite_color: "violet",
      spirit_animal: "star",
      core_element: "void",
      companion_name: "Preload",
      current_stage: 3,
      current_xp: 240,
      vitality: 500,
      wisdom: 500,
      discipline: 500,
      resolve: 500,
      creativity: 500,
      alignment: 500,
    })
    .select("id")
    .single();

  if (companionError || !companionData?.id) {
    throw new Error(`Failed to create preload fixture companion: ${companionError?.message ?? "missing companion id"}`);
  }

  const { error: signInError } = await userSupabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(`Failed to sign in preload fixture user: ${signInError.message}`);
  }

  return {
    companionId: companionData.id,
    email,
    password,
    userId,
  };
};

const cleanupFixtureUser = async (
  serviceSupabase: SupabaseClient,
  fixtureUser: FixtureUser | null,
) => {
  if (!fixtureUser) return;

  const { error: analysisError } = await serviceSupabase
    .from("companion_stat_analyses")
    .delete()
    .eq("user_id", fixtureUser.userId);
  if (analysisError) {
    console.warn(`Warning: failed to delete fixture analyses: ${analysisError.message}`);
  }

  const { error: companionError } = await serviceSupabase
    .from("user_companion")
    .delete()
    .eq("id", fixtureUser.companionId);
  if (companionError) {
    console.warn(`Warning: failed to delete fixture companion: ${companionError.message}`);
  }

  const { error: userError } = await serviceSupabase.auth.admin.deleteUser(fixtureUser.userId);
  if (userError) {
    console.warn(`Warning: failed to delete fixture auth user ${fixtureUser.email}: ${userError.message}`);
  }
};

const insertAnalysis = async ({
  card,
  index,
  fixtureUser,
  serviceSupabase,
}: {
  card: CompanionStatAnalysisPreludeCard;
  index: number;
  fixtureUser: FixtureUser;
  serviceSupabase: SupabaseClient;
}) => {
  const analysisDate = `2026-04-${String(10 + index).padStart(2, "0")}`;
  const payload = buildAnalysisPayload({
    analysisDate,
    card,
    companionId: fixtureUser.companionId,
    userId: fixtureUser.userId,
  });

  const { error } = await serviceSupabase
    .from("companion_stat_analyses")
    .upsert(
      {
        user_id: fixtureUser.userId,
        companion_id: fixtureUser.companionId,
        mentor_id: null,
        analysis_date: analysisDate,
        payload,
      },
      { onConflict: "user_id,analysis_date" },
    );

  if (error) {
    throw new Error(`Failed to insert analysis for ${card.title}: ${error.message}`);
  }

  return analysisDate;
};

const getFunctionErrorDetail = async (error: unknown) => {
  const maybeContext = error && typeof error === "object"
    ? (error as { context?: unknown }).context
    : null;
  if (!maybeContext || typeof maybeContext !== "object") return null;

  const response = maybeContext as Response;
  if (typeof response.clone !== "function") return null;

  try {
    return await response.clone().text();
  } catch {
    return null;
  }
};

const generateCardImageUrl = async ({
  analysisDate,
  card,
  userSupabase,
}: {
  analysisDate: string;
  card: CompanionStatAnalysisPreludeCard;
  userSupabase: SupabaseClient;
}) => {
  const { data, error } = await userSupabase.functions.invoke<GeneratedCardResponse>(
    FUNCTION_NAME,
    {
      body: {
        analysisDate,
        forceRefresh: true,
      },
    },
  );

  if (error) {
    const detail = await getFunctionErrorDetail(error);
    throw new Error(
      `Function invocation failed for ${card.title}: ${error.message}${detail ? ` (${detail})` : ""}`,
    );
  }

  if (data?.error) {
    throw new Error(
      `Function returned an error for ${card.title}: ${data.error}${data.details ? ` (${data.details})` : ""}`,
    );
  }

  if (data?.card?.status !== "ready" || !data.card.imageUrl) {
    throw new Error(
      `Title card generation did not return ready art for ${card.title}: ${
        data?.card?.failureCode ?? data?.card?.status ?? "unknown_status"
      } ${data?.card?.failureMessage ?? ""}`.trim(),
    );
  }

  return data.card.imageUrl;
};

const downloadImage = async (imageUrl: string) => {
  const response = await fetch(imageUrl, {
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download generated image ${imageUrl}: HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const uploadPreloadCard = async ({
  card,
  imageBytes,
  serviceSupabase,
}: {
  card: CompanionStatAnalysisPreludeCard;
  imageBytes: Buffer;
  serviceSupabase: SupabaseClient;
}) => {
  const pngBytes = await sharp(imageBytes)
    .png()
    .toBuffer();

  const { error } = await serviceSupabase.storage
    .from(COMPANION_STAT_ANALYSIS_PRELUDE_CARD_BUCKET)
    .upload(card.imageStoragePath, pngBytes, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload ${card.imageStoragePath}: ${error.message}`);
  }
};

const verifyPublicPng = async (publicUrl: string) => {
  const response = await fetch(publicUrl, {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const ok = response.ok && contentType.toLowerCase().startsWith("image/png");

  return {
    contentType,
    ok,
    status: response.status,
  };
};

const verifyAllPublicPngs = async (supabaseUrl: string) => {
  const results = [];

  for (const card of COMPANION_STAT_ANALYSIS_PRELUDE_CARDS) {
    const publicUrl = buildCompanionStatAnalysisPreludeCardImageUrl(card, supabaseUrl);
    const verification = await verifyPublicPng(publicUrl);
    results.push({
      card,
      publicUrl,
      ...verification,
    });
  }

  return results;
};

const main = async () => {
  const force = process.argv.includes("--force");
  const keepFixtureUser = process.argv.includes("--keep-fixture-user");
  const verifyOnly = process.argv.includes("--verify-only");
  const env = loadEnv();
  const projectRef = readProjectRef(env);
  const supabaseUrl =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    `https://${projectRef}.supabase.co`;

  const initialVerification = await verifyAllPublicPngs(supabaseUrl);
  const invalidResults = initialVerification.filter((result) => !result.ok);

  if (verifyOnly) {
    for (const result of initialVerification) {
      const label = result.ok ? "ok" : `missing/bad HTTP ${result.status} ${result.contentType || "no-content-type"}`;
      console.log(`${result.card.id}: ${label}`);
    }

    if (invalidResults.length > 0) {
      throw new Error(`${invalidResults.length} preload image(s) failed live verification.`);
    }

    console.log(`Verified ${initialVerification.length}/${COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.length} preload PNGs.`);
    return;
  }

  const cardsToGenerate = force
    ? COMPANION_STAT_ANALYSIS_PRELUDE_CARDS
    : invalidResults.map((result) => result.card);

  if (cardsToGenerate.length === 0) {
    console.log("All preload template cards already exist and passed live PNG verification.");
    return;
  }

  const { anonKey, serviceRoleKey } = resolveSupabaseConfig();
  const serviceSupabase = createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    "cosmiq-title-preload-card-generator-service",
  );
  const userSupabase = createSupabaseClient(
    supabaseUrl,
    anonKey,
    "cosmiq-title-preload-card-generator-user",
  );
  let fixtureUser: FixtureUser | null = null;

  try {
    fixtureUser = await createFixtureUser(serviceSupabase, userSupabase);
    console.log(`Generating ${cardsToGenerate.length} preload template card(s) via ${FUNCTION_NAME}.`);

    for (const card of cardsToGenerate) {
      const cardIndex = COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.findIndex(
        (candidate) => candidate.id === card.id,
      );
      const ordinal = `${cardIndex + 1}/${COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.length}`;
      console.log(`[${ordinal}] ${card.title}: starting`);

      const analysisDate = await insertAnalysis({
        card,
        fixtureUser,
        index: cardIndex,
        serviceSupabase,
      });
      const generatedImageUrl = await generateCardImageUrl({
        analysisDate,
        card,
        userSupabase,
      });
      const generatedBytes = await downloadImage(generatedImageUrl);
      await uploadPreloadCard({
        card,
        imageBytes: generatedBytes,
        serviceSupabase,
      });

      const publicUrl = buildCompanionStatAnalysisPreludeCardImageUrl(card, supabaseUrl);
      const verification = await verifyPublicPng(publicUrl);
      if (!verification.ok) {
        throw new Error(
          `${card.title} uploaded but failed public verification: HTTP ${verification.status} ${verification.contentType}`,
        );
      }

      console.log(`[${ordinal}] ${card.title}: uploaded ${card.imageStoragePath}`);
    }
  } finally {
    if (keepFixtureUser) {
      console.log("Keeping preload fixture user because --keep-fixture-user was provided.");
    } else {
      await cleanupFixtureUser(serviceSupabase, fixtureUser);
    }
  }

  const finalVerification = await verifyAllPublicPngs(supabaseUrl);
  const failed = finalVerification.filter((result) => !result.ok);
  if (failed.length > 0) {
    throw new Error(`${failed.length} preload image(s) failed final live verification.`);
  }

  console.log(`Verified ${finalVerification.length}/${COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.length} preload PNGs.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
