import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// content/ and contracts/ live at the repo root, outside app/.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
})
