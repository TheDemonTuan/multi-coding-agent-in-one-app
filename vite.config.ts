import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import fs from 'fs';

// Plugin to copy preload.cjs directly (bypass Vite transformation)
function copyPreloadPlugin() {
  return {
    name: 'copy-preload',
    apply: 'serve',
    buildStart() {
      const srcPath = path.join(__dirname, 'src/electron/preload.cjs');
      const destPath = path.join(__dirname, 'dist-electron/preload/preload.cjs');
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      console.log('[copy-preload] ✓ Copied preload.cjs');
    },
  };
}

export default defineConfig({
  define: {
    'process.env': {},
  },
  plugins: [
    react(),
    copyPreloadPlugin(),
    electron([
      {
        entry: 'src/electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'node-pty'],
              output: {
                format: 'cjs',
                entryFileNames: 'main.js',
              },
            },
          },
        },
        target: 'electron-main',
        noBundle: true,
      },
      {
        entry: 'src/electron/preload.cjs',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
