import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';

// The app version (web/src/lib/sincronizacion/version-app.ts): the one of tauri.conf.json, which CI sets from the tag.
const confTauri = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const versionApp: string = confTauri.version;
// The updater's public key (0.12, web/src/lib/sincronizacion/actualizador.ts): while it is still the placeholder,
// the desktop app treats the automatic update as unavailable and keeps the «Versión nueva» notice with the link.
const claveActualizador: string = confTauri.plugins?.updater?.pubkey ?? '';

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
  define: { __VERSION_APP__: JSON.stringify(versionApp), __CLAVE_ACTUALIZADOR__: JSON.stringify(claveActualizador) },
  // The simulator's worker is an ES module (it imports the ngspice factory); loaded only on demand.
  worker: { format: 'es' },
  build: {
    target: ['es2021', 'chrome105', 'safari15'],
    chunkSizeWarningLimit: 900,
    sourcemap: false,
  },
});
