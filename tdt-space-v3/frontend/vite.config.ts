import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wails from '@wailsio/runtime/plugins/vite';
import path from 'path';

// Wails-compatible Vite config
// - Port is set by Wails via WAILS_VITE_PORT env var (from Taskfile VITE_PORT)
// - Output goes to dist/ (relative to this frontend/ dir)
// - Optimized for memory and bundle size
const VITE_PORT = parseInt(process.env.WAILS_VITE_PORT || '9245', 10);
export default defineConfig({
  plugins: [react(), wails('./bindings')],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: VITE_PORT, // Set via Taskfile VITE_PORT → wails3 -port → WAILS_VITE_PORT
    strictPort: true,
    open: false,
  },
  build: {
    outDir: 'dist',
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
