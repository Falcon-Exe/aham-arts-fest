import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
//     VitePWA({
//       registerType: "autoUpdate",
//       injectRegister: "auto",
//       workbox: {
//         cleanupOutdatedCaches: true,
//         skipWaiting: true,
//         clientsClaim: true,
//       },
//       manifest: {
//         name: "AHAM Arts Fest",
//         short_name: "AHAM",
//         start_url: "/",
//         scope: "/",
//         display: "standalone",
// theme_color: "#913831",
// background_color: "#ffffff",
//         icons: [
//           {
//             src: "/pwa-192x192.png",
//             sizes: "192x192",
//             type: "image/png"
//           },
//           {
//             src: "/pwa-512x512.png",
//             sizes: "512x512",
//             type: "image/png"
//           },
          
//         //   {
//         //     src: "/pwa-maskable-512.png",
//         //     sizes: "512x512",
//         //     type: "image/png",
//         //     purpose: "maskable"
//         //   }
//         ]
//       }
//     })
  ]
});

