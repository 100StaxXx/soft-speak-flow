import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drawerRootProps: [] as Array<Record<string, unknown>>,
  reset: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    open,
    children,
    ...props
  }: {
    open?: boolean;
    children?: ReactNode;
  } & Record<string, unknown>) => {
    mocks.drawerRootProps.push({ open, ...props });
    return open ? <div>{children}</div> : null;
  },
  DrawerContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DrawerFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useAdjustEpicPlan", () => ({
  useAdjustEpicPlan: () => ({
    suggestions: [],
    analysis: null,
    encouragement: null,
    epicStatus: null,
    isLoading: false,
    generateAdjustments: vi.fn().mockResolvedValue(undefined),
    toggleSuggestion: vi.fn(),
    getSelectedSuggestions: vi.fn(() => []),
    applyAdjustments: vi.fn().mockResolvedValue(true),
    reset: mocks.reset,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
  }),
}));

vi.mock("@/components/journey/SmartRitualAdvisor", () => ({
  SmartRitualAdvisor: () => <div data-testid="smart-ritual-advisor" />,
}));

import { SmartAdjustPlanDrawer } from "./SmartAdjustPlanDrawer";

describe("SmartAdjustPlanDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drawerRootProps.length = 0;
  });

  it("disables Vaul input repositioning for the smart adjust drawer", () => {
    render(
      <SmartAdjustPlanDrawer
        open
        onOpenChange={vi.fn()}
        epicId="epic-1"
        epicTitle="Launch prep"
      />,
    );

    expect(mocks.drawerRootProps[0]).toMatchObject({
      repositionInputs: false,
    });
  });
});
