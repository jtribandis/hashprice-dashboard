import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // MUST match your repo name (with trailing slash)
  base: '/hashprice-dashboard/',
  resolve: { alias: { '@': '/src' } },
})
