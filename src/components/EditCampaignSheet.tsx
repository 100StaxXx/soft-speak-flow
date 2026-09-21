import type { CSSProperties } from "react";
import {
  EditCampaignSheetFrame,
  type EditCampaignSheetEpic,
} from "@/components/edit-campaign-sheet/EditCampaignSheetFrame";
import { useEpics } from "@/hooks/useEpics";
import { isValidCategory } from "@/types/quest";

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

  return (
    <EditCampaignSheetFrame
      epic={epic}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      startWithAddRitual={startWithAddRitual}
      companionFrostedThemeStyle={companionFrostedThemeStyle}
      dependencies={{
        activeEpics: activeEpics.map((item) => ({
          ...item,
          epic_habits: item.epic_habits?.map((link) => ({
            ...link,
            habits: link.habits ? {
              ...link.habits,
              category: isValidCategory(link.habits.category) ? link.habits.category : null,
            } : null,
          })),
        })),
        updateEpic: async (params) => { await updateEpic(params); },
        deleteEpic: async (params) => { await deleteEpic(params); },
        createCampaignRitual: async (params) => { await createCampaignRitual(params); },
        deleteRitual,
      }}
    />
  );
}
