import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import InfluencerDashboard from "@/pages/InfluencerDashboard";

describe("InfluencerDashboard", () => {
  it("renders the Cosmiq dashboard messaging", () => {
    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <InfluencerDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Creator dashboard lives in Cosmiq/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Admin/i })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
