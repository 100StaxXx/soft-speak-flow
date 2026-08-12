import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

const mocks = vi.hoisted(() => ({ hapticsLight: vi.fn() }));
vi.mock("@/utils/haptics", () => ({
  haptics: { light: (...args: unknown[]) => mocks.hapticsLight(...args) },
}));

import { BottomNav } from "./BottomNav";

const PathnameProbe = () => <div data-testid="pathname">{useLocation().pathname}</div>;
const renderBottomNav = (initialPath = "/mentor") => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <BottomNav />
    <PathnameProbe />
  </MemoryRouter>,
);

describe("Graceward bottom navigation", () => {
  beforeEach(() => {
    mocks.hapticsLight.mockClear();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 72 } as DOMRect);
  });

  afterEach(() => vi.restoreAllMocks());

  it("places Today in the center as the primary tab", () => {
    renderBottomNav();
    const labels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual(["Companion", "Today", "Guide"]);
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute("href", "/mentor");
    expect(labels.join(" ")).not.toMatch(/mentor|quests|campaigns|garden/i);
  });

  it("returns to Today from another main tab", async () => {
    renderBottomNav("/companion");
    fireEvent.click(screen.getByText("Today"));

    await waitFor(() => expect(screen.getByTestId("pathname")).toHaveTextContent("/mentor"));
    expect(mocks.hapticsLight).toHaveBeenCalledTimes(1);
  });

  it("navigates to the Guide", async () => {
    renderBottomNav();
    fireEvent.click(screen.getByText("Guide"));

    await waitFor(() => expect(screen.getByTestId("pathname")).toHaveTextContent("/guide"));
    expect(mocks.hapticsLight).toHaveBeenCalledTimes(1);
  });

  it("navigates to the Companion", async () => {
    renderBottomNav();
    fireEvent.click(screen.getByText("Companion"));

    await waitFor(() => expect(screen.getByTestId("pathname")).toHaveTextContent("/companion"));
    expect(mocks.hapticsLight).toHaveBeenCalledTimes(1);
  });

  it("sets and removes the runtime navigation offset", () => {
    const view = renderBottomNav();
    expect(document.documentElement.style.getPropertyValue("--bottom-nav-runtime-offset")).toBe("72px");
    view.unmount();
    expect(document.documentElement.style.getPropertyValue("--bottom-nav-runtime-offset")).toBe("");
  });
});
