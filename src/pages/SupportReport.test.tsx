import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  toast: vi.fn(),
  reportIssue: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    state: "healthy",
    backendHealth: "healthy",
    isOnline: true,
    queueCount: 0,
    recentErrorFingerprints: [],
    reportIssue: mocks.reportIssue,
  }),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/StarfieldBackground", () => ({
  StarfieldBackground: () => null,
}));

import SupportReport from "./SupportReport";

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: null | ((this: FileReader, ev: ProgressEvent<FileReader>) => void) = null;

  readAsDataURL(_blob: Blob) {
    this.result = "data:image/png;base64,ZmFrZQ==";
    this.onload?.call(this as unknown as FileReader, new ProgressEvent("load"));
  }
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const renderSupportReport = (state?: Record<string, unknown>) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/support/report", state }]}>
      <SupportReport />
    </MemoryRouter>,
  );

describe("SupportReport", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.reportIssue.mockReset();
    mocks.reportIssue.mockResolvedValue({ queued: false, submitted: true });
    vi.stubGlobal("FileReader", MockFileReader);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to bug reporting copy when no navigation state is provided", () => {
    renderSupportReport();

    expect(screen.getByText("Report a Problem")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toHaveValue("bug");
    expect(screen.getByLabelText("What happened?")).toBeInTheDocument();
    expect(screen.queryByLabelText("Summary")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reproduction steps")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Expected behavior")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Actual behavior")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Email/i })).not.toBeInTheDocument();
  });

  it("defaults to feedback mode when opened from Command Center", () => {
    renderSupportReport({ defaultCategory: "feedback" });

    expect(screen.getByText("Send Feedback")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toHaveValue("feedback");
    expect(screen.getByLabelText("What would you like to share?")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Email/i })).not.toBeInTheDocument();
  });

  it("prefills billing support copy when opened from the paywall", () => {
    renderSupportReport({
      defaultCategory: "billing",
      defaultMessage: "I am stuck on the paywall.",
    });

    expect(screen.getByLabelText("Category")).toHaveValue("billing");
    expect(screen.getByLabelText("What happened?")).toHaveValue("I am stuck on the paywall.");
  });

  it("submits feedback payloads through the shared support pipeline", async () => {
    renderSupportReport({ defaultCategory: "feedback" });

    fireEvent.change(screen.getByLabelText("What would you like to share?"), {
      target: { value: "A weekly review email would be amazing." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));

    await waitFor(() => {
      expect(mocks.reportIssue).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.reportIssue.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      category: "feedback",
      summary: "A weekly review email would be amazing.",
      reproductionSteps: "",
      expectedBehavior: "",
      actualBehavior: "",
      consentDiagnostics: false,
    });
    expect(payload).not.toHaveProperty("diagnostics");
  });

  it("keeps screenshot attach working in feedback mode without extra controls", async () => {
    renderSupportReport({ defaultCategory: "feedback" });

    fireEvent.change(screen.getByLabelText("Optional screenshot"), {
      target: {
        files: [new File(["image"], "feedback.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Screenshot attached")).toBeInTheDocument();
    });
    expect(screen.queryByRole("checkbox", { name: /Include diagnostics/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Email/i })).not.toBeInTheDocument();
  });
});
