// The upgrade to 1.0 and back, with the app's REAL modules in Node (hooks-svelte.mjs, a fake browser: navegador.ts) and
// a fake GitHub kept in a file between sessions (1.0; until 0.12 this checked the upgrade from 0.10.1/0.11.0 with the
// old device kept on its version and syncing — compatibility with 0.10/0.11 clients was dropped in 1.0):
//   1. the old version's code fills every store through its public API (generar.ts: real fixtures; by default
//      0.12.0, HEAD's release; `0.11.0` or `0.10.1` on the command line: their data, opened as they are AND after a
//      session of 0.12.0 on them — a device that never ran 0.12 and one that did);
//   2. store by store, 1.0 reads the same items (same ids, same hashes) as 0.12.0 — but the daily progress, whose
//      legacy days the schema migration moves into «<day>@0» (lib/esquemas.ts): there the days as the reader sees them
//      must be equal —; at load it writes only what 0.12 wrote and the migration (its data, the versions `esquemas`,
//      the backup of the original); a second start changes nothing (comparar.ts);
//   3. two devices: X with the old version's data and code, Y with 0.12.0, synchronise (format 1); Y is updated and
//      its first run writes the file in format 2; X, still old, is refused («actualice la aplicación», the file
//      untouched) before and after editing offline; X is updated (from 0.10.1/0.11.0: straight, never having run 0.12)
//      and sends its offline edits — one commit, no tombstone but the deleted bookmark's —; X goes back to its old
//      version (it reads its data, its runs are refused) and to 1.0 again (nothing migrated twice, no commit); X and Y
//      end with the same data (pasada.ts, one process per session);
//   4. on 1.0 devices only: a day studied on two devices adds up and the commits stop; the review counts, an undone
//      answer and «Reiniciar tarjetas» of 0.12c–e.
//   node --experimental-transform-types --no-warnings tests/actualizacion/escenario.ts [tauri] [0.11.0|0.10.1]
//   (from web/; prints JSON; `tauri`: every session on the Tauri path — the plugin-store's IPC — as on desktop and
//   Android). The old sources are extracted read-only from git (tests/fuentes-viejas.ts).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { COMMITS, fuenteVieja, type Vieja } from '../fuentes-viejas.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('./', import.meta.url));
export { fuenteVieja, type Vieja };
export const COMMIT_0101 = COMMITS['0.10.1'];
export const COMMIT_0110 = COMMITS['0.11.0'];

/** The 0.10.1 web/src (extracted once; null without git). */
export function fuente0101(): string | null {
  return fuenteVieja('0.10.1');
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
  dias: Record<string, unknown> | null;
  despues: Record<string, string>;
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

export function escenario(enTauri = false, vieja: Vieja = '0.12.0'): { omitido?: string; problemas: string[]; pasos: Record<string, unknown>[] } {
  tauri = enTauri;
  const v = fuenteVieja(vieja);
  const v12 = fuenteVieja('0.12.0');
  if (!v || !v12) return { omitido: `no se pudo extraer la ${vieja} o la 0.12.0 con git`, problemas: [], pasos: [] };
  // (EPA_SRC_NUEVA: another copy of the new version's sources — to see a step fail before its fix)
  const n = process.env.EPA_SRC_NUEVA ?? join(WEB, 'src');
  const tmp = mkdtempSync(join(tmpdir(), 'epa-actualizacion-'));
  const f = (x: string) => join(tmp, x);
  const problemas: string[] = [];
  const pasos: Record<string, unknown>[] = [];
  const leer = (x: string) => JSON.parse(readFileSync(f(x), 'utf8')) as Lectura;
  try {
    // 1–2: the stores filled by the old version's own code (real fixtures), read by 0.12.0 and by 1.0
    script('generar.ts', v, f('fixture.json'));
    // a device that ran 0.12 on that data (0.12.0's lazy migrations, its load-time writes), and the data as the old
    // version left them on a device that never ran 0.12 (1.0 reads them directly)
    const fuentes: [string, string][] = [['tal cual', 'fixture.json']];
    if (vieja !== '0.12.0') {
      sesionSuelta(v12, f('fixture.json'), f('fixture-012.json'));
      fuentes.push(['abierta con la 0.12.0', 'fixture-012.json']);
    }
    let almacenes: string[] = [];
    for (const [como, fx] of fuentes) {
      script('comparar.ts', v12, f(fx), f(`lect-12-${fx}`));
      script('comparar.ts', n, f(fx), f(`lect-n-${fx}`));
      const l12 = leer(`lect-12-${fx}`);
      const ln = leer(`lect-n-${fx}`);
      const et = `${vieja} ${como}`;
      almacenes = Object.keys(l12.leido);
      if (almacenes.length < 24) problemas.push(`${et}: la 0.12.0 solo tiene ${almacenes.length} almacenes`);
      // 0.11 stores generar.ts does not fill may be empty; XP and achievements are reconciled at load with each
      // version's clock: compared by their ids and amounts
      const de011 = new Set(['progreso-xp', 'progreso-logros', 'cursos-superadas', 'cursos-pruebas', 'dominio', 'problema-dia']);
      const sinHora = (k: string, x: unknown) => (k === 'progreso-xp' ? (x as { x?: unknown })?.x : k === 'progreso-logros' ? 1 : x);
      for (const k of almacenes) {
        const a = l12.leido[k]!;
        const b = ln.leido[k] ?? {};
        if (!Object.keys(a).length && !de011.has(k)) problemas.push(`${et}: el almacén ${k} quedó vacío`);
        // the daily progress: the migration adds the legacy record of each day (lib/esquemas.ts); the days the reader
        // sees must be the same
        if (k === 'progreso-diario') {
          if (JSON.stringify(l12.dias) !== JSON.stringify(ln.dias)) problemas.push(`${et}: los días suman distinto — 0.12.0 ${JSON.stringify(l12.dias)}, 1.0 ${JSON.stringify(ln.dias)}`);
          if (!l12.dias || !Object.keys(l12.dias).length) problemas.push(`${et}: sin días de progreso`);
          // (the records; a day's summary follows its records and may be remade at load: its counts and verdict are in `dias`)
        for (const [id, h] of Object.entries(a)) if (id.includes('@') && b[id] !== h) problemas.push(`${et}: progreso-diario/${id} cambia con la migración`);
          continue;
        }
        // (exercises: the migration 1 → 2 gives each answer its time, `vt` — compared without it)
        if (k === 'ejercicios') {
          const sinVt = (x: unknown) => {
            const { vt: _vt, ...resto } = (x ?? {}) as Record<string, unknown>;
            void _vt;
            return JSON.stringify(Object.fromEntries(Object.entries(resto).sort(([p], [q]) => (p < q ? -1 : 1))));
          };
          for (const id of new Set([...Object.keys(a), ...Object.keys(b)]))
            if (sinVt(l12.valores[k]?.[id]) !== sinVt(ln.valores[k]?.[id])) problemas.push(`${et}: ejercicios/${id}: la 0.12.0 lee ${sinVt(l12.valores[k]?.[id])}, la 1.0 ${sinVt(ln.valores[k]?.[id])}`);
          continue;
        }
        const recalculado = k === 'progreso-xp' || k === 'progreso-logros';
        for (const id of new Set([...Object.keys(a), ...Object.keys(b)]))
          if (recalculado ? JSON.stringify(sinHora(k, l12.valores[k]?.[id])) !== JSON.stringify(sinHora(k, ln.valores[k]?.[id])) : a[id] !== b[id])
            problemas.push(`${et}: ${k}/${id}: la 0.12.0 lee ${a[id] ?? '—'}, la 1.0 ${b[id] ?? '—'}`);
      }
      // what 1.0 writes at load: what 0.12 wrote too, and the migration (its data, the versions, the backup before)
      // (on the Tauri path the backup goes to its own store file, copia-automatica.json, whose key «migracion» the fake
      // IPC keeps as `epa:migracion`)
      const previstas = new Set(['epa:__prueba', 'epa:progreso-xp', 'epa:dominio', 'epa:sinc-marcas', 'epa:progreso-diario', 'epa:ejercicios', 'epa:esquemas', 'epa:copia-migracion', 'epa:migracion']);
      for (const k of ln.escrituras) if (!previstas.has(k)) problemas.push(`${et}: la 1.0 escribe ${k} al cargar`);
      const sello = JSON.parse(ln.despues['epa:esquemas'] ?? 'null') as { almacenes?: Record<string, number> } | null;
      if (sello?.almacenes?.['progreso-diario'] !== 2 || sello?.almacenes?.ejercicios !== 2) problemas.push(`${et}: las versiones guardadas no dicen progreso-diario 2 (${JSON.stringify(sello)})`);
      const original = JSON.parse(readFileSync(f(fx), 'utf8')) as Record<string, string>;
      // (when the migration changed something — 0.9–0.11 days: always — the backup holds the original)
      const copia = JSON.parse(ln.despues['epa:copia-migracion'] ?? ln.despues['epa:migracion'] ?? 'null') as { texto?: string } | null;
      if (vieja !== '0.12.0' && como === 'tal cual' && !copia) problemas.push(`${et}: no se guardó la copia previa a la migración`);
      if (copia?.texto) {
        const claves = (JSON.parse(copia.texto) as { claves?: Record<string, unknown> }).claves;
        for (const [k, v] of Object.entries(claves ?? {}))
          if (JSON.stringify(v) !== JSON.stringify(JSON.parse(original[`epa:${k}`] ?? 'null'))) problemas.push(`${et}: la copia previa a la migración no guarda ${k} tal como estaba`);
        if (!claves?.ejercicios) problemas.push(`${et}: la copia previa no lleva los ejercicios (que la migración cambia)`);
      }
      // a second start of 1.0 on its own output changes nothing (idempotent) and makes no new backup
      const migrado = Object.fromEntries(Object.entries(ln.despues));
      writeFileSync(f(`migrado-${fx}`), JSON.stringify(migrado));
      script('comparar.ts', n, f(`migrado-${fx}`), f(`lect-n2-${fx}`));
      const ln2 = leer(`lect-n2-${fx}`);
      for (const k of ['epa:progreso-diario', 'epa:ejercicios', 'epa:esquemas', 'epa:copia-migracion', 'epa:migracion']) if (ln2.despues[k] !== migrado[k]) problemas.push(`${et}: el segundo arranque de la 1.0 cambia ${k}`);
      if (JSON.stringify(ln2.dias) !== JSON.stringify(ln.dias)) problemas.push(`${et}: el segundo arranque suma los días distinto`);
    }

    // 3: two devices across the update and back — X starts with the old version's data and code, Y with 0.12.0
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
      if (sinc && r.ok !== true && !paso.includes('rechaza')) problemas.push(`${paso}: la sincronización falló (${r.error})`);
      return r;
    };
    const commits = (paso: string, r: { commits: number }, esperados: number) => {
      if (r.commits !== esperados) problemas.push(`${paso}: ${r.commits} commits (se esperaban ${esperados})`);
    };
    const formato = () => {
      const t = (JSON.parse(readFileSync(repo, 'utf8')) as { texto?: string }).texto;
      return t ? (JSON.parse(t) as { version: number }).version : 0;
    };
    const textoRepo = () => (JSON.parse(readFileSync(repo, 'utf8')) as { texto?: string }).texto;
    /** A session of the old version on a file of format 2: refused, «actualice la aplicación», the file untouched. */
    const rechazada = (paso: string, raiz: string, entrada: string, salida: string, acciones: string, reloj: number) => {
      const antes = textoRepo();
      const r = sesion(`${paso} (se rechaza)`, raiz, entrada, salida, acciones, true, reloj);
      if (r.ok === true) problemas.push(`${paso}: la versión vieja sincronizó con el fichero del formato 2`);
      if (!/actualice la aplicación/.test(r.error)) problemas.push(`${paso}: el aviso no pide actualizar («${r.error}»)`);
      if (textoRepo() !== antes || r.commits) problemas.push(`${paso}: la versión vieja tocó el fichero`);
      return r;
    };
    // (steps 1–12 within 90 days: the tombstones of the first runs are pruned later, in a session that commits anyway)
    commits(`1 X ${vieja} sincroniza`, sesion('1', v, f('fixture.json'), f('X1.json'), '', true, 1_771_000_000_000), 1);
    sesion('2 Y 0.12.0 sincroniza', v12, '-', f('Y1.json'), '', true, 1_771_500_000_000);
    commits('3 Y edita y sincroniza', sesion('3', v12, f('Y1.json'), f('Y2.json'), 'editarY', true, 1_772_000_000_000), 1);
    sesion('4 X edita sin conexión', v, f('X1.json'), f('X2.json'), 'editar', false, 1_772_500_000_000);
    if (formato() !== 1) problemas.push(`hasta aquí el fichero es del formato 1 (es ${formato()})`);
    // Y is updated: its first run writes the file in format 2 (nothing else new: the format itself)
    const antes = lapidas(repo);
    commits('5 Y con la 1.0 sincroniza', sesion('5', n, f('Y2.json'), f('Y3.json'), '', true, 1_773_000_000_000), 1);
    if (formato() !== 2) problemas.push(`5: el fichero no pasó al formato 2 (${formato()})`);
    // X, still on the old version, cannot synchronise — before and after more offline edits; nothing it did is lost
    rechazada(`6 X ${vieja}`, v, f('X2.json'), f('X3.json'), '', 1_773_200_000_000);
    rechazada(`6b X ${vieja} estudia`, v, f('X3.json'), f('X3b.json'), vieja === '0.10.1' ? '' : 'estudiar2', 1_773_300_000_000);
    // X is updated (straight from its version: from 0.10.1/0.11.0 a device that never ran 0.12)
    commits('7 X con la 1.0 sincroniza', sesion('7', n, f('X3b.json'), f('X4.json'), '', true, 1_773_500_000_000), 1);
    // (and the records of the days X studied in its tabs before yesterday, compacted into one per day — lib/progreso-dias.ts
    // compactar: «<day>@<device>-<tab>» deleted)
    const nuevas = [...lapidas(repo)].filter((x) => !antes.has(x) && !/^progreso-diario\/\d{4}-\d\d-\d\d@[0-9a-f]+-[0-9a-z]+~?$/.test(x));
    if (nuevas.join() !== 'marcadores/eq:1') problemas.push(`lápidas nuevas al actualizar: ${nuevas.join(' ') || 'ninguna'} (solo el marcador borrado)`);
    commits('8 X sincroniza otra vez', sesion('8', n, f('X4.json'), f('X5.json'), '', true, 1_774_000_000_000), 0);
    commits('9 X solo mira y sincroniza', sesion('9', n, f('X5.json'), f('X6.json'), 'leer', true, 1_774_500_000_000), 0);
    const x6 = JSON.parse(readFileSync(f('X6.json'), 'utf8')) as Record<string, string>;
    const marcas = JSON.parse(x6['epa:sinc-marcas'] ?? '{}') as { cambios?: Record<string, object>; borrados?: Record<string, object> };
    const conMarcas = [...Object.entries(marcas.cambios ?? {}), ...Object.entries(marcas.borrados ?? {})].filter(([, ids]) => Object.keys(ids).length);
    if (conMarcas.length) problemas.push(`mirar sin cambiar nada deja marcas: ${conMarcas.map(([k]) => k).join(' ')}`);
    commits('10 Y sincroniza', sesion('10', n, f('Y3.json'), f('Y4.json'), '', true, 1_775_000_000_000), 0);
    // back-out: X reinstalls the old version — it reads its (migrated) data and cannot synchronise —, then 1.0 again:
    // its versions say «migrated», nothing is migrated twice, nothing sent
    rechazada(`11 X vuelve a la ${vieja}`, v, f('X6.json'), f('X7.json'), '', 1_775_200_000_000);
    script('comparar.ts', v, f('X7.json'), f('lect-vuelta.json'));
    const lvuelta = leer('lect-vuelta.json');
    if ((lvuelta.valores.notas?.['fig:1'] as { texto?: string } | undefined)?.texto !== 'nota 1 EDITADA sin conexión') problemas.push(`11: la ${vieja} no lee la nota que la 1.0 guardó`);
    const x7 = JSON.parse(readFileSync(f('X7.json'), 'utf8')) as Record<string, string>;
    commits('12 X con la 1.0 otra vez', sesion('12', n, f('X7.json'), f('X8.json'), '', true, 1_775_500_000_000), 0);
    const x8 = JSON.parse(readFileSync(f('X8.json'), 'utf8')) as Record<string, string>;
    if (x8['epa:copia-migracion'] !== x7['epa:copia-migracion'] || x8['epa:migracion'] !== x7['epa:migracion']) problemas.push('12: la vuelta a la 1.0 hizo otra copia previa (migró otra vez)');

    // X's offline edits are on Y; X and Y hold the same (read by 1.0)
    script('comparar.ts', n, f('X8.json'), f('lect-x.json'));
    script('comparar.ts', n, f('Y4.json'), f('lect-y.json'));
    const lx = leer('lect-x.json');
    const ly = leer('lect-y.json');
    const ordenado = (m: Record<string, string> | undefined) => JSON.stringify(Object.entries(m ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    for (const k of almacenes) if (k !== 'progreso-xp' && k !== 'progreso-logros' && ordenado(lx.leido[k]) !== ordenado(ly.leido[k])) problemas.push(`X e Y no acaban iguales en ${k}`);
    if (JSON.stringify(lx.dias) !== JSON.stringify(ly.dias)) problemas.push('X e Y no suman igual los días');
    const yv = ly.valores;
    if ((yv.notas?.['fig:1'] as { texto?: string } | undefined)?.texto !== 'nota 1 EDITADA sin conexión') problemas.push('la nota editada sin conexión no llegó a Y');
    if (yv.marcadores?.['eq:1']) problemas.push('el marcador borrado sin conexión sigue en Y');
    if (!Object.values(yv['editor-circuitos'] ?? {}).some((c) => (c as { nombre?: string }).nombre === 'Circuito 1 renombrado sin conexión')) problemas.push('el circuito renombrado sin conexión no llegó a Y');
    if (!yv.leidas?.['cap05/sec:40']) problemas.push('la sección leída sin conexión no llegó a Y');
    if (yv.deducciones?.['cap09:999'] !== 4) problemas.push('los pasos de la deducción no llegaron a Y');
    if (!Object.values(yv['editor-circuitos'] ?? {}).some((c) => (c as { nombre?: string }).nombre === 'Circuito 2 renombrado en Y')) problemas.push('el cambio de Y se perdió');
    // (6b: X studied 2 steps while it could not synchronise: they reach Y)
    if (vieja !== '0.10.1') {
      const dia = Object.entries((ly.dias ?? {}) as Record<string, { pasos: number }>).find(([d]) => d === claveDiaDe(1_773_300_000_000));
      if ((dia?.[1].pasos ?? 0) < 2) problemas.push(`los pasos que X estudió sin poder sincronizar no llegaron a Y (${JSON.stringify(dia)})`);
    }

    // a day of study on both (both on 1.0), the same day: each counts both devices once, and the commits stop
    const DIA = 1_781_000_000_000;
    const hoy = (paso: string, r: { hoy?: number }, esperado: number) => {
      if (r.hoy !== esperado) problemas.push(`${paso}: el día suma ${r.hoy} pasos (se esperaban ${esperado})`);
    };
    const r13 = sesion('13 X estudia 2 pasos', n, f('X8.json'), f('X9.json'), 'estudiar2', true, DIA);
    commits('13 X estudia y sincroniza', r13, 1);
    hoy('13', r13, 2);
    const r14 = sesion('14 Y estudia 3 pasos', n, f('Y4.json'), f('Y5.json'), 'estudiar3', true, DIA + 600_000);
    commits('14 Y estudia', r14, 1);
    hoy('14', r14, 5);
    const r15 = sesion('15 X sincroniza', n, f('X9.json'), f('X10.json'), '', true, DIA + 1_200_000);
    hoy('15', r15, 5);
    let fin = { X: 'X10.json', Y: 'Y5.json' } as Record<string, string>;
    for (let ronda = 0; ronda < 3; ronda++)
      for (const d of ['X', 'Y'] as const) {
        const sal = `${d}-dia-${ronda}.json`;
        const r = sesion(`16 ${d} sincroniza otra vez (${ronda})`, n, f(fin[d]!), f(sal), '', true, DIA + 1_800_000 + (ronda * 2 + (d === 'X' ? 0 : 1)) * 600_000);
        fin[d] = sal;
        hoy(`16 ${d}`, r, 5);
        if (ronda === 2) commits(`16 ${d} sincroniza otra vez`, r, 0);
      }

    // 0.12c–e on 1.0 devices only (steps 17–55 of 0.12, without the old device): the day's review counts of two
    // devices (the larger value per field), an answer undone after it was synchronised, «Reiniciar tarjetas» and
    // answering again the same day — and the commits stop
    const DIA2 = 1_782_000_000_000;
    const reales = (r: { repasoHoy?: unknown }) => {
      const d = (r.repasoHoy ?? {}) as { r?: number; dr?: number };
      return (d.r ?? 0) - (d.dr ?? 0);
    };
    const efectivas = (paso: string, r: { repasoHoy?: unknown }, esperado: number) => {
      if (reales(r) !== esperado) problemas.push(`${paso}: el repaso del día cuenta ${reales(r)} respuestas (se esperaban ${esperado})`);
    };
    const sinRepaso = (paso: string, r: { enviados?: Record<string, string[]> }) => {
      if (r.enviados?.['repaso-diario']) problemas.push(`${paso}: vuelve a enviar repaso-diario (${r.enviados['repaso-diario'].join(' ')})`);
    };
    sesion('17 Z (instalación nueva) sincroniza', n, '-', f('Z1.json'), '', true, DIA2 - 3_600_000);
    sesion('18 X repasa 2 sin conexión', n, f(fin.X!), f('X11.json'), 'repasar2', false, DIA2);
    const r19 = sesion('19 Z repasa 1 y sincroniza', n, f('Z1.json'), f('Z2.json'), 'repasar1', true, DIA2 + 600_000);
    efectivas('19', r19, 1);
    const r20 = sesion('20 X sincroniza', n, f('X11.json'), f('X12.json'), '', true, DIA2 + 1_200_000);
    efectivas('20', r20, 2);
    const r21 = sesion('21 Z sincroniza', n, f('Z2.json'), f('Z3.json'), '', true, DIA2 + 1_800_000);
    efectivas('21', r21, 2);
    const DIA3 = 1_783_000_000_000;
    const r29 = sesion('29 X repasa 2 y sincroniza', n, f('X12.json'), f('X13.json'), 'repasar:2:u', true, DIA3);
    efectivas('29', r29, 2);
    const r30 = sesion('30 X deshace una y sincroniza', n, f('X13.json'), f('X14.json'), 'deshacer:u:1', true, DIA3 + 600_000);
    efectivas('30', r30, 1);
    const r31 = sesion('31 Z sincroniza', n, f('Z3.json'), f('Z4.json'), '', true, DIA3 + 1_200_000);
    efectivas('31', r31, 1);
    sinRepaso('31', r31);
    const DIA4 = 1_784_000_000_000;
    const nuevasDe = (r: { repasoHoy?: unknown }) => {
      const d = (r.repasoHoy ?? {}) as { n?: number; dn?: number };
      return (d.n ?? 0) - (d.dn ?? 0);
    };
    const r43 = sesion('43 X repasa 3 y sincroniza', n, f('X14.json'), f('X15.json'), 'repasar:3:w', true, DIA4);
    efectivas('43', r43, 3);
    const r44 = sesion('44 X reinicia las tarjetas, repasa 1 y sincroniza', n, f('X15.json'), f('X16.json'), 'reiniciar,repasar:1:w2', true, DIA4 + 600_000);
    efectivas('44', r44, 1);
    if (nuevasDe(r44) !== 1) problemas.push(`44: ${nuevasDe(r44)} nuevas hoy (se esperaba 1)`);
    const r45 = sesion('45 Z sincroniza', n, f('Z4.json'), f('Z5.json'), '', true, DIA4 + 1_200_000);
    efectivas('45', r45, 1);
    if (nuevasDe(r45) !== 1) problemas.push(`45: ${nuevasDe(r45)} nuevas hoy en Z (se esperaba 1)`);
    let ent = { X: 'X16.json', Z: 'Z5.json', Y: fin.Y! } as Record<string, string>;
    for (let ronda = 0; ronda < 3; ronda++)
      for (const d of ['X', 'Z', 'Y'] as const) {
        const sal = `${d}-12e-r${ronda}.json`;
        const k = ronda * 3 + (d === 'X' ? 0 : d === 'Z' ? 1 : 2);
        const paso = `${47 + k} ${d} sincroniza otra vez`;
        const r = sesion(paso, n, f(ent[d]!), f(sal), '', true, DIA4 + 2_400_000 + k * 600_000);
        ent[d] = sal;
        efectivas(paso, r, 1);
        if (ronda > 0) sinRepaso(paso, r);
        if (ronda === 2) commits(paso, r, 0);
      }
  } catch (e) {
    problemas.push(`error: ${(e as Error).message.split('\n').slice(0, 6).join(' | ')}`);
  } finally {
    // (EPA_CONSERVAR=1: the session files are kept, to look into a failure)
    if (process.env.EPA_CONSERVAR === '1') console.error(`ficheros en ${tmp}`);
    else rmSync(tmp, { recursive: true, force: true });
  }
  return { problemas, pasos };
}

/** A session of a version on a storage, without synchronising (it loads everything, flushes, saves the storage). */
function sesionSuelta(raiz: string, entrada: string, salida: string): void {
  const repo = `${salida}.repo.json`;
  script('pasada.ts', raiz, entrada, salida, repo, '', '0', '1770500000000');
}

/** The review day (04:00 local) of a time, as the app keys it (componentes/repaso/srs.ts claveDia). */
function claveDiaDe(t: number): string {
  const d = new Date(t - 4 * 3_600_000);
  const dos = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const vieja: Vieja = process.argv.includes('0.11.0') ? '0.11.0' : process.argv.includes('0.10.1') ? '0.10.1' : '0.12.0';
  const r = escenario(process.argv.includes('tauri'), vieja);
  writeFileSync(1, JSON.stringify(r) + '\n');
}
