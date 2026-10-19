/** @type {import('tailwindcss').Config} */
function withOpacity(varName) {
  return ({ opacityValue }) =>
    opacityValue !== undefined
      ? `rgb(var(${varName}) / ${opacityValue})`
      : `rgb(var(${varName}))`;
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        // Backed by CSS variables (see src/index.css) rather than static
        // hex, so the Settings tab's color pickers can change these live,
        // app-wide, without a rebuild — a plain hex value here could only
        // ever be changed at build time.
        brand: {
          200: withOpacity('--brand-200'),
          300: withOpacity('--brand-300'),
          400: withOpacity('--brand-400'),
          500: withOpacity('--brand-500'),
          600: withOpacity('--brand-600'),
        },
        accent: {
          300: withOpacity('--accent-300'),
          400: withOpacity('--accent-400'),
          500: withOpacity('--accent-500'),
        },
      },
    },
  },
  plugins: [],
};
