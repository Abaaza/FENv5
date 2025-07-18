import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    define: {
      // Ensure environment variables are replaced during build
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:5000/api'),
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(env.VITE_CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud'),
    },
    optimizeDeps: {
      exclude: ['convex/_generated/api']
    }
  }
})