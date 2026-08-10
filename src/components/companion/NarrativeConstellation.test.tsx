import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useCompanionNarrativeMemories", () => ({
  useCompanionNarrativeMemories: () => ({
    data: [
      {
        id: "memory-1",
        memory_type: "promise",
        summary: "Nova and the user promised to follow the fourth bell.",
      },
      {
        id: "memory-2",
        memory_type: "relationship",
        summary: "They chose trust when the bridge disappeared.",
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

import { NarrativeConstellation } from "./NarrativeConstellation";

describe("NarrativeConstellation", () => {
  it("makes persistent world consequences visible", () => {
    render(<NarrativeConstellation companionId="companion-1" companionName="Nova" />);

    expect(screen.getByRole("heading", { name: "Constellation of Choices" })).toBeInTheDocument();
    expect(screen.getByText("2 remembered")).toBeInTheDocument();
    expect(screen.getByText(/promised to follow the fourth bell/)).toBeInTheDocument();
    expect(screen.getByText(/chose trust/)).toBeInTheDocument();
  });
});
