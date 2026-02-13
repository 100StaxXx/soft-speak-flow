export type RitualType = "attention" | "nurture" | "growth" | "reflection";
export type RitualStatus = "pending" | "completed" | "missed";
export type RequestUrgency = "gentle" | "important" | "critical";
export type RequestStatus = "pending" | "accepted" | "completed" | "declined" | "expired" | "snoozed";
export type RequestEscalationLevel = "stable" | "watch" | "critical";

export interface CompanionRitualDef {
  id: string;
  code: string;
  title: string;
  description: string;
  ritualType: RitualType;
  baseBondDelta: number;
  baseCareDelta: number;
  cooldownHours: number;
}

export interface CompanionRitual {
  id: string;
  ritualDate: string;
  status: RitualStatus;
  urgency: RequestUrgency;
  completedAt: string | null;
  completionContext: Record<string, unknown>;
  ritualDefId: string;
  ritualDef: CompanionRitualDef | null;
}

export interface CompanionRequest {
  id: string;
  requestType: string;
  title: string;
  prompt: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  dueAt: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  responseStyle: string | null;
  consequenceHint: string | null;
  requestContext: Record<string, unknown>;
}

export interface CompanionRequestCadence {
  maxOpenRequests: number;
  openRequests: number;
  slotsAvailable: number;
  cooldownActive: boolean;
  nextDueAt: string | null;
  overdueCount: number;
  urgencyCounts: Record<RequestUrgency, number>;
  escalationPressure: number;
  escalationLevel: RequestEscalationLevel;
  recommendedNewRequests: number;
}

export interface CompanionRequestAnalytics {
  averageResponseMinutes: number | null;
  completionStreakDays: number;
  completionRate30d: number | null;
  resolvedCount30d: number;
  completedCount30d: number;
}

export interface CompanionHabitatState {
  biome: string;
  ambiance: string;
  qualityTier: "high" | "medium" | "low";
  decorSlots: Record<string, string | null>;
  unlockedThemes: string[];
  lastSceneState: Record<string, unknown>;
}

export interface CompanionHabitatItem {
  id: string;
  itemKey: string;
  itemName: string;
  slot: "foreground" | "midground" | "background" | string;
  rarity: "common" | "rare" | "epic" | "legendary" | string;
  isEquipped: boolean;
  unlockSource: string | null;
  metadata: Record<string, unknown>;
}

export interface CompanionCampaignNode {
  id: string;
  nodeKey: string;
  chapterIndex: number;
  title: string;
  summary: string;
  unlockRules: Record<string, unknown>;
  branchGroup: string | null;
  branchOutcomes: Record<string, string>;
  ambientTheme: string | null;
}

export interface CompanionCampaignChoice {
  at: string;
  fromNodeId: string | null;
  toNodeId: string;
  choiceKey: string;
  recap?: {
    chapter: number;
    title: string;
    summary: string;
    ambientTheme: string | null;
    branchLabel: string;
  };
}

export interface CompanionCampaignRecapCard {
  id: string;
  at: string;
  chapter: number;
  title: string;
  summary: string;
  ambientTheme: string | null;
  choiceKey: string;
  fromNodeTitle: string | null;
  toNodeId: string;
}

export interface CompanionCampaignBranchTarget {
  choiceKey: string;
  toNodeKey: string;
  toNodeId: string | null;
  toNodeTitle: string | null;
  toNodeChapter: number | null;
  unlockRules: Record<string, unknown>;
  eligible: boolean;
  blockedReasons: string[];
}

export interface CompanionCampaignProgress {
  id: string;
  currentNodeId: string | null;
  currentChapter: number;
  unlockedNodeIds: string[];
  completedNodeIds: string[];
  choiceHistory: CompanionCampaignChoice[];
  recapCards: CompanionCampaignRecapCard[];
  currentNode: CompanionCampaignNode | null;
  availableChoices: string[];
  availableBranches: CompanionCampaignBranchTarget[];
}

export interface CompanionSocialSnapshotPayload {
  companion?: {
    spiritAnimal?: string | null;
    stage?: number | null;
    mood?: string | null;
    bondLevel?: number | null;
    emotionalArc?: string | null;
    routineStability?: number | null;
  };
  habitat?: {
    biome?: string | null;
    ambiance?: string | null;
    quality_tier?: "high" | "medium" | "low" | string | null;
    decor_slots?: Record<string, string | null>;
  };
  campaign?: {
    current_chapter?: number | null;
    current_node_id?: string | null;
  };
  publishedAt?: string | null;
}

export interface CompanionSocialSnapshot {
  id: string;
  headline: string;
  visibility: "friends" | "private" | "public";
  publishedAt: string;
  snapshotType?: string;
  snapshotPayload?: CompanionSocialSnapshotPayload | null;
}

export interface CompanionLifeSnapshot {
  currentEmotionalArc: string;
  routineStabilityScore: number;
  requestFatigue: number;
}
