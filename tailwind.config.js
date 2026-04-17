/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#185FA5',
          light: '#2a7bc9',
          dark: '#114478',
        },
        danger: '#DC2626',
        warning: '#F59E0B',
        success: '#10B981',
        neutral: {
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          800: '#1F2937',
          900: '#111827',
        }
      }
    },
  },
  plugins: [],
}