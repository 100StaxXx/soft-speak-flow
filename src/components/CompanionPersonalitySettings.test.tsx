import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mode: "mentor" as const,
  adaptationEnabled: false,
  isLoading: false,
  isSaving: false,
  setMode: vi.fn(),
  setAdaptationEnabled: vi.fn(),
}));

vi.mock("@/hooks/useCompanionModeSettings", () => ({
  useCompanionModeSettings: () => ({
    mode: mocks.mode,
    adaptationEnabled: mocks.adaptationEnabled,
    isLoading: mocks.isLoading,
    isSaving: mocks.isSaving,
    setMode: mocks.setMode,
    setAdaptationEnabled: mocks.setAdaptationEnabled,
  }),
}));

import { CompanionPersonalitySettings } from "./CompanionPersonalitySettings";

describe("CompanionPersonalitySettings", () => {
  beforeEach(() => {
    mocks.mode = "mentor";
    mocks.adaptationEnabled = false;
    mocks.isLoading = false;
    mocks.isSaving = false;
    Element.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();
  });

  it("renders the current saved mode and mode descriptions", () => {
    render(<CompanionPersonalitySettings />);

    expect(screen.getByRole("combobox", { name: "Companion personality mode" })).toHaveTextContent("Mentor");
    expect(screen.getByText("Companion Personality")).toBeInTheDocument();
    expect(screen.getByText("Confident, direct, and momentum-heavy.")).toBeInTheDocument();
    expect(screen.getByText("Supportive, steady, and reflective.")).toBeInTheDocument();
    expect(screen.getByText("Analytical, efficient, and high-signal.")).toBeInTheDocument();
    expect(screen.getByText("Playful, funny, and lightly unhinged.")).toBeInTheDocument();
    expect(screen.getAllByText("Wise, disciplined, and identity-building.").length).toBeGreaterThan(0);
  });

  it("updates the saved mode when a new option is selected", async () => {
    render(<CompanionPersonalitySettings />);

    fireEvent.click(screen.getByRole("combobox", { name: "Companion personality mode" }));
    fireEvent.click(await screen.findByRole("option", { name: "Chaotic" }));

    expect(mocks.setMode).toHaveBeenCalledWith("chaotic");
  });

  it("toggles adaptive tone", () => {
    render(<CompanionPersonalitySettings />);

    fireEvent.click(screen.getByRole("switch"));

    expect(mocks.setAdaptationEnabled).toHaveBeenCalledWith(true);
  });
});
