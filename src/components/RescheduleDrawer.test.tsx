import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drawerRootProps: [] as Array<Record<string, unknown>>,
  adjustSchedule: vi.fn(),
  resetSchedule: vi.fn(),
  invalidateQueries: vi.fn(),
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
  DrawerTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DrawerContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DrawerFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useJourneySchedule", () => ({
  useJourneySchedule: () => ({
    schedule: null,
    adjustSchedule: mocks.adjustSchedule,
    isLoading: false,
    error: null,
    reset: mocks.resetSchedule,
  }),
}));

vi.mock("@/hooks/useMilestones", () => ({
  useMilestones: () => ({
    milestones: [],
    milestonesByPhase: [],
    getJourneyHealth: () => null,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    })),
  },
}));

vi.mock("@/components/journey/SmartRescheduleAdvisor", () => ({
  SmartRescheduleAdvisor: () => <div data-testid="smart-reschedule-advisor" />,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { RescheduleDrawer } from "./RescheduleDrawer";

describe("RescheduleDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drawerRootProps.length = 0;
  });

  it("disables Vaul input repositioning for the reschedule drawer", () => {
    render(
      <RescheduleDrawer
        epicId="epic-1"
        epicTitle="Launch prep"
        currentDeadline="2026-05-20T00:00:00.000Z"
      />,
    );

    expect(mocks.drawerRootProps[0]).toMatchObject({
      repositionInputs: false,
    });
  });
});
