import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentorSpotlightGuard } from "./MentorSpotlightGuard";

describe("MentorSpotlightGuard", () => {
  it("renders mask + ring when active target exists", () => {
    document.body.innerHTML = `
      <button data-tour="add-quest-fab" style="position:fixed;left:20px;top:20px;width:40px;height:40px;">+</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;

    render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="add-quest-fab"]'
      />
    );

    expect(screen.getByTestId("mentor-spotlight-guard")).toBeInTheDocument();
  });

  it("blocks pointer interactions on masks", () => {
    document.body.innerHTML = `
      <button data-tour="add-quest-fab" style="position:fixed;left:20px;top:20px;width:40px;height:40px;">+</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;

    render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="add-quest-fab"]'
      />
    );

    const guard = screen.getByTestId("mentor-spotlight-guard");
    const mask = guard.querySelector(".mentor-spotlight-mask") as HTMLElement;
    const clickSpy = vi.fn();
    document.body.addEventListener("click", clickSpy);
    fireEvent.click(mask);
    expect(clickSpy).not.toHaveBeenCalled();
    document.body.removeEventListener("click", clickSpy);
  });
});
