import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Relatywne ścieżki dla subdomeny
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Wyczyść dist przed buildem
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Stałe nazwy plików - małe litery, bez hashów z wielkimi literami
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
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
        target: 'http://localhost/crm-api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});