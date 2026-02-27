import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { AdvancedQuestOptions } from "./AdvancedQuestOptions";

vi.mock("@/hooks/useSmartScheduling", () => ({
  useSmartScheduling: () => ({
    suggestedSlots: [],
    getSuggestedSlots: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

function RecurrenceHarness({ selectedDate }: { selectedDate?: Date }) {
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);

  return (
    <div>
      <AdvancedQuestOptions
        scheduledTime={null}
        onScheduledTimeChange={vi.fn()}
        estimatedDuration={30}
        onEstimatedDurationChange={vi.fn()}
        recurrencePattern={recurrencePattern}
        onRecurrencePatternChange={setRecurrencePattern}
        recurrenceDays={recurrenceDays}
        onRecurrenceDaysChange={setRecurrenceDays}
        reminderEnabled={false}
        onReminderEnabledChange={vi.fn()}
        reminderMinutesBefore={15}
        onReminderMinutesBeforeChange={vi.fn()}
        moreInformation={null}
        onMoreInformationChange={vi.fn()}
        location={null}
        onLocationChange={vi.fn()}
        selectedDate={selectedDate}
      />
      <div data-testid="recurrence-state">
        {recurrencePattern ?? "none"}|{recurrenceDays.join(",")}
      </div>
    </div>
  );
}

function ReminderHarness() {
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);

  return (
    <div>
      <AdvancedQuestOptions
        scheduledTime="09:00"
        onScheduledTimeChange={vi.fn()}
        estimatedDuration={30}
        onEstimatedDurationChange={vi.fn()}
        recurrencePattern={null}
        onRecurrencePatternChange={vi.fn()}
        recurrenceDays={[]}
        onRecurrenceDaysChange={vi.fn()}
        reminderEnabled
        onReminderEnabledChange={vi.fn()}
        reminderMinutesBefore={reminderMinutesBefore}
        onReminderMinutesBeforeChange={setReminderMinutesBefore}
        moreInformation={null}
        onMoreInformationChange={vi.fn()}
        location={null}
        onLocationChange={vi.fn()}
      />
      <div data-testid="reminder-state">{reminderMinutesBefore}</div>
    </div>
  );
}

describe("AdvancedQuestOptions recurrence", () => {
  it("renders expanded recurrence options", () => {
    render(<RecurrenceHarness selectedDate={new Date(2026, 0, 12)} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));

    expect(screen.getByRole("button", { name: "Daily" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weekdays" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weekly" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Every 2 Weeks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monthly" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom Days" })).toBeInTheDocument();
  });

  it("sets weekdays to Monday-Friday", async () => {
    render(<RecurrenceHarness selectedDate={new Date(2026, 0, 12)} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Weekdays" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("weekdays|0,1,2,3,4");
    });
  });

  it("enforces single-day selection for weekly", async () => {
    render(<RecurrenceHarness selectedDate={new Date(2026, 0, 12)} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("weekly|0");
    });

    fireEvent.click(screen.getByRole("button", { name: "Wed" }));
    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("weekly|2");
    });

    fireEvent.click(screen.getByRole("button", { name: "Fri" }));
    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("weekly|4");
    });
  });

  it("supports multi-day selection for custom", async () => {
    render(<RecurrenceHarness selectedDate={new Date(2026, 0, 12)} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom Days" }));

    fireEvent.click(screen.getByRole("button", { name: "Mon" }));
    fireEvent.click(screen.getByRole("button", { name: "Wed" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("custom|0,2");
    });
  });
});

describe("AdvancedQuestOptions reminder picker", () => {
  it("shows 2 days and custom reminder options", () => {
    render(<ReminderHarness />);

    fireEvent.click(screen.getByRole("button", { name: "15 minutes before" }));

    expect(screen.getByRole("button", { name: "2 days before" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("applies a custom reminder value", async () => {
    render(<ReminderHarness />);

    fireEvent.click(screen.getByRole("button", { name: "15 minutes before" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Minutes before"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(screen.getByTestId("reminder-state")).toHaveTextContent("180");
    });

    expect(screen.getByRole("button", { name: /180 minutes before \(Custom\)/i })).toBeInTheDocument();
  });
});
