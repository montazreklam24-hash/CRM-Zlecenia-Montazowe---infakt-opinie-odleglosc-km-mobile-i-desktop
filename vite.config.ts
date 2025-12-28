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
    host: '0.0.0.0',
    port: 3000,
    strictPort: true, // Wywalaj się, jeśli port zajęty - nie skacz na 3001/3002
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
});