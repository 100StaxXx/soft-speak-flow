import { Navigate } from "react-router-dom";

import { PageLoader } from "@/components/PageLoader";
import { Paywall } from "@/components/Paywall";
import { useAccessStatus } from "@/hooks/useAccessStatus";

export default function Premium() {
  const { hasAccess, loading } = useAccessStatus();

  if (loading) {
    return <PageLoader message="Checking your Cosmiq access..." />;
  }

  if (hasAccess) {
    return <Navigate to="/profile" replace />;
  }

  return <Paywall />;
}
