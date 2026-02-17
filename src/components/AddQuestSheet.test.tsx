import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddQuestSheet, type AddQuestData } from "./AddQuestSheet";

const mocks = vi.hoisted(() => ({
  integrationVisible: false,
  defaultProvider: null as "apple" | "google" | "outlook" | null,
  connections: [] as Array<{ provider: "apple" | "google" | "outlook" }>,
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: () => ({
    integrationVisible: mocks.integrationVisible,
    defaultProvider: mocks.defaultProvider,
    connections: mocks.connections,
  }),
}));

describe("AddQuestSheet", () => {
  const selectedDate = new Date(2026, 0, 15);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.integrationVisible = false;
    mocks.defaultProvider = null;
    mocks.connections = [];
  });

  it("renders title and scheduling controls on one screen and no Next button", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByPlaceholderText("Quest Title")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Time" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("shows campaign creation CTA with inline max cap hint", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
        onCreateCampaign={vi.fn()}
      />
    );

    expect(screen.getByText("Or create a Campaign")).toBeInTheDocument();
    expect(screen.getByText("Max 2 active")).toBeInTheDocument();
  });

  it("keeps Create Quest disabled until title and time are both set", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const createButton = screen.getByRole("button", { name: "Create Quest" });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Plan sprint tasks" },
    });
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    expect(createButton).toBeEnabled();
  });

  it("supports prefilledTime and enables create once title is entered", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const createButton = screen.getByRole("button", { name: "Create Quest" });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Morning planning" },
    });

    expect(createButton).toBeEnabled();
  });

  it("shows full-day half-hour quick-pick times in the time picker", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Time" }));

    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("12:30 AM")).toBeInTheDocument();
    expect(screen.getByText("11:30 PM")).toBeInTheDocument();
  });

  it("submits custom manual time values outside quick-pick increments", async () => {
    const onAdd = vi.fn<Parameters<(data: AddQuestData) => Promise<void>>, ReturnType<(data: AddQuestData) => Promise<void>>>()
      .mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Custom time quest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    fireEvent.change(screen.getByLabelText("Custom quest time"), {
      target: { value: "11:17" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(onAdd.mock.calls[0]?.[0]).toMatchObject({
      scheduledTime: "11:17",
    });
  });

  it("sends inbox payload with null date/time when adding to inbox", async () => {
    const onAdd = vi.fn<Parameters<(data: AddQuestData) => Promise<void>>, ReturnType<(data: AddQuestData) => Promise<void>>>()
      .mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Triage inbox" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to Inbox instead" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    const payload = onAdd.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      text: "Triage inbox",
      taskDate: null,
      scheduledTime: null,
      sendToInbox: true,
      sendToCalendar: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits scheduled quest payload when Create Quest is tapped", async () => {
    const onAdd = vi.fn<Parameters<(data: AddQuestData) => Promise<void>>, ReturnType<(data: AddQuestData) => Promise<void>>>()
      .mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Review roadmap" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    const payload = onAdd.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      text: "Review roadmap",
      taskDate: "2026-01-15",
      scheduledTime: "09:00",
      sendToInbox: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides send-to-calendar option when default provider is stale and no providers are connected", () => {
    mocks.integrationVisible = true;
    mocks.defaultProvider = "google";
    mocks.connections = [];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText(/Send to .* Calendar after create/i)).not.toBeInTheDocument();
  });

  it("shows connected provider label when default provider is stale", () => {
    mocks.integrationVisible = true;
    mocks.defaultProvider = "outlook";
    mocks.connections = [{ provider: "google" }];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Send to Google Calendar after create")).toBeInTheDocument();
  });

  it("blocks close requests when preventClose is enabled", () => {
    const onOpenChange = vi.fn();
    const onPreventedCloseAttempt = vi.fn();

    render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
        preventClose
        onPreventedCloseAttempt={onPreventedCloseAttempt}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onPreventedCloseAttempt).toHaveBeenCalledTimes(1);
  });

  it("emits tutorial events for open, title entry, time selection, and create attempt", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-sheet-opened" }));

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Evented quest" },
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-title-entered" }));

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    fireEvent.change(screen.getByLabelText("Custom quest time"), {
      target: { value: "10:15" },
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-time-selected" }));

    fireEvent.click(screen.getByRole("button", { name: "Create Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-create-attempted" }));
    dispatchSpy.mockRestore();
  });
});
