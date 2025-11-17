import type { Config } from "tailwindcss";

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
        "breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "bounce-subtle": "bounce-subtle 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "breathe": "breathe 4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
