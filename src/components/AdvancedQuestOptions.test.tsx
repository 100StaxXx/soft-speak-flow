import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState<number[]>([]);
  const [recurrenceCustomPeriod, setRecurrenceCustomPeriod] = useState<"week" | "month" | null>(null);

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
        recurrenceMonthDays={recurrenceMonthDays}
        onRecurrenceMonthDaysChange={setRecurrenceMonthDays}
        recurrenceCustomPeriod={recurrenceCustomPeriod}
        onRecurrenceCustomPeriodChange={setRecurrenceCustomPeriod}
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
        {recurrencePattern ?? "none"}|{recurrenceDays.join(",")}|{recurrenceMonthDays.join(",")}|{recurrenceCustomPeriod ?? "none"}
      </div>
    </div>
  );
}

function RecurrenceDisabledHarness() {
  return (
    <AdvancedQuestOptions
      scheduledTime={null}
      onScheduledTimeChange={vi.fn()}
      estimatedDuration={30}
      onEstimatedDurationChange={vi.fn()}
      recurrencePattern={null}
      onRecurrencePatternChange={vi.fn()}
      recurrenceDays={[]}
      onRecurrenceDaysChange={vi.fn()}
      recurrenceMonthDays={[]}
      onRecurrenceMonthDaysChange={vi.fn()}
      recurrenceCustomPeriod={null}
      onRecurrenceCustomPeriodChange={vi.fn()}
      reminderEnabled={false}
      onReminderEnabledChange={vi.fn()}
      reminderMinutesBefore={15}
      onReminderMinutesBeforeChange={vi.fn()}
      moreInformation={null}
      onMoreInformationChange={vi.fn()}
      location={null}
      onLocationChange={vi.fn()}
      requireScheduledTimeForRecurrence
    />
  );
}

function ReminderHarness() {
  const [reminderEnabled, setReminderEnabled] = useState(false);
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
        recurrenceMonthDays={[]}
        onRecurrenceMonthDaysChange={vi.fn()}
        recurrenceCustomPeriod={null}
        onRecurrenceCustomPeriodChange={vi.fn()}
        reminderEnabled={reminderEnabled}
        onReminderEnabledChange={setReminderEnabled}
        reminderMinutesBefore={reminderMinutesBefore}
        onReminderMinutesBeforeChange={setReminderMinutesBefore}
        moreInformation={null}
        onMoreInformationChange={vi.fn()}
        location={null}
        onLocationChange={vi.fn()}
      />
      <div data-testid="reminder-state">{String(reminderEnabled)}|{reminderMinutesBefore}</div>
    </div>
  );
}

function getReminderSection() {
  const helperText = screen.getByText("You'll be notified when the quest starts. Add an early reminder for a little breathing room.");
  const section = helperText.parentElement;
  if (!section) {
    throw new Error("Reminder section not found");
  }
  return within(section);
}

function DurationHarness() {
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(30);

  return (
    <div>
      <AdvancedQuestOptions
        scheduledTime={null}
        onScheduledTimeChange={vi.fn()}
        estimatedDuration={estimatedDuration}
        onEstimatedDurationChange={setEstimatedDuration}
        recurrencePattern={null}
        onRecurrencePatternChange={vi.fn()}
        recurrenceDays={[]}
        onRecurrenceDaysChange={vi.fn()}
        recurrenceMonthDays={[]}
        onRecurrenceMonthDaysChange={vi.fn()}
        recurrenceCustomPeriod={null}
        onRecurrenceCustomPeriodChange={vi.fn()}
        reminderEnabled={false}
        onReminderEnabledChange={vi.fn()}
        reminderMinutesBefore={15}
        onReminderMinutesBeforeChange={vi.fn()}
        moreInformation={null}
        onMoreInformationChange={vi.fn()}
        location={null}
        onLocationChange={vi.fn()}
      />
      <div data-testid="duration-state">{estimatedDuration ?? "none"}</div>
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

    expect(screen.queryByRole("button", { name: "Daily" })).not.toBeInTheDocument();
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

  it("supports monthly multi-day selection", async () => {
    render(<RecurrenceHarness selectedDate={new Date(2026, 0, 1)} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    fireEvent.click(screen.getByRole("button", { name: "15" }));
    fireEvent.click(screen.getByRole("button", { name: "31" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("monthly||1,15,31");
    });
  });

  it("supports custom month selection and keeps each period selection", async () => {
    render(<RecurrenceHarness selectedDate={new Date(2026, 0, 12)} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom Days" }));
    fireEvent.click(screen.getByRole("button", { name: "Wed" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("custom|0,2||week");
    });

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    fireEvent.click(screen.getByRole("button", { name: "24" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("custom|0,2|12,24|month");
    });

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("custom|0,2|12,24|week");
    });
  });

  it("keeps at least one selected day in active custom mode", async () => {
    render(<RecurrenceHarness selectedDate={new Date(2026, 0, 12)} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom Days" }));
    fireEvent.click(screen.getByRole("button", { name: "Mon" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("custom|0||week");
    });

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    fireEvent.click(screen.getByRole("button", { name: "12" }));

    await waitFor(() => {
      expect(screen.getByTestId("recurrence-state")).toHaveTextContent("custom|0|12|month");
    });
  });

  it("disables recurrence controls when time is required but missing", () => {
    render(<RecurrenceDisabledHarness />);

    const recurrenceButton = screen.getByRole("button", { name: "None" });
    expect(recurrenceButton).toBeDisabled();
    expect(screen.getByText("Set a time to enable recurrence.")).toBeInTheDocument();
  });
});

describe("AdvancedQuestOptions reminder picker", () => {
  it("updates duration using the shared duration picker", async () => {
    render(<DurationHarness />);

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    expect(screen.getByRole("button", { name: "45m" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "45m" }));

    await waitFor(() => {
      expect(screen.getByTestId("duration-state")).toHaveTextContent("45");
    });
  });

  it("shows None by default when reminders are disabled", () => {
    render(<ReminderHarness />);

    expect(getReminderSection().getByRole("button", { name: "None" })).toBeInTheDocument();
    expect(screen.getByTestId("reminder-state")).toHaveTextContent("false|15");
  });

  it("shows 2 days and custom reminder options", () => {
    render(<ReminderHarness />);

    fireEvent.click(getReminderSection().getByRole("button", { name: "None" }));

    expect(screen.getByRole("button", { name: "2 days before" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("enables reminders when selecting a preset", async () => {
    render(<ReminderHarness />);

    fireEvent.click(getReminderSection().getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "30 minutes before" }));

    await waitFor(() => {
      expect(screen.getByTestId("reminder-state")).toHaveTextContent("true|30");
    });

    expect(screen.getByRole("button", { name: "30 minutes before" })).toBeInTheDocument();
  });

  it("disables reminders when selecting None", async () => {
    render(<ReminderHarness />);

    fireEvent.click(getReminderSection().getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "10 minutes before" }));

    await waitFor(() => {
      expect(screen.getByTestId("reminder-state")).toHaveTextContent("true|10");
    });

    fireEvent.click(getReminderSection().getByRole("button", { name: "10 minutes before" }));
    fireEvent.click(screen.getAllByRole("button", { name: "None" }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByTestId("reminder-state")).toHaveTextContent("false|10");
    });

    expect(getReminderSection().getByRole("button", { name: "None" })).toBeInTheDocument();
  });

  it("applies a custom reminder value", async () => {
    render(<ReminderHarness />);

    fireEvent.click(getReminderSection().getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Minutes before"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(screen.getByTestId("reminder-state")).toHaveTextContent("true|180");
    });

    expect(screen.getByRole("button", { name: /180 minutes before \(Custom\)/i })).toBeInTheDocument();
  });

  it("shows an existing custom reminder label when reminders are enabled", () => {
    render(
      <AdvancedQuestOptions
        scheduledTime="09:00"
        onScheduledTimeChange={vi.fn()}
        estimatedDuration={30}
        onEstimatedDurationChange={vi.fn()}
        recurrencePattern={null}
        onRecurrencePatternChange={vi.fn()}
        recurrenceDays={[]}
        onRecurrenceDaysChange={vi.fn()}
        recurrenceMonthDays={[]}
        onRecurrenceMonthDaysChange={vi.fn()}
        recurrenceCustomPeriod={null}
        onRecurrenceCustomPeriodChange={vi.fn()}
        reminderEnabled
        onReminderEnabledChange={vi.fn()}
        reminderMinutesBefore={180}
        onReminderMinutesBeforeChange={vi.fn()}
        moreInformation={null}
        onMoreInformationChange={vi.fn()}
        location={null}
        onLocationChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /180 minutes before \(Custom\)/i })).toBeInTheDocument();
  });
});
