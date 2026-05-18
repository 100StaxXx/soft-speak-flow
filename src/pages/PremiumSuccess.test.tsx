import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetchSubscription: vi.fn(),
  isActive: true,
  isLoading: false,
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    refetch: mocks.refetchSubscription,
    isActive: mocks.isActive,
    isLoading: mocks.isLoading,
  }),
}));

vi.mock("react-confetti", () => ({
  default: () => null,
}));

import PremiumSuccess from "./PremiumSuccess";

describe("PremiumSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetchSubscription.mockResolvedValue(undefined);
    mocks.isActive = true;
    mocks.isLoading = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows success when hardened subscription access is active", async () => {
    render(
      <MemoryRouter initialEntries={["/premium/success"]}>
        <PremiumSuccess />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome to Cosmiq!")).toBeInTheDocument();
    });
  });

  it("keeps showing activation while hardened access is not active", async () => {
    mocks.isActive = false;
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={["/premium/success"]}>
        <PremiumSuccess />
      </MemoryRouter>,
    );

    expect(screen.getByText("Activating your subscription...")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to Cosmiq!")).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.refetchSubscription).toHaveBeenCalled();
  });

  it("shows a still-activating state after bounded checks without active access", async () => {
    mocks.isActive = false;
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={["/premium/success"]}>
        <PremiumSuccess />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
      await Promise.resolve();
    });

    expect(screen.getByText("Still activating your subscription")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to Cosmiq!")).not.toBeInTheDocument();
  });
});
