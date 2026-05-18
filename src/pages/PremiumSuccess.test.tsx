import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetchSubscription: vi.fn(),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    refetch: mocks.refetchSubscription,
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
  });

  it("refetches subscription state even without a checkout session id", async () => {
    render(
      <MemoryRouter initialEntries={["/premium/success"]}>
        <PremiumSuccess />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.refetchSubscription).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Welcome to Cosmiq!")).toBeInTheDocument();
  });
});
