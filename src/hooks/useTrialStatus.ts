import { useAccessStatus } from "./useAccessStatus";

/**
 * Legacy hook for backwards compatibility.
 * @deprecated Use useAccessStatus() instead for new code.
 * 
 * This hook wraps the centralized useAccessStatus() hook and provides
 * the same interface as before for backwards compatibility.
 */
interface TrialStatus {
  isInTrial: boolean;
  trialDaysRemaining: number;
  trialExpired: boolean;
  isSubscribed: boolean;
  needsPaywall: boolean;
  trialEndsAt: Date | null;
  loading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const accessStatus = useAccessStatus();

  return {
    isInTrial: accessStatus.isInTrial,
    trialDaysRemaining: accessStatus.trialDaysRemaining,
    trialExpired: accessStatus.status === "free",
    isSubscribed: accessStatus.isSubscribed,
    needsPaywall: accessStatus.needsPaywall,
    trialEndsAt: accessStatus.trialEndsAt,
    loading: accessStatus.loading,
  };
}
