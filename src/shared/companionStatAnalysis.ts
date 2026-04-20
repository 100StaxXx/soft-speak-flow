import type {
  CompanionMissInterpretation,
  CompanionMomentumState,
  CompanionStatAttribute,
  CompanionStatNeed,
  CompanionStatProfileSummary,
} from "./companionStatSignals";

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
}

interface ValidationFailure {
  ok: false;
  error: string;
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

function failure(error: string): ValidationFailure {
  return { ok: false, error };
}

function success<T>(data: T): ValidationSuccess<T> {
  return { ok: true, data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
    if (!validation.ok) return validation;
  }

  return success(value as CompanionStatDriver[]);
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
  if (!reasonsValidation.ok) return reasonsValidation;

  const driversValidation = validateDriverArray(value.recentDrivers, `${path}.recentDrivers`);
  if (!driversValidation.ok) return driversValidation;

  return success(value as unknown as CompanionStatBreakdown);
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
    if (!reasonsValidation.ok) return reasonsValidation;
  }

  return success(value as Record<CompanionStatAttribute, CompanionStatNeed>);
}

function validateActivitySnapshot(
  value: unknown,
  path: string,
): ValidationResult<CompanionStatActivitySnapshot> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  for (const key of ACTIVITY_SNAPSHOT_KEYS) {
    const field = value[key];
    if (
      key === "activityStartDate"
      || key === "activityEndDate"
      || key === "provenanceStartDate"
      || key === "provenanceEndDate"
    ) {
      if (!isNonEmptyString(field)) {
        return failure(`${path}.${key} must be a non-empty string`);
      }
      continue;
    }

    if (!isFiniteNumber(field)) {
      return failure(`${path}.${key} must be a number`);
    }
  }

  return success(value as unknown as CompanionStatActivitySnapshot);
}

function validateStatProfile(
  value: unknown,
  path: string,
): ValidationResult<CompanionStatProfileSummary> {
  if (!isRecord(value)) {
    return failure(`${path} must be an object`);
  }

  if (!isRecord(value.scores)) {
    return failure(`${path}.scores must be an object`);
  }

  for (const attribute of ATTRIBUTE_KEYS) {
    if (!isFiniteNumber(value.scores[attribute])) {
      return failure(`${path}.scores.${attribute} must be a number`);
    }
  }

  if (!isString(value.dominantStat) || !ATTRIBUTE_KEYS.includes(value.dominantStat as CompanionStatAttribute)) {
    return failure(`${path}.dominantStat must be a valid companion stat attribute`);
  }

  if (!isString(value.secondaryStat) || !ATTRIBUTE_KEYS.includes(value.secondaryStat as CompanionStatAttribute)) {
    return failure(`${path}.secondaryStat must be a valid companion stat attribute`);
  }

  return success(value as unknown as CompanionStatProfileSummary);
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
  if (!activitySnapshotValidation.ok) return activitySnapshotValidation;

  const statProfileValidation = validateStatProfile(value.statProfile, "statProfile");
  if (!statProfileValidation.ok) return statProfileValidation;

  const statNeedsValidation = validateStatNeeds(value.statNeeds, "statNeeds");
  if (!statNeedsValidation.ok) return statNeedsValidation;

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
  if (!strongestRecentDriversValidation.ok) return strongestRecentDriversValidation;

  if (!Array.isArray(value.statBreakdowns)) {
    return failure(`statBreakdowns must be an array`);
  }

  for (const [index, breakdown] of value.statBreakdowns.entries()) {
    const validation = validateBreakdown(breakdown, `statBreakdowns[${index}]`);
    if (!validation.ok) return validation;
  }

  if (!isNonEmptyString(value.summary)) {
    return failure(`summary must be a non-empty string`);
  }

  if (!isNonEmptyString(value.suggestedAction)) {
    return failure(`suggestedAction must be a non-empty string`);
  }

  return success(value as unknown as CompanionStatAnalysis);
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
  if (!analysisValidation.ok) {
    return failure(`analysis.${analysisValidation.error}`);
  }

  return success({
    analysis: analysisValidation.data,
    cached: value.cached,
  });
}
