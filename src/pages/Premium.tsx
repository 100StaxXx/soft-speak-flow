import { Navigate } from "react-router-dom";

import { PageLoader } from "@/components/PageLoader";
import { Paywall } from "@/components/Paywall";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { AccessCheckError } from "@/components/AccessCheckError";

export default function Premium() {
  const { hasAccess, loading, error, retry, gateReason } = useAccessStatus();

  if (loading) {
    return <PageLoader message="Checking your Cosmiq access..." />;
  }

  if (hasAccess) {
    return <Navigate to="/profile" replace />;
  }

  if (error) return <AccessCheckError retry={retry} />;
  return <Paywall variant={gateReason === "trial_expired" ? "trial_expired" : "pre_trial_signup"} />;
}
