import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3699,
    proxy: {
      '/api': 'http://localhost:3688',
      '/static': 'http://localhost:3688',
      '/oss': 'http://localhost:3688',
    },
  },
})
