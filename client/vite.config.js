import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Forward API calls and uploaded images to the Express server
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
    },
  },
});
