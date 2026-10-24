import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative Pfade: Die App läuft so unter jeder GitHub-Pages-Adresse,
  // egal wie das Repository heißt.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Parkplatz-Kontrolle',
        short_name: 'Parkplatz',
        description: 'Stellflächen-Kontrolle für den Parkplatzdienst',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f5f5',
        theme_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    // Feste Zeitzone, damit die Tests zur Zeitumstellung überall gleich laufen
    // (auch auf GitHub, dort ist sonst UTC eingestellt).
    env: { TZ: 'Europe/Berlin' },
  },
})
