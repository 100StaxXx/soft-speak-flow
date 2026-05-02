import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useCreationPopupResume } from "@/hooks/useCreationPopupResume";
import type { CreationPopupMarker } from "@/utils/creationPopupPersistence";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  status: "authenticated" as "authenticated" | "unauthenticated",
  profileLoading: false,
  marker: null as CreationPopupMarker | null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    status: mocks.status,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    loading: mocks.profileLoading,
  }),
}));

vi.mock("@/utils/creationPopupPersistence", () => ({
  readCreationPopupMarker: () => mocks.marker,
}));

function Probe() {
  useCreationPopupResume();
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

const renderProbe = (initialPath: string) => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <Probe />
  </MemoryRouter>,
);

describe("useCreationPopupResume", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.status = "authenticated";
    mocks.profileLoading = false;
    mocks.marker = null;
  });

  it("routes from a safe origin to the stored creation popup route", async () => {
    mocks.marker = {
      surface: "quest",
      route: "/journeys",
      selectedDate: "2026-05-01",
      updatedAt: "2026-05-01T12:00:00.000Z",
    };

    renderProbe("/campaigns");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
    });
  });

  it("does not navigate when already on the target route", () => {
    mocks.marker = {
      surface: "campaign",
      route: "/campaigns",
      selectedDate: null,
      updatedAt: "2026-05-01T12:00:00.000Z",
    };

    renderProbe("/campaigns");

    expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
  });

  it("does not navigate from protected auth or onboarding paths", () => {
    mocks.marker = {
      surface: "quest",
      route: "/journeys",
      selectedDate: "2026-05-01",
      updatedAt: "2026-05-01T12:00:00.000Z",
    };

    renderProbe("/auth");

    expect(screen.getByTestId("path")).toHaveTextContent("/auth");
  });

  it("does not navigate when no marker is stored", () => {
    renderProbe("/campaigns");

    expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
  });
});
