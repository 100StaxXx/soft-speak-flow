import { toCampaign } from "@/features/epics/adapters";
import { useEpics } from "@/hooks/useEpics";

type UseEpicsOptions = Parameters<typeof useEpics>[0];

export const useCampaigns = (options: UseEpicsOptions = {}) => {
  const legacyEpics = useEpics(options);

  return {
    campaigns: legacyEpics.epics.map(toCampaign),
    activeCampaigns: legacyEpics.activeEpics.map(toCampaign),
    completedCampaigns: legacyEpics.completedEpics.map(toCampaign),
    isLoading: legacyEpics.isLoading,
    error: legacyEpics.error,
    createCampaign: legacyEpics.createEpic,
    isCreating: legacyEpics.isCreating,
    updateCampaign: legacyEpics.updateEpic,
    renameCampaign: legacyEpics.renameEpic,
    deleteCampaign: legacyEpics.deleteEpic,
    updateCampaignStatus: legacyEpics.updateEpicStatus,
    createCampaignRitual: legacyEpics.createCampaignRitual,
    isCreatingCampaignRitual: legacyEpics.isCreatingCampaignRitual,
  };
};
