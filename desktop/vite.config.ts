import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api to the Fastify backend so the frontend can use
// a relative base URL. `vite preview` needs the same proxy to test a
// production build locally.
const apiProxy = {
  "/api": {
    target: process.env.VITE_BACKEND_URL ?? "http://localhost:4000",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
  build: { target: "es2020", chunkSizeWarningLimit: 1200 },
});
