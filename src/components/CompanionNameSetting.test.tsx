import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompanionNameSetting } from "./CompanionNameSetting";

const mocks = vi.hoisted(() => ({
  companion: {
    id: "companion-1",
    companion_name: "Lyra",
  } as { id: string; companion_name?: string | null } | null,
  invalidateQueries: vi.fn(),
  toast: vi.fn(),
  persistCompanionCustomName: vi.fn(),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    isLoading: false,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/lib/companionName", async () => {
  const actual = await vi.importActual<typeof import("@/lib/companionName")>("@/lib/companionName");
  return {
    ...actual,
    persistCompanionCustomName: mocks.persistCompanionCustomName,
  };
});

describe("CompanionNameSetting", () => {
  beforeEach(() => {
    mocks.companion = {
      id: "companion-1",
      companion_name: "Lyra",
    };
    mocks.invalidateQueries.mockReset();
    mocks.toast.mockReset();
    mocks.persistCompanionCustomName.mockReset();
    mocks.persistCompanionCustomName.mockResolvedValue("Lyra");
  });

  it("saves a renamed custom companion name", async () => {
    mocks.persistCompanionCustomName.mockResolvedValueOnce("Nova");

    render(<CompanionNameSetting />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Custom companion name"), {
      target: { value: "Nova" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.persistCompanionCustomName).toHaveBeenCalledWith("companion-1", "Nova");
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["companion"] });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Companion name updated",
      description: "Nova will now appear across the app.",
    });
  });

  it("clears the custom companion name when the field is emptied", async () => {
    mocks.persistCompanionCustomName.mockResolvedValue(null);

    render(<CompanionNameSetting />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Custom companion name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.persistCompanionCustomName).toHaveBeenCalledWith("companion-1", "   ");
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["companion"] });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Companion name cleared",
      description: "Your companion will go back to using its generated name.",
    });
  });
});
