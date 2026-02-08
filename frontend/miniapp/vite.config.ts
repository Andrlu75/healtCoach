import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          'vendor-data': [
            '@tanstack/react-query',
            'axios',
          ],
          'vendor-ui': [
            'framer-motion',
            'lucide-react',
          ],
          'chart': ['recharts'],
        },
      },
    },
  },
})
