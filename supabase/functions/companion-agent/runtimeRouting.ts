import {
  isScheduleReadMessage,
  isUpcomingScheduleDigestMessage,
} from "../../../src/shared/schedulingIntent.ts";
import type { CompanionAgentRequest } from "./types.ts";

export const isDeterministicScheduleReadRequest = (
  request: CompanionAgentRequest,
): boolean => {
  if (request.selectedProposalId || request.selectedProposedAction) {
    return false;
  }

  return request.starterIntent === "upcoming_start" ||
    isUpcomingScheduleDigestMessage(request.message) ||
    isScheduleReadMessage(request.message);
};

export const getScheduleReadStarterIntent = (
  request: CompanionAgentRequest,
): string | null =>
  request.starterIntent === "upcoming_start" ||
    isUpcomingScheduleDigestMessage(request.message)
    ? "upcoming_start"
    : null;

export const shouldUseCostGuardrailPreflight = (
  request: CompanionAgentRequest,
): boolean => !isDeterministicScheduleReadRequest(request);
