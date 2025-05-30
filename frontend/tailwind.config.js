/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        primary: '#ff6f61',
        accent: '#00d1b2',
        text: '#ffffff',
        'gray-800': '#1a1a1a',
        'gray-700': '#2a2a2a',
        'gray-600': '#3a3a3a',
      },
      fontFamily: {
        'code': ['Fira Code', 'monospace'],
        'ui': ['Inter', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #ff6f61, 0 0 10px #ff6f61, 0 0 15px #ff6f61' },
          '100%': { boxShadow: '0 0 10px #ff6f61, 0 0 20px #ff6f61, 0 0 30px #ff6f61' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'neon-gradient': 'linear-gradient(45deg, #ff6f61, #00d1b2, #ff6f61)',
      },
    },
  },
  plugins: [],
} 