/** @type {import('tailwindcss').Config} */
// Colours come from CSS variables (see src/index.css) so the three themes
// (Maroon & Gold, Light, Dark) can be swapped at runtime without rebuilding.
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), bg2: c('bg2'), ink: c('ink'), muted: c('muted'),
        primary: c('primary'), deep: c('deep'), gold: c('gold'), softgold: c('softgold'),
        link: c('link'), ok: c('ok'), warn: c('warn'), bad: c('bad'),
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        glass: '0 8px 30px -12px rgb(var(--c-deep) / 0.25)',
        float: '0 14px 34px -10px rgb(var(--c-primary) / 0.45)',
      },
    },
  },
  plugins: [],
};
