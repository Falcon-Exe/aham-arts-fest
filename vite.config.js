import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./", // 🔴 REQUIRED FOR PWA + NETLIFY

  plugins: [
    react(),
   VitePWA({
      registerType: "prompt", // 🔔 enables update prompt

      devOptions: {
        enabled: false,
      },

workbox: {
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: false,
  navigateFallback: "/offline.html",

  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  ],
},

      manifest: {
        name: "AHAM Arts Fest",
        short_name: "AHAM",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#913831",
        background_color: "#ffffff",

        icons: [
          {
            src: "./pwa-192x192.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          // {
          //   src: "./pwa-192x192.png",
          //   sizes: "192x192",
          //   type: "image/png",
          // },
          {
            src: "./pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          // {
          //   src: "./pwa-192x192.png",
          //   sizes: "512x512",
          //   type: "image/png",
          //   purpose: "maskable",
          // },
        ],
      },
    }),
  ],
});