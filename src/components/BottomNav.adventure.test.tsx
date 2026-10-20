import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

vi.mock("@/config/product", () => ({ PRODUCT: { mode: "christian" } }));
vi.mock("@/config/gracewardAdventure", () => ({ GRACEWARD_ADVENTURE_ENABLED: true }));
vi.mock("@/utils/haptics", () => ({ haptics: { light: vi.fn() } }));
vi.mock("@/components/companion/CompanionNavPresence", () => ({ CompanionNavPresence: () => null }));

import { BottomNav } from "./BottomNav";

const PathnameProbe = () => <div data-testid="pathname">{useLocation().pathname}</div>;

const renderNavigation = () => render(
  <MemoryRouter initialEntries={["/adventure"]}>
    <BottomNav />
    <PathnameProbe />
  </MemoryRouter>,
);

describe("Graceward Adventure navigation", () => {
  it("shows the four Adventure destinations", () => {
    renderNavigation();
    expect(screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Adventure", "/adventure"],
      ["Play", "/play"],
      ["Companion", "/companion"],
      ["Sanctuary", "/mentor"],
    ]);
  });

  it("opens Play from Adventure", async () => {
    renderNavigation();
    fireEvent.click(screen.getByRole("link", { name: "Play" }));
    await waitFor(() => expect(screen.getByTestId("pathname")).toHaveTextContent("/play"));
  });
});
