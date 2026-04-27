import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // During development, forward /api/* to the FastAPI server
      '/api': 'http://localhost:8000',
    },
  },
})
