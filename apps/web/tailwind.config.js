/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'stratsight-dark': '#1B3A2D',
        'stratsight-medium': '#2E7D52',
        'stratsight-light': '#E8F5E9',
        'stratsight-gold': '#C9A84C',
      }
    },
  },
  plugins: [],
}