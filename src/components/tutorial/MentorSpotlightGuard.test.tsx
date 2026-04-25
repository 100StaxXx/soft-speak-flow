import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("status")).toHaveTextContent("Tutorial highlight active");
  });

  it("focuses the highlighted action and restores previous focus on cleanup", async () => {
    document.body.innerHTML = `
      <button data-testid="previous-focus">before</button>
      <button data-tour="add-quest-fab" style="position:fixed;left:20px;top:20px;width:40px;height:40px;">+</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    const previousFocus = screen.getByTestId("previous-focus");
    const target = document.querySelector('[data-tour="add-quest-fab"]') as HTMLElement;
    previousFocus.focus();

    const { unmount } = render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="add-quest-fab"]'
      />
    );

    await waitFor(() => {
      expect(target).toHaveFocus();
    });

    unmount();
    expect(previousFocus).toHaveFocus();
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

  it("renders a non-blocking outline without masks", () => {
    document.body.innerHTML = `
      <section data-tour="morning-checkin" style="position:fixed;left:20px;top:20px;width:280px;height:180px;">check-in</section>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;

    const target = document.querySelector('[data-tour="morning-checkin"]') as HTMLElement;
    const clickSpy = vi.fn();
    target.addEventListener("click", clickSpy);

    render(
      <MentorSpotlightGuard
        active
        mode="outline"
        targetSelector='[data-tour="morning-checkin"]'
      />
    );

    const guard = screen.getByTestId("mentor-spotlight-guard");
    expect(guard).toHaveAttribute("data-mode", "outline");
    expect(guard.querySelector(".mentor-spotlight-mask")).toBeNull();
    expect(guard.querySelector(".mentor-spotlight-ring--outline")).toBeInTheDocument();

    fireEvent.click(target);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    target.removeEventListener("click", clickSpy);
  });
});
