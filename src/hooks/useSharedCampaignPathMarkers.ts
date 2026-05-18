import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SharedCampaignPathMarker {
  userId: string;
  displayName: string;
  progressPercentage: number;
  isCurrentUser: boolean;
  isOwner: boolean;
  companionImageUrl: string | null;
  companionImageFocalX: number | null;
  companionImageFocalY: number | null;
  companionMood: string | null;
  joinedAt: string | null;
  lastActivityAt: string | null;
}

export interface SharedCampaignMarkerProgressInput {
  completedMilestonePercents?: Array<number | null | undefined>;
  progressLogPercentage?: number | null;
  ownerProgressPercentage?: number | null;
  memberContribution?: number | null;
  isOwner?: boolean;
}

interface SharedCampaignPathMarkerRow {
  user_id: string;
  display_name: string | null;
  progress_percentage: number | string | null;
  is_current_user: boolean | null;
  is_owner: boolean | null;
  companion_image_url: string | null;
  companion_image_focal_x: number | null;
  companion_image_focal_y: number | null;
  companion_mood: string | null;
  joined_at: string | null;
  last_activity_at: string | null;
}

const clampProgress = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

const firstFiniteNumber = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

export const getSharedCampaignPathMarkersQueryKey = (epicId: string | undefined, userId: string | undefined) =>
  ["shared-campaign-path-markers", epicId, userId] as const;

export const resolveSharedCampaignMarkerProgress = ({
  completedMilestonePercents = [],
  progressLogPercentage,
  ownerProgressPercentage,
  memberContribution,
  isOwner = false,
}: SharedCampaignMarkerProgressInput): number => {
  const completedMilestoneProgress = completedMilestonePercents
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce<number | null>((highest, value) => highest === null ? value : Math.max(highest, value), null);

  return clampProgress(
    firstFiniteNumber(
      completedMilestoneProgress,
      progressLogPercentage,
      isOwner ? ownerProgressPercentage : memberContribution,
      0,
    ) ?? 0,
  );
};

export const normalizeSharedCampaignPathMarkers = (
  rows: SharedCampaignPathMarkerRow[] | null | undefined,
  currentUserId: string | undefined,
): SharedCampaignPathMarker[] =>
  (rows ?? []).map((row) => {
    const displayName = row.display_name?.trim() || "Adventurer";
    const progressPercentage = resolveSharedCampaignMarkerProgress({
      progressLogPercentage: Number(row.progress_percentage ?? 0),
    });

    return {
      userId: row.user_id,
      displayName,
      progressPercentage,
      isCurrentUser: Boolean(row.is_current_user) || row.user_id === currentUserId,
      isOwner: Boolean(row.is_owner),
      companionImageUrl: row.companion_image_url,
      companionImageFocalX: row.companion_image_focal_x,
      companionImageFocalY: row.companion_image_focal_y,
      companionMood: row.companion_mood,
      joinedAt: row.joined_at,
      lastActivityAt: row.last_activity_at,
    };
  });

export const useSharedCampaignPathMarkers = (epicId: string | undefined) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: getSharedCampaignPathMarkersQueryKey(epicId, user?.id),
    queryFn: async () => {
      if (!epicId || !user?.id) return [];

      const { data, error } = await supabase.rpc("get_shared_epic_path_markers", {
        p_epic_id: epicId,
      });

      if (error) {
        throw error;
      }

      return normalizeSharedCampaignPathMarkers(data as SharedCampaignPathMarkerRow[], user.id);
    },
    enabled: Boolean(epicId && user?.id),
    staleTime: 60 * 1000,
    placeholderData: (previousMarkers) => previousMarkers ?? [],
  });

  return {
    ...query,
    markers: query.data ?? [],
  };
};
