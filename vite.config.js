import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Чтобы работало через Docker
    proxy: {
      '/api': {
        target: 'https://cue2a.spdrm.ru',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})