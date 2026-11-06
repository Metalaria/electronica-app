// 1.0 «data» block: the stable data format and its migrations (lib/esquemas.ts, lib/migrar.ts), the synchronisation
// file and the backups of format 2 (fusion.ts, copia-formato.ts), the merge of an exercise's versions
// (lib/union-ejercicios.ts) and the transition from 0.12 on the real engine (tests/motor-real/escenarios10.ts, with
// 0.12.0's engine from git, and the randomized simulation with a 0.12 device updated half-way); in the browser, the
// notice of a migration that failed and the backup of the data from before it.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos10.config.ts tests/datos10.spec.ts
// (the single active tab: tests/datos10-pestanas.spec.ts)
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { canonico, escribirDoc, leerDoc, migradoDe, VERSION_DOC } from '../src/lib/sincronizacion/fusion';
import { leerCopia, VERSION_COPIA } from '../src/lib/sincronizacion/copia-formato';
import { ESQUEMAS, MIGRACIONES } from '../src/lib/esquemas';
import { migrarAlmacen, restaurarAntesDeMigrar } from '../src/lib/migrar';
import { unirEjercicios, type EjercicioUnible } from '../src/lib/union-ejercicios';
import type { Almacen } from '../src/lib/almacen';

const WEB = fileURLToPath(new URL('..', import.meta.url));

/** A storage in memory (values as JSON texts, like localStorage) that can refuse writes of some keys. */
function memoria(inicial: Record<string, unknown> = {}, rechaza: (clave: string) => boolean = () => false): Almacen & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    tipo: 'memoria',
    datos,
    async leer<T>(k: string) {
      const v = datos.get(k);
      return v === undefined ? undefined : (JSON.parse(v) as T);
    },
    async escribir(k: string, v: unknown) {
      if (rechaza(k)) throw new Error(`cuota: ${k}`);
      datos.set(k, JSON.stringify(v));
    },
  };
}

const DIA = '2026-10-20';
const LEGADO_011 = { [DIA]: { pasos: 4, preguntas: 2, secciones: 1, cumplido: true, t: 1_000 } };

test.describe('formato estable · migraciones (Node)', () => {
  test('el registro: cada migración en orden, con su almacén y su formato; toda clave conocida tiene versión', () => {
    for (const m of MIGRACIONES) {
      expect(ESQUEMAS[m.clave], m.clave).toBeGreaterThan(m.de);
      expect(m.formato).toBeLessThanOrEqual(VERSION_DOC);
      expect(typeof m.descripcion).toBe('string');
    }
    expect(ESQUEMAS['progreso-diario']).toBe(2);
    expect(VERSION_DOC).toBe(2);
    expect(VERSION_COPIA).toBe(2);
  });

  test('datos de la 0.12: se migran, se guarda antes la copia del original (una sola vez) y las versiones', async () => {
    const a = memoria({ 'progreso-diario': LEGADO_011, notas: { n: { texto: 'x', t: 1 } } });
    const r = await migrarAlmacen(a);
    expect(r.migradas).toEqual(['progreso-diario']);
    expect(r.fallidas).toEqual([]);
    const dias = JSON.parse(a.datos.get('progreso-diario')!) as Record<string, { pasos: number }>;
    expect(dias[`${DIA}@0`]!.pasos).toBe(4);
    expect(dias[DIA]).toEqual(LEGADO_011[DIA]);
    const copia = JSON.parse((JSON.parse(a.datos.get('copia-migracion')!) as { texto: string }).texto) as { claves: Record<string, unknown> };
    expect(copia.claves).toEqual({ 'progreso-diario': LEGADO_011 });
    const sello = JSON.parse(a.datos.get('esquemas')!) as { almacenes: Record<string, number> };
    expect(sello.almacenes).toEqual(ESQUEMAS);
    // a second start: nothing to do, nothing written
    const antes = new Map(a.datos);
    expect((await migrarAlmacen(a)).migradas).toEqual([]);
    expect(a.datos).toEqual(antes);
  });

  test('una migración que falla deja ese almacén intacto y bloqueado, migra los demás y se puede exportar el original', async () => {
    const g = globalThis as { __epaFallarMigracion?: string[] };
    g.__epaFallarMigracion = ['progreso-diario'];
    try {
      const a = memoria({ 'progreso-diario': LEGADO_011 });
      const r = await migrarAlmacen(a);
      expect(r.migradas).toEqual([]);
      expect(r.fallidas.map((f) => [f.clave, f.tipo])).toEqual([['progreso-diario', 'fallo']]);
      expect(r.bloqueadas.has('progreso-diario')).toBe(true);
      expect(JSON.parse(a.datos.get('progreso-diario')!)).toEqual(LEGADO_011);
      // its version stays 1: the next start tries again
      expect((JSON.parse(a.datos.get('esquemas')!) as { almacenes: Record<string, number> }).almacenes['progreso-diario']).toBe(1);
      g.__epaFallarMigracion = [];
      expect((await migrarAlmacen(a)).migradas).toEqual(['progreso-diario']);
    } finally {
      delete g.__epaFallarMigracion;
    }
  });

  test('sin poder guardar la copia previa no se migra nada; un almacén de una versión más nueva no se toca', async () => {
    const a = memoria({ 'progreso-diario': LEGADO_011 }, (k) => k === 'copia-migracion');
    const r = await migrarAlmacen(a);
    expect(r.migradas).toEqual([]);
    expect(r.fallidas[0]!.error).toMatch(/copia previa/);
    expect(JSON.parse(a.datos.get('progreso-diario')!)).toEqual(LEGADO_011);
    const b = memoria({ 'progreso-diario': LEGADO_011, esquemas: { formato: 'epa-esquemas', app: '9.0.0', almacenes: { 'progreso-diario': 7 } } });
    const rb = await migrarAlmacen(b);
    expect(rb.fallidas.map((f) => f.tipo)).toEqual(['nueva']);
    expect(rb.bloqueadas.has('progreso-diario')).toBe(true);
    expect(JSON.parse(b.datos.get('progreso-diario')!)).toEqual(LEGADO_011);
    expect((JSON.parse(b.datos.get('esquemas')!) as { almacenes: Record<string, number> }).almacenes['progreso-diario']).toBe(7);
  });

  test('la copia previa de otros datos (no los que hay ahora) se sustituye; la de estos mismos se conserva', async () => {
    const a = memoria({ 'progreso-diario': LEGADO_011 });
    await migrarAlmacen(a);
    // other data of 0.12 arrive (a lector.json copied in) and the versions are lost with them
    const otro = { '2026-10-21': { pasos: 9, preguntas: 0, secciones: 0, cumplido: true, t: 2_000 } };
    a.datos.set('progreso-diario', JSON.stringify(otro));
    a.datos.delete('esquemas');
    expect((await migrarAlmacen(a)).migradas).toEqual(['progreso-diario']);
    const copia = JSON.parse((JSON.parse(a.datos.get('copia-migracion')!) as { texto: string }).texto) as { claves: Record<string, unknown> };
    expect(copia.claves['progreso-diario']).toEqual(otro);
  });

  test('ejercicios 1 → 2: cada respuesta sin hora toma la del ejercicio (idempotente)', async () => {
    const e = { 'cap01/e1': { intentos: 1, fallos: 0, resuelto: false, pistas: 0, solucion: false, valores: { a: '1', b: '2' }, vt: { b: 50 }, t: 40 } };
    const a = memoria({ ejercicios: e });
    expect((await migrarAlmacen(a)).migradas).toEqual(['ejercicios']);
    const m = JSON.parse(a.datos.get('ejercicios')!) as typeof e;
    expect(m['cap01/e1'].vt).toEqual({ a: 40, b: 50 });
    a.datos.delete('esquemas');
    expect((await migrarAlmacen(a)).migradas).toEqual([]);
  });

  test('«Restaurar los datos anteriores»: vuelve el original y esta versión no lo migra otra vez (lo deja bloqueado)', async () => {
    const a = memoria({ 'progreso-diario': LEGADO_011 });
    await migrarAlmacen(a);
    expect(await restaurarAntesDeMigrar(a)).toEqual(['progreso-diario']);
    expect(JSON.parse(a.datos.get('progreso-diario')!)).toEqual(LEGADO_011);
    const r = await migrarAlmacen(a);
    expect(r.migradas).toEqual([]);
    expect(r.fallidas.map((f) => f.tipo)).toEqual(['retenida']);
    expect(JSON.parse(a.datos.get('progreso-diario')!)).toEqual(LEGADO_011);
  });

  test('el fichero de sincronización: el formato 1 se lee migrado (y se reescribe), uno más nuevo se rechaza con «actualice»', () => {
    const v1 = { formato: 'epa-sincronizacion', version: 1, id: 'f', actualizado: 5, podado: 0, dispositivos: {}, almacenes: { 'progreso-diario': { [DIA]: { t: 1000, v: LEGADO_011[DIA] } } } };
    const d = leerDoc(JSON.stringify(v1));
    expect(d.version).toBe(2);
    expect(migradoDe(d)).toBe(1);
    expect((d.almacenes['progreso-diario']![`${DIA}@0`] as { t: number; v: { pasos: number } }).v.pasos).toBe(4);
    const d2 = leerDoc(escribirDoc(d));
    expect(migradoDe(d2)).toBeUndefined();
    expect(canonico(d2.almacenes)).toBe(canonico(d.almacenes));
    expect(() => leerDoc(JSON.stringify({ ...v1, version: 3 }))).toThrow(/versión 3 del formato; actualice la aplicación/);
    // a backup of format 1 (0.12) is migrated the same way; the synchronisation file of format 1 too
    const copia1 = { formato: 'epa-copia-seguridad', version: 1, app: '0.12.0', exportado: 9, dispositivo: 'Mac', almacenes: v1.almacenes };
    const conocidos = [{ clave: 'progreso-diario', nombre: 'Progreso diario' }];
    for (const texto of [JSON.stringify(copia1), JSON.stringify(v1)]) {
      const l = leerCopia(texto, conocidos);
      expect((l.copia.almacenes['progreso-diario']![`${DIA}@0`] as { v: { pasos: number } }).v.pasos).toBe(4);
    }
    expect(() => leerCopia(JSON.stringify({ ...copia1, version: 3 }), conocidos)).toThrow(/versión más nueva/);
  });

  test('la unión de dos versiones de un ejercicio: conmutativa, asociativa e idempotente (5000 tríos al azar; resuelto y tapada por sus claves `_r`/`_o`, revisión 10j)', () => {
    let s = 99;
    const rnd = (n: number) => ((s = (s * 1103515245 + 12345) % 2147483648) % n);
    const gen = (): EjercicioUnible => {
      const e: EjercicioUnible & Record<string, unknown> = { intentos: rnd(4), fallos: rnd(3), resuelto: !!rnd(2), pistas: rnd(3), solucion: !!rnd(2), t: rnd(4) };
      if (rnd(2)) {
        e.valores = {};
        e.vt = {};
        // (review 10j: also the keys `_r`/`_o` that hold resuelto/tapada, which may disagree with the fields)
        for (const k of ['e1', 'e2', 'texto', '_r', '_o']) if (rnd(k.startsWith('_') ? 3 : 2) === 1) {
          e.valores[k] = k === '_r' ? ['', '1', '1|2|1|0|1'][rnd(3)]! : k === '_o' ? ['', '1'][rnd(2)]! : `v${rnd(3)}`;
          if (rnd(3)) e.vt[k] = rnd(4);
        }
      }
      if (rnd(2)) e.bien = ['e1', 'e2'].filter(() => rnd(2));
      if (rnd(2)) e.tapada = !!rnd(2);
      if (rnd(3) === 0) e.r = rnd(3);
      return e;
    };
    const u = unirEjercicios;
    for (let i = 0; i < 5000; i++) {
      const [a, b, c] = [gen(), gen(), gen()];
      expect(canonico(u(a, b)), `conmutativa ${i}`).toBe(canonico(u(b, a)));
      expect(canonico(u(u(a, b), c)), `asociativa ${i}`).toBe(canonico(u(a, u(b, c))));
      expect(canonico(u(u(a, b), b)), `idempotente ${i}`).toBe(canonico(u(a, b)));
      // (review 10a) the answers typed after the newer reset survive it: each key of the side with the older reset
      // whose time (vt, else the item's t) is later than the newer reset, unless the other side has it newer
      const [g, p] = (a.r ?? 0) > (b.r ?? 0) ? [a, b] : [b, a];
      if ((g.r ?? 0) !== (p.r ?? 0)) {
        const tk = (e: EjercicioUnible, k: string) => e.vt?.[k] ?? e.t;
        const m = u(a, b);
        for (const [k, v] of Object.entries(p.valores ?? {}))
          if (tk(p, k) > (g.r ?? 0) && !(g.valores && k in g.valores && (tk(g, k) > tk(p, k) || (tk(g, k) === tk(p, k) && g.valores[k]! >= v))))
            expect(m.valores?.[k], `respuesta posterior al reinicio ${i}`).toBe(v);
        // and nothing of before it: failures, hints and the solution are the reset's side's; a real attempt after the
        // reset (the other side's `t` later than it) counts as one, with its verdict when it is the newer (review 10i)
        expect(m.fallos).toBe(g.fallos);
        expect(m.intentos).toBe(Math.max(g.intentos, p.t > (g.r ?? 0) ? 1 : 0));
        if (p.t > (g.r ?? 0) && p.t > g.t) expect(canonico(m.bien ?? null), `bien tras el reinicio ${i}`).toBe(canonico(p.bien ?? null));
      }
      // (review 10j) resuelto and tapada: the newest of their keys `_r`/`_o` (an item without the key: `resuelto` true
      // / `tapada` set at its own t), of the side with the older reset only one later than the newer reset
      if (canonico(a) !== canonico(b)) {
        const marca = (e: EjercicioUnible, k: '_r' | '_o', desde: number) => {
          const v = e.valores && k in e.valores ? e.valores[k]! : k === '_r' ? (e.resuelto ? '1' : undefined) : typeof e.tapada === 'boolean' ? (e.tapada ? '1' : '') : undefined;
          const x = e.vt?.[k] ?? e.t;
          return v === undefined || !(x > desde) ? undefined : { x, v };
        };
        const otra = (g.r ?? 0) !== (p.r ?? 0) ? (g.r ?? 0) : Number.NEGATIVE_INFINITY;
        const m = u(a, b);
        for (const k of ['_r', '_o'] as const) {
          const [x, y] = [marca(g, k, Number.NEGATIVE_INFINITY), marca(p, k, otra)];
          const w = !x ? y : !y ? x : y.x > x.x || (y.x === x.x && y.v > x.v) ? y : x;
          if (k === '_r') expect(m.resuelto, `resuelto ${i} ${canonico([a, b])}`).toBe(!!w?.v.startsWith('1'));
          else expect(m.tapada, `tapada ${i} ${canonico([a, b])}`).toBe(w ? w.v === '1' : undefined);
        }
      }
      // a key without vt counts from its item's time, and every key of a merge has its time
      const m = u(a, b);
      if (canonico(a) !== canonico(b)) for (const k of Object.keys(m.valores ?? {})) expect(m.vt?.[k] ?? 0, `vt de ${k} ${i}`).toBeGreaterThanOrEqual(0);
    }
  });
});

function correrMotor<T>(...args: string[]): Promise<T> {
  return new Promise((ok, mal) => {
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/correr.ts', ...args],
      { cwd: WEB, maxBuffer: 64 * 1024 * 1024, timeout: 1_500_000 },
      (e, salida, errores) => {
        if (e) return mal(new Error(`${e.message}\n${errores}`));
        try {
          ok(JSON.parse(salida.trim().split('\n').at(-1)!) as T);
        } catch {
          mal(new Error(`salida inesperada:\n${salida}\n${errores}`));
        }
      },
    );
  });
}

test.describe('transición desde la 0.12 · motor real', () => {
  test('escenarios t10·1–18 (la 0.12.0 desde git): no escribe el fichero nuevo, sus cambios llegan al actualizarse, la vuelta atrás, copias, la migración', async () => {
    test.setTimeout(600_000);
    const r = await correrMotor<{ nombre: string; ok: boolean; error?: string }[]>('casos', 't10');
    expect(r.length).toBe(18);
    expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
  });

  test('simulación al azar con un dispositivo en la 0.12.0 que se actualiza a mitad (2 × 40 pruebas): sin pérdidas y convergen', async () => {
    test.setTimeout(1_500_000);
    const partes = await Promise.all([correrMotor<{ problemas: string[]; errores: string[]; rechazos012: number }>('azar', '40', '200'), correrMotor<{ problemas: string[]; errores: string[]; rechazos012: number }>('azar', '40', '240')]);
    for (const p of partes) {
      expect(p.problemas).toEqual([]);
      expect(p.errores).toEqual([]);
      // the transition is exercised: the 0.12 device was refused by the file of format 2 many times
      expect(p.rechazos012).toBeGreaterThan(20);
    }
  });
});

// ------------------------------------------------------------------ browser

async function abrir(page: Page, hash: string, datos: Record<string, unknown>, fallar?: string[]): Promise<void> {
  await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await page.goto('/');
  await page.evaluate(async (d) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    await new Promise<void>((ok) => {
      const r = indexedDB.deleteDatabase('epa-copias');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    });
  }, datos);
  if (fallar) await page.addInitScript((f) => ((globalThis as { __epaFallarMigracion?: string[] }).__epaFallarMigracion = f), fallar);
  await page.goto(`/${hash}`);
  await page.reload();
}

test.describe('migración · navegador', () => {
  const VIEJO = JSON.stringify({ [DIA]: { pasos: 4, preguntas: 0, secciones: 0, cumplido: true, t: 1_793_000_000_000 } });

  test('una migración que falla: aviso en español, los datos originales sin tocar ni sobrescribir, y se pueden guardar', async ({ page }) => {
    await abrir(page, '#/', { 'epa:progreso-diario': VIEJO }, ['progreso-diario']);
    const aviso = page.locator('[data-aviso-datos]');
    await expect(aviso).toBeVisible({ timeout: 30_000 });
    await expect(aviso).toContainText('Algunos datos no se han actualizado a esta versión');
    await expect(aviso).toContainText('Progreso diario y racha');
    await expect(aviso).toHaveAttribute('role', 'alert');
    // the app is usable, and nothing is written over the original
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => localStorage.getItem('epa:progreso-diario'))).toBe(VIEJO);
    const [d] = await Promise.all([page.waitForEvent('download'), aviso.getByRole('button', { name: 'Guardar los datos originales' }).click()]);
    const texto = readFileSync((await d.path())!, 'utf8');
    expect(JSON.parse(texto).claves['progreso-diario']).toEqual(JSON.parse(VIEJO));
    const boton = await aviso.getByRole('button', { name: 'Guardar los datos originales' }).boundingBox();
    expect(boton!.height).toBeGreaterThanOrEqual(44);
  });

  test('una migración que falla con una copia previa de OTROS datos: se guardan los datos que hay ahora (revisión 10b)', async ({ page }) => {
    await abrir(page, '#/', { 'epa:progreso-diario': VIEJO });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('epa:esquemas'))).not.toBeNull();
    const OTRO = JSON.stringify({ '2026-10-22': { pasos: 7, preguntas: 0, secciones: 0, cumplido: true, t: 1_793_000_100_000 } });
    await page.evaluate((o) => {
      localStorage.setItem('epa:progreso-diario', o);
      localStorage.removeItem('epa:esquemas');
    }, OTRO);
    await page.addInitScript(() => ((globalThis as { __epaFallarMigracion?: string[] }).__epaFallarMigracion = ['progreso-diario']));
    await page.reload();
    const aviso = page.locator('[data-aviso-datos]');
    await expect(aviso).toBeVisible({ timeout: 30_000 });
    const [d] = await Promise.all([page.waitForEvent('download'), aviso.getByRole('button', { name: 'Guardar los datos originales' }).click()]);
    expect(JSON.parse(readFileSync((await d.path())!, 'utf8')).claves['progreso-diario']).toEqual(JSON.parse(OTRO));
  });

  test('migrada bien: sin aviso; «Datos anteriores a la actualización» en la página de sincronización, y restaurarlos', async ({ page }) => {
    await abrir(page, '#/sincronizacion', { 'epa:progreso-diario': VIEJO });
    const anteriores = page.locator('[data-datos-anteriores]');
    await expect(anteriores).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-aviso-datos]')).toHaveCount(0);
    const migrado = JSON.parse((await page.evaluate(() => localStorage.getItem('epa:progreso-diario')))!) as Record<string, { pasos: number }>;
    expect(migrado[`${DIA}@0`]!.pasos).toBe(4);
    const [d] = await Promise.all([page.waitForEvent('download'), anteriores.getByRole('button', { name: 'Guardarlos en un fichero' }).click()]);
    expect(JSON.parse(readFileSync((await d.path())!, 'utf8')).claves['progreso-diario']).toEqual(JSON.parse(VIEJO));
    await anteriores.getByRole('button', { name: 'Restaurarlos…' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restaurar' }).click();
    await page.waitForLoadState('load');
    await expect(page.locator('[data-aviso-datos]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-aviso-datos]')).toContainText('restaurados a como estaban antes de actualizar');
    expect(await page.evaluate(() => localStorage.getItem('epa:progreso-diario'))).toBe(VIEJO);
  });

  test('un examen ya entregado cuyo borrador quedó (no se pudo borrar): no se retoma ni sustituye ni resucita su resultado (revisión 10b)', async ({ page }) => {
    test.setTimeout(120_000);
    await abrir(page, '#/', {});
    await page.goto('/#/docente/nuevo/examen');
    await page.locator('[data-titulo]').fill('Uno');
    await page.locator('[data-filtro-parte]').selectOption('cap05');
    await page.locator('li[data-entrada="pregunta:cap05-01"] [data-anadir]').click();
    await page.locator('[data-guardar]').click();
    await page.locator('[data-empezar]').click();
    await page.locator('[data-item-examen="1"]').getByRole('radio').first().check();
    await page.locator('[data-entregar]').click();
    await expect(page).toHaveURL(/#\/docente\/resultado\/r[a-z0-9]+$/);
    const rid = page.url().split('/').pop()!;
    const leer = () => page.evaluate(() => ({
      propios: JSON.parse(localStorage.getItem('epa:docente') ?? '{}').propios ?? {},
      resultados: JSON.parse(localStorage.getItem('epa:docente-resultados') ?? '{}').resultados ?? {},
    })) as Promise<{ propios: Record<string, { actualizado: number }>; resultados: Record<string, { inicio: number; t: number; borrado?: number; actualizado: number }> }>;
    const d = await leer();
    const id = Object.keys(d.propios)[0]!;
    const res = d.resultados[rid]!;
    // the draft of that attempt is left behind (its removal failed), with other answers
    const dejar = () => page.evaluate(([i, b]) => localStorage.setItem(`epa:docente-en-curso:${i}`, JSON.stringify(b)), [id, { variante: 0, inicio: res.inicio, respuestas: { 1: { r: '3' } }, actualizado: d.propios[id]!.actualizado }] as const);
    await dejar();
    await page.goto(`/#/docente/examen/${id}/hacer`);
    await expect(page).toHaveURL(new RegExp(`#/docente/resultado/${rid}$`));
    expect(await page.evaluate((i) => localStorage.getItem(`epa:docente-en-curso:${i}`), id)).toBeNull();
    expect((await leer()).resultados[rid]).toEqual(res);
    // deleted later: a draft left behind does not bring it back
    await page.evaluate((r) => {
      const o = JSON.parse(localStorage.getItem('epa:docente-resultados')!);
      const x = o.resultados[r];
      o.resultados[r] = { ...x, items: [], puntos: 0, maximo: 0, actualizado: x.actualizado + 1, borrado: x.actualizado + 1 };
      localStorage.setItem('epa:docente-resultados', JSON.stringify(o));
    }, rid);
    await dejar();
    await page.goto('/#/');
    await page.reload();
    await page.goto(`/#/docente/examen/${id}/hacer`);
    await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}$`));
    expect((await leer()).resultados[rid]!.borrado).toBeTruthy();
    expect(Object.values((await leer()).resultados).filter((x) => !x.borrado)).toEqual([]);
  });

  test('la página de sincronización nombra los dispositivos que faltan por actualizar', async ({ page }) => {
    const ahora = 1_793_000_000_000;
    await abrir(page, '#/sincronizacion', {
      'epa:sinc-estado': {
        doc: 'd',
        dispositivo: 'yo',
        ultima: ahora,
        items: {},
        resumen: {
          recibidos: 0,
          escrito: false,
          creado: false,
          reintentos: 0,
          porAlmacen: {},
          dispositivos: [
            { nombre: 'Mac', ultima: ahora, version: '1.0.0', datos: 2, este: true },
            { nombre: 'Tableta', ultima: ahora - 86_400_000, version: '0.12.0', este: false },
            { nombre: 'Windows', ultima: ahora - 3_600_000, version: '1.0.0', datos: 2, este: false },
          ],
        },
      },
      'epa-credencial:github': ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_'),
      'epa:sinc-ajustes': { repositorio: 'Metalaria/electronica-datos', ruta: 'sincronizacion/datos.json', auto: false },
    });
    const p = page.locator('[data-pendientes]');
    await expect(p).toBeVisible({ timeout: 30_000 });
    await expect(p).toContainText('«Tableta» (versión 0.12.0)');
    await expect(p).not.toContainText('Windows');
  });
});
