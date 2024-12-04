import forms from "@tailwindcss/forms"
import animate from "tailwindcss-animate"
import typography from "@tailwindcss/typography"

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "../../packages/ai-workspace-common/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            img: {
              // 移除所有图片样式
              margin: "0",
              padding: "0",
              border: "none",
              boxShadow: "none",
              display: "inline",
              width: "auto",
              height: "auto",
            },
          },
          // 添加 blockquote 样式覆盖
          blockquote: {
            quotes: "none",
            "&::before": {
              content: "none",
            },
            "&::after": {
              content: "none",
            },
            // 重要：覆盖 blockquote 内 p 元素的样式
            "p::before": {
              content: "none",
            },
            "p::after": {
              content: "none",
            },
          },
        },
      },
      colors: {
        gray: {
          100: "#F1F1F0",
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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          600: "#00968F",
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
        alibaba: ["Alibaba PuHuiTi", "sans-serif"],
      },
      fontSize: {
        xs: "0.75rem",
        sm: "0.875rem",
        base: "1rem",
        lg: "1.125rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
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
  plugins: [
    forms({
      strategy: "class", // 只在使用 form-* 类时应用样式
    }),
    animate,
    typography,
  ],
  corePlugins: {
    preflight: false,
  },
}
