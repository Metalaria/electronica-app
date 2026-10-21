#!/usr/bin/env node
// Runs the Tauri CLI for this layout: the web app lives in web/ and the Rust shell in ../src-tauri.
// The CLI only looks for tauri.conf.json below the current folder, so it is told where it is.
// Works the same on Windows, macOS and Linux (no shell-specific environment syntax).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.TAURI_APP_PATH ??= path.join(web, '..', 'src-tauri');
process.env.TAURI_FRONTEND_PATH ??= web;

const cli = createRequire(import.meta.url)('@tauri-apps/cli');
cli.run(process.argv.slice(2), 'npm run tauri').catch((err) => {
  cli.logError(err.message);
  process.exit(1);
});
