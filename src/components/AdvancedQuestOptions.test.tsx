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
