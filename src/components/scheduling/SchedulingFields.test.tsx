import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DurationPickerField } from "./DurationPickerField";
import { TimePickerField } from "./TimePickerField";
import { TimeRangePickerField } from "./TimeRangePickerField";

function TimeHarness({
  variant = "default",
}: {
  variant?: "default" | "quest-soft" | "compact";
}) {
  const [value, setValue] = useState<string | null>(null);

  return (
    <div>
      <TimePickerField
        value={value}
        onChange={setValue}
        placeholder="Time"
        ariaLabel="Harness time"
        variant={variant}
      />
      <div data-testid="time-state">{value ?? "none"}</div>
    </div>
  );
}

function DurationHarness({
  variant = "default",
}: {
  variant?: "default" | "quest-soft" | "compact";
}) {
  const [value, setValue] = useState<number | null>(30);

  return (
    <div>
      <DurationPickerField
        value={value}
        onChange={setValue}
        variant={variant}
      />
      <div data-testid="duration-state">{value ?? "none"}</div>
    </div>
  );
}

describe("TimePickerField", () => {
  it("preserves exact manual time entry", () => {
    render(<TimeHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    fireEvent.change(screen.getByLabelText("Harness time"), {
      target: { value: "11:17" },
    });

    expect(screen.getByTestId("time-state")).toHaveTextContent("11:17");
    expect(screen.getAllByRole("button", { name: "11:17 AM" }).length).toBeGreaterThan(0);
  });

  it("renders compact variant styling", () => {
    render(<TimeHarness variant="compact" />);

    expect(screen.getByRole("button", { name: "Time" })).toHaveClass("rounded-lg");
  });
});

describe("DurationPickerField", () => {
  it("updates from preset selections", () => {
    render(<DurationHarness />);

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    fireEvent.click(screen.getByRole("button", { name: "45m" }));

    expect(screen.getByTestId("duration-state")).toHaveTextContent("45");
  });

  it("supports custom duration entry", () => {
    render(<DurationHarness variant="quest-soft" />);

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByPlaceholderText("Minutes"), {
      target: { value: "17" },
    });

    expect(screen.getByTestId("duration-state")).toHaveTextContent("17");
  });
});

describe("TimeRangePickerField", () => {
  it("renders both start and end pickers", () => {
    render(
      <TimeRangePickerField
        startValue="09:00"
        endValue="10:00"
        onStartChange={() => {}}
        onEndChange={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "9:00 AM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:00 AM" })).toBeInTheDocument();
  });
});
