import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
    },
  },
  server: {
    host: true,
    port: 5175,
  },
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
