import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/hashprice-dashboard/v1/',  // <— bump once to v1
  resolve: { alias: { '@': '/src' } }
})
