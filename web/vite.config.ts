import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on the LAN so phones on the same Wi-Fi can join a game.
    host: true,
    proxy: { '/api': API },
  },
})
