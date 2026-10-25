// The app's version, fixed at build time by vite.config.ts from src-tauri/tauri.conf.json (which
// web/scripts/version-ci.mjs sets from the tag vX.Y.Z before a release build), so the web code and the
// installers always agree.

declare const __VERSION_APP__: string;

export const VERSION_APP: string = typeof __VERSION_APP__ === 'string' ? __VERSION_APP__ : '0.0.0';
