import { createContext, useContext, useMemo, type ReactNode } from "react";

interface MainTabVisibilityContextValue {
  isTabActive: boolean;
}

const MainTabVisibilityContext = createContext<MainTabVisibilityContextValue>({
  isTabActive: true,
});

export const MainTabVisibilityProvider = ({
  isTabActive,
  children,
}: {
  isTabActive: boolean;
  children: ReactNode;
}) => {
  const value = useMemo(() => ({ isTabActive }), [isTabActive]);

  return (
    <MainTabVisibilityContext.Provider value={value}>
      {children}
    </MainTabVisibilityContext.Provider>
  );
};

export const useMainTabVisibility = () => useContext(MainTabVisibilityContext);
