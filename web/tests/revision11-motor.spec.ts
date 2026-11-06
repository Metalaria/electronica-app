// The synchronisation engine after the second and third independent reviews of 0.11, on the REAL engine in Node (no
// browser): tests/motor-real/ drives sincronizar.svelte.ts, marcas.ts, github.ts, fusion.ts and guardado.ts of src/ —
// one module graph per device and per browser tab, a fake storage per device, a fake GitHub with 409 on a stale sha —
// and the 0.10 engine (tests/motor-real/v010/) for an 0.10 device. Its scenarios (escenarios.ts: one per finding of
// the second and third reviews, each failed before its fix) and its randomized simulation (azar.ts: three 0.11
// devices with tabs and module memory apart from the storage, an 0.10 device, a fresh install, the storage refusing
// writes, a module that is not atomic, clock skew, interrupted runs, edits during a run, 409s) run in a child Node
// process, since the harness replaces globals (Date.now, fetch, setTimeout) that Playwright itself needs.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11-motor.spec.ts
// By hand (from web/):
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/correr.ts casos [filtro]
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/correr.ts azar <n> [desde]
//   (TRAZA=<n> prints the events of trial n on stderr; TRAZA_ALMACEN=<store> picks the store shown, default «sin»;
//   EPA_SUSTITUIR='src/…/x.ts=/other/x.ts' runs it with another version of a module, to see a scenario fail before
//   its fix)
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { encolar, leerLista, unirListas, MAX_COLA } from '../src/lib/aprendizaje/cola-eventos.ts';
import { REENVIOS_MAXIMOS } from '../src/lib/sincronizacion/fusion.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));

/** Runs the harness's command line; its last output line is the JSON result. */
function correr<T>(...args: string[]): Promise<T> {
  return correrGuion<T>('tests/motor-real/correr.ts', args);
}

/** Runs one of the harness's scripts (with extra environment variables); its last output line is the JSON result. */
function correrGuion<T>(guion: string, args: string[], entorno: Record<string, string> = {}): Promise<T> {
  return new Promise((ok, mal) => {
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', guion, ...args],
      { cwd: WEB, maxBuffer: 64 * 1024 * 1024, timeout: 1_500_000, env: { ...process.env, ...entorno } },
      (e, salida, errores) => {
        if (e) return mal(new Error(`${e.message}\n${errores}`));
        const lineas = salida.trim().split('\n');
        try {
          ok(JSON.parse(lineas.at(-1)!) as T);
        } catch {
          mal(new Error(`salida inesperada:\n${salida}\n${errores}`));
        }
      },
    );
  });
}

// ================================================================== the findings, one by one

test.describe('motor real · escenarios de las revisiones', () => {
  test('cada hallazgo de la segunda y la tercera revisión, en el motor real', async () => {
    test.setTimeout(300_000);
    const r = await correr<{ nombre: string; ok: boolean; error?: string }[]>('casos');
    // second review: 1, 3, 4, 5, 7; third: 1 (eight), 2 (two), 3, 4 (two), 5, 6, 7, 8; fourth: 1 (three), 2, 4; fifth
    // (the Tauri path, loading, two tabs, a full storage): 1 (two), 2, 3, 4, 5; sixth (failed reads, a damaged
    // device entry, edits during aplicar, no base): 1, 2, 3, 4, 5 and the retried load
    expect(r.length).toBeGreaterThanOrEqual(40);
    for (const n of ['r4·1', 'r4·2', 'r4·4', 'r5·1', 'r5·2', 'r5·3', 'r5·4', 'r5·5', 'r6·1', 'r6·2', 'r6·3', 'r6·4', 'r6·5', 'r6 · menor']) expect(r.some((c) => c.nombre.startsWith(n)), n).toBe(true);
    for (const n of ['r2·1', 'r2·3', 'r2·4', 'r2·5', 'r2·7', 'r3·1', 'r3·2', 'r3·3', 'r3·4', 'r3·5', 'r3·6', 'r3·7', 'r3·8'])
      expect(r.some((c) => c.nombre.startsWith(n)), n).toBe(true);
    expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
  });
});

// ================================================================== randomized: devices, tabs, versions and failures

test.describe('motor real · simulación al azar', () => {
  // (1.0: the 0.10 device is now a device on 0.12.0 — its engine from git — updated half-way: tests/motor-real/azar.ts)
  test('tres dispositivos con pestañas, uno con la 0.12 que se actualiza a mitad y una instalación nueva: sin pérdidas, sin resurrecciones, convergen, los commits paran', async () => {
    test.setTimeout(1_500_000);
    // two child processes (seeds 0–39 and 40–79) side by side
    const partes = await Promise.all([correr<Resultado>('azar', '40', '0'), correr<Resultado>('azar', '40', '40')]);
    for (const r of partes) {
      expect(r.problemas).toEqual([]);
      expect(r.conProblemas).toBe(0);
      expect(r.errores).toEqual([]);
      // five devices at most: each settles within a few runs
      expect(r.commitsAsentarMax).toBeLessThanOrEqual(5 * (REENVIOS_MAXIMOS + 3));
    }
  });
});

// ================================================================== sixth review: one Guardado, at random

test.describe('motor real · un Guardado al azar (sexta revisión, x8b/x8c)', () => {
  test('ediciones y borrados en cualquier momento, lecturas y escrituras que fallan, carga que falla y se reintenta: nada se pierde, todo se guarda', async () => {
    test.setTimeout(900_000);
    // guardado-azar.ts on the storage of falsos/almacen-ipc.ts: like Tauri's (values over an IPC) and like
    // localStorage's (texts), ending with a write («escribir») or with what hiding the page does («volcar»); before
    // the sixth review's fixes (300 trials, seed 1): 17, 19, 11 and 87 problems
    const casos = (['tauri', 'navegador'] as const).flatMap((a) => (['escribir', 'volcar'] as const).map((f) => [a, f] as const));
    const r = await Promise.all(
      casos.map(([a, f]) =>
        correrGuion<{ pruebas: number; problemas: string[]; total: number }>('tests/motor-real/guardado-azar.ts', ['200', '1', f], {
          EPA_SUSTITUIR: 'src/lib/almacen.ts=tests/motor-real/falsos/almacen-ipc.ts',
          EPA_ALMACEN: a,
        }),
      ),
    );
    r.forEach((x, i) => {
      expect(x.pruebas, casos[i]!.join(' ')).toBe(200);
      expect(x.problemas, casos[i]!.join(' ')).toEqual([]);
      expect(x.total, casos[i]!.join(' ')).toBe(0);
    });
  });
});

// ================================================================== fourth review, finding 3: the cost of a write

test.describe('motor real · coste de una escritura (biblioteca grande del editor)', () => {
  test('un guardado automático con 2 MB y con 5 MB: por el camino rápido y dentro del presupuesto', async () => {
    test.setTimeout(600_000);
    interface Medida {
      bytes: number;
      escrituras: number[];
      rapidas: number;
      completas: number;
      conOtraPestana: number;
    }
    const r = await correr<Record<string, Medida>>('rendimiento', '200,500');
    const mediana = (x: number[]) => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)]!;
    const m2 = r['200']!;
    const m5 = r['500']!;
    expect(m2.bytes).toBeGreaterThan(1.8e6);
    expect(m5.bytes).toBeGreaterThan(4.5e6);
    // every autosave found the key as this module left it: no merge, no parse of the stored text
    expect(m2.rapidas).toBe(m2.escrituras.length);
    expect(m5.rapidas).toBe(m5.escrituras.length);
    // (before: 0.8–1.8 s and 3–5.6 s per write; budgets with room for a loaded machine)
    expect(mediana(m2.escrituras), JSON.stringify(m2.escrituras)).toBeLessThan(150);
    expect(mediana(m5.escrituras), JSON.stringify(m5.escrituras)).toBeLessThan(400);
    // a write after another tab wrote merges (and keeps that tab's change: checked by the script), still well below
    expect(m2.conOtraPestana).toBeLessThan(800);
  });

  test('lo mismo con un almacenamiento como el de Tauri (valores, sin textos): camino rápido y presupuesto', async () => {
    test.setTimeout(600_000);
    const r = await correr<Record<string, { bytes: number; escrituras: number[]; rapidas: number }>>('rendimiento', '200,500', 'tauri');
    const mediana = (x: number[]) => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)]!;
    for (const [n, m] of Object.entries(r)) expect(m.rapidas, n).toBe(m.escrituras.length);
    // (round 4 on this path: about 75–115 ms and 180–250 ms; the store's own serialisation is included)
    expect(mediana(r['200']!.escrituras), JSON.stringify(r['200']!.escrituras)).toBeLessThan(200);
    expect(mediana(r['500']!.escrituras), JSON.stringify(r['500']!.escrituras)).toBeLessThan(500);
  });
});

interface Resultado {
  pruebas: number;
  problemas: string[];
  conProblemas: number;
  commitsAsentarMax: number;
  errores: string[];
}

// ================================================================== event queue (round 2, finding 10)

test.describe('ronda 2 · 10 · cola de eventos (sin navegador)', () => {
  test('se quedan los más nuevos, en memoria y guardados igual; varias pestañas se unen sin duplicar', () => {
    const cola: { tipo: string; t: number }[] = [];
    let fuera = 0;
    for (let i = 0; i < MAX_COLA + 50; i++) fuera += encolar(cola, { tipo: 'respuesta', t: i });
    expect(fuera).toBe(50);
    expect(cola).toHaveLength(MAX_COLA);
    expect(cola[0]!.t).toBe(50);
    expect(cola.at(-1)!.t).toBe(MAX_COLA + 49);
    const a = [{ tipo: 'respuesta', t: 3 }, { tipo: 'respuesta', t: 1 }];
    const b = [{ tipo: 'respuesta', t: 1 }, { tipo: 'leccion-completada', t: 2 }];
    expect(unirListas([a, b])).toEqual([{ tipo: 'respuesta', t: 1 }, { tipo: 'leccion-completada', t: 2 }, { tipo: 'respuesta', t: 3 }]);
    expect(unirListas([a, b], 2).map((e) => e.t)).toEqual([2, 3]);
    expect(leerLista('[{"tipo":"x","t":1},{"t":2},null,"z"]')).toEqual([{ tipo: 'x', t: 1 }]);
    expect(leerLista('no es json')).toEqual([]);
  });
});
