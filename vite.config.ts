import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // DEMO_ARQUIVO_UNICO=1 gera um único JS (usado para publicar a demonstração, junto com VITE_DEMO=1)
  build: process.env.DEMO_ARQUIVO_UNICO ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker próprio (src/sw.ts) — necessário para tratar o Web Push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Marquez CRM',
        short_name: 'Marquez',
        description: 'CRM da agência Marquez: contatos, leads, clientes e cursos',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0c0b10',
        theme_color: '#0c0b10',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
})
