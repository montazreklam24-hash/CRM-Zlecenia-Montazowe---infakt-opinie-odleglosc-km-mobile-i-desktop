import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Relatywne ścieżki dla subdomeny
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Wyczyść dist przed buildem (wyłączone - może powodować EPERM na Windows)
    emptyOutDir: false,
    rollupOptions: {
      output: {
        // Hashe z małymi literami (hex: 0-9, a-f)
        hashCharacters: 'hex',
        entryFileNames: 'assets/app.[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks: {
          vendor: ['react', 'react-dom'],
          leaflet: ['leaflet', 'react-leaflet'],
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        // Proxy przekierowuje /api/jobs.php na http://localhost/api/jobs.php
        // Nie przepisuj ścieżki - zostaw /api
      }
    }
  }
});