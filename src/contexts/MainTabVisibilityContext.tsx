import { createContext, useContext, type ReactNode } from "react";

interface MainTabVisibilityContextValue {
  isTabActive: boolean;
}

const MainTabVisibilityContext = createContext<MainTabVisibilityContextValue>({
  isTabActive: true,
});

interface MainTabVisibilityProviderProps {
  isTabActive: boolean;
  children: ReactNode;
}

export const MainTabVisibilityProvider = ({
  isTabActive,
  children,
}: MainTabVisibilityProviderProps) => (
  <MainTabVisibilityContext.Provider value={{ isTabActive }}>
    {children}
  </MainTabVisibilityContext.Provider>
);

export const useMainTabVisibility = () => useContext(MainTabVisibilityContext);
