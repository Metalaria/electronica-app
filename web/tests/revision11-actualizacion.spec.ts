// Fourth independent review of 0.11: the app's REAL modules in Node (tests/actualizacion/: a loader that compiles the
// `.svelte.ts` modules, a fake browser, a fake GitHub), in child processes:
//   - upgrade from 0.10.1 store by store (the same items, the same hashes, no writes on load but the planned
//     migrations), two devices synchronising across the update and back to 0.10.1 (escenario.ts; the 0.10.1 source is
//     extracted from git, read only);
//   - damaged stored data in every key the app stores — the stores, `sinc-estado`, `sinc-marcas`, the settings —: the
//     app loads, reads every store and synchronises without throwing (datos-rotos.ts).
//   0.12: the same upgrade from 0.11.0 data too, a day studied on an updated and an old device (the daily progress
//   summed across devices), and the backup made and imported back over damaged data.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11-actualizacion.spec.ts
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WEB = fileURLToPath(new URL('..', import.meta.url));

function ejecutar(args: string[], tiempo: number, tauri = false): Promise<string> {
  return new Promise((ok, mal) => {
    const env = { ...process.env, EPA_TAURI: tauri ? '1' : '' };
    execFile(process.execPath, args, { cwd: WEB, env, maxBuffer: 64 * 1024 * 1024, timeout: tiempo }, (e, salida, errores) => {
      if (e) return mal(new Error(`${e.message}\n${errores}`));
      ok(salida.trim().split('\n').at(-1) ?? '');
    });
  });
}

// (each on a browser's storage and on the Tauri path — the plugin-store's IPC, as on desktop and Android: fifth review)
for (const plataforma of ['navegador', 'tauri'] as const) {
  for (const vieja of ['0.10.1', '0.11.0'] as const)
    test.describe(`actualización desde la ${vieja} y vuelta atrás · ${plataforma}`, () => {
      test('almacén por almacén, y dos dispositivos que se actualizan y vuelven: sin commits ni lápidas de más, convergen', async () => {
        test.setTimeout(900_000);
        const args = ['--experimental-transform-types', '--no-warnings', 'tests/actualizacion/escenario.ts', ...(plataforma === 'tauri' ? ['tauri'] : []), vieja];
        const r = JSON.parse(await ejecutar(args, 880_000)) as { omitido?: string; problemas: string[] };
        test.skip(!!r.omitido, r.omitido);
        expect(r.problemas).toEqual([]);
      });
    });

  test.describe(`datos guardados dañados · ${plataforma}`, () => {
    test('cada clave con valores mal formados: la aplicación carga, lee y sincroniza sin fallar', async () => {
      test.setTimeout(900_000);
      const problemas: string[] = [];
      for (let v = 0; v < 11; v++) {
        const r = JSON.parse(await ejecutar(['--no-warnings', '--import', './tests/actualizacion/registrar.mjs', 'tests/actualizacion/datos-rotos.ts', String(v)], 120_000, plataforma === 'tauri')) as {
          problemas: string[];
        };
        problemas.push(...r.problemas.map((p) => `variante ${v}: ${p}`));
      }
      expect(problemas).toEqual([]);
    });
  });
}
