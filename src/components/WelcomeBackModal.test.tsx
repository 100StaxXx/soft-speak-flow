import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markUserActive: vi.fn(async () => undefined),
  awardCustomXP: vi.fn(async () => undefined),
  checkComebackAchievement: vi.fn(async () => undefined),
  triggerComeback: vi.fn(async () => undefined),
  onClose: vi.fn(),
  companion: {
    id: "companion-1",
    preset_id: "fox",
    current_stage: 5,
    current_image_url: "https://example.com/custom-current.png",
    current_image_focal_x: 0.44,
    current_image_focal_y: 0.56,
    core_element: "nature",
  },
  health: {
    moodState: "sad",
    daysInactive: 3,
    neglectedImageUrl: "https://example.com/custom-neglected.png",
    neglectedImageFocalX: 0.25,
    neglectedImageFocalY: 0.75,
  },
}));

vi.mock("@/hooks/useCompanionHealth", () => ({
  useCompanionHealth: () => ({
    health: mocks.health,
    markUserActive: mocks.markUserActive,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: mocks.awardCustomXP,
    XP_REWARDS: {
      WELCOME_BACK_BONUS: 25,
    },
  }),
}));

vi.mock("@/hooks/useLivingCompanion", () => ({
  useLivingCompanionSafe: () => ({
    triggerComeback: mocks.triggerComeback,
  }),
}));

vi.mock("@/hooks/useAchievements", () => ({
  useAchievements: () => ({
    checkComebackAchievement: mocks.checkComebackAchievement,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (assetPath: string) => ({
          data: {
            publicUrl: `https://example.com/storage/v1/object/public/companion-presets/${assetPath}`,
          },
        }),
      }),
    },
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CompanionImage", () => ({
  CompanionPortraitShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CompanionImage: ({
    src,
    alt,
  }: {
    src: string;
    alt: string;
  }) => <div data-testid="companion-image" data-src={src} aria-label={alt} />,
}));

import { WelcomeBackModal } from "./WelcomeBackModal";

describe("WelcomeBackModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders canonical preset art for the sad and reunion states even when stored URLs are custom", async () => {
    render(<WelcomeBackModal isOpen onClose={mocks.onClose} />);

    expect(screen.getByTestId("companion-image")).toHaveAttribute(
      "data-src",
      "https://example.com/storage/v1/object/public/companion-presets/fox/t2_guardian/neglected/fox__t2_guardian__neglected__nature.png",
    );

    fireEvent.click(screen.getByRole("button", { name: /reunite with your companion/i }));

    await waitFor(() => {
      expect(screen.getByText("Welcome Back! 🎉")).toBeInTheDocument();
    });

    expect(screen.getByTestId("companion-image")).toHaveAttribute(
      "data-src",
      "https://example.com/storage/v1/object/public/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__nature.png",
    );
  });
});
