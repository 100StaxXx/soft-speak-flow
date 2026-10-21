import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Companion } from "@/hooks/useCompanion";
import { AdventureCompanion } from "./AdventureCompanion";
const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => motionPreference.reduced, motion: { div: ({ children, animate: _a, transition: _t, ...rest }: React.HTMLAttributes<HTMLDivElement> & { animate: unknown; transition: unknown }) => <div {...rest}>{children}</div> } }));
const companion = { current_stage: 1, spirit_animal: "lion", core_element: "light", current_image_url: "/my-lion.webp", companion_name: "Leo" } as Companion;
afterEach(() => { cleanup(); motionPreference.reduced = false; });
describe("Adventure companion reactions", () => {
  it("uses the existing celebration clip and settles back to the user's portrait", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    render(<AdventureCompanion companion={companion} celebrate />);
    const video = screen.getByLabelText("Your companion celebrates");
    expect(video).toHaveAttribute("src", "/graceward-motion/v1/lion/light/reaction-celebrate.mp4");
    expect(video).toHaveAttribute("poster", "/my-lion.webp");
    fireEvent.ended(video);
    expect(screen.getByAltText("Leo")).toHaveAttribute("src", "/my-lion.webp");
  });
  it("uses the actual later-stage portrait instead of a Young-form video", () => {
    render(<AdventureCompanion companion={{ ...companion, current_stage: 5 }} celebrate />);
    expect(screen.queryByLabelText("Your companion celebrates")).not.toBeInTheDocument();
    expect(screen.getByAltText("Leo")).toBeInTheDocument();
  });
  it("does not autoplay video when reduced motion is preferred", () => {
    motionPreference.reduced = true;
    render(<AdventureCompanion companion={companion} celebrate />);
    expect(screen.queryByLabelText("Your companion celebrates")).not.toBeInTheDocument();
  });
});
