const READY_QUEST_PROPOSAL_KINDS = new Set([
  "create_quest",
  "update_quest",
  "suggest_reminder",
]);

type PlannerProposalLike = {
  kind: string;
  readyToConfirm: boolean;
  status?: string | null;
};

const normalizePlannerReplyForDetection = (reply: string): string =>
  reply
    .replace(/[*_`~>#[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const isReadyQuestPlannerProposalKind = (kind: string): boolean =>
  READY_QUEST_PROPOSAL_KINDS.has(kind);

export const getReadyQuestPlannerProposals = <T extends PlannerProposalLike>(
  proposals: T[],
): T[] =>
  proposals.filter((proposal) =>
    (proposal.status ?? "pending") === "pending" &&
    proposal.readyToConfirm &&
    isReadyQuestPlannerProposalKind(proposal.kind)
  );

export const hasReadyQuestPlannerProposal = <T extends PlannerProposalLike>(
  proposals: T[],
): boolean => getReadyQuestPlannerProposals(proposals).length > 0;

export const isQuestionLikePlannerReply = (reply: string): boolean => {
  const normalized = normalizePlannerReplyForDetection(reply);
  if (!normalized) return true;

  return normalized.includes("?") ||
    /\b(before you confirm|let me know|tell me|what makes this timing|fine[- ]tune|which .* fits|which .* matters|want me to|do you prefer|how would you like|any other priorities)\b/
      .test(normalized);
};

export const buildConfirmReadyPlannerReply = (kind: string): string => {
  switch (kind) {
    case "create_quest":
      return "I can talk this through with you, but I won't create or schedule a quest from this chat.";
    case "update_quest":
      return "I can talk this through with you, but I won't create or schedule a quest edit from this chat.";
    case "create_campaign":
      return "I can talk this through with you, but I won't create or schedule a campaign from this chat.";
    case "update_campaign":
      return "I can talk this through with you, but I won't create or schedule a campaign edit from this chat.";
    case "adjust_campaign_plan":
      return "I can talk this through with you, but I won't create or schedule a campaign adjustment from this chat.";
    case "create_ritual":
      return "I can talk this through with you, but I won't create or schedule a ritual from this chat.";
    case "update_ritual":
      return "I can talk this through with you, but I won't create or schedule a ritual edit from this chat.";
    case "suggest_reminder":
      return "I can talk this through with you, but I won't create or schedule a reminder change from this chat.";
    default:
      return "I can talk this through with you, but I won't create or schedule planner changes from this chat.";
  }
};
