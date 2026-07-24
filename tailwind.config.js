/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F5F6F3',
        surface: '#FFFFFF',
        ink: '#1C2321',
        'ink-soft': '#586066',
        navy: {
          DEFAULT: '#16324F',
          50: '#EAF1F7',
          100: '#CFE0EC',
          200: '#9FC1D9',
          300: '#6FA2C6',
          400: '#3E76A0',
          500: '#204A72',
          600: '#16324F',
          700: '#102541',
          800: '#0B1B30',
          900: '#071222',
        },
        rebar: {
          DEFAULT: '#D9581F',
          50: '#FDEEE6',
          100: '#FAD5C0',
          200: '#F3AE84',
          300: '#EC8748',
          400: '#E36A2C',
          500: '#D9581F',
          600: '#B8451A',
          700: '#8F3514',
        },
        concrete: {
          DEFAULT: '#8B9296',
          50: '#F6F7F6',
          100: '#E7E9E8',
          200: '#D3D7D6',
          300: '#B6BCBC',
          400: '#8B9296',
          500: '#6D7477',
          600: '#565C5F',
          700: '#414648',
        },
        pass: { DEFAULT: '#2F7A4F', 50: '#EAF5EE', 100: '#CDE9D6', 700: '#1E5636' },
        fail: { DEFAULT: '#B23A32', 50: '#FBEAE9', 100: '#F4CAC7', 700: '#7E2822' },
        warnclr: { DEFAULT: '#B8860B', 50: '#FBF3E1', 100: '#F3E0AE' },
        line: '#DBDDD8',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Tahoma', 'Arial', 'sans-serif'],
        display: ['"IBM Plex Sans Arabic"', 'Tahoma', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        grid: 'linear-gradient(#DBDDD8 1px, transparent 1px), linear-gradient(90deg, #DBDDD8 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '24px 24px',
      },
      boxShadow: {
        sheet: '0 1px 2px rgba(11,27,48,0.06), 0 8px 24px -12px rgba(11,27,48,0.18)',
        stamp: '0 0 0 1.5px currentColor inset',
      },
      borderRadius: {
        sheet: '10px',
      },
    },
  },
  plugins: [],
};
