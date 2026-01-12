import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./", // 🔴 REQUIRED FOR PWA + NETLIFY

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      devOptions: {
        enabled: false, // 🔴 PREVENT DEV CACHE IN PROD
      },

      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },

      manifest: {
        name: "AHAM Arts Fest",
        short_name: "AHAM",
        start_url: "./", // 🔴 IMPORTANT
        scope: "./",
        display: "standalone",
        theme_color: "#913831",
        background_color: "#ffffff",

        icons: [
          {
            src: "./pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "./pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "./pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
