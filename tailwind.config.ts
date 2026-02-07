import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        'obsidian': 'hsl(var(--obsidian))',
        'midnight': 'hsl(var(--midnight))',
        'charcoal': 'hsl(var(--charcoal))',
        'steel': 'hsl(var(--steel))',
        'pure-white': 'hsl(var(--pure-white))',
        'graphite': 'hsl(var(--graphite))',
        'royal-purple': 'hsl(var(--royal-purple))',
        'deep-purple': 'hsl(var(--deep-purple))',
        'accent-purple': 'hsl(var(--accent-purple))',
        'electric-purple': 'hsl(var(--electric-purple))',
        'neon-glow': 'hsl(var(--neon-glow))',
        
        // Quest Category Colors
        'category-mind': 'hsl(var(--category-mind))',
        'category-body': 'hsl(var(--category-body))',
        'category-soul': 'hsl(var(--category-soul))',
        
        // Epic Theme Colors
        'epic-heroic': 'hsl(var(--epic-heroic))',
        'epic-warrior': 'hsl(var(--epic-warrior))',
        'epic-mystic': 'hsl(var(--epic-mystic))',
        'epic-nature': 'hsl(var(--epic-nature))',
        'epic-solar': 'hsl(var(--epic-solar))',
        
        // Streak Milestone Colors
        'streak-building': 'hsl(var(--streak-building))',
        'streak-strong': 'hsl(var(--streak-strong))',
        'streak-elite': 'hsl(var(--streak-elite))',
        'streak-legendary': 'hsl(var(--streak-legendary))',
        
        // Evolution Stage Tiers
        'stage-tier-2': 'hsl(var(--stage-tier-2))',
        'stage-tier-3': 'hsl(var(--stage-tier-3))',
        
        // Cosmic Accent Colors
        'celestial-blue': 'hsl(var(--celestial-blue))',
        'stardust-gold': 'hsl(var(--stardust-gold))',
        'nebula-pink': 'hsl(var(--nebula-pink))',
        'deep-space': 'hsl(var(--deep-space))',
        'cosmiq-glow': 'hsl(var(--cosmiq-glow))',
      },
      fontFamily: {
        'heading': ['Bebas Neue', 'Oswald', 'sans-serif'],
        'body': ['Barlow', 'sans-serif'],
        'quote': ['Playfair Display', 'serif'],
        'cinzel': ['Cinzel', 'serif'],
        'cormorant': ['Cormorant Garamond', 'serif'],
        'abril': ['Abril Fatface', 'serif'],
        'righteous': ['Righteous', 'sans-serif'],
        'monoton': ['Monoton', 'cursive'],
        'fredoka': ['Fredoka', 'sans-serif'],
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'medium': 'var(--shadow-medium)',
        'hard': 'var(--shadow-hard)',
        'glow': 'var(--shadow-glow)',
        'glow-lg': 'var(--shadow-glow-lg)',
        'neon': 'var(--shadow-neon)',
      },
      borderRadius: {
        lg: '1.5rem',
        md: '1.25rem',
        sm: '1rem',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "collapsible-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "skeleton-pulse": {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.5",
          },
          to: {
            height: "0",
          },
        },
        "skeleton-pulse": {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.5",
          },
        },
        "shimmer": {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(100%)",
          },
        },
        "scale-in": {
          "0%": {
            opacity: "0",
            transform: "scale(0.9)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        "bounce-subtle": {
          "0%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-10px)",
          },
          "100%": {
            transform: "translateY(0)",
          },
        },
        "bounce-slow": {
          "0%, 100%": {
            transform: "translateY(-5%)",
            animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
          },
          "50%": {
            transform: "translateY(0)",
            animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
          },
        },
        "breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
        "gradient-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        "bounce-pop": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        "rainbow-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "pulse-glow": {
          "0%, 100%": { 
            transform: "scale(1)",
            boxShadow: "0 0 20px rgba(255, 0, 128, 0.5), 0 0 40px rgba(128, 0, 255, 0.3), 0 0 60px rgba(0, 128, 255, 0.2)",
          },
          "50%": { 
            transform: "scale(1.02)",
            boxShadow: "0 0 30px rgba(255, 0, 128, 0.6), 0 0 60px rgba(128, 0, 255, 0.4), 0 0 90px rgba(0, 128, 255, 0.3)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 8s linear infinite",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "bounce-subtle": "bounce-subtle 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "bounce-slow": "bounce-slow 1.5s ease-in-out infinite",
        "breathe": "breathe 4s ease-in-out infinite",
        "gradient-spin": "gradient-spin 3s linear infinite",
        "wiggle": "wiggle 0.3s ease-in-out",
        "bounce-pop": "bounce-pop 0.6s ease-in-out infinite",
        "rainbow-shift": "rainbow-shift 3s ease infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      perspective: {
        "1000": "1000px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
