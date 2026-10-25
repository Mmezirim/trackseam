import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // jsPDF is large; the app ships inside the native bundle, so one chunk is fine.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3002,
    proxy: {
      '/api': 'https://trackseam.onrender.com/'
    }
  }
})
