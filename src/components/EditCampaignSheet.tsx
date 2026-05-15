import type { CSSProperties } from "react";
import {
  EditCampaignSheetFrame,
  type EditCampaignSheetDependencies,
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
  const updateCampaignEpic = async (params: {
    epicId: string;
    updates: { title: string; description: string | null };
  }) => {
    await updateEpic(params);
  };
  const deleteCampaignEpic = async (params: { epicId: string }) => {
    await deleteEpic(params);
  };
  const createRitual: EditCampaignSheetDependencies["createCampaignRitual"] =
    async (params) => {
      await createCampaignRitual(params);
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
        activeEpics: activeEpics as unknown as EditCampaignSheetEpic[],
        updateEpic: updateCampaignEpic,
        deleteEpic: deleteCampaignEpic,
        createCampaignRitual: createRitual,
        deleteRitual,
      }}
    />
  );
}
