/** @type {import('tailwindcss').Config} */
export default {
  // The house convention: an attribute on <html>, not a class, matching survey-suite.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        side: 'var(--side)',
        card: 'var(--card)',
        elev: 'var(--elev)',
        line: { DEFAULT: 'var(--line)', soft: 'var(--line2)' },
        fg: {
          DEFAULT: 'var(--fg2)',
          strong: 'var(--fg)',
          muted: 'var(--fg3)',
          soft: 'var(--fg4)',
          faint: 'var(--fg5)'
        },
        accent: {
          DEFAULT: 'var(--acc)',
          fg: 'var(--btnfg)',
          bg: 'var(--accbg)',
          line: 'var(--accln)',
          wash: 'var(--accwash)'
        },
        ok: { DEFAULT: 'var(--okfg)', bg: 'var(--okbg)', line: 'var(--okln)' },
        warn: { DEFAULT: 'var(--wnfg)', bg: 'var(--wnbg)', line: 'var(--wnln)' },
        danger: { DEFAULT: 'var(--dnfg)', bg: 'var(--dnbg)', line: 'var(--dnln)' },
        info: { DEFAULT: 'var(--infg)', bg: 'var(--inbg)', line: 'var(--inln)' },
        field: 'var(--field)',
        brand: 'var(--brand)'
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      borderRadius: { DEFAULT: '6px', md: '8px', lg: '10px' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(7px)' }, to: { opacity: '1', transform: 'none' } },
        // The centred variant carries the -50%/-50% itself. An animation sets
        // transform for the whole life of the element under fill-mode both, so a
        // plain rise silently overrides the translate utilities that centre a modal.
        riseCentred: {
          from: { opacity: '0', transform: 'translate(-50%, calc(-50% + 7px))' },
          to: { opacity: '1', transform: 'translate(-50%, -50%)' }
        },
        grow: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        // The navigation column arriving from the edge it lives on at every other width.
        slideIn: { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        shim: { to: { backgroundPosition: '-200% 0' } }
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.22,1,.36,1) both',
        'rise-centred': 'riseCentred .5s cubic-bezier(.22,1,.36,1) both',
        grow: 'grow .85s cubic-bezier(.22,1,.36,1) both',
        'slide-in': 'slideIn .3s cubic-bezier(.22,1,.36,1) both',
        shim: 'shim 1.5s linear infinite'
      }
    }
  },
  plugins: []
}
