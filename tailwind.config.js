/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sonic-orange': '#FF5F1F',
        'sonic-dark': '#1A1A1A',
        'sonic-darker': '#121212',
        'sonic-light-orange': '#FF8A47',
        'sonic-gray': '#2A2A2A',
      },
      boxShadow: {
        'neomorphic': '0 4px 8px rgba(0, 0, 0, 0.3), inset 1px 1px 1px rgba(255, 255, 255, 0.07)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
} 