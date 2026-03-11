import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Wails-compatible Vite config
// - Output goes to frontend/dist (Wails reads this)
// - No electron plugins
// - Optimized for memory and bundle size
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
    target: 'esnext',
    cssTarget: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'xterm-core': ['@xterm/xterm'],
          'xterm-addons': ['@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-search', '@xterm/addon-webgl'],
          'zustand': ['zustand'],
        },
      },
    },
    // Enable source map for debugging but keep it separate
    sourcemap: false,
    // Report bundle size
    reportCompressedSize: true,
    // Chunk size warning limit
    chunkSizeWarningLimit: 1500,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@xterm/xterm', 'zustand'],
  },
});
