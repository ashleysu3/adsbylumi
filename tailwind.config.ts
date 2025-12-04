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
        // Lumi brand colors
        lumi: {
          orange: {
            1: "hsl(var(--lumi-orange-1))",
            2: "hsl(var(--lumi-orange-2))",
            3: "hsl(var(--lumi-orange-3))",
          },
          yellow: "hsl(var(--lumi-yellow))",
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
          "yellow-light": "hsl(var(--tab-yellow-light))",
          "yellow-dark": "hsl(var(--tab-yellow-dark))",
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
            boxShadow: "0 0 20px 4px hsl(var(--lumi-yellow) / 0.3)",
          },
          "50%": {
            boxShadow: "0 0 30px 8px hsl(var(--lumi-yellow) / 0.5)",
          },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
