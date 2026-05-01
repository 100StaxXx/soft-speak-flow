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
}

export function EditCampaignSheet({
  epic,
  open,
  onOpenChange,
  onDeleted,
  startWithAddRitual = false,
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
      dependencies={{
        activeEpics,
        updateEpic,
        deleteEpic,
        createCampaignRitual,
        deleteRitual,
      }}
    />
  );
}
