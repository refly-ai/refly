import forms from "@tailwindcss/forms"
import animate from "tailwindcss-animate"
import typography from "@tailwindcss/typography"
import customTypograph from "./typography"

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@refly/ai-workspace-common/src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@refly/editor-common/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    typography: customTypograph,
    extend: {
      screens: {
        mobile: "100px",
        // => @media (min-width: 100px) { ... }
        tablet: "640px", // 391
        // => @media (min-width: 600px) { ... }
        pc: "769px",
        // => @media (min-width: 769px) { ... }
      },
      colors: {
        gray: {
          25: "#fcfcfd",
          50: "#f9fafb",
          100: "#EBF1F5",
          200: "#D9E3EA",
          300: "#C5D2DC",
          400: "#9BA9B4",
          500: "#707D86",
          600: "#55595F",
          700: "#33363A",
          800: "#25282C",
          900: "#151719",
        },
        green: {
          100: "#E8FFFA",
          200: "#AAEADE",
          300: "#74D5C6",
          400: "#46C0B2",
          500: "#1FAB9F",
          600: "#00968F",
          700: "#008481",
        },
        blue: {
          500: "#E1EFFE",
        },
        yellow: {
          100: "#FDF6B2",
          800: "#723B13",
        },
        purple: {
          50: "#F6F5FF",
          200: "#DCD7FE",
        },
        indigo: {
          25: "#F5F8FF",
          50: "#EEF4FF",
          100: "#E0EAFF",
          300: "#A4BCFD",
          400: "#8098F9",
          600: "#444CE7",
          800: "#2D31A6",
        },
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
      },
      spacing: {
        "9/16": "56.25%",
        "3/4": "75%",
        "1/1": "100%",
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        "architects-daughter": ['"Architects Daughter"', "sans-serif"],
      },
      boxShadow: {
        xs: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
        sm: "0px 1px 2px 0px rgba(16, 24, 40, 0.06), 0px 1px 3px 0px rgba(16, 24, 40, 0.10)",
        md: "0px 2px 4px -2px rgba(16, 24, 40, 0.06), 0px 4px 8px -2px rgba(16, 24, 40, 0.10)",
        lg: "0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
        xl: "0px 8px 8px -4px rgba(16, 24, 40, 0.03), 0px 20px 24px -4px rgba(16, 24, 40, 0.08)",
        "2xl": "0px 24px 48px -12px rgba(16, 24, 40, 0.18)",
        "3xl": "0px 32px 64px -12px rgba(16, 24, 40, 0.14)",
      },
      opacity: {
        2: "0.02",
        8: "0.08",
      },
      fontSize: {
        xs: "0.75rem",
        sm: "0.875rem",
        base: "1rem",
        lg: "1.125rem",
        xl: "1.25rem",
        "2xs": "0.625rem",
        "3xl": "2rem",
        "4xl": "2.5rem",
        "5xl": "3.25rem",
        "6xl": "4rem",
      },
      inset: {
        full: "100%",
      },
      letterSpacing: {
        tighter: "-0.02em",
        tight: "-0.01em",
        normal: "0",
        wide: "0.01em",
        wider: "0.02em",
        widest: "0.4em",
      },
      minWidth: {
        10: "2.5rem",
      },
      scale: {
        98: ".98",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [forms, animate, typography],
  // https://github.com/tailwindlabs/tailwindcss/discussions/5969
  corePlugins: {
    preflight: false,
  },
}
