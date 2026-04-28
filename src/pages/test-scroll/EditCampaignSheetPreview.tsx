import { useEffect, useMemo, useState } from "react";

import {
  EditCampaignSheetFrame,
  type EditCampaignSheetDependencies,
  type EditCampaignSheetEpic,
} from "@/components/edit-campaign-sheet/EditCampaignSheetFrame";

const createPreviewCampaignEpic = (): EditCampaignSheetEpic => ({
  id: "test-scroll-campaign-preview",
  title: "Companion Planner Sprint",
  description: "A local-only visual fixture for checking the warm campaign editor shell.",
  target_days: 30,
  start_date: "2026-04-01",
  end_date: "2026-04-30",
  status: "active",
  epic_habits: [
    {
      habit_id: "test-scroll-ritual-focus",
      habits: {
        id: "test-scroll-ritual-focus",
        title: "Morning focus ritual",
        description: "Open the day with one intentional planning block.",
        difficulty: "medium",
        frequency: "daily",
        custom_days: [],
        custom_month_days: null,
        preferred_time: "08:30",
        estimated_minutes: 25,
        category: "mind",
      },
    },
    {
      habit_id: "test-scroll-ritual-review",
      habits: {
        id: "test-scroll-ritual-review",
        title: "Evening review",
        description: "Close the loop and choose tomorrow's first move.",
        difficulty: "easy",
        frequency: "custom",
        custom_days: [1, 3, 5],
        custom_month_days: null,
        preferred_time: "18:00",
        estimated_minutes: 15,
        category: "soul",
      },
    },
  ],
});

interface EditCampaignSheetPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCampaignSheetPreview({
  open,
  onOpenChange,
}: EditCampaignSheetPreviewProps) {
  const [previewEpic, setPreviewEpic] = useState<EditCampaignSheetEpic | null>(() => createPreviewCampaignEpic());

  useEffect(() => {
    if (open && !previewEpic) {
      setPreviewEpic(createPreviewCampaignEpic());
    }
  }, [open, previewEpic]);

  const previewDependencies = useMemo<EditCampaignSheetDependencies>(() => ({
    activeEpics: previewEpic ? [previewEpic] : [],
    updateEpic: async ({ updates }) => {
      setPreviewEpic((current) => current
        ? {
          ...current,
          title: updates.title,
          description: updates.description,
        }
        : current);
    },
    deleteEpic: async () => {
      setPreviewEpic(null);
    },
    createCampaignRitual: async ({ title, difficulty, frequency, customDays }) => {
      setPreviewEpic((current) => {
        if (!current) return current;

        const ritualId = `test-scroll-ritual-${Date.now()}`;
        return {
          ...current,
          epic_habits: [
            ...(current.epic_habits ?? []),
            {
              habit_id: ritualId,
              habits: {
                id: ritualId,
                title,
                description: "Local-only preview ritual.",
                difficulty,
                frequency,
                custom_days: customDays,
                custom_month_days: null,
                preferred_time: null,
                estimated_minutes: 20,
                category: "mind",
              },
            },
          ],
        };
      });
    },
    deleteRitual: async (habitId) => {
      setPreviewEpic((current) => current
        ? {
          ...current,
          epic_habits: (current.epic_habits ?? []).filter((link) => link.habit_id !== habitId),
        }
        : current);

      return true;
    },
  }), [previewEpic]);

  return (
    <EditCampaignSheetFrame
      epic={previewEpic}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={() => setPreviewEpic(createPreviewCampaignEpic())}
      dependencies={previewDependencies}
      visualPreview
    />
  );
}
