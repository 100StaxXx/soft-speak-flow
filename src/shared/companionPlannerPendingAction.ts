export type PlannerPendingActionSupportedProposalKind =
  | "create_quest"
  | "update_quest"
  | "create_campaign"
  | "update_campaign"
  | "adjust_campaign_plan"
  | "create_ritual"
  | "update_ritual"
  | "suggest_reminder";

type PlannerPendingActionType =
  | "campaign_create"
  | "campaign_adjust"
  | "task_create"
  | "task_update"
  | "ritual_create"
  | "ritual_update"
  | "reminder_create"
  | "campaign_update";

type PlannerPendingActionIntent =
  | "schedule_task"
  | "update_existing_plan"
  | "goal_setting";

type PlannerProposalPendingActionMetadata = {
  actionType: PlannerPendingActionType;
  intent: PlannerPendingActionIntent;
};

const PLANNER_PROPOSAL_PENDING_ACTION_METADATA = {
  create_quest: {
    actionType: "task_create",
    intent: "schedule_task",
  },
  update_quest: {
    actionType: "task_update",
    intent: "update_existing_plan",
  },
  create_campaign: {
    actionType: "campaign_create",
    intent: "goal_setting",
  },
  update_campaign: {
    actionType: "campaign_update",
    intent: "goal_setting",
  },
  adjust_campaign_plan: {
    actionType: "campaign_adjust",
    intent: "goal_setting",
  },
  create_ritual: {
    actionType: "ritual_create",
    intent: "goal_setting",
  },
  update_ritual: {
    actionType: "ritual_update",
    intent: "update_existing_plan",
  },
  suggest_reminder: {
    actionType: "reminder_create",
    intent: "update_existing_plan",
  },
} satisfies Record<PlannerPendingActionSupportedProposalKind, PlannerProposalPendingActionMetadata>;

export const PLANNER_PENDING_ACTION_PROPOSAL_KINDS = Object.freeze(
  Object.keys(
    PLANNER_PROPOSAL_PENDING_ACTION_METADATA,
  ) as PlannerPendingActionSupportedProposalKind[],
);

export const getPlannerProposalPendingActionMetadata = (
  kind: string | null | undefined,
): PlannerProposalPendingActionMetadata | null => {
  if (!kind) return null;

  return Object.prototype.hasOwnProperty.call(
      PLANNER_PROPOSAL_PENDING_ACTION_METADATA,
      kind,
    )
    ? PLANNER_PROPOSAL_PENDING_ACTION_METADATA[
      kind as PlannerPendingActionSupportedProposalKind
    ]
    : null;
};

export const isPlannerProposalPendingActionSupported = (
  kind: string | null | undefined,
): kind is PlannerPendingActionSupportedProposalKind =>
  getPlannerProposalPendingActionMetadata(kind) !== null;
