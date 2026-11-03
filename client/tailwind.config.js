/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Enterprise light theme
        primary:    '#1A56DB',
        'primary-hover': '#1648C0',
        surface:    '#FFFFFF',
        'surface-2': '#F8FAFC',
        canvas:     '#F8FAFC',
        border:     '#E2E8F0',
        'text-primary':   '#0F172A',
        'text-secondary': '#475569',
        'text-body':      '#334155',
        success:    '#16A34A',
        warning:    '#D97706',
        danger:     '#DC2626',
      },
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        heading: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 12px rgba(26, 86, 219, 0.08)',
      },
      borderRadius: {
        card:   '8px',
        button: '6px',
        input:  '6px',
      },
    },
  },
  plugins: [],
};
