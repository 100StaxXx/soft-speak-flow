import type { CSSProperties } from "react";
import {
  EditCampaignSheetFrame,
  type EditCampaignSheetEpic,
} from "@/components/edit-campaign-sheet/EditCampaignSheetFrame";
import { useEpics } from "@/hooks/useEpics";

interface EditCampaignSheetProps {
  epic: EditCampaignSheetEpic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  startWithAddRitual?: boolean;
  companionFrostedThemeStyle?: CSSProperties;
}

export function EditCampaignSheet({
  epic,
  open,
  onOpenChange,
  onDeleted,
  startWithAddRitual = false,
  companionFrostedThemeStyle,
}: EditCampaignSheetProps) {
  const {
    activeEpics,
    updateEpic,
    deleteEpic,
    deleteCampaignRitual,
    createCampaignRitual,
  } = useEpics();

  const deleteRitual = async (habitId: string) => {
    if (!epic?.id) return false;
    await deleteCampaignRitual({ epicId: epic.id, habitId });
    return true;
  };

  const frameActiveEpics: EditCampaignSheetEpic[] = activeEpics.map((activeEpic) => ({
    id: activeEpic.id,
    title: activeEpic.title,
    description: activeEpic.description,
    target_days: activeEpic.target_days,
    start_date: activeEpic.start_date,
    end_date: activeEpic.end_date,
    status: activeEpic.status,
    epic_habits: activeEpic.epic_habits?.map((link) => ({
      habit_id: link.habit_id,
      habits: link.habits ? {
        ...link.habits,
        category: link.habits.category === "mind"
          || link.habits.category === "body"
          || link.habits.category === "soul"
          ? link.habits.category
          : null,
      } : null,
    })) ?? null,
  }));

  return (
    <EditCampaignSheetFrame
      epic={epic}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      startWithAddRitual={startWithAddRitual}
      companionFrostedThemeStyle={companionFrostedThemeStyle}
      dependencies={{
        activeEpics: frameActiveEpics,
        updateEpic: async ({ epicId, updates }) => {
          await updateEpic({
            epicId,
            updates: {
              title: updates.title,
              description: updates.description ?? "",
            },
          });
        },
        deleteEpic: async (params) => {
          await deleteEpic(params);
        },
        createCampaignRitual: async (params) => {
          await createCampaignRitual(params);
        },
        deleteRitual,
      }}
    />
  );
}
