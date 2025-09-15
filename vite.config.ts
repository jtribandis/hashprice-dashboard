import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/hashprice-dashboard/', // <-- EXACT GitHub repo name, with slashes
  resolve: { alias: { '@': '/src' } }
})


