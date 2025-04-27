import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        // Optionnel : pour avoir le support du JSX directement
        icon: true,
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 4001, // ou un autre port de ton choix
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
