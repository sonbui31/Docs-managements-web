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
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
            if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
            if (id.includes("mermaid") || id.includes("cytoscape") || id.includes("dagre")) return "vendor-diagrams";
            return undefined;
          }
        }
      }
    }
  };
});
