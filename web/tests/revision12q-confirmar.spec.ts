// Second independent review of the 0.12 «platform» block: tauri-plugin-dialog, added in 0.12 for the backup's
// save/open dialogs (src-tauri/src/lib.rs), also injects a script into every page on desktop
// (tauri-plugin-dialog 2.8.4 src/lib.rs `init`: js_init_script(init-iife.js), not on Android) that replaces
// window.alert and window.confirm. Its confirm is an *async* function: it returns a Promise, which is always truthy,
// so `if (!confirm('…')) return;` never returns, and the destructive action runs without asking
// (PaginaProtoboard.svelte `quitar`: «¿Borrar «…»?»; EditorEsquemas.svelte `nuevo`: «¿Empezar un circuito nuevo? …
// se perderá»). And the webview has no dialog:* permission (capabilities/default.json), so the dialog it tries to
// show is refused anyway (tauri 2.12.4 webview/mod.rs: plugin commands need an ACL match).
// This spec injects the plugin's own script (read from the cargo registry, the exact file the app embeds) and a
// minimal Tauri IPC that refuses plugin:dialog|* as the release build does (or, once capabilities grant
// dialog:allow-message, opens the box and the reader answers «Cancelar»), then deletes a saved breadboard.
// Fixed (0.12 fix round 2): both confirmations use the app's own dialog (src/lib/confirmar.ts, role=alertdialog), so
// the injected window.confirm is never called. Adapted: the reader answers «Cancelar» in that dialog (and Escape),
// the breadboard stays, and only its «Borrar» deletes it; no native dialog and no plugin:dialog call at all.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12q.config.ts
import { test, expect, type Browser } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function scriptDelPlugin(): string {
  const registro = path.join(os.homedir(), '.cargo', 'registry', 'src');
  for (const indice of fs.existsSync(registro) ? fs.readdirSync(registro) : []) {
    const f = path.join(registro, indice, 'tauri-plugin-dialog-2.8.4', 'src', 'init-iife.js');
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  }
  return '';
}
const INIT_DIALOGO = scriptDelPlugin();

/** Whether the app's capabilities let the webview open a native message box (dialog:allow-message or dialog:default). */
function mensajePermitido(): boolean {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'src-tauri', 'capabilities');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .some((f) => {
      const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { platforms?: string[]; permissions?: (string | { identifier: string })[] };
      const escritorio = !c.platforms || c.platforms.includes('windows') || c.platforms.includes('macOS');
      return escritorio && (c.permissions ?? []).some((p) => ['dialog:allow-message', 'dialog:default'].includes(typeof p === 'string' ? p : p.identifier));
    });
}
const MENSAJE_PERMITIDO = mensajePermitido();

async function contexto(browser: Browser, conPlugin: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    }
  });
  if (conPlugin) {
    // the desktop app's IPC as far as this needs: the store is refused (the app falls back to localStorage) and
    // so is the dialog plugin, with release Tauri's message (no dialog:* permission)
    await ctx.addInitScript((mensajePermitido) => {
      const w = window as unknown as Record<string, unknown>;
      const llamadas: string[] = [];
      w.__llamadas = llamadas;
      w.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          llamadas.push(cmd);
          // with the permission granted, the native box opens and the reader answers «Cancelar»
          if (cmd === 'plugin:dialog|message' && mensajePermitido) return 'Cancel';
          if (cmd.startsWith('plugin:')) throw `Command ${cmd} not allowed by ACL`;
          return null;
        },
        transformCallback: () => Math.floor(Math.random() * 1e9),
        unregisterCallback: () => {},
      };
    }, MENSAJE_PERMITIDO);
    await ctx.addInitScript({ content: INIT_DIALOGO });
  }
  const page = await ctx.newPage();
  return { ctx, page };
}

for (const conPlugin of [false, true]) {
  test(`Protoboard: «Borrar» un montaje y no confirmarlo lo deja como estaba (${conPlugin ? 'app de escritorio, con tauri-plugin-dialog' : 'navegador'})`, async ({ browser }) => {
    expect(INIT_DIALOGO, 'init-iife.js de tauri-plugin-dialog 2.8.4 en el registro de cargo').toContain('window.confirm');
    const { ctx, page } = await contexto(browser, conPlugin);
    // the reader answers «Cancelar» to any confirmation the page manages to show
    const preguntas: string[] = [];
    page.on('dialog', (d) => {
      preguntas.push(d.message());
      void d.dismiss();
    });
    await page.goto('./#/protoboard');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/#\/protoboard\/.+/);
    await page.getByRole('button', { name: /Mis montajes|Montajes/ }).click();
    const lista = page.getByRole('region', { name: 'Mis montajes' });
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    await lista.getByRole('button', { name: 'Borrar' }).click();
    // the app asks in its own dialog; the reader answers «Cancelar»
    const dialogo = page.getByRole('alertdialog', { name: '¿Borrar «Montaje nuevo»?' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(1000);
    // not confirmed: the saved breadboard must still be there
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    // Escape is «Cancelar» too
    await lista.getByRole('button', { name: 'Borrar' }).click();
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    // only the dialog's «Borrar» deletes it
    await lista.getByRole('button', { name: 'Borrar' }).click();
    await dialogo.getByRole('button', { name: 'Borrar' }).click();
    await expect(lista.getByRole('listitem')).toHaveCount(0);
    // no native dialog, and (desktop) not a single call to the dialog plugin
    expect(preguntas).toEqual([]);
    if (conPlugin) {
      const llamadas = await page.evaluate(() => (window as unknown as { __llamadas: string[] }).__llamadas);
      expect(llamadas.filter((c) => c.startsWith('plugin:dialog|'))).toEqual([]);
    }
    await ctx.close();
  });
}
