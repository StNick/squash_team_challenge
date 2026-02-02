/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        team: {
          red: "#EF4444",
          blue: "#3B82F6",
          green: "#22C55E",
          yellow: "#EAB308",
          purple: "#A855F7",
          orange: "#F97316",
          pink: "#EC4899",
          teal: "#14B8A6",
        },
      },
    },
  },
  plugins: [],
};
