import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    openQuestLocationMock.mockClear();
  });

  it("does not render for empty locations", () => {
    const { container } = render(<QuestLocationLink location="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the saved location and opens either maps provider", () => {
    render(<QuestLocationLink location="1 Infinite Loop, Cupertino, CA" />);

    expect(screen.getByText("1 Infinite Loop, Cupertino, CA")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open 1 infinite loop, cupertino, ca in apple maps/i }));
    expect(openQuestLocationMock).toHaveBeenCalledWith("1 Infinite Loop, Cupertino, CA", "apple");

    fireEvent.click(screen.getByRole("button", { name: /open 1 infinite loop, cupertino, ca in google maps/i }));
    expect(openQuestLocationMock).toHaveBeenCalledWith("1 Infinite Loop, Cupertino, CA", "google");
  });

  it("does not bubble map actions to parent quest cards", () => {
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <QuestLocationLink location="Library" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open library in apple maps/i }));

    expect(openQuestLocationMock).toHaveBeenCalledWith("Library", "apple");
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("does not bubble mobile touch map actions to parent quest cards", () => {
    const parentTouchEnd = vi.fn();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick} onTouchEnd={parentTouchEnd}>
        <QuestLocationLink location="City Hall" />
      </div>,
    );

    const appleMapsButton = screen.getByRole("button", { name: /open city hall in apple maps/i });
    fireEvent.touchEnd(appleMapsButton);
    fireEvent.click(appleMapsButton);

    expect(openQuestLocationMock).toHaveBeenCalledWith("City Hall", "apple");
    expect(parentTouchEnd).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });
});
