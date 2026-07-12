/**
 * NOTE: This project uses Tailwind CSS v4 with CSS-first configuration —
 * the real token definitions live in `src/App.css` under `@theme`.
 * This file is NOT loaded by the v4 Vite plugin; it only mirrors the
 * palette so editor tooling (IntelliSense) can resolve class names.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bone: "#F0EDE4",
        cream: "#E4DFD1",
        forest: "#0D1F1A",
        "forest-light": "#16281F",
        hunter: "#1F3D33",
        teal: "#3E6259",
        sage: "#7BA88C",
        "sage-bright": "#A8C9B5",
        amber: "#C77B3F",
        "amber-dark": "#D68F55",
        "amber-deep": "#96591F",
        text: "var(--color-text)",
        background: "var(--color-background)",
        live: "var(--color-live)",
        rec: "var(--color-rec)",
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
