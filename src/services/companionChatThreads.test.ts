import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const from = vi.fn();
  return {
    supabase: {
      from,
    },
    from,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

import {
  loadCompanionChatThreadMessages,
  loadCompanionPendingAction,
  persistCompanionThreadMessages,
  readCompanionThreadReceiptProposalId,
} from "@/services/companionChatThreads";

describe("companionChatThreads service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates planner metadata from persisted thread messages and sanitizes invalid nested json", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "message-1",
          session_id: "session-1",
          role: "assistant",
          content: "Tomorrow starts with a reset move.",
          created_at: "2026-04-24T10:00:00.000Z",
          input_mode: "text",
          source: "agent",
          metadata: {
            mode: "receipt",
            intent: "plan_week",
            structuredResponse: {
              intent: {
                intentType: "quest",
                timeHorizon: "short_term",
                isRecurring: false,
                shouldCreateQuest: false,
                shouldPromptCampaign: false,
              },
              reflectionBridge: {
                message: "Tomorrow should start with a reset move.",
                carryForward: null,
                tomorrowSummary: "light",
                firstAction: {
                  suggestionId: "tomorrow-reset-1",
                  proposalId: "proposal-reset-1",
                  title: "Adjust Launch prep",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason:
                    "This campaign has slipped repeatedly without a protected recovery move.",
                },
                tomorrowSchedule: [],
              },
            },
            pendingAction: {
              id: "action-1",
              status: "pending",
              intent: "plan_week",
              actionType: "campaign_update",
              proposalId: "proposal-reset-1",
              summary: "Adjust Launch prep",
              confirmationMessage: "Want me to reset Launch prep?",
              normalizedPayload: new Map(),
              affectedEntities: new Set(["epic-1"]),
              expiresAt: "2026-04-24T12:00:00.000Z",
              createdAt: "2026-04-24T10:00:00.000Z",
            },
            receipt: {
              actionId: "action-1",
              status: "executed",
              proposalId: "proposal-reset-1",
              message: "Launch prep was reset.",
              summary: "Adjusted Launch prep",
              createdAt: "2026-04-24T10:01:00.000Z",
              executionResult: new Map(),
              executionError: new Set(["bad"]),
            },
          },
        },
      ],
      error: null,
    });
    const eqSurface = vi.fn(() => ({ order }));
    const eqSession = vi.fn(() => ({ eq: eqSurface }));
    const select = vi.fn(() => ({ eq: eqSession }));
    mocks.from.mockReturnValue({
      select,
    });

    const messages = await loadCompanionChatThreadMessages(
      "session-1",
      "companion",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.mode).toBe("receipt");
    expect(messages[0]?.intent).toBe("plan_week");
    expect(
      messages[0]?.structuredResponse?.reflectionBridge?.firstAction?.title,
    ).toBe("Adjust Launch prep");
    expect(messages[0]?.pendingAction?.proposalId).toBe("proposal-reset-1");
    expect(messages[0]?.pendingAction?.normalizedPayload).toEqual({});
    expect(messages[0]?.pendingAction?.affectedEntities).toBeNull();
    expect(messages[0]?.receipt?.proposalId).toBe("proposal-reset-1");
    expect(messages[0]?.receipt?.executionResult).toBeNull();
    expect(messages[0]?.receipt?.executionError).toBeNull();
  });

  it("maps selected proposal ids from pending-action metadata", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "pending-1",
        session_id: "session-1",
        status: "pending",
        intent: "plan_week",
        action_type: "campaign_update",
        summary: "Adjust Launch prep",
        confirmation_message: "Want me to reset Launch prep?",
        normalized_payload: { epicId: "epic-1" },
        affected_entities: [{ epicId: "epic-1" }],
        expires_at: "2026-04-24T12:00:00.000Z",
        created_at: "2026-04-24T10:00:00.000Z",
        metadata: {
          selectedProposalId: "proposal-reset-1",
        },
      },
      error: null,
    });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eqStatus = vi.fn(() => ({ order }));
    const eqSession = vi.fn(() => ({ eq: eqStatus }));
    const select = vi.fn(() => ({ eq: eqSession }));
    mocks.from.mockReturnValue({
      select,
    });

    const pendingAction = await loadCompanionPendingAction("session-1");

    expect(pendingAction?.proposalId).toBe("proposal-reset-1");
    expect(pendingAction?.actionType).toBe("campaign_update");
  });

  it("hydrates proposal-backed structured surfaces from persisted assistant messages", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "message-2",
          session_id: "session-2",
          role: "assistant",
          content: "Here is the current planner read.",
          created_at: "2026-04-24T10:10:00.000Z",
          input_mode: "text",
          source: "agent",
          metadata: {
            mode: "schedule_read",
            intent: "update_existing_plan",
            structuredResponse: {
              intent: {
                intentType: "quest",
                timeHorizon: "today",
                isRecurring: false,
                shouldCreateQuest: false,
                shouldPromptCampaign: false,
              },
              weeklyPlan: {
                message: "Protect the campaign reset this week.",
                weeklyTheme: "Reset the launch path.",
                focusCampaignTitle: "Course launch",
                focusCampaignStatus: "stalled",
                focusCampaignInterventionLevel: "reset",
                focusCampaignReason: "The current move is still too large.",
                focusCampaignHealth: {
                  overdueQuestCount: 2,
                  protectedTodayCount: 0,
                  daysWithoutMomentum: 7,
                  activeCampaignCount: 4,
                },
                topPriorities: [
                  {
                    suggestionId: "weekly-1",
                    proposalId: "proposal-weekly-1",
                    title: "Adjust Course launch",
                    type: "must",
                    estimatedDuration: "20 min",
                    estimatedDurationMinutes: 20,
                    source: "campaign",
                    reason: "This is the cleanest weekly reset move.",
                  },
                ],
                busyDays: [],
                openDays: ["Friday"],
              },
              rightNow: {
                message: "You have one clean move right now.",
                currentWindow: "Next 20 minutes",
                recommendedAction: {
                  suggestionId: "right-now-1",
                  proposalId: "proposal-right-now-1",
                  title: "Adjust Course launch",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason: "This fits before the next block.",
                },
                fallbackAction: null,
              },
              comingUp: {
                message: "You have one useful move before your next event.",
                nextEvent: {
                  id: "event-1",
                  title: "Call",
                  label: "Call at 2:00 PM",
                  startsAt: "2026-04-24T21:00:00.000Z",
                  endsAt: "2026-04-24T21:30:00.000Z",
                  isAllDay: false,
                  source: "calendar",
                },
                nextBestAction: {
                  suggestionId: "coming-up-1",
                  proposalId: "proposal-coming-up-1",
                  title: "Adjust Course launch",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason: "This fits before the call and reduces pressure.",
                },
                remainingToday: [],
                tomorrowSummary: "light",
                missedItems: [],
              },
              dayAdjust: {
                message: "Keep the reset, move the rest.",
                keep: [
                  {
                    suggestionId: "adjust-1",
                    proposalId: "proposal-adjust-1",
                    title: "Adjust Course launch",
                    type: "must",
                    estimatedDuration: "20 min",
                    estimatedDurationMinutes: 20,
                    source: "campaign",
                    reason: "This reset should stay protected.",
                  },
                ],
                move: [],
                dropOrShrink: [],
              },
              campaignMomentum: {
                message: "Course launch needs a cleaner next move.",
                campaignId: "campaign-1",
                campaignTitle: "Course launch",
                status: "stalled",
                interventionLevel: "reset",
                statusReason: "The next step is still too large.",
                healthSnapshot: {
                  overdueQuestCount: 2,
                  protectedTodayCount: 0,
                  daysWithoutMomentum: 7,
                  activeCampaignCount: 4,
                },
                pressureSignals: ["Repeated slip on the campaign move."],
                nextStep: {
                  suggestionId: "campaign-1",
                  proposalId: "proposal-campaign-1",
                  title: "Adjust Course launch",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason: "Resetting the campaign is the honest next move.",
                },
                supportActions: [],
              },
            },
          },
        },
      ],
      error: null,
    });
    const eqSurface = vi.fn(() => ({ order }));
    const eqSession = vi.fn(() => ({ eq: eqSurface }));
    const select = vi.fn(() => ({ eq: eqSession }));
    mocks.from.mockReturnValue({
      select,
    });

    const messages = await loadCompanionChatThreadMessages(
      "session-2",
      "companion",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.structuredResponse?.weeklyPlan?.topPriorities[0]?.proposalId)
      .toBe("proposal-weekly-1");
    expect(messages[0]?.structuredResponse?.rightNow?.recommendedAction?.proposalId)
      .toBe("proposal-right-now-1");
    expect(messages[0]?.structuredResponse?.comingUp?.nextBestAction?.proposalId)
      .toBe("proposal-coming-up-1");
    expect(messages[0]?.structuredResponse?.dayAdjust?.keep[0]?.proposalId)
      .toBe("proposal-adjust-1");
    expect(messages[0]?.structuredResponse?.campaignMomentum?.nextStep?.proposalId)
      .toBe("proposal-campaign-1");
  });

  it("reads proposal ids from persisted receipts", () => {
    expect(
      readCompanionThreadReceiptProposalId({
        actionId: "action-1",
        status: "executed",
        proposalId: "proposal-reset-1",
        message: "done",
        createdAt: "2026-04-24T10:00:00.000Z",
      }),
    ).toBe("proposal-reset-1");
    expect(readCompanionThreadReceiptProposalId(null)).toBeNull();
  });

  it("persists planner metadata and updates the existing thread summary", async () => {
    const insertMessages = vi.fn().mockResolvedValue({ error: null });
    const countEqSurface = vi.fn().mockResolvedValue({ count: 2, error: null });
    const countEqSession = vi.fn(() => ({ eq: countEqSurface }));
    const selectMessageCount = vi.fn(() => ({ eq: countEqSession }));
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { session_id: "session-1" },
      error: null,
    });
    const selectThreadUpdate = vi.fn(() => ({ maybeSingle }));
    const updateEq = vi.fn(() => ({ select: selectThreadUpdate }));
    const updateThread = vi.fn(() => ({ eq: updateEq }));

    mocks.from.mockImplementation((table: string) => {
      if (table === "companion_chats") {
        return {
          insert: insertMessages,
          select: selectMessageCount,
        };
      }

      if (table === "companion_chat_threads") {
        return {
          update: updateThread,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await persistCompanionThreadMessages({
      userId: "user-1",
      companionId: "companion-1",
      sessionId: "session-1",
      surface: "companion",
      source: "agent",
      rows: [
        {
          role: "user",
          content: "What matters most today?",
          createdAt: "2026-04-24T10:00:00.000Z",
          inputMode: "text",
        },
        {
          role: "assistant",
          content: "Reset the launch path before adding more work.",
          createdAt: "2026-04-24T10:01:00.000Z",
          metadata: {
            mode: "schedule_read",
            intent: "plan_day",
            structuredResponse: {
              intent: {
                intentType: "quest",
                timeHorizon: "today",
                isRecurring: false,
                shouldCreateQuest: false,
                shouldPromptCampaign: false,
              },
              priorityOverview: {
                title: "What Matters",
                message: "Reset the launch path before adding more work.",
                campaignPressure:
                  "Campaign pressure: Launch prep is stalled.",
                topPriorities: [
                  {
                    suggestionId: "priority-reset-1",
                    proposalId: "proposal-reset-1",
                    title: "Adjust Launch prep",
                    type: "must",
                    estimatedDuration: "20 min",
                    estimatedDurationMinutes: 20,
                    source: "campaign",
                    reason:
                      "This campaign has slipped repeatedly and needs a reset plan right now.",
                  },
                ],
              },
            },
          },
        },
      ],
    });

    expect(insertMessages).toHaveBeenCalledTimes(1);
    expect(insertMessages).toHaveBeenCalledWith([
      {
        user_id: "user-1",
        companion_id: "companion-1",
        role: "user",
        content: "What matters most today?",
        input_mode: "text",
        metadata: {},
        session_id: "session-1",
        surface: "companion",
        source: "agent",
        created_at: "2026-04-24T10:00:00.000Z",
      },
      {
        user_id: "user-1",
        companion_id: "companion-1",
        role: "assistant",
        content: "Reset the launch path before adding more work.",
        input_mode: null,
        metadata: expect.objectContaining({
          mode: "schedule_read",
          intent: "plan_day",
        }),
        session_id: "session-1",
        surface: "companion",
        source: "agent",
        created_at: "2026-04-24T10:01:00.000Z",
      },
    ]);
    expect(updateThread).toHaveBeenCalledWith({
      preview_text: "Reset the launch path before adding more work.",
      last_message_at: "2026-04-24T10:01:00.000Z",
      archived_at: null,
      message_count: 2,
    });
  });

  it("retries thread updates after a duplicate thread-row insert race", async () => {
    const insertMessages = vi.fn().mockResolvedValue({ error: null });
    const countEqSurface = vi.fn().mockResolvedValue({ count: 1, error: null });
    const countEqSession = vi.fn(() => ({ eq: countEqSurface }));
    const selectMessageCount = vi.fn(() => ({ eq: countEqSession }));

    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { session_id: "session-dup" }, error: null });
    const selectThreadUpdate = vi.fn(() => ({ maybeSingle }));
    const updateEq = vi.fn(() => ({ select: selectThreadUpdate }));
    const updateThread = vi.fn(() => ({ eq: updateEq }));
    const insertThread = vi.fn().mockResolvedValue({
      error: { code: "23505" },
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "companion_chats") {
        return {
          insert: insertMessages,
          select: selectMessageCount,
        };
      }

      if (table === "companion_chat_threads") {
        return {
          update: updateThread,
          insert: insertThread,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      persistCompanionThreadMessages({
        userId: "user-1",
        companionId: "companion-1",
        sessionId: "session-dup",
        surface: "journeys",
        source: "plan",
        rows: [
          {
            role: "user",
            content: "Plan my week",
            createdAt: "2026-04-24T09:00:00.000Z",
            inputMode: "text",
          },
        ],
      }),
    ).resolves.toBeUndefined();

    expect(insertThread).toHaveBeenCalledWith({
      session_id: "session-dup",
      user_id: "user-1",
      companion_id: "companion-1",
      surface: "journeys",
      title: "Plan my week",
      preview_text: "Plan my week",
      created_at: "2026-04-24T09:00:00.000Z",
      last_message_at: "2026-04-24T09:00:00.000Z",
      archived_at: null,
      message_count: 1,
    });
    expect(updateThread).toHaveBeenCalledTimes(2);
  });
});
