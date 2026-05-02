import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { readCreationPopupMarker } from "@/utils/creationPopupPersistence";

const SAFE_CREATION_POPUP_RESUME_ORIGIN_PATHS = ["/", "/journeys", "/campaigns"];

export function useCreationPopupResume() {
  const { user, status } = useAuth();
  const { loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (hasNavigatedRef.current) return;
    if (status !== "authenticated" || !user?.id) return;
    if (profileLoading) return;

    const marker = readCreationPopupMarker(user.id);
    if (!marker) return;

    if (location.pathname === marker.route) {
      hasNavigatedRef.current = true;
      return;
    }

    if (!SAFE_CREATION_POPUP_RESUME_ORIGIN_PATHS.includes(location.pathname)) {
      hasNavigatedRef.current = true;
      return;
    }

    hasNavigatedRef.current = true;
    navigate(marker.route, {
      replace: true,
      state: { creationPopupRestore: true },
    });
  }, [location.pathname, navigate, profileLoading, status, user?.id]);
}
