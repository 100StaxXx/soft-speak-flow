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
      return "I drafted this quest for you. Review it and confirm if it fits.";
    case "update_quest":
      return "I drafted this quest edit for you. Review it and confirm if it fits.";
    case "create_campaign":
      return "I drafted this campaign for you. Review it and confirm if it fits.";
    case "update_campaign":
      return "I drafted this campaign edit for you. Review it and confirm if it fits.";
    case "adjust_campaign_plan":
      return "I drafted this campaign adjustment for you. Review it and confirm if it fits.";
    case "create_ritual":
      return "I drafted this ritual for you. Review it and confirm if it fits.";
    case "update_ritual":
      return "I drafted this ritual edit for you. Review it and confirm if it fits.";
    case "suggest_reminder":
      return "I drafted this reminder change for you. Review it and confirm if it fits.";
    default:
      return "I drafted this planner change for you. Review it and confirm if it fits.";
  }
};
