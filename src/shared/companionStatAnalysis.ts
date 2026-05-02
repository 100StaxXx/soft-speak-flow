import type {
  CompanionMissInterpretation,
  CompanionMomentumState,
  CompanionStatAttribute,
  CompanionStatNeed,
  CompanionStatProfileSummary,
} from "./companionStatSignals.ts";
import {
  buildCompanionFantasyTitle,
  type CompanionFantasyTitle,
} from "./companionStatFantasyTitles.ts";
import {
  buildCompanionCosmiqTitle,
  buildFantasyTitleAliasFromCosmiqTitle,
  isCompanionCosmiqTitleMomentum,
  isCompanionCosmiqTitleRarity,
  isCompanionCosmiqTitleStability,
  type CompanionCosmiqTitle,
  type CompanionCosmiqTitleCard,
} from "./companionStatCosmiqTitles.ts";

export type CompanionStatBand = "Emerging" | "Building" | "Strong" | "Exceptional";
export type CompanionStatDriverSource = "attribute_event" | "activity" | "echo";
export type CompanionStatDriverWindow = "7d" | "30d";

export interface CompanionStatDriver {
  key: string;
  label: string;
  detail: string;
  sourceType: CompanionStatDriverSource;
  window: CompanionStatDriverWindow;
  count: number | null;
  amount: number | null;
}

export interface CompanionStatBreakdown {
  attribute: CompanionStatAttribute;
  score: number;
  band: CompanionStatBand;
  status: string;
  primaryReasons: string[];
  recentDrivers: CompanionStatDriver[];
}

export interface CompanionStatActivitySnapshot {
  activityStartDate: string;
  activityEndDate: string;
  provenanceStartDate: string;
  provenanceEndDate: string;
  morningCheckIns: number;
  eveningReflections: number;
  habitCompletions: number;
  onTimeTasks: number;
  trackedAttributeEvents: number;
  streakMilestones: number;
  hardTaskWins: number;
  recoveryActions: number;
  healthActions: number;
  creativeActions: number;
  relationshipActions: number;
  epicLinkedCompletions: number;
  bounceBackDays: number;
}

export interface CompanionStatAnalysis {
  analysisDate: string;
  timezone: string;
  generatedAt: string;
  mentor: {
    id: string | null;
    name: string;
    tone: string | null;
    avatarUrl: string | null;
    primaryColor: string | null;
  };
  companion: {
    id: string;
    currentStage: number;
    currentXp: number;
  };
  activitySnapshot: CompanionStatActivitySnapshot;
  statProfile: CompanionStatProfileSummary;
  statNeeds: Record<CompanionStatAttribute, CompanionStatNeed>;
  cosmiqTitle: CompanionCosmiqTitle;
  cosmiqTitleCard?: CompanionCosmiqTitleCard;
  fantasyTitle: CompanionFantasyTitle;
  momentumState: CompanionMomentumState;
  recentMissInterpretation: CompanionMissInterpretation;
  narrativeBrief: string;
  dailyNarrative: string;
  weeklyNarrative: string;
  identityBootstrap: string;
  strongestRecentDrivers: CompanionStatDriver[];
  statBreakdowns: CompanionStatBreakdown[];
  summary: string;
  suggestedAction: string;
}

export interface CompanionStatAnalysisResponse {
  analysis: CompanionStatAnalysis;
  cached: boolean;
}

interface ValidationSuccess<T> {
  ok: true;
  data: T;
  error?: never;
}

interface ValidationFailure {
  ok: false;
  error: string;
  data?: never;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const ATTRIBUTE_KEYS: readonly CompanionStatAttribute[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];

const NEED_LEVELS = new Set(["low", "medium", "high"]);
const BAND_VALUES = new Set(["Emerging", "Building", "Strong", "Exceptional"]);
const DRIVER_SOURCE_VALUES = new Set(["attribute_event", "activity", "echo"]);
const DRIVER_WINDOW_VALUES = new Set(["7d", "30d"]);
const MOMENTUM_VALUES = new Set(["locked_in", "coasting", "slipping", "rebuilding"]);
const MISS_INTERPRETATION_VALUES = new Set([
  "overload",
  "low_energy",
  "avoidance",
  "interruption",
  "normal_variance",
]);
const COSMIQ_TITLE_CARD_STATUS_VALUES = new Set(["ready", "generating", "unavailable"]);

const ACTIVITY_SNAPSHOT_KEYS: ReadonlyArray<keyof CompanionStatActivitySnapshot> = [
  "activityStartDate",
  "activityEndDate",
  "provenanceStartDate",
  "provenanceEndDate",
  "morningCheckIns",
  "eveningReflections",
  "habitCompletions",
  "onTimeTasks",
  "trackedAttributeEvents",
  "streakMilestones",
  "hardTaskWins",
  "recoveryActions",
  "healthActions",
  "creativeActions",
  "relationshipActions",
  "epicLinkedCompletions",
  "bounceBackDays",
];

const ACTIVITY_SNAPSHOT_DATE_KEYS = [
  "activityStartDate",
  "activityEndDate",
  "provenanceStartDate",
  "provenanceEndDate",
] as const satisfies readonly (keyof CompanionStatActivitySnapshot)[];

const ACTIVITY_SNAPSHOT_COUNT_KEYS = [
  "morningCheckIns",
  "eveningReflections",
  "habitCompletions",
  "onTimeTasks",
  "trackedAttributeEvents",
  "streakMilestones",
  "hardTaskWins",
  "recoveryActions",
  "healthActions",
  "creativeActions",
  "relationshipActions",
  "epicLinkedCompletions",
  "bounceBackDays",
] as const satisfies readonly (keyof CompanionStatActivitySnapshot)[];

const STAT_NEEDS_COMPATIBILITY_ERROR_PATTERN = /^analysis\.statNeeds(?:\.[a-z]+)? must be an object$/;
const COSMIQ_TITLE_COMPATIBILITY_ERROR_PATTERN = /^analysis\.cosmiqTitle(?:\.| must be an object$)/;

function failure(error: string): ValidationFailure {
  return { ok: false, error };
}

function success<T>(data: T): ValidationSuccess<T> {
  return { ok: true, data };
}

function isValidationFailure<T>(result: ValidationResult<T>): result is ValidationFailure {
  return result.ok === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (!isString(value)) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function validateStringArray(value: unknown, path: string): ValidationResult<string[]> {
  if (!Array.isArray(value)) {
    return failure(`${path} must be an array`);
  }

  if (!value.every(isString)) {
    return failure(`${path} must contain only strings`);
  }

  return success(value);
}

function validateDriver(value: unknown, path: string): ValidationResult<CompanionStatDriver> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  if (!isNonEmptyString(value.key)) {
    return failure(`${path}.key must be a non-empty string`);
  }

  if (!isNonEmptyString(value.label)) {
    return failure(`${path}.label must be a non-empty string`);
  }

  if (!isNonEmptyString(value.detail)) {
    return failure(`${path}.detail must be a non-empty string`);
  }

  if (!isString(value.sourceType) || !DRIVER_SOURCE_VALUES.has(value.sourceType)) {
    return failure(`${path}.sourceType must be one of attribute_event, activity, or echo`);
  }

  if (!isString(value.window) || !DRIVER_WINDOW_VALUES.has(value.window)) {
    return failure(`${path}.window must be "7d" or "30d"`);
  }

  if (!(value.count === null || isFiniteNumber(value.count))) {
    return failure(`${path}.count must be a number or null`);
  }

  if (!(value.amount === null || isFiniteNumber(value.amount))) {
    return failure(`${path}.amount must be a number or null`);
  }

  return success(value as unknown as CompanionStatDriver);
}

function validateDriverArray(value: unknown, path: string): ValidationResult<CompanionStatDriver[]> {
  if (!Array.isArray(value)) {
    return failure(`${path} must be an array`);
  }

  for (const [index, driver] of value.entries()) {
    const validation = validateDriver(driver, `${path}[${index}]`);
    if (isValidationFailure(validation)) return validation;
  }

  return success(value as CompanionStatDriver[]);
}

function sortAttributesByScore(
  scores: Record<CompanionStatAttribute, number>,
): CompanionStatAttribute[] {
  return [...ATTRIBUTE_KEYS].sort((left, right) => {
    const diff = scores[right] - scores[left];
    if (diff !== 0) return diff;
    return ATTRIBUTE_KEYS.indexOf(left) - ATTRIBUTE_KEYS.indexOf(right);
  });
}

function validateBreakdown(value: unknown, path: string): ValidationResult<CompanionStatBreakdown> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  if (!isString(value.attribute) || !ATTRIBUTE_KEYS.includes(value.attribute as CompanionStatAttribute)) {
    return failure(`${path}.attribute must be a valid companion stat attribute`);
  }

  if (!isFiniteNumber(value.score)) {
    return failure(`${path}.score must be a number`);
  }

  if (!isString(value.band) || !BAND_VALUES.has(value.band)) {
    return failure(`${path}.band must be a valid stat band`);
  }

  if (!isNonEmptyString(value.status)) {
    return failure(`${path}.status must be a non-empty string`);
  }

  const reasonsValidation = validateStringArray(value.primaryReasons, `${path}.primaryReasons`);
  if (isValidationFailure(reasonsValidation)) return reasonsValidation;

  const driversValidation = validateDriverArray(value.recentDrivers, `${path}.recentDrivers`);
  if (isValidationFailure(driversValidation)) return driversValidation;

  return success(value as unknown as CompanionStatBreakdown);
}

function deriveStatProfileFromBreakdowns(
  breakdowns: CompanionStatBreakdown[],
  path: string,
): ValidationResult<CompanionStatProfileSummary> {
  const scores = {} as Record<CompanionStatAttribute, number>;

  for (const attribute of ATTRIBUTE_KEYS) {
    const breakdown = breakdowns.find((entry) => entry.attribute === attribute);
    if (!breakdown) {
      return failure(`${path} must be an object`);
    }

    scores[attribute] = breakdown.score;
  }

  const sortedAttributes = sortAttributesByScore(scores);
  const dominantStat = sortedAttributes[0] ?? "discipline";
  const secondaryStat = sortedAttributes[1] ?? dominantStat;

  return success({
    scores,
    dominantStat,
    secondaryStat,
  });
}

function validateStatNeeds(
  value: unknown,
  path: string,
): ValidationResult<Record<CompanionStatAttribute, CompanionStatNeed>> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  for (const attribute of ATTRIBUTE_KEYS) {
    const need = value[attribute];
    if (!isRecord(need)) {
      return failure(`${path}.${attribute} must be an object`);
    }

    if (!isString(need.level) || !NEED_LEVELS.has(need.level)) {
      return failure(`${path}.${attribute}.level must be low, medium, or high`);
    }

    const reasonsValidation = validateStringArray(need.reasons, `${path}.${attribute}.reasons`);
    if (isValidationFailure(reasonsValidation)) return reasonsValidation;
  }

  return success(value as Record<CompanionStatAttribute, CompanionStatNeed>);
}

function validateFantasyTitle(value: unknown, path: string): ValidationResult<CompanionFantasyTitle> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  if (!isNonEmptyString(value.title)) {
    return failure(`${path}.title must be a non-empty string`);
  }

  if (!isNonEmptyString(value.archetype)) {
    return failure(`${path}.archetype must be a non-empty string`);
  }

  if (!isNonEmptyString(value.explanation)) {
    return failure(`${path}.explanation must be a non-empty string`);
  }

  return success(value as unknown as CompanionFantasyTitle);
}

function validateCosmiqTitle(value: unknown, path: string): ValidationResult<CompanionCosmiqTitle> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  if (!isNonEmptyString(value.title)) {
    return failure(`${path}.title must be a non-empty string`);
  }

  if (!isCompanionCosmiqTitleRarity(value.rarity)) {
    return failure(`${path}.rarity must be a valid Cosmiq title rarity`);
  }

  if (!isCompanionCosmiqTitleMomentum(value.momentum)) {
    return failure(`${path}.momentum must be a valid Cosmiq title momentum`);
  }

  if (!isString(value.dominantStat) || !ATTRIBUTE_KEYS.includes(value.dominantStat as CompanionStatAttribute)) {
    return failure(`${path}.dominantStat must be a valid companion stat attribute`);
  }

  if (!isString(value.secondaryStat) || !ATTRIBUTE_KEYS.includes(value.secondaryStat as CompanionStatAttribute)) {
    return failure(`${path}.secondaryStat must be a valid companion stat attribute`);
  }

  if (!isString(value.rebalanceStat) || !ATTRIBUTE_KEYS.includes(value.rebalanceStat as CompanionStatAttribute)) {
    return failure(`${path}.rebalanceStat must be a valid companion stat attribute`);
  }

  if (typeof value.fusion !== "boolean") {
    return failure(`${path}.fusion must be a boolean`);
  }

  if (!isNonEmptyString(value.rebalancePath)) {
    return failure(`${path}.rebalancePath must be a non-empty string`);
  }

  if (!isCompanionCosmiqTitleStability(value.titleStability)) {
    return failure(`${path}.titleStability must be a valid Cosmiq title stability`);
  }

  return success(value as unknown as CompanionCosmiqTitle);
}

function validateCosmiqTitleCard(value: unknown, path: string): ValidationResult<CompanionCosmiqTitleCard | undefined> {
  if (value === undefined) {
    return success(undefined);
  }

  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  if (!isNonEmptyString(value.profileKey)) {
    return failure(`${path}.profileKey must be a non-empty string`);
  }

  if (!(value.imageUrl === null || isNonEmptyString(value.imageUrl))) {
    return failure(`${path}.imageUrl must be a non-empty string or null`);
  }

  let imageUrls: string[] | undefined;
  if (value.imageUrls !== undefined) {
    if (!Array.isArray(value.imageUrls)) {
      return failure(`${path}.imageUrls must be an array`);
    }

    const normalizedUrls: string[] = [];
    for (const [index, imageUrl] of value.imageUrls.entries()) {
      if (!isNonEmptyString(imageUrl)) {
        return failure(`${path}.imageUrls[${index}] must be a non-empty string`);
      }
      if (!normalizedUrls.includes(imageUrl)) {
        normalizedUrls.push(imageUrl);
      }
    }
    imageUrls = normalizedUrls;
  }

  if (!isString(value.status) || !COSMIQ_TITLE_CARD_STATUS_VALUES.has(value.status)) {
    return failure(`${path}.status must be ready, generating, or unavailable`);
  }

  if (typeof value.cached !== "boolean") {
    return failure(`${path}.cached must be a boolean`);
  }

  if (!isFiniteNumber(value.promptVersion)) {
    return failure(`${path}.promptVersion must be a number`);
  }

  return success({
    ...(value as unknown as CompanionCosmiqTitleCard),
    ...(imageUrls ? { imageUrls } : {}),
  });
}

function validateActivitySnapshot(
  value: unknown,
  path: string,
): ValidationResult<CompanionStatActivitySnapshot> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  const normalizedSnapshot = {} as CompanionStatActivitySnapshot;

  for (const key of ACTIVITY_SNAPSHOT_DATE_KEYS) {
    const field = value[key];
    if (!isNonEmptyString(field)) {
      return failure(`${path}.${key} must be a non-empty string`);
    }

    normalizedSnapshot[key] = field;
  }

  for (const key of ACTIVITY_SNAPSHOT_COUNT_KEYS) {
    const field = value[key];
    if (field === null || field === undefined) {
      normalizedSnapshot[key] = 0;
      continue;
    }

    const parsed = toFiniteNumber(field);
    if (parsed === null) {
      return failure(`${path}.${key} must be a number`);
    }

    normalizedSnapshot[key] = parsed;
  }

  for (const key of ACTIVITY_SNAPSHOT_KEYS) {
    if (!(key in normalizedSnapshot)) {
      return failure(`${path}.${key} is missing`);
    }
  }

  return success(normalizedSnapshot);
}

function validateStatProfile(
  value: unknown,
  breakdowns: CompanionStatBreakdown[],
  path: string,
): ValidationResult<CompanionStatProfileSummary> {
  const fallback = deriveStatProfileFromBreakdowns(breakdowns, path);

  if (!isRecord(value)) {
    return fallback;
  }

  const normalizedScores = {} as Record<CompanionStatAttribute, number>;
  if (isRecord(value.scores)) {
    for (const attribute of ATTRIBUTE_KEYS) {
      if (!isFiniteNumber(value.scores[attribute])) {
        return fallback;
      }

      normalizedScores[attribute] = value.scores[attribute];
    }
  } else if (fallback.ok) {
    Object.assign(normalizedScores, fallback.data.scores);
  } else {
    return failure(`${path}.scores must be an object`);
  }

  const sortedAttributes = sortAttributesByScore(normalizedScores);
  const dominantFallback = fallback.ok ? fallback.data.dominantStat : sortedAttributes[0] ?? "discipline";
  const secondaryFallback = fallback.ok ? fallback.data.secondaryStat : sortedAttributes[1] ?? dominantFallback;

  const dominantStat = isString(value.dominantStat) && ATTRIBUTE_KEYS.includes(value.dominantStat as CompanionStatAttribute)
    ? value.dominantStat as CompanionStatAttribute
    : dominantFallback;

  const secondaryStat = isString(value.secondaryStat) && ATTRIBUTE_KEYS.includes(value.secondaryStat as CompanionStatAttribute)
    ? value.secondaryStat as CompanionStatAttribute
    : secondaryFallback;

  return success({
    scores: normalizedScores,
    dominantStat,
    secondaryStat,
  });
}

export function validateCompanionStatAnalysis(value: unknown): ValidationResult<CompanionStatAnalysis> {
  if (!isRecord(value)) {
    return failure(`analysis must be an object`);
  }

  if (!isNonEmptyString(value.analysisDate)) {
    return failure(`analysisDate must be a non-empty string`);
  }

  if (!isNonEmptyString(value.timezone)) {
    return failure(`timezone must be a non-empty string`);
  }

  if (!isNonEmptyString(value.generatedAt)) {
    return failure(`generatedAt must be a non-empty string`);
  }

  if (!isRecord(value.mentor)) {
    return failure(`mentor must be an object`);
  }

  if (!isNullableString(value.mentor.id)) {
    return failure(`mentor.id must be a string or null`);
  }

  if (!isNonEmptyString(value.mentor.name)) {
    return failure(`mentor.name must be a non-empty string`);
  }

  if (!isNullableString(value.mentor.tone)) {
    return failure(`mentor.tone must be a string or null`);
  }

  if (!isNullableString(value.mentor.avatarUrl)) {
    return failure(`mentor.avatarUrl must be a string or null`);
  }

  if (!isNullableString(value.mentor.primaryColor)) {
    return failure(`mentor.primaryColor must be a string or null`);
  }

  if (!isRecord(value.companion)) {
    return failure(`companion must be an object`);
  }

  if (!isNonEmptyString(value.companion.id)) {
    return failure(`companion.id must be a non-empty string`);
  }

  if (!isFiniteNumber(value.companion.currentStage)) {
    return failure(`companion.currentStage must be a number`);
  }

  if (!isFiniteNumber(value.companion.currentXp)) {
    return failure(`companion.currentXp must be a number`);
  }

  const activitySnapshotValidation = validateActivitySnapshot(value.activitySnapshot, "activitySnapshot");
  if (isValidationFailure(activitySnapshotValidation)) return activitySnapshotValidation;

  if (!Array.isArray(value.statBreakdowns)) {
    return failure(`statBreakdowns must be an array`);
  }

  const normalizedBreakdowns: CompanionStatBreakdown[] = [];
  for (const [index, breakdown] of value.statBreakdowns.entries()) {
    const validation = validateBreakdown(breakdown, `statBreakdowns[${index}]`);
    if (isValidationFailure(validation)) return validation;
    normalizedBreakdowns.push(validation.data);
  }

  const statProfileValidation = validateStatProfile(value.statProfile, normalizedBreakdowns, "statProfile");
  if (isValidationFailure(statProfileValidation)) return statProfileValidation;

  const statNeedsValidation = validateStatNeeds(value.statNeeds, "statNeeds");
  if (isValidationFailure(statNeedsValidation)) return statNeedsValidation;

  const cosmiqTitleValidation = validateCosmiqTitle(value.cosmiqTitle, "cosmiqTitle");
  if (isValidationFailure(cosmiqTitleValidation)) return cosmiqTitleValidation;

  const cosmiqTitleCardValidation = validateCosmiqTitleCard(value.cosmiqTitleCard, "cosmiqTitleCard");
  if (isValidationFailure(cosmiqTitleCardValidation)) return cosmiqTitleCardValidation;

  const fantasyTitleValidation = validateFantasyTitle(value.fantasyTitle, "fantasyTitle");
  if (isValidationFailure(fantasyTitleValidation)) return fantasyTitleValidation;

  if (!isString(value.momentumState) || !MOMENTUM_VALUES.has(value.momentumState)) {
    return failure(`momentumState must be a valid companion momentum state`);
  }

  if (
    !isString(value.recentMissInterpretation)
    || !MISS_INTERPRETATION_VALUES.has(value.recentMissInterpretation)
  ) {
    return failure(`recentMissInterpretation must be a valid miss interpretation`);
  }

  if (!isNonEmptyString(value.narrativeBrief)) {
    return failure(`narrativeBrief must be a non-empty string`);
  }

  if (!isNonEmptyString(value.dailyNarrative)) {
    return failure(`dailyNarrative must be a non-empty string`);
  }

  if (!isNonEmptyString(value.weeklyNarrative)) {
    return failure(`weeklyNarrative must be a non-empty string`);
  }

  if (!isNonEmptyString(value.identityBootstrap)) {
    return failure(`identityBootstrap must be a non-empty string`);
  }

  const strongestRecentDriversValidation = validateDriverArray(
    value.strongestRecentDrivers,
    "strongestRecentDrivers",
  );
  if (isValidationFailure(strongestRecentDriversValidation)) return strongestRecentDriversValidation;

  if (!isNonEmptyString(value.summary)) {
    return failure(`summary must be a non-empty string`);
  }

  if (!isNonEmptyString(value.suggestedAction)) {
    return failure(`suggestedAction must be a non-empty string`);
  }

  return success({
    ...(value as unknown as CompanionStatAnalysis),
    activitySnapshot: activitySnapshotValidation.data,
    statProfile: statProfileValidation.data,
    statNeeds: statNeedsValidation.data,
    cosmiqTitle: cosmiqTitleValidation.data,
    ...(cosmiqTitleCardValidation.data ? { cosmiqTitleCard: cosmiqTitleCardValidation.data } : {}),
    fantasyTitle: fantasyTitleValidation.data,
    statBreakdowns: normalizedBreakdowns,
  });
}

export function validateCompanionStatAnalysisResponse(
  value: unknown,
): ValidationResult<CompanionStatAnalysisResponse> {
  if (!isRecord(value)) {
    return failure(`response must be an object`);
  }

  if (typeof value.cached !== "boolean") {
    return failure(`cached must be a boolean`);
  }

  const analysisValidation = validateCompanionStatAnalysis(value.analysis);
  if (isValidationFailure(analysisValidation)) {
    return failure(`analysis.${analysisValidation.error}`);
  }

  return success({
    analysis: analysisValidation.data,
    cached: value.cached,
  });
}

function createDefaultStatNeed(): CompanionStatNeed {
  return {
    level: "low",
    reasons: [],
  };
}

function createDefaultStatNeeds(): Record<CompanionStatAttribute, CompanionStatNeed> {
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((attribute) => [attribute, createDefaultStatNeed()]),
  ) as Record<CompanionStatAttribute, CompanionStatNeed>;
}

function normalizeCompanionStatNeedsForClient(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.analysis)) {
    return value;
  }

  const analysis = value.analysis;
  if (!isRecord(analysis.statNeeds)) {
    return {
      ...value,
      analysis: {
        ...analysis,
        statNeeds: createDefaultStatNeeds(),
      },
    };
  }

  let didChange = false;
  const normalizedStatNeeds = {
    ...analysis.statNeeds,
  } as Record<string, unknown>;

  for (const attribute of ATTRIBUTE_KEYS) {
    if (!isRecord(analysis.statNeeds[attribute])) {
      normalizedStatNeeds[attribute] = createDefaultStatNeed();
      didChange = true;
    }
  }

  if (!didChange) {
    return value;
  }

  return {
    ...value,
    analysis: {
      ...analysis,
      statNeeds: normalizedStatNeeds,
    },
  };
}

function normalizeCompanionFantasyTitleForClient(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.analysis)) {
    return value;
  }

  const analysis = value.analysis;
  if (isRecord(analysis.fantasyTitle)) {
    return value;
  }

  const cosmiqTitleValidation = validateCosmiqTitle(analysis.cosmiqTitle, "cosmiqTitle");
  if (cosmiqTitleValidation.ok) {
    return {
      ...value,
      analysis: {
        ...analysis,
        fantasyTitle: buildFantasyTitleAliasFromCosmiqTitle(cosmiqTitleValidation.data),
      },
    };
  }

  if (!Array.isArray(analysis.statBreakdowns)) {
    return value;
  }

  const normalizedBreakdowns: CompanionStatBreakdown[] = [];
  for (const [index, breakdown] of analysis.statBreakdowns.entries()) {
    const validation = validateBreakdown(breakdown, `statBreakdowns[${index}]`);
    if (isValidationFailure(validation)) {
      return value;
    }
    normalizedBreakdowns.push(validation.data);
  }

  const statProfileValidation = validateStatProfile(
    analysis.statProfile,
    normalizedBreakdowns,
    "statProfile",
  );
  if (isValidationFailure(statProfileValidation)) {
    return value;
  }

  const statNeeds = isRecord(analysis.statNeeds)
    ? analysis.statNeeds as Partial<Record<CompanionStatAttribute, CompanionStatNeed>>
    : null;
  const momentumState = isString(analysis.momentumState) && MOMENTUM_VALUES.has(analysis.momentumState)
    ? analysis.momentumState as CompanionMomentumState
    : "coasting";
  const analysisDate = isNonEmptyString(analysis.analysisDate)
    ? analysis.analysisDate
    : "1970-01-01";

  return {
    ...value,
    analysis: {
      ...analysis,
      fantasyTitle: buildCompanionFantasyTitle({
        analysisDate,
        statProfile: statProfileValidation.data,
        statNeeds,
        momentumState,
      }),
    },
  };
}

function normalizeCompanionCosmiqTitleForClient(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.analysis)) {
    return value;
  }

  const analysis = value.analysis;
  if (isRecord(analysis.cosmiqTitle)) {
    return value;
  }

  if (!Array.isArray(analysis.statBreakdowns)) {
    return value;
  }

  const normalizedBreakdowns: CompanionStatBreakdown[] = [];
  for (const [index, breakdown] of analysis.statBreakdowns.entries()) {
    const validation = validateBreakdown(breakdown, `statBreakdowns[${index}]`);
    if (isValidationFailure(validation)) {
      return value;
    }
    normalizedBreakdowns.push(validation.data);
  }

  const statProfileValidation = validateStatProfile(
    analysis.statProfile,
    normalizedBreakdowns,
    "statProfile",
  );
  if (isValidationFailure(statProfileValidation)) {
    return value;
  }

  const statNeeds = isRecord(analysis.statNeeds)
    ? analysis.statNeeds as Partial<Record<CompanionStatAttribute, CompanionStatNeed>>
    : null;
  const momentumState = isString(analysis.momentumState) && MOMENTUM_VALUES.has(analysis.momentumState)
    ? analysis.momentumState as CompanionMomentumState
    : "coasting";

  return {
    ...value,
    analysis: {
      ...analysis,
      cosmiqTitle: buildCompanionCosmiqTitle({
        statProfile: statProfileValidation.data,
        statNeeds,
        statBreakdowns: normalizedBreakdowns,
        momentumState,
      }),
    },
  };
}

export function validateCompanionStatAnalysisResponseForClient(
  value: unknown,
): ValidationResult<CompanionStatAnalysisResponse> {
  const validation = validateCompanionStatAnalysisResponse(value);
  if (validation.ok) return validation;

  if (
    !STAT_NEEDS_COMPATIBILITY_ERROR_PATTERN.test(validation.error)
    && !COSMIQ_TITLE_COMPATIBILITY_ERROR_PATTERN.test(validation.error)
    && validation.error !== "analysis.fantasyTitle must be an object"
  ) {
    return validation;
  }

  return validateCompanionStatAnalysisResponse(
    normalizeCompanionFantasyTitleForClient(
      normalizeCompanionCosmiqTitleForClient(
        normalizeCompanionStatNeedsForClient(value),
      ),
    ),
  );
}
