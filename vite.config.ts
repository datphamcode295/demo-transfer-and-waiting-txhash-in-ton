import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import Terminal from "vite-plugin-terminal";
// https://vitejs.dev/config/

export default defineConfig({
  plugins: [react()],
  publicDir: "./public",
  // @ts-ignore
  base: process.env.GH_PAGES ? "/demo-wait-tx/" : "./",
  server: {
    fs: {
      allow: ["../sdk", "./"],
    },
  },
});
