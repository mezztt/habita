import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Habita · by Mezztt
export default defineConfig({
  plugins: [react()],
  server: { port: 5179 },
  preview: { port: 5179 },
})
