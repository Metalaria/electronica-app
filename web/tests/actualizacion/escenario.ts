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
// 0.12: the same with 0.11.0 as the older version (commit 0afc439; `0.11.0` on the command line), and after it a
// day of study on both devices — X updated, Y still on the old version —: the day adds up on X, Y sees the sum, the
// commits stop (the daily progress summed across devices, lib/progreso-dias.ts). A commit missing from the clone (a
// rewritten history) is found by its message («Versión 0.10.1: …»).
//   node --experimental-transform-types --no-warnings tests/actualizacion/escenario.ts [tauri] [0.11.0]   (from web/;
//   prints JSON; `tauri`: every session on the Tauri path — the plugin-store's IPC — as on desktop and Android)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('./', import.meta.url));
export const COMMIT_0101 = '8ffa4c6';
export const COMMIT_0110 = '0afc439';
export type Vieja = '0.10.1' | '0.11.0';
const COMMITS: Record<Vieja, string> = { '0.10.1': COMMIT_0101, '0.11.0': COMMIT_0110 };

/** The commit of a release: its known hash, or the commit whose message starts «Versión X.Y.Z:» (null: not found). */
function commitDe(version: Vieja): string | null {
  const git = (...a: string[]) => execFileSync('git', ['-C', join(WEB, '..'), ...a], { encoding: 'utf8' }).trim();
  try {
    return git('rev-parse', '--verify', '--quiet', `${COMMITS[version]}^{commit}`).slice(0, 7);
  } catch {
    try {
      return git('log', '--format=%h', '-n', '1', `--grep=^Versión ${version.replace(/\./g, '\\.')}:`) || null;
    } catch {
      return null;
    }
  }
}

/** The 0.10.1 web/src (extracted once; null without git). */
export function fuente0101(): string | null {
  return fuenteVieja('0.10.1');
}

/** The web/src of an older release (extracted once into the temporary folder; null without git). */
export function fuenteVieja(version: Vieja): string | null {
  const commit = commitDe(version);
  if (!commit) return null;
  const dir = join(tmpdir(), `epa-v${version.replace(/\./g, '')}-${commit}`);
  const src = join(dir, 'web', 'src');
  if (existsSync(join(src, 'lib', 'usuario.svelte.ts'))) return src;
  try {
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['-C', join(WEB, '..'), 'archive', commit, 'web/src', 'web/package.json'], { maxBuffer: 256 * 1024 * 1024 });
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

export function escenario(enTauri = false, vieja: Vieja = '0.10.1'): { omitido?: string; problemas: string[]; pasos: Record<string, unknown>[] } {
  tauri = enTauri;
  const v = fuenteVieja(vieja);
  if (!v) return { omitido: `no se pudo extraer la ${vieja} con git`, problemas: [], pasos: [] };
  // (EPA_SRC_NUEVA: another copy of the new version's sources — to see a step fail before its fix)
  const n = process.env.EPA_SRC_NUEVA ?? join(WEB, 'src');
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
    if (almacenes.length < 18) problemas.push(`la ${vieja} solo tiene ${almacenes.length} almacenes`);
    // 0.11.0 as the older version: generar.ts fills the stores 0.10.1 had (not the six of 0.11, which stay empty), and
    // both versions credit XP and achievements at load with their own clock (reconciliation): those two are compared by
    // their ids and amounts, not by their times
    const de011 = new Set(['progreso-xp', 'progreso-logros', 'cursos-superadas', 'cursos-pruebas', 'dominio', 'problema-dia']);
    const sinHora = (k: string, x: unknown) => (k === 'progreso-xp' ? (x as { x?: unknown })?.x : k === 'progreso-logros' ? 1 : x);
    for (const k of almacenes) {
      const a = lv.leido[k]!;
      const b = ln.leido[k] ?? {};
      if (!Object.keys(a).length && !(vieja === '0.11.0' && de011.has(k))) problemas.push(`el almacén ${k} quedó vacío en el fichero de la ${vieja}`);
      const recalculado = vieja === '0.11.0' && (k === 'progreso-xp' || k === 'progreso-logros');
      for (const id of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (recalculado ? JSON.stringify(sinHora(k, lv.valores[k]?.[id])) !== JSON.stringify(sinHora(k, ln.valores[k]?.[id])) : a[id] !== b[id])
          problemas.push(`${k}/${id}: la ${vieja} lee ${a[id] ?? '—'}, la nueva ${b[id] ?? '—'}`);
    }
    const previstas = new Set(['epa:__prueba', 'epa:progreso-xp', 'epa:dominio', 'epa:sinc-marcas']);
    for (const k of ln.escrituras) if (!previstas.has(k)) problemas.push(`la versión nueva escribe ${k} al cargar`);
    const cambiaSola = vieja === '0.11.0' ? lv.cambiadas.filter((k) => !previstas.has(k)) : lv.cambiadas;
    if (cambiaSola.length) problemas.push(`la ${vieja} cambia al cargar: ${cambiaSola.join(' ')}`);

    // 3: two devices, the update and going back
    const repo = f('repo.json');
    const sesion = (paso: string, raiz: string, entrada: string, salida: string, acciones: string, sinc: boolean, reloj: number) => {
      const r = JSON.parse(script('pasada.ts', raiz, entrada, salida, repo, acciones, sinc ? '1' : '0', String(reloj))) as {
        ok: unknown;
        error: string;
        commits: number;
        hoy?: number;
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
    commits(`1 X ${vieja} sincroniza`, sesion('1', v, f('fixture.json'), f('X1.json'), '', true, 1_771_000_000_000), 1);
    sesion(`2 Y ${vieja} sincroniza`, v, '-', f('Y1.json'), '', true, 1_772_000_000_000);
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
    commits(`8 Y ${vieja} sincroniza`, sesion('8', v, f('Y2.json'), f('Y3.json'), '', true, 1_778_000_000_000), 0);
    commits(`9 X vuelve a la ${vieja}`, sesion('9', v, f('X5.json'), f('X6.json'), '', true, 1_779_000_000_000), 0);
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

    // 0.12: one day of study on both — X updated again, Y still on the old version —, the same day (clocks minutes
    // apart): X counts both devices once, Y sees the sum, and the commits stop
    const DIA = 1_781_000_000_000;
    const hoy = (paso: string, r: { hoy?: number }, esperado: number) => {
      if (r.hoy !== esperado) problemas.push(`${paso}: el día suma ${r.hoy} pasos (se esperaban ${esperado})`);
    };
    const r11 = sesion('11 X con la versión nueva estudia 2 pasos', n, f('X6.json'), f('X7.json'), 'estudiar2', true, DIA);
    commits('11 X estudia y sincroniza', r11, 1);
    hoy('11', r11, 2);
    const r12 = sesion('12 Y (versión vieja) recibe', v, f('Y4.json'), f('Y4b.json'), '', true, DIA + 300_000);
    commits('12 Y recibe', r12, 0);
    hoy('12', r12, 2);
    const r12b = sesion('12b Y estudia 3 pasos y sincroniza', v, f('Y4b.json'), f('Y5.json'), 'estudiar3', true, DIA + 600_000);
    commits('12b Y estudia', r12b, 1);
    hoy('12b', r12b, 5);
    // X counts Y's 3 steps (the old version's day is newer than X's record: lib/progreso-dias.ts «exceso») and stores
    // them in the day's legacy record, which its next run sends (one commit), and nothing more
    const r13 = sesion('13 X sincroniza', n, f('X7.json'), f('X8.json'), '', true, DIA + 1_200_000);
    commits('13 X recibe', r13, 0);
    hoy('13', r13, 5);
    const r14 = sesion('14 X sincroniza otra vez', n, f('X8.json'), f('X9.json'), '', true, DIA + 1_800_000);
    commits('14 X envía el registro antiguo del día', r14, 1);
    hoy('14', r14, 5);
    const r15 = sesion('15 Y sincroniza', v, f('Y5.json'), f('Y6.json'), '', true, DIA + 2_400_000);
    commits('15 Y sincroniza', r15, 0);
    hoy('15', r15, 5);
    const r16 = sesion('16 X sincroniza', n, f('X9.json'), f('X10.json'), '', true, DIA + 3_000_000);
    commits('16 X sincroniza', r16, 0);
    hoy('16', r16, 5);

    // 0.12c (review finding 5): the day's review counts (repaso-diario) of two devices with the new version, the same
    // day: X answers 2 cards offline, then Z (a fresh install that received everything) answers 1 later and
    // synchronises first. Before, the newer version won whole (Z's 1: X's 2 lost); now the larger count per field
    // stays (2) — never counted twice —, the old version Y takes it as it is, and the commits stop
    const DIA2 = 1_782_000_000_000;
    const repasadas = (paso: string, r: { repasoHoy?: unknown }, esperado: number) => {
      const x = (r.repasoHoy as { r?: number } | null)?.r ?? 0;
      if (x !== esperado) problemas.push(`${paso}: el repaso del día cuenta ${x} respuestas (se esperaban ${esperado})`);
    };
    sesion('17 Z (instalación nueva) sincroniza', n, '-', f('Z1.json'), '', true, DIA2 - 3_600_000);
    sesion('18 X repasa 2 sin conexión', n, f('X10.json'), f('X11.json'), 'repasar2', false, DIA2);
    const r19 = sesion('19 Z repasa 1 y sincroniza', n, f('Z1.json'), f('Z2.json'), 'repasar1', true, DIA2 + 600_000);
    commits('19 Z repasa', r19, 1);
    repasadas('19', r19, 1);
    const r20 = sesion('20 X sincroniza', n, f('X11.json'), f('X12.json'), '', true, DIA2 + 1_200_000);
    commits('20 X envía su día (el mayor por campo)', r20, 1);
    repasadas('20', r20, 2);
    const r21 = sesion('21 Z sincroniza', n, f('Z2.json'), f('Z3.json'), '', true, DIA2 + 1_800_000);
    commits('21 Z recibe', r21, 0);
    repasadas('21', r21, 2);
    const r22 = sesion(`22 Y ${vieja} sincroniza`, v, f('Y6.json'), f('Y7.json'), '', true, DIA2 + 2_400_000);
    commits('22 Y recibe', r22, 0);
    repasadas('22', r22, 2);
    // (one more commit may come in the next round: X's daily goal, met by the answers of both devices, credits its XP —
    // once, the day's id; not the review counts), then nothing more
    let otraVez = 0;
    for (const [paso, raiz, ent, sal, t, ultima] of [
      ['23 X', n, 'X12.json', 'X13.json', DIA2 + 3_000_000, false],
      ['24 Z', n, 'Z3.json', 'Z4.json', DIA2 + 3_600_000, false],
      ['25 Y', v, 'Y7.json', 'Y8.json', DIA2 + 4_200_000, false],
      ['26 X', n, 'X13.json', 'X14.json', DIA2 + 4_800_000, true],
      ['27 Z', n, 'Z4.json', 'Z5.json', DIA2 + 5_400_000, true],
      ['28 Y', v, 'Y8.json', 'Y9.json', DIA2 + 6_000_000, true],
    ] as const) {
      const r = sesion(`${paso} sincroniza otra vez`, raiz, f(ent), f(sal), '', true, t);
      if (ultima) commits(`${paso} sincroniza otra vez`, r, 0);
      else otraVez += r.commits;
      repasadas(paso, r, 2);
    }
    if (otraVez > 1) problemas.push(`23–25: ${otraVez} commits (como mucho 1: el XP del objetivo del día)`);

    // 0.12d (review finding 2): an answer undone after it was synchronised stays undone on every new device (the undo
    // raises the day's undo counters; the larger value of each is kept), the old version shows the answers it reads
    // (r: the undone one included), keeps the counters when it answers on top, and the commits stop
    const DIA3 = 1_783_000_000_000;
    const reales = (r: { repasoHoy?: unknown }) => {
      const d = (r.repasoHoy ?? {}) as { r?: number; dr?: number };
      return (d.r ?? 0) - (d.dr ?? 0);
    };
    const efectivas = (paso: string, r: { repasoHoy?: unknown }, esperado: number, crudo?: number) => {
      if (reales(r) !== esperado) problemas.push(`${paso}: el repaso del día cuenta ${reales(r)} respuestas (se esperaban ${esperado})`);
      const x = (r.repasoHoy as { r?: number } | null)?.r ?? 0;
      if (crudo !== undefined && x !== crudo) problemas.push(`${paso}: r=${x} (se esperaba ${crudo})`);
    };
    // (other stores may still send once in these rounds — the daily progress compacting past days, the legacy record of
    // the old version's step, the day's XP —; the review counts are sent only by the sessions that change them)
    const sinRepaso = (paso: string, r: { enviados?: Record<string, string[]> }) => {
      if (r.enviados?.['repaso-diario']) problemas.push(`${paso}: vuelve a enviar repaso-diario (${r.enviados['repaso-diario'].join(' ')})`);
    };
    const r29 = sesion('29 X repasa 2 y sincroniza', n, f('X14.json'), f('X15.json'), 'repasar:2:u', true, DIA3);
    efectivas('29', r29, 2);
    const r30 = sesion('30 X deshace una y sincroniza', n, f('X15.json'), f('X16.json'), 'deshacer:u:1', true, DIA3 + 600_000);
    efectivas('30', r30, 1);
    const r31 = sesion('31 Z sincroniza', n, f('Z5.json'), f('Z6.json'), '', true, DIA3 + 1_200_000);
    efectivas('31', r31, 1);
    sinRepaso('31', r31);
    // (the old version reads r: 2, the undone answer included — what it can show)
    const r32 = sesion(`32 Y ${vieja} sincroniza`, v, f('Y9.json'), f('Y10.json'), '', true, DIA3 + 1_800_000);
    efectivas('32', r32, 1, 2);
    sinRepaso('32', r32);
    const r33 = sesion(`33 Y ${vieja} repasa 1 y sincroniza`, v, f('Y10.json'), f('Y11.json'), 'repasar:1:v', true, DIA3 + 2_400_000);
    efectivas('33', r33, 2, 3);
    let ent = { X: 'X16.json', Z: 'Z6.json', Y: 'Y11.json' } as Record<string, string>;
    for (let ronda = 0; ronda < 3; ronda++)
      for (const [d, raiz] of [['X', n], ['Z', n], ['Y', v]] as const) {
        const sal = `${d}-12d-${ronda}.json`;
        const paso = `${34 + ronda * 3 + (d === 'X' ? 0 : d === 'Z' ? 1 : 2)} ${d} sincroniza otra vez`;
        const r = sesion(paso, raiz, f(ent[d]!), f(sal), '', true, DIA3 + 3_000_000 + (ronda * 3 + (d === 'X' ? 0 : d === 'Z' ? 1 : 2)) * 600_000);
        ent[d] = sal;
        efectivas(paso, r, 2);
        sinRepaso(paso, r);
        if (ronda === 2) commits(paso, r, 0);
      }

    // 0.12e (review finding 3): «Reiniciar tarjetas» and answering again the same day — today's counts start again
    // from the reset on every new device (and today's new cards: the daily limit), the old version shows the answers it
    // reads (the pre-reset ones included), and the commits stop
    const DIA4 = 1_784_000_000_000;
    const nuevasDe = (r: { repasoHoy?: unknown }) => {
      const d = (r.repasoHoy ?? {}) as { n?: number; dn?: number };
      return (d.n ?? 0) - (d.dn ?? 0);
    };
    const r43 = sesion('43 X repasa 3 y sincroniza', n, f(ent.X!), f('X-12e-1.json'), 'repasar:3:w', true, DIA4);
    efectivas('43', r43, 3);
    const r44 = sesion('44 X reinicia las tarjetas, repasa 1 y sincroniza', n, f('X-12e-1.json'), f('X-12e-2.json'), 'reiniciar,repasar:1:w2', true, DIA4 + 600_000);
    efectivas('44', r44, 1);
    if (nuevasDe(r44) !== 1) problemas.push(`44: ${nuevasDe(r44)} nuevas hoy (se esperaba 1)`);
    const r45 = sesion('45 Z sincroniza', n, f(ent.Z!), f('Z-12e-1.json'), '', true, DIA4 + 1_200_000);
    efectivas('45', r45, 1);
    if (nuevasDe(r45) !== 1) problemas.push(`45: ${nuevasDe(r45)} nuevas hoy en Z (se esperaba 1)`);
    const r46 = sesion(`46 Y ${vieja} sincroniza`, v, f(ent.Y!), f('Y-12e-1.json'), '', true, DIA4 + 1_800_000);
    efectivas('46', r46, 1, 4);
    let ent2 = { X: 'X-12e-2.json', Z: 'Z-12e-1.json', Y: 'Y-12e-1.json' } as Record<string, string>;
    for (let ronda = 0; ronda < 3; ronda++)
      for (const [d, raiz] of [['X', n], ['Z', n], ['Y', v]] as const) {
        const sal = `${d}-12e-r${ronda}.json`;
        const k = ronda * 3 + (d === 'X' ? 0 : d === 'Z' ? 1 : 2);
        const paso = `${47 + k} ${d} sincroniza otra vez`;
        const r = sesion(paso, raiz, f(ent2[d]!), f(sal), '', true, DIA4 + 2_400_000 + k * 600_000);
        ent2[d] = sal;
        efectivas(paso, r, 1);
        sinRepaso(paso, r);
        if (ronda === 2) commits(paso, r, 0);
      }
  } catch (e) {
    problemas.push(`error: ${(e as Error).message.split('\n').slice(0, 6).join(' | ')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { problemas, pasos };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = escenario(process.argv.includes('tauri'), process.argv.includes('0.11.0') ? '0.11.0' : '0.10.1');
  writeFileSync(1, JSON.stringify(r) + '\n');
}
