import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

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
        const { data: mentor } = await supabase
          .from("graceward_guides")
          .select("theme_config")
          .eq("id", mentorId)
          .maybeSingle();

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
    
    // Daily Way defaults: warm paper, evergreen, and restrained gold.
    root.style.setProperty("--primary", "132 31% 34%");
    root.style.setProperty("--primary-foreground", "45 40% 98%");
    root.style.setProperty("--secondary", "42 33% 90%");
    root.style.setProperty("--secondary-foreground", "132 21% 16%");
    root.style.setProperty("--accent", "39 45% 60%");
    root.style.setProperty("--accent-foreground", "132 21% 16%");
    root.style.setProperty("--background", "43 30% 96%");
    root.style.setProperty("--foreground", "132 21% 16%");
    root.style.setProperty("--card", "45 35% 98%");
    root.style.setProperty("--card-foreground", "132 21% 16%");
    root.style.setProperty("--popover", "45 35% 98%");
    root.style.setProperty("--popover-foreground", "132 21% 16%");
    root.style.setProperty("--muted", "42 24% 89%");
    root.style.setProperty("--muted-foreground", "130 8% 40%");
    root.style.setProperty("--border", "132 14% 79%");
    root.style.setProperty("--input", "132 12% 53%");
    root.style.setProperty("--ring", "132 31% 34%");
    root.style.setProperty("--radius", "1.25rem");
    root.style.setProperty("--shadow-glow", "0 12px 36px hsl(132 31% 24% / 0.16)");
    
    root.classList.remove("sharp-borders");
  };

  const value = useMemo(() => ({ currentTheme, isTransitioning }), [currentTheme, isTransitioning]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
