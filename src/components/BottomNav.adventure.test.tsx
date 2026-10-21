import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

vi.mock("@/config/product", () => ({ PRODUCT: { mode: "christian" } }));
vi.mock("@/config/gracewardAdventure", () => ({ GRACEWARD_ADVENTURE_ENABLED: true }));
vi.mock("@/utils/haptics", () => ({ haptics: { light: vi.fn() } }));
vi.mock("@/components/companion/CompanionNavPresence", () => ({ CompanionNavPresence: () => null }));

import { BottomNav } from "./BottomNav";

const PathnameProbe = () => <div data-testid="pathname">{useLocation().pathname}</div>;

const renderNavigation = (path = "/companion") => render(
  <MemoryRouter initialEntries={[path]}>
    <BottomNav />
    <PathnameProbe />
  </MemoryRouter>,
);

describe("Graceward Adventure navigation", () => {
  it("shows exactly Play, Companion, and Sanctuary", () => {
    renderNavigation();
    expect(screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Play", "/play"],
      ["Companion", "/companion"],
      ["Sanctuary", "/mentor"],
    ]);
  });

  it("opens Play from Companion", async () => {
    renderNavigation();
    fireEvent.click(screen.getByRole("link", { name: "Play" }));
    await waitFor(() => expect(screen.getByTestId("pathname")).toHaveTextContent("/play"));
  });
});

it.each(["/play/noahs-pairs", "/play/scripture-builder", "/play/bible-quest/1"])("keeps Play active on %s", (path) => { renderNavigation(path); expect(screen.getByRole("link", { name: "Play" })).toHaveAttribute("aria-current", "page"); });
it.each(["/mentor/quiet-pause", "/mentor/focus"])("keeps Sanctuary active on %s", (path) => { renderNavigation(path); expect(screen.getByRole("link", { name: "Sanctuary" })).toHaveAttribute("aria-current", "page"); });
