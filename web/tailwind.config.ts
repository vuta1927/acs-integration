import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cr: {
          bg: '#0B1020',
          'bg-deep': '#060A16',
          panel: '#121A2E',
          'panel-raised': '#16203A',
          border: '#243049',
          'border-subtle': '#1B2540',
          text: '#E8EDF7',
          muted: '#94A3B8',
          dim: '#64748B',
          info: '#3B82F6',
          'info-hover': '#60A5FA',
          critical: '#EF4444',
          'critical-strong': '#DC2626',
          major: '#F97316',
          minor: '#EAB308',
          ok: '#22C55E',
          warn: '#F59E0B',
          neutral: '#64748B',
        },
        // shadcn vars (resolved via CSS HSL triples in index.css)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
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
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      fontFamily: {
        sans: ['Fira Sans', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '8px',
        card: '12px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontSize: {
        micro: ['11px', { lineHeight: '1.4' }],
        '2xs': ['12px', { lineHeight: '1.4' }],
        xs: ['13px', { lineHeight: '1.4' }],
        base: ['14px', { lineHeight: '1.5' }],
        kpi: ['24px', { lineHeight: '1.2' }],
        hero: ['32px', { lineHeight: '1.1' }],
      },
      keyframes: {
        'cr-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        'cr-flash': {
          '0%': { backgroundColor: 'rgba(239,68,68,.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'cr-pulse': 'cr-pulse 2s cubic-bezier(.2,.7,.3,1) infinite',
        'cr-flash': 'cr-flash 400ms cubic-bezier(.2,.7,.3,1) 1',
      },
    },
  },
  plugins: [],
} satisfies Config
