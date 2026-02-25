const HIDDEN_EXACT_PATHS = new Set([
  "/welcome",
  "/terms",
  "/privacy",
  "/promo-code",
  "/test-scroll",
  "/test-day-planner",
]);

const HIDDEN_PREFIX_PATHS = ["/auth", "/onboarding"];

const isHiddenPrefixPath = (pathname: string) =>
  HIDDEN_PREFIX_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const shouldShowBottomNav = (
  pathname: string,
  isAuthenticated: boolean,
): boolean => {
  if (!isAuthenticated) return false;
  if (HIDDEN_EXACT_PATHS.has(pathname)) return false;
  if (isHiddenPrefixPath(pathname)) return false;
  return true;
};
