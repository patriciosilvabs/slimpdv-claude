import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

import fs from "fs";

// https://vitejs.dev/config/
// Sequential version from version.json + build timestamp for cache busting
const versionFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, "version.json"), "utf-8"));
const BUILD_VERSION = `v${versionFile.version}`;

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'slim - Sistema para Restaurante',
        short_name: 'slim',
        description: 'Sistema completo de gestão para restaurantes com controle de pedidos, mesas, estoque e impressão térmica',
        theme_color: '#1a9cb0',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/?source=pwa',
        scope: '/',
        id: '/slim-pdv',
        categories: ['business', 'food', 'productivity'],
        lang: 'pt-BR',
        dir: 'ltr',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Mesas',
            short_name: 'Mesas',
            description: 'Gerenciar mesas do restaurante',
            url: '/tables?source=shortcut',
            icons: [{ src: 'shortcut-tables.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Balcão',
            short_name: 'Balcão',
            description: 'Pedidos de balcão e delivery',
            url: '/counter?source=shortcut',
            icons: [{ src: 'shortcut-counter.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Cozinha (KDS)',
            short_name: 'KDS',
            description: 'Display da cozinha',
            url: '/kds?source=shortcut',
            icons: [{ src: 'shortcut-kds.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Configurações',
            short_name: 'Config',
            description: 'Configurações do sistema',
            url: '/settings?source=shortcut',
            icons: [{ src: 'shortcut-settings.png', sizes: '192x192', type: 'image/png' }]
          }
        ],
        share_target: {
          action: '/share-receiver',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'files',
                accept: ['image/*', 'text/*', 'application/pdf']
              }
            ]
          }
        },
        screenshots: [
          {
            src: 'screenshots/tables-wide.png',
            sizes: '1280x736',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Gerenciamento de Mesas'
          },
          {
            src: 'screenshots/kds-wide.png',
            sizes: '1280x736',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Kitchen Display System'
          },
          {
            src: 'screenshots/tables-narrow.png',
            sizes: '768x1344',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mesas no Mobile'
          }
        ],
        prefer_related_applications: false
      },
    workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB limit
        importScripts: ['custom-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Do NOT use navigateFallback — it serves stale HTML after deploys,
        // causing chunk hash mismatches. Always fetch navigation from network.
        navigateFallback: null,
        runtimeCaching: [
          {
            // Navigation requests: always try network first so users get
            // fresh HTML (with new chunk hashes) after every deploy.
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation-cache',
              networkTimeoutSeconds: 5,
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.*/i,
            handler: 'NetworkOnly',
            method: 'POST',
            options: { cacheName: 'edge-functions-bypass' }
          },
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly',
            method: 'POST',
            options: {
              backgroundSync: {
                name: 'supabase-post-queue',
                options: {
                  maxRetentionTime: 24 * 60 // 24 hours in minutes
                }
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly',
            method: 'PATCH',
            options: {
              backgroundSync: {
                name: 'supabase-patch-queue',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly',
            method: 'DELETE',
            options: {
              backgroundSync: {
                name: 'supabase-delete-queue',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*supabase\.co\/auth\/v1\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
}));
