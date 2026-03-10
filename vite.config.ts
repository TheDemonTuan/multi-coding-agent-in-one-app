import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Wails-compatible Vite config
// - Output goes to frontend/dist (Wails reads this)
// - No electron plugins
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 34115, // Wails default dev server port
    strictPort: true,
    open: false,
  },
  build: {
    outDir: 'frontend/dist',
    emptyOutDir: true,
  },
});
