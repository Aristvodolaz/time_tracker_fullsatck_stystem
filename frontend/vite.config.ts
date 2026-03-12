import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3021,
    host: true,
    // Проксируем /api на бэкенд, чтобы запросы отчёта и скана доходили без VITE_API_BASE
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE
          ? new URL(process.env.VITE_API_BASE).origin
          : 'http://localhost:3020',
        changeOrigin: true,
      },
    },
  },
})
