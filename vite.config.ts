import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "react", 
      "react-dom", 
      "react-dom/client",
      "react/jsx-runtime", 
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "react-router-dom",
      "next-themes",
    ],
    force: true,
    esbuildOptions: {
      // Ensure single React instance
      define: {
        global: 'globalThis',
      },
    },
  },
}));
