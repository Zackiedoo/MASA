import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standard Vite + React config. Output goes to /dist, which Vercel serves.
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split heavy vendor libs so the first paint (Home) stays light.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/database', 'firebase/storage'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
