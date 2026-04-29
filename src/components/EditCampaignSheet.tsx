import { useQueryClient } from "@tanstack/react-query";

import {
  EditCampaignSheetFrame,
  type EditCampaignSheetEpic,
} from "@/components/edit-campaign-sheet/EditCampaignSheetFrame";
import { useAuth } from "@/hooks/useAuth";
import { useEpics } from "@/hooks/useEpics";
import { supabase } from "@/integrations/supabase/client";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    activeEpics,
    updateEpic,
    deleteEpic,
    createCampaignRitual,
  } = useEpics();

  const deleteRitual = async (habitId: string) => {
    if (!user?.id) return false;

    const { data: deletedHabits, error: habitError } = await supabase
      .from("habits")
      .delete()
      .eq("id", habitId)
      .eq("user_id", user.id)
      .select("id");

    if (habitError) throw habitError;

    if (!deletedHabits || deletedHabits.length === 0) {
      throw new Error(
        `No matching ritual deleted (habit_id=${habitId}, user_id=${user.id}) — RLS denied or row already gone.`,
      );
    }

    const { error: tasksError } = await supabase
      .from("daily_tasks")
      .delete()
      .eq("habit_source_id", habitId)
      .eq("user_id", user.id)
      .eq("completed", false);

    if (tasksError) {
      console.error("Error deleting linked tasks:", tasksError);
    }

    queryClient.invalidateQueries({ queryKey: ["habits"] });
    queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["epics"] });

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
