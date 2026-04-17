import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuestLocationLink } from "@/components/QuestLocationLink";

const openQuestLocationMock = vi.fn();

vi.mock("@/utils/questLocationLinks", async () => {
  const actual = await vi.importActual<typeof import("@/utils/questLocationLinks")>("@/utils/questLocationLinks");
  return {
    ...actual,
    openQuestLocation: (...args: Parameters<typeof actual.openQuestLocation>) => openQuestLocationMock(...args),
  };
});

describe("QuestLocationLink", () => {
  it("does not render for empty locations", () => {
    const { container } = render(<QuestLocationLink location="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the saved location and opens maps on click", () => {
    render(<QuestLocationLink location="1 Infinite Loop, Cupertino, CA" />);

    const button = screen.getByRole("button", { name: /open 1 infinite loop, cupertino, ca in maps/i });
    expect(button).toHaveTextContent("1 Infinite Loop, Cupertino, CA");

    fireEvent.click(button);
    expect(openQuestLocationMock).toHaveBeenCalledWith("1 Infinite Loop, Cupertino, CA");
  });
});
