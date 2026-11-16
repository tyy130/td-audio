/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#e8e6e1",
        dim: "#8a8a85",
        line: "#2a2a28",
        panel: "#141413",
        acid: "#c3f53c",
        surface: "#0c0c0b",
      },
      fontFamily: {
        display: ['"Archivo Black"', "sans-serif"],
        sans: ["Archivo", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      keyframes: {
        "music-bar": {
          "0%, 100%": { height: "12%" },
          "50%": { height: "90%" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "music-bar": "music-bar 1s ease-in-out infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
