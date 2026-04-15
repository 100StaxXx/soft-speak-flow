import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ACTIVE_CAMPAIGN_LIMIT_WARNING } from "@/features/epics/constants";
import { CapacityWarningBanner } from "./CapacityWarningBanner";

describe("CapacityWarningBanner", () => {
  it("renders the shared campaign limit warning copy", () => {
    render(<CapacityWarningBanner isAtEpicLimit isLoading={false} />);

    expect(screen.getByText(ACTIVE_CAMPAIGN_LIMIT_WARNING)).toBeInTheDocument();
  });
});
