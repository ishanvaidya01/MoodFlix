/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07070c",
          900: "#0b0b12",
          850: "#101018",
          800: "#16161f",
          700: "#1e1e2a",
        },
        accent: {
          rose: "#ff2d55",
          ember: "#ff6b35",
          gold: "#ffc247",
        },
      },
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "sans-serif"],
      },
      animation: {
        pulseSoft: "pulseSoft 1.6s ease-in-out infinite",
        floatIn: "floatIn 0.5s ease both",
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.04)" },
        },
        floatIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
