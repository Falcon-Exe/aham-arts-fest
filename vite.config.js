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
          /* 🧭 HTML & navigation — always try network first */
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
            },
          },

          /* 📊 Google Sheets / CSV — NEVER cache */
          {
            urlPattern: ({ url }) => url.pathname.endsWith(".csv"),
            handler: "NetworkOnly",
          },

          /* 🖼️ Images — cache safely */
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },

      manifest: {
        name: "HAMARTIA",
        short_name: "HAMARTIA",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#913831",
        background_color: "#ffffff",

        icons: [
          {
            src: "./pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
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
        ],
      },
    }),
  ],
});