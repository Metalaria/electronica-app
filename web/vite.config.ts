import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Tauri expects a fixed port in development and relative asset paths in the bundle.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte()],
  base: './',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  // The simulator's worker is an ES module (it imports the ngspice factory); loaded only on demand.
  worker: { format: 'es' },
  build: {
    target: ['es2021', 'chrome105', 'safari15'],
    chunkSizeWarningLimit: 900,
    sourcemap: false,
  },
});
