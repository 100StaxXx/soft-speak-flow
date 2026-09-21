import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ hasAccess: false, loading: false }));

vi.mock("@/hooks/useAccessStatus", () => ({
  useAccessStatus: () => access,
}));

vi.mock("@/components/Paywall", () => ({
  Paywall: () => <div>Cosmiq purchase options</div>,
}));

vi.mock("@/components/PageLoader", () => ({
  PageLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));

import Premium from "./Premium";

describe("Premium", () => {
  beforeEach(() => {
    access.hasAccess = false;
    access.loading = false;
  });

  it("shows checkout to an account without access", () => {
    render(<MemoryRouter><Premium /></MemoryRouter>);
    expect(screen.getByText("Cosmiq purchase options")).toBeInTheDocument();
  });

  it("routes an active subscriber to subscription management", () => {
    access.hasAccess = true;
    render(
      <MemoryRouter initialEntries={["/premium"]}>
        <Routes>
          <Route path="/premium" element={<Premium />} />
          <Route path="/profile" element={<div>Subscription profile</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Subscription profile")).toBeInTheDocument();
  });
});
