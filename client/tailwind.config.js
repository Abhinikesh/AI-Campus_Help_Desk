/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:   '#0f172a',
        secondary: '#1e293b',
        accent:    '#3b82f6',
        gold:      '#f59e0b',
        danger:    '#ef4444',
        success:   '#22c55e',
      },
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
