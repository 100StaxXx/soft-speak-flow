import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    lifeSnapshot: {
      currentEmotionalArc: "steady_bloom",
      routineStabilityScore: 62,
      requestFatigue: 2,
    },
    rituals: [] as Array<unknown>,
    requests: [] as Array<unknown>,
    requestCadence: {
      maxOpenRequests: 3,
      openRequests: 3,
      slotsAvailable: 0,
      cooldownActive: true,
      nextDueAt: null as string | null,
      overdueCount: 1,
      urgencyCounts: {
        gentle: 0,
        important: 1,
        critical: 2,
      },
      escalationPressure: 0.96,
      escalationLevel: "critical" as const,
      recommendedNewRequests: 0,
    },
    requestAnalytics: {
      averageResponseMinutes: 42,
      completionStreakDays: 3,
      completionRate30d: 67,
      resolvedCount30d: 12,
      completedCount30d: 8,
    },
    isLoading: false,
  },
  mutations: {
    processDayTick: { mutate: vi.fn(), isPending: false },
    generateRequests: { mutate: vi.fn(), isPending: false },
    completeRitual: { mutate: vi.fn(), isPending: false },
    resolveRequest: { mutate: vi.fn(), isPending: false },
    advanceCampaign: { mutate: vi.fn(), isPending: false },
  },
}));

vi.mock("@/hooks/useCompanionLife", () => ({
  useCompanionLife: () => ({
    lifeSnapshot: mocks.state.lifeSnapshot,
    rituals: mocks.state.rituals,
    requests: mocks.state.requests,
    requestCadence: mocks.state.requestCadence,
    requestAnalytics: mocks.state.requestAnalytics,
    isLoading: mocks.state.isLoading,
    processDayTick: mocks.mutations.processDayTick,
    generateRequests: mocks.mutations.generateRequests,
    completeRitual: mocks.mutations.completeRitual,
    resolveRequest: mocks.mutations.resolveRequest,
    advanceCampaign: mocks.mutations.advanceCampaign,
  }),
}));

import { LifeTab } from "./LifeTab";

describe("LifeTab", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T12:00:00.000Z"));
    mocks.state.isLoading = false;
    mocks.state.lifeSnapshot = {
      currentEmotionalArc: "steady_bloom",
      routineStabilityScore: 62,
      requestFatigue: 2,
    };
    mocks.state.rituals = [];
    mocks.state.requests = [];
    mocks.state.requestCadence = {
      maxOpenRequests: 3,
      openRequests: 3,
      slotsAvailable: 0,
      cooldownActive: true,
      nextDueAt: null,
      overdueCount: 1,
      urgencyCounts: {
        gentle: 0,
        important: 1,
        critical: 2,
      },
      escalationPressure: 0.96,
      escalationLevel: "critical",
      recommendedNewRequests: 0,
    };
    mocks.state.requestAnalytics = {
      averageResponseMinutes: 42,
      completionStreakDays: 3,
      completionRate30d: 67,
      resolvedCount30d: 12,
      completedCount30d: 8,
    };
    Object.values(mocks.mutations).forEach((mutation) => mutation.mutate.mockReset());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows cooldown guardrails and disables request generation when cadence is full", () => {
    render(<LifeTab />);

    expect(screen.getByText(/request cadence guardrails/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cooldown active/i })).toBeDisabled();
    expect(screen.getByText(/resolve or complete one request to reopen cadence slots/i)).toBeInTheDocument();
    expect(screen.getByText(/overdue 1/i)).toBeInTheDocument();
  });

  it("shows autonomy analytics row", () => {
    render(<LifeTab />);

    expect(screen.getByTestId("autonomy-metric-latency")).toHaveTextContent("42m");
    expect(screen.getByTestId("autonomy-metric-streak")).toHaveTextContent("3 days");
    expect(screen.getByTestId("autonomy-metric-rate")).toHaveTextContent("67%");
  });

  it("updates autonomy time windows live and raises escalation banner when crossing into critical window", () => {
    mocks.state.requestCadence = {
      maxOpenRequests: 3,
      openRequests: 2,
      slotsAvailable: 1,
      cooldownActive: false,
      nextDueAt: "2026-02-13T14:01:00.000Z",
      overdueCount: 0,
      urgencyCounts: {
        gentle: 1,
        important: 1,
        critical: 0,
      },
      escalationPressure: 0.4,
      escalationLevel: "watch",
      recommendedNewRequests: 1,
    };
    mocks.state.requests = [
      {
        id: "req-closing",
        requestType: "check_in",
        title: "Closing Event",
        prompt: "Please check in soon.",
        urgency: "important",
        status: "pending",
        dueAt: "2026-02-13T14:01:00.000Z",
        requestedAt: "2026-02-13T11:30:00.000Z",
        resolvedAt: null,
        responseStyle: null,
        consequenceHint: null,
        requestContext: {},
      },
    ];

    render(<LifeTab />);

    expect(screen.getByText(/closing soon 3h/i)).toBeInTheDocument();
    expect(screen.queryByTestId("autonomy-escalation-banner")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
      vi.setSystemTime(new Date("2026-02-13T12:01:00.000Z"));
    });

    expect(screen.getByText(/critical window 120m/i)).toBeInTheDocument();
    expect(screen.getByTestId("autonomy-escalation-banner")).toHaveTextContent(/entered a critical response window/i);
  });

  it("filters autonomy events by urgency", () => {
    mocks.state.requests = [
      {
        id: "req-critical",
        requestType: "repair_invite",
        title: "Repair Invitation",
        prompt: "I felt distance today. Can we repair it before nightfall?",
        urgency: "critical",
        status: "pending",
        dueAt: "2026-02-13T11:30:00.000Z",
        requestedAt: "2026-02-13T10:30:00.000Z",
        resolvedAt: null,
        responseStyle: null,
        consequenceHint: "Repair moments prevent fatigue spikes.",
        requestContext: {},
      },
      {
        id: "req-gentle",
        requestType: "check_in",
        title: "A Small Check-In",
        prompt: "Could we spend two quiet minutes together before the day gets loud?",
        urgency: "gentle",
        status: "pending",
        dueAt: "2026-02-13T15:00:00.000Z",
        requestedAt: "2026-02-13T11:30:00.000Z",
        resolvedAt: null,
        responseStyle: null,
        consequenceHint: "A gentle check-in helps your companion feel seen.",
        requestContext: {},
      },
    ];

    render(<LifeTab />);

    expect(screen.getByText(/autonomy event inbox/i)).toBeInTheDocument();
    expect(screen.getByText(/overdue 30m/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Critical \(1\)$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Gentle \(1\)$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Gentle \(1\)$/i }));
    expect(screen.getByText(/a small check-in/i)).toBeInTheDocument();
    expect(screen.queryByText(/repair invitation/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Overdue \(1\)$/i }));
    expect(screen.getByText(/repair invitation/i)).toBeInTheDocument();
    expect(screen.queryByText(/a small check-in/i)).not.toBeInTheDocument();
  });

  it("shows recovery lane pressure and allows quick completion of next ritual", () => {
    mocks.state.lifeSnapshot = {
      currentEmotionalArc: "fragile_echo",
      routineStabilityScore: 28,
      requestFatigue: 7,
    };
    mocks.state.requestCadence = {
      maxOpenRequests: 3,
      openRequests: 2,
      slotsAvailable: 1,
      cooldownActive: false,
      nextDueAt: "2026-02-13T12:30:00.000Z",
      overdueCount: 2,
      urgencyCounts: {
        gentle: 0,
        important: 1,
        critical: 1,
      },
      escalationPressure: 1.1,
      escalationLevel: "critical",
      recommendedNewRequests: 1,
    };
    mocks.state.rituals = [
      {
        id: "ritual-1",
        ritualDate: "2026-02-13",
        status: "pending",
        urgency: "important",
        completedAt: null,
        completionContext: {},
        ritualDefId: "def-1",
        ritualDef: {
          id: "def-1",
          code: "attention_ping",
          title: "Attention Ping",
          description: "Reconnect quickly.",
          ritualType: "attention",
          baseBondDelta: 1,
          baseCareDelta: 0.02,
          cooldownHours: 0,
        },
      },
    ];

    render(<LifeTab />);
    expect(screen.getByText(/recovery lane/i)).toBeInTheDocument();
    expect(screen.getByText(/ritual consistency is under strain/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /complete next ritual/i }));
    expect(mocks.mutations.completeRitual.mutate).toHaveBeenCalledWith("ritual-1");
  });
});
