import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    port: Number(process.env.FRONTEND_MOBX_PORT || 5174),
    fs: {
      allow: [".."],
    },
  },
});
