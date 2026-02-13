import { createContext, useContext, type ReactNode } from "react";

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
  return (
    <MainTabVisibilityContext.Provider value={{ isTabActive }}>
      {children}
    </MainTabVisibilityContext.Provider>
  );
};

export const useMainTabVisibility = () => useContext(MainTabVisibilityContext);
