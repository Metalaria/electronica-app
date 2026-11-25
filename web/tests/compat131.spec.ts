// 1.3.1 (qa131-plataforma): data of 1.2.0, 1.2.1 and 1.3.0 opened by 1.3.1, made by those releases' REAL modules (their
// web/src extracted read-only from git) in Node (tests/actualizacion/sesion131.ts, the fake browser of
// tests/actualizacion/navegador.ts): a reader's use of every store (positions, bookmarks, notes, exercises, Repaso,
// calculators, editor and breadboard circuits, lessons with their XP, mastery and achievements, the daily goal,
// courses, «¿Cuánto lo sabía?», a lab, a project stage, teacher courses, exams and a result, the problem of the day).
//   1. its backup imports into a fresh 1.3.1 with nothing discarded, and 1.3.1 exports exactly the same items back
//      (lossless, store by store, item by item);
//   2. two devices, one still on the old release and one on 1.3.1, synchronise through the same file (a fake GitHub)
//      and end with the same data, each keeping what the other made;
//   3. a damaged or partial backup is refused with a clear Spanish message, and nothing changes.
// The storage, its schemas and the synchronisation did not change between 1.2.0 and 1.3.0 (git diff 41a7707..786bc0a
// of lib/almacen.ts, lib/esquemas.ts, lib/migrar.ts, lib/sincronizacion/ and the stores' modules is empty), so these
// releases write format 3 of the backup and of the synchronisation's file.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/compat131.spec.ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WEB = fileURLToPath(new URL('../', import.meta.url));
const HEAD = join(WEB, 'src');
/** The release commits («Versión X.Y.Z…» in git log). */
const VERSIONES: Record<string, string> = { '1.2.0': '41a7707', '1.2.1': 'beb9f51', '1.3.0': '786bc0a' };

function fuente(version: string): string | null {
  const commit = VERSIONES[version]!;
  const dir = join(tmpdir(), `epa-v${version.replace(/\./g, '')}-${commit}`);
  const src = join(dir, 'web', 'src');
  // (cierre14: the extracted release is kept in the system's temporary folder between runs, but its node_modules link
  // points at the checkout that made it — a clone deleted since leaves it dangling: always link this checkout's)
  const enlazar = () => {
    rmSync(join(dir, 'web', 'node_modules'), { force: true });
    symlinkSync(join(WEB, 'node_modules'), join(dir, 'web', 'node_modules'));
  };
  try {
    if (existsSync(join(src, 'lib', 'usuario.svelte.ts'))) {
      enlazar();
      return src;
    }
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['-C', join(WEB, '..'), 'archive', commit, 'web/src', 'web/package.json'], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    enlazar();
    return src;
  } catch {
    return null;
  }
}

interface Salida {
  error?: string;
  exportados?: number;
  descartados?: unknown;
  importado?: unknown;
  sinc?: boolean;
  errorSinc?: string | null;
}

function sesion(raiz: string, lsIn: string, lsOut: string, repo: string, acciones: string[], reloj: number): Salida {
  const texto = execFileSync(process.execPath, ['--no-warnings', '--import', './tests/actualizacion/registrar.mjs', 'tests/actualizacion/sesion131.ts', raiz, lsIn, lsOut, repo, acciones.join(','), String(reloj)], {
    cwd: WEB,
    encoding: 'utf8',
    timeout: 170_000,
  });
  const r = JSON.parse(texto.trim().split('\n').pop()!) as Salida;
  expect(r.error, `sesión ${acciones.join(',')} en ${raiz}`).toBeUndefined();
  return r;
}

type Almacenes = Record<string, Record<string, unknown>>;
const almacenes = (f: string) => (JSON.parse(readFileSync(f, 'utf8')) as { almacenes: Almacenes }).almacenes;

/**
 * The items that differ between two exports, store by store (empty: the same data). `importada`: b is a fresh device
 * that imported a: a deletion mark ({t, x: 1}) of a has nothing to delete there and is not kept (the item stays
 * deleted). `valores`: compare what the reader sees ({v} or the mark), not the wrapper's time — a device's own mirror of
 * a summed day (progreso-diario) is dated by that device.
 */
function diferencias(a: Almacenes, b: Almacenes, o: { importada?: boolean; valores?: boolean } = {}): string[] {
  const r: string[] = [];
  const marca = (v: unknown) => !!v && typeof v === 'object' && 'x' in v && !('v' in v);
  const ver = (v: unknown) => JSON.stringify(o.valores && v && typeof v === 'object' && 'v' in v ? (v as { v: unknown }).v : marca(v) ? 'borrado' : v);
  for (const s of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[s] ?? {};
    const y = b[s] ?? {};
    for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (o.importada && y[id] === undefined && marca(x[id])) continue;
      if (ver(x[id]) !== ver(y[id])) r.push(`${s}/${id}: ${JSON.stringify(x[id])?.slice(0, 120)} ≠ ${JSON.stringify(y[id])?.slice(0, 120)}`);
    }
  }
  return r;
}

const T0 = new Date(2026, 10, 21, 10).getTime();

for (const version of Object.keys(VERSIONES)) {
  test.describe(`datos de la ${version}`, () => {
    test.describe.configure({ mode: 'serial' });
    let dir = '';
    let vieja: string | null = null;
    test.beforeAll(() => {
      vieja = fuente(version);
      dir = mkdtempSync(join(tmpdir(), `epa-compat131-${version}-`));
    });
    test.afterAll(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    test('su copia de seguridad se importa en la 1.3.1 sin descartar nada y vuelve a exportarse igual', () => {
      test.skip(!vieja, `sin las fuentes de la ${version} en git`);
      test.setTimeout(400_000);
      const copia = join(dir, 'copia-vieja.json');
      const r0 = sesion(vieja!, '-', join(dir, 'vieja.json'), '-', [`llenar:${version}`, `exportar:${copia}`], T0);
      const antes = almacenes(copia);
      // every store has something: the fixture is a real use of all of them
      expect(Object.entries(antes).filter(([, v]) => !Object.keys(v).length).map(([k]) => k)).toEqual([]);
      expect(r0.exportados).toBeGreaterThan(100);
      const nueva = join(dir, 'copia-131.json');
      const r1 = sesion(HEAD, '-', join(dir, 'nueva.json'), '-', [`importar:${copia}`, `exportar:${nueva}`], T0 + 3600e3);
      // (leerCopia counts the malformed items per store)
      expect(Object.values((r1.descartados ?? {}) as Record<string, number>).reduce((x, y) => x + y, 0)).toBe(0);
      expect(diferencias(antes, almacenes(nueva), { importada: true })).toEqual([]);
    });

    test('un dispositivo con la versión vieja y otro con la 1.3.1 se sincronizan y acaban con los mismos datos', () => {
      test.skip(!vieja, `sin las fuentes de la ${version} en git`);
      test.setTimeout(500_000);
      const repo = join(dir, 'repo.json');
      const x = join(dir, 'x.json');
      const y = join(dir, 'y.json');
      // X (old release) fills and synchronises first: the file is the old release's
      const rx = sesion(vieja!, '-', x, repo, [`llenar:X${version}`, 'sincronizar'], T0);
      expect([rx.sinc, rx.errorSinc || null]).toEqual([true, null]);
      // Y (1.3.1) fills its own and synchronises: reads X's file, merges, writes
      const ry = sesion(HEAD, '-', y, repo, ['llenar:Y131', 'sincronizar'], T0 + 7200e3);
      expect([ry.sinc, ry.errorSinc || null]).toEqual([true, null]);
      // X, still old, synchronises again (reads 1.3.1's file) and both export
      const cx = join(dir, 'cx.json');
      const cy = join(dir, 'cy.json');
      const rx2 = sesion(vieja!, x, join(dir, 'x2.json'), repo, ['sincronizar', `exportar:${cx}`], T0 + 10800e3);
      expect([rx2.sinc, rx2.errorSinc || null]).toEqual([true, null]);
      sesion(HEAD, y, join(dir, 'y2.json'), repo, ['sincronizar', `exportar:${cy}`], T0 + 14400e3);
      const ax = almacenes(cx);
      const ay = almacenes(cy);
      expect(diferencias(ax, ay, { valores: true })).toEqual([]);
      // each kept what the other made
      const notas = Object.keys(ax.notas ?? {});
      expect(notas.some((k) => k.endsWith(`.X${version}`)) && notas.some((k) => k.endsWith('.Y131'))).toBe(true);
      const docente = JSON.stringify(ax['docente-propios']);
      expect(docente).toContain(`Curso de X${version}`);
      expect(docente).toContain('Curso de Y131');
    });
  });
}

// 2.1 close-out (the cause of this file's flaky first test): a backup whose days complete TODAY's goal, imported on a
// device in use (the learning events' consumers already loaded). Applying the days emits «objetivo cumplido»; with the
// XP ledger still to come, the consumer awarded the day's XP again («+10 XP») and announced achievements the backup
// brings, and the import exported them back re-dated. In the suite the consumers' lazy load usually lost the race (it
// failed 1 in 6–20 runs under load); here it is deterministic. The import now applies the ledger first (copia.ts).
test('una copia con el objetivo de hoy cumplido, importada con los eventos ya en marcha, no vuelve a dar XP ni logros', () => {
  test.setTimeout(400_000);
  const dir = mkdtempSync(join(tmpdir(), 'epa-compat131-hoy-'));
  try {
    const copia = join(dir, 'copia.json');
    sesion(HEAD, '-', join(dir, 'a.json'), '-', ['llenar:H', `exportar:${copia}`], T0);
    const antes = almacenes(copia);
    // (the fixture met today's goal: the day's award and the first achievements are in the backup)
    expect(Object.keys(antes['progreso-xp'] ?? {}).some((k) => k.startsWith('d:'))).toBe(true);
    expect(Object.keys(antes['progreso-logros'] ?? {}).length).toBeGreaterThan(0);
    const nueva = join(dir, 'nueva.json');
    sesion(HEAD, '-', join(dir, 'b.json'), '-', ['consumidores', `importar:${copia}`, `exportar:${nueva}`], T0 + 3600e3);
    const d = diferencias(antes, almacenes(nueva), { importada: true });
    expect(d.filter((x) => /^progreso-(xp|logros)\//.test(x))).toEqual([]);
    expect(d).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('copias dañadas, parciales o ajenas: un mensaje claro en español y nada cambia', () => {
  test.setTimeout(400_000);
  const dir = mkdtempSync(join(tmpdir(), 'epa-compat131-rotas-'));
  try {
    const copia = join(dir, 'buena.json');
    sesion(HEAD, '-', join(dir, 'ls.json'), '-', ['llenar:R', `exportar:${copia}`], T0);
    const texto = readFileSync(copia, 'utf8');
    const casos: [string, string][] = [
      ['cortada', texto.slice(0, Math.floor(texto.length / 2))],
      ['vacía', ''],
      ['ajena', '{"hola": 1}'],
      ['futura', JSON.stringify({ ...JSON.parse(texto), version: 99, app: '9.0.0' })],
      ['binaria', '\u0000\u0001PK\u0003\u0004'],
    ];
    const script = `
      const imp = (p) => import('file://${HEAD}/' + p);
      const Co = await imp('lib/sincronizacion/copia.ts');
      const r = {};
      for (const [n, t] of JSON.parse(process.argv[2])) {
        try { Co.leerFicheroCopia(t); r[n] = 'ACEPTADA'; } catch (e) { r[n] = e.message; }
      }
      console.log(JSON.stringify(r)); process.exit(0);`;
    const f = join(dir, 'rotas.mts');
    writeFileSync(f, `import '${join(WEB, 'tests/actualizacion/navegador.ts')}';\n${script}`);
    const out = execFileSync(process.execPath, ['--no-warnings', '--import', './tests/actualizacion/registrar.mjs', f, JSON.stringify(casos)], { cwd: WEB, encoding: 'utf8', timeout: 60_000 });
    const r = JSON.parse(out.trim().split('\n').pop()!) as Record<string, string>;
    for (const [n] of casos) {
      expect(r[n], n).not.toBe('ACEPTADA');
      // a sentence for the reader, in Spanish, never an engine message («Unexpected token…», «JSON»)
      expect(r[n], n).toMatch(/^[A-ZÁÉÍÓÚÑ¿¡]/);
      expect(r[n], n).not.toMatch(/Unexpected|position|SyntaxError|undefined|JSON\.parse/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
