import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyMissions } from "./EmptyMissions";

describe("EmptyMissions", () => {
  it("shows the 2 AM local reset copy", () => {
    render(<EmptyMissions />);
    expect(screen.getByText(/New missions arrive at 2 AM \(local time\)/i)).toBeInTheDocument();
  });
});
