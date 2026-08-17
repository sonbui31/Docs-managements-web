import { defineConfig, loadEnv } from "vite";
import { default as react } from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react],
    server: {
      port: Number(env.VITE_DEV_PORT ?? 5173),
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET ?? "http://localhost:3000",
          changeOrigin: true
        }
      }
    }
  };
});
