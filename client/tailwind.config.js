/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Enterprise white theme
        primary:    '#1A56DB',
        'primary-hover': '#1648C0',
        surface:    '#F8F9FA',
        'surface-2': '#F4F5F7',
        border:     '#E2E8F0',
        'text-primary':   '#111827',
        'text-secondary': '#6B7280',
        'text-body':      '#374151',
        success:    '#16A34A',
        warning:    '#D97706',
        danger:     '#DC2626',
      },
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        heading: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.08)',
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
