import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const API_PORT = process.env.CONVX_API_PORT || "7331";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": `http://localhost:${API_PORT}`,
    },
  },
  build: {
    outDir: "../src/convx_ai/web",
    emptyOutDir: true,
  },
});
