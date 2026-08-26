import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExternalCalendarAgenda } from "@/components/ExternalCalendarAgenda";

describe("ExternalCalendarAgenda", () => {
  it("renders connected provider events as read-only schedule context", () => {
    render(
      <ExternalCalendarAgenda
        events={[
          {
            id: "google:event-1",
            title: "Project review",
            start: "2026-08-13T16:00:00.000Z",
            end: "2026-08-13T16:30:00.000Z",
            isAllDay: false,
            provider: "google",
            readOnly: true,
          },
          {
            id: "outlook:event-2",
            title: "Planning day",
            start: "2026-08-14T07:00:00.000Z",
            end: "2026-08-15T07:00:00.000Z",
            isAllDay: true,
            provider: "outlook",
            readOnly: true,
          },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "Connected calendar events" })).toBeInTheDocument();
    expect(screen.getByText("Project review")).toBeInTheDocument();
    expect(screen.getByText("Planning day")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Outlook")).toBeInTheDocument();
    expect(screen.getByText(/All day/)).toBeInTheDocument();
  });

  it("stays hidden when there are no imported events", () => {
    const { container } = render(<ExternalCalendarAgenda events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
