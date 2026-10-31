// Upgrade from 0.10.1 and back (fourth review), with the app's REAL modules in Node (hooks-svelte.mjs, a fake
// browser: navegador.ts) and a fake GitHub kept in a file between sessions:
//   1. the 0.10.1 code fills every store through its public API (generar.ts);
//   2. store by store, 0.11 reads the same items (same ids, same hashes) as 0.10.1, and writes nothing on load but
//      its planned migrations (comparar.ts);
//   3. two devices X and Y with 0.10.1 synchronise, X edits offline, updates to 0.11 and synchronises, synchronises
//      again, opens everything without changing anything, Y (still 0.10.1) synchronises, X goes back to 0.10.1, Y
//      synchronises (pasada.ts, one process per session): one commit for X's edits and no other, no tombstone but
//      the deleted bookmark's, X's offline edits reach Y, and X and Y end with the same data.
// The 0.10.1 source is extracted from git (commit 8ffa4c6, read only) into the system's temporary folder.
//   node --experimental-transform-types --no-warnings tests/actualizacion/escenario.ts [tauri]   (from web/; prints JSON;
//   `tauri`: every session on the Tauri path — the plugin-store's IPC — as on desktop and Android)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('./', import.meta.url));
export const COMMIT_0101 = '8ffa4c6';

/** The 0.10.1 web/src (extracted once; null without git). */
export function fuente0101(): string | null {
  const dir = join(tmpdir(), `epa-v0101-${COMMIT_0101}`);
  const src = join(dir, 'web', 'src');
  if (existsSync(join(src, 'lib', 'usuario.svelte.ts'))) return src;
  try {
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['-C', join(WEB, '..'), 'archive', COMMIT_0101, 'web/src', 'web/package.json'], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    if (!existsSync(join(dir, 'web', 'node_modules'))) symlinkSync(join(WEB, 'node_modules'), join(dir, 'web', 'node_modules'));
    return src;
  } catch {
    return null;
  }
}

/** Runs one of this folder's scripts with the app loader; its last output line is JSON (or a summary). */
export function script(nombre: string, ...args: string[]): string {
  const salida = execFileSync(process.execPath, ['--no-warnings', '--import', join(AQUI, 'registrar.mjs'), join(AQUI, nombre), ...args], {
    cwd: WEB,
    env: { ...process.env, EPA_TAURI: tauri ? '1' : '' },
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return salida.trim().split('\n').at(-1) ?? '';
}

interface Lectura {
  leido: Record<string, Record<string, string>>;
  valores: Record<string, Record<string, unknown>>;
  escrituras: string[];
  cambiadas: string[];
}
interface Doc {
  almacenes: Record<string, Record<string, { t: number; v?: unknown; x?: 1 }>>;
}

const lapidas = (repo: string): Set<string> => {
  const r = JSON.parse(readFileSync(repo, 'utf8')) as { texto?: string };
  const d = r.texto ? (JSON.parse(r.texto) as Doc) : { almacenes: {} };
  const s = new Set<string>();
  for (const [k, c] of Object.entries(d.almacenes)) for (const [id, e] of Object.entries(c)) if (e.x) s.add(`${k}/${id}`);
  return s;
};

/** Every session as in Tauri (desktop, Android: the plugin-store's IPC, navegador.ts) instead of a browser. */
let tauri = false;

export function escenario(enTauri = false): { omitido?: string; problemas: string[]; pasos: Record<string, unknown>[] } {
  tauri = enTauri;
  const v = fuente0101();
  if (!v) return { omitido: 'no se pudo extraer la 0.10.1 con git', problemas: [], pasos: [] };
  const n = join(WEB, 'src');
  const tmp = mkdtempSync(join(tmpdir(), 'epa-actualizacion-'));
  const f = (x: string) => join(tmp, x);
  const problemas: string[] = [];
  const pasos: Record<string, unknown>[] = [];
  try {
    // 1–2: the stores of 0.10.1, read by 0.10.1 and by 0.11
    script('generar.ts', v, f('fixture.json'));
    script('comparar.ts', v, f('fixture.json'), f('lect-v.json'));
    script('comparar.ts', n, f('fixture.json'), f('lect-n.json'));
    const lv = JSON.parse(readFileSync(f('lect-v.json'), 'utf8')) as Lectura;
    const ln = JSON.parse(readFileSync(f('lect-n.json'), 'utf8')) as Lectura;
    const almacenes = Object.keys(lv.leido);
    if (almacenes.length < 18) problemas.push(`la 0.10.1 solo tiene ${almacenes.length} almacenes`);
    for (const k of almacenes) {
      const a = lv.leido[k]!;
      const b = ln.leido[k] ?? {};
      if (!Object.keys(a).length) problemas.push(`el almacén ${k} quedó vacío en el fichero de la 0.10.1`);
      for (const id of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (a[id] !== b[id]) problemas.push(`${k}/${id}: la 0.10.1 lee ${a[id] ?? '—'}, la 0.11 ${b[id] ?? '—'}`);
    }
    const previstas = new Set(['epa:__prueba', 'epa:progreso-xp', 'epa:dominio', 'epa:sinc-marcas']);
    for (const k of ln.escrituras) if (!previstas.has(k)) problemas.push(`la 0.11 escribe ${k} al cargar`);
    if (lv.cambiadas.length) problemas.push(`la 0.10.1 cambia al cargar: ${lv.cambiadas.join(' ')}`);

    // 3: two devices, the update and going back
    const repo = f('repo.json');
    const sesion = (paso: string, raiz: string, entrada: string, salida: string, acciones: string, sinc: boolean, reloj: number) => {
      const r = JSON.parse(script('pasada.ts', raiz, entrada, salida, repo, acciones, sinc ? '1' : '0', String(reloj))) as {
        ok: unknown;
        error: string;
        commits: number;
      };
      pasos.push({ paso, ...r });
      const tipo = (r as { almacen?: string }).almacen;
      if (tipo !== (tauri ? 'tauri' : 'navegador')) problemas.push(`${paso}: almacenamiento ${tipo}`);
      if (sinc && r.ok !== true) problemas.push(`${paso}: la sincronización falló (${r.error})`);
      return r;
    };
    const commits = (paso: string, r: { commits: number }, esperados: number) => {
      if (r.commits !== esperados) problemas.push(`${paso}: ${r.commits} commits (se esperaban ${esperados})`);
    };
    commits('1 X 0.10.1 sincroniza', sesion('1', v, f('fixture.json'), f('X1.json'), '', true, 1_771_000_000_000), 1);
    sesion('2 Y 0.10.1 sincroniza', v, '-', f('Y1.json'), '', true, 1_772_000_000_000);
    commits('3 Y edita y sincroniza', sesion('3', v, f('Y1.json'), f('Y2.json'), 'editarY', true, 1_773_000_000_000), 1);
    sesion('4 X edita sin conexión', v, f('X1.json'), f('X2.json'), 'editar', false, 1_774_000_000_000);
    const antes = lapidas(repo);
    commits('5 X con la 0.11 sincroniza', sesion('5', n, f('X2.json'), f('X3.json'), '', true, 1_775_000_000_000), 1);
    const nuevas = [...lapidas(repo)].filter((x) => !antes.has(x));
    if (nuevas.join() !== 'marcadores/eq:1') problemas.push(`lápidas nuevas al actualizar: ${nuevas.join(' ') || 'ninguna'} (solo el marcador borrado)`);
    commits('6 X sincroniza otra vez', sesion('6', n, f('X3.json'), f('X4.json'), '', true, 1_776_000_000_000), 0);
    commits('7 X solo mira y sincroniza', sesion('7', n, f('X4.json'), f('X5.json'), 'leer', true, 1_777_000_000_000), 0);
    const x5 = JSON.parse(readFileSync(f('X5.json'), 'utf8')) as Record<string, string>;
    const marcas = JSON.parse(x5['epa:sinc-marcas'] ?? '{}') as { cambios?: Record<string, object>; borrados?: Record<string, object> };
    const conMarcas = [...Object.entries(marcas.cambios ?? {}), ...Object.entries(marcas.borrados ?? {})].filter(([, ids]) => Object.keys(ids).length);
    if (conMarcas.length) problemas.push(`mirar sin cambiar nada deja marcas: ${conMarcas.map(([k]) => k).join(' ')}`);
    commits('8 Y 0.10.1 sincroniza', sesion('8', v, f('Y2.json'), f('Y3.json'), '', true, 1_778_000_000_000), 0);
    commits('9 X vuelve a la 0.10.1', sesion('9', v, f('X5.json'), f('X6.json'), '', true, 1_779_000_000_000), 0);
    commits('10 Y sincroniza', sesion('10', v, f('Y3.json'), f('Y4.json'), '', true, 1_780_000_000_000), 0);

    // X's offline edits are on Y; X and Y hold the same
    script('comparar.ts', v, f('X6.json'), f('lect-x.json'));
    script('comparar.ts', v, f('Y4.json'), f('lect-y.json'));
    const lx = JSON.parse(readFileSync(f('lect-x.json'), 'utf8')) as Lectura;
    const ly = JSON.parse(readFileSync(f('lect-y.json'), 'utf8')) as Lectura;
    const ordenado = (m: Record<string, string> | undefined) => JSON.stringify(Object.entries(m ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    for (const k of almacenes) if (ordenado(lx.leido[k]) !== ordenado(ly.leido[k])) problemas.push(`X e Y no acaban iguales en ${k}`);
    const yv = ly.valores;
    if ((yv.notas?.['fig:1'] as { texto?: string } | undefined)?.texto !== 'nota 1 EDITADA sin conexión') problemas.push('la nota editada sin conexión no llegó a Y');
    if (yv.marcadores?.['eq:1']) problemas.push('el marcador borrado sin conexión sigue en Y');
    if (!Object.values(yv['editor-circuitos'] ?? {}).some((c) => (c as { nombre?: string }).nombre === 'Circuito 1 renombrado sin conexión')) problemas.push('el circuito renombrado sin conexión no llegó a Y');
    if (!yv.leidas?.['cap05/sec:40']) problemas.push('la sección leída sin conexión no llegó a Y');
    if (yv.deducciones?.['cap09:999'] !== 4) problemas.push('los pasos de la deducción no llegaron a Y');
    if (!Object.values(yv['editor-circuitos'] ?? {}).some((c) => (c as { nombre?: string }).nombre === 'Circuito 2 renombrado en Y')) problemas.push('el cambio de Y se perdió');
  } catch (e) {
    problemas.push(`error: ${(e as Error).message.split('\n').slice(0, 6).join(' | ')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { problemas, pasos };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = escenario(process.argv.includes('tauri'));
  writeFileSync(1, JSON.stringify(r) + '\n');
}
