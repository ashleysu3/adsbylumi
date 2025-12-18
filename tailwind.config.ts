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
        glow: "hsl(var(--glow))",
        // Lumi brand colors - Logo gradient
        lumi: {
          orange: {
            1: "hsl(var(--lumi-orange-1))",
            2: "hsl(var(--lumi-orange-2))",
          },
          pink: {
            1: "hsl(var(--lumi-pink-1))",
            2: "hsl(var(--lumi-pink-2))",
          },
          purple: {
            1: "hsl(var(--lumi-purple-1))",
            2: "hsl(var(--lumi-purple-2))",
          },
          blue: {
            1: "hsl(var(--lumi-blue-1))",
            2: "hsl(var(--lumi-blue-2))",
          },
          black: "hsl(var(--warm-black))",
          charcoal: "hsl(var(--soft-charcoal))",
          white: "hsl(var(--warm-white))",
          grey: "hsl(var(--fog-grey))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        tab: {
          "orange-light": "hsl(var(--tab-orange-light))",
          "orange-dark": "hsl(var(--tab-orange-dark))",
          "pink-light": "hsl(var(--tab-pink-light))",
          "pink-dark": "hsl(var(--tab-pink-dark))",
          "purple-light": "hsl(var(--tab-purple-light))",
          "purple-dark": "hsl(var(--tab-purple-dark))",
          "blue-light": "hsl(var(--tab-blue-light))",
          "blue-dark": "hsl(var(--tab-blue-dark))",
          "cream-light": "hsl(var(--tab-cream-light))",
          "cream-dark": "hsl(var(--tab-cream-dark))",
          black: "hsl(var(--tab-black))",
        },
      },
      fontFamily: {
        display: ['Red Hat Display', 'system-ui', 'sans-serif'],
        heading: ['Red Hat Display', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-lumi': 'var(--gradient-lumi)',
        'gradient-warm': 'var(--gradient-warm)',
        'gradient-cool': 'var(--gradient-cool)',
        'gradient-glow': 'var(--gradient-glow)',
      },
      boxShadow: {
        'lumi': 'var(--shadow-lumi)',
        'glow': 'var(--shadow-glow)',
        'elevated': 'var(--shadow-elevated)',
        'card': 'var(--shadow-card)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
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
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px 4px hsl(var(--lumi-purple-1) / 0.3)",
          },
          "50%": {
            boxShadow: "0 0 30px 8px hsl(var(--lumi-purple-1) / 0.5)",
          },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sparkle": {
          "0%, 100%": { 
            opacity: "1", 
            transform: "scale(1) rotate(0deg)" 
          },
          "25%": { 
            opacity: "0.8", 
            transform: "scale(1.1) rotate(5deg)" 
          },
          "50%": { 
            opacity: "1", 
            transform: "scale(1.2) rotate(0deg)" 
          },
          "75%": { 
            opacity: "0.8", 
            transform: "scale(1.1) rotate(-5deg)" 
          },
        },
        "sparkle-pulse": {
          "0%, 100%": { 
            opacity: "0.7",
            filter: "drop-shadow(0 0 2px hsl(var(--lumi-purple-1) / 0.5))"
          },
          "50%": { 
            opacity: "1",
            filter: "drop-shadow(0 0 6px hsl(var(--lumi-purple-1) / 0.8))"
          },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "sparkle": "sparkle 2s ease-in-out infinite",
        "sparkle-pulse": "sparkle-pulse 1.5s ease-in-out infinite",
        "shimmer": "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;