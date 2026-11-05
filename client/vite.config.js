import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * base defaults to the GitHub Pages project path so `npm run deploy` works
 * out of the box; override with VITE_BASE=/ for other static hosts.
 */
export default defineConfig({
  base: process.env.VITE_BASE || "/MoodFlix/",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
