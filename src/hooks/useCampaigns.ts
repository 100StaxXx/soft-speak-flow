import { toCampaign } from "@/features/epics/adapters";
import { useEpics } from "@/hooks/useEpics";

type UseEpicsOptions = Parameters<typeof useEpics>[0];

export const useCampaigns = (options: UseEpicsOptions = {}) => {
  const legacyEpics = useEpics(options);
  const campaigns = legacyEpics.epics ?? [];
  const activeCampaigns = legacyEpics.activeEpics ?? [];
  const completedCampaigns = legacyEpics.completedEpics ?? [];

  return {
    campaigns: campaigns.map(toCampaign),
    activeCampaigns: activeCampaigns.map(toCampaign),
    completedCampaigns: completedCampaigns.map(toCampaign),
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
