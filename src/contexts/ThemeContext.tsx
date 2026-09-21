import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { PRODUCT, type ProductMode } from "@/config/product";
import { fetchProductMentorById } from "@/services/productMentorCatalog";

interface MentorTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  card: string;
  border_radius: string;
  border_style: string;
  glow_effect: boolean;
  texture: string;
  motion_effect: string;
}

interface ThemeContextType {
  currentTheme: MentorTheme | null;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: null,
  isTransitioning: false,
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
  mentorId?: string | null;
}

export const getDefaultProductTheme = (mode: ProductMode): Record<string, string> => (
  mode === "cosmiq"
    ? {
        "--primary": "270 70% 55%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "240 8% 18%",
        "--secondary-foreground": "0 0% 98%",
        "--accent": "280 80% 65%",
        "--accent-foreground": "0 0% 100%",
        "--background": "0 0% 5%",
        "--foreground": "0 0% 98%",
        "--card": "240 8% 14%",
        "--card-foreground": "0 0% 98%",
        "--popover": "240 8% 14%",
        "--popover-foreground": "0 0% 98%",
        "--muted": "240 6% 22%",
        "--muted-foreground": "240 5% 70%",
        "--destructive": "0 84.2% 60.2%",
        "--destructive-foreground": "0 0% 100%",
        "--border": "240 10% 20%",
        "--input": "240 8% 18%",
        "--ring": "270 70% 55%",
        "--radius": "1.25rem",
        "--shadow-glow": "0 0 30px hsl(270 70% 55% / 0.6), 0 0 60px hsl(270 70% 55% / 0.3)",
      }
    : {
        "--primary": "132 31% 34%",
        "--primary-foreground": "45 40% 98%",
        "--secondary": "42 33% 90%",
        "--secondary-foreground": "132 21% 16%",
        "--accent": "39 45% 60%",
        "--accent-foreground": "132 21% 16%",
        "--background": "43 30% 96%",
        "--foreground": "132 21% 16%",
        "--card": "45 35% 98%",
        "--card-foreground": "132 21% 16%",
        "--popover": "45 35% 98%",
        "--popover-foreground": "132 21% 16%",
        "--muted": "42 24% 89%",
        "--muted-foreground": "130 8% 40%",
        "--destructive": "0 65% 47%",
        "--destructive-foreground": "0 0% 100%",
        "--border": "132 14% 79%",
        "--input": "132 12% 53%",
        "--ring": "132 31% 34%",
        "--radius": "1.25rem",
        "--shadow-glow": "0 12px 36px hsl(132 31% 24% / 0.16)",
      }
);

export const ThemeProvider = ({ children, mentorId }: ThemeProviderProps) => {
  const [currentTheme, setCurrentTheme] = useState<MentorTheme | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let transitionTimeout: NodeJS.Timeout;

    const applyTheme = async () => {
      if (!mentorId) {
        // Reset to default theme without transition
        if (isMounted) {
          setCurrentTheme(null);
          applyDefaultTheme();
        }
        return;
      }

      try {
        // Fetch theme data BEFORE showing transition
        const mentor = await fetchProductMentorById(mentorId);

        if (!isMounted) return;

        // Only show transition if we actually have a theme to apply
        if (mentor?.theme_config) {
          setIsTransitioning(true);
          
          const theme = mentor.theme_config as unknown as MentorTheme;
          setCurrentTheme(theme);
          applyThemeToDOM(theme);
          
          // Transition duration
          transitionTimeout = setTimeout(() => {
            if (isMounted) {
              setIsTransitioning(false);
            }
          }, 300);
        } else {
          // No theme config, apply default without transition
          applyDefaultTheme();
        }
      } catch (error) {
        console.error("Error applying theme:", error);
        if (isMounted) {
          applyDefaultTheme();
          setIsTransitioning(false);
        }
      }
    };

    applyTheme();

    return () => {
      isMounted = false;
      if (transitionTimeout) {
        clearTimeout(transitionTimeout);
      }
    };
  }, [mentorId]);

  const applyThemeToDOM = (theme: MentorTheme) => {
    const root = document.documentElement;
    
    // Apply colors
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--secondary", theme.secondary);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--foreground", theme.foreground);
    root.style.setProperty("--card", theme.card);
    root.style.setProperty("--card-foreground", theme.foreground);
    root.style.setProperty("--popover", theme.card);
    root.style.setProperty("--popover-foreground", theme.foreground);
    root.style.setProperty("--primary-foreground", theme.foreground);
    root.style.setProperty("--secondary-foreground", theme.foreground);
    root.style.setProperty("--accent-foreground", theme.foreground);
    
    // Apply border radius
    root.style.setProperty("--radius", theme.border_radius);
    
    // Apply glow effect
    if (theme.glow_effect) {
      root.style.setProperty("--shadow-glow", `0 0 24px hsl(${theme.primary} / 0.5)`);
    } else {
      root.style.setProperty("--shadow-glow", "0 0 0 transparent");
    }
    
    // Apply border style class
    if (theme.border_style === "sharp") {
      root.classList.add("sharp-borders");
    } else {
      root.classList.remove("sharp-borders");
    }
    
    // Apply texture
    if (theme.texture && theme.texture !== "none") {
      root.style.setProperty("--bg-texture", theme.texture);
    }
    
    // Trigger transition
    root.classList.add("theme-transition");
    setTimeout(() => root.classList.remove("theme-transition"), 300);
  };

  const applyDefaultTheme = () => {
    const root = document.documentElement;

    Object.entries(getDefaultProductTheme(PRODUCT.mode)).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    
    root.classList.remove("sharp-borders");
    root.style.removeProperty("--bg-texture");
  };

  const value = useMemo(() => ({ currentTheme, isTransitioning }), [currentTheme, isTransitioning]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
