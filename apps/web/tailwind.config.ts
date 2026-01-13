import plugin from 'tailwindcss/plugin';
import { reflyColors } from './tailwind-colors';

import type { Config } from 'tailwindcss';

const content = [
  './index.html',
  './src/**/*.{js,jsx,ts,tsx}',
  '../../packages/ai-workspace-common/src/**/*.{js,jsx,ts,tsx}',
  '../../packages/web-core/src/**/*.{js,jsx,ts,tsx}',
  '../../packages/ui-kit/src/**/*.{js,jsx,ts,tsx}',
];

const AntdOverwritePlugin = plugin(({ matchVariant }) => {
  const processSpaces = (value: string) =>
    value.replace(/([^\\_])_([^_])/g, '$1 $2').replace(/\\_/g, '_');
  matchVariant('ant', (value) => {
    if (value.startsWith('&')) {
      return processSpaces(value);
    }
    return `& ${processSpaces(value)}`;
  });
});

export function defineConfig(): Config {
  return {
    darkMode: 'class',
    plugins: [AntdOverwritePlugin],
    corePlugins: {
      preflight: false,
    },
    content,
    theme: {
      extend: {
        gridTemplateColumns: {
          // Custom grid columns for avatar wall
          '13': 'repeat(13, minmax(0, 1fr))',
          '14': 'repeat(14, minmax(0, 1fr))',
          '15': 'repeat(15, minmax(0, 1fr))',
          '16': 'repeat(16, minmax(0, 1fr))',
        },
        fontFamily: {
          inter: ['Inter', 'sans-serif'],
          'architects-daughter': ['"Architects Daughter"', 'sans-serif'],
        },
        fontSize: {
          xs: ['12px', '20px'],
          sm: ['14px', '22px'],
          base: ['16px', '24px'],
          lg: ['18px', '28px'],
          xl: ['20px', '30px'],
          '2xl': ['24px', '36px'],
        },
        animation: {
          'slide-in-left': 'slideInLeft 0.3s ease-out',
          shake: 'shake 0.5s ease-in-out infinite',
        },
        boxShadow: {
          'refly-s': '0 1px 6px 0 #0000003d',
          'refly-m': '0 2px 20px 4px #0000000a',
          'refly-l': '0 8px 40px 0 #00000014',
          'refly-primary': '0 8px 60px 0 #1d463d1a',
          'refly-xl': '0 8px 32px 0 #00000014',
        },
        keyframes: {
          shake: {
            '0%, 100%': { transform: 'rotate(0deg)' },
            '25%': { transform: 'rotate(-10deg)' },
            '50%': { transform: 'rotate(10deg)' },
            '75%': { transform: 'rotate(-10deg)' },
          },
          slideInLeft: {
            '0%': {
              transform: 'translateX(-100%)',
              opacity: '0',
            },
            '100%': {
              transform: 'translateX(0)',
              opacity: '1',
            },
          },
        },
        backgroundImage: {
          'gradient-tools-open':
            'linear-gradient(124deg, rgba(31, 201, 150, 0.10) 0%, rgba(69, 190, 255, 0.06) 24.85%)',
        },
        colors: {
          ...reflyColors,
          // TODO: remove below hardcoded colors after reflyColors is correctly configured
          gray: {
            100: '#F1F1F0',
            200: '#D9E3EA',
            300: '#C5D2DC',
            400: '#9BA9B4',
            500: '#707D86',
            600: '#55595F',
            700: '#33363A',
            800: '#25282C',
            900: '#151719',
            950: '#090A0A',
          },
          green: {
            50: '#eff4f7',
            100: '#E8FFFA',
            200: '#AAEADE',
            300: '#74D5C6',
            400: '#46C0B2',
            500: '#1FAB9F',
            600: '#0E9F77',
            700: '#008481',
            800: '#00716A',
            900: '#18242c',
          },
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          background: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          primary: {
            300: '#E8FFFA',
            400: '#46C0B2',
            600: '#0E9F77',
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))',
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))',
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))',
          },
          muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))',
          },
          accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))',
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))',
          },
          card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))',
          },
        },
      },
    },
  };
}

export default defineConfig();
