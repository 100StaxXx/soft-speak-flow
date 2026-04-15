import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import InfluencerDashboard from "@/pages/InfluencerDashboard";

describe("InfluencerDashboard", () => {
  it("renders the WinWinKit handoff messaging", () => {
    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <InfluencerDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Creator dashboard moved to WinWinKit/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open affiliate dashboard/i })).toHaveAttribute(
      "href",
      "https://app.winwinkit.com/projects/a1f39a40-f90d-4aee-99dd-09c7f7cf1b88/affiliates/active",
    );
  });
});
