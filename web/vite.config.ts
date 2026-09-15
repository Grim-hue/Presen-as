import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react()],
  // Read from package.json at build time so the version shown can never drift
  // from the bundle actually being served.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: {
    port: 5273,
    // The API listens on 8280 in development; see LOCAL_DEV.md for why not 8080.
    // Proxying keeps the browser on one origin, so the session cookie is first
    // party and SameSite=Strict does not drop it.
    proxy: { '/api': { target: 'http://localhost:8280', changeOrigin: true } }
  }
})
