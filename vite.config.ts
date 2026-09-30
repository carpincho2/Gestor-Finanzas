import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Gestor de Finanzas Flujo',
        short_name: 'Flujo',
        description: 'Gestor de finanzas personales y asistente inteligente',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'main.html'),
      }
    }
  },
  server: {
    open: true,
  }
});
