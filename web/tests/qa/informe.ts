// The QA report: merges the raw findings of every test (informe/crudo/*.jsonl, all shards that have run) into
// informe/informe.json (machine-readable, every group) and informe/informe.md (readable Spanish summary),
// grouped by severity and by signature (the same bug on 300 routes is one entry with its routes), with the
// triage of tests/qa/triaje.json (fixed, reported, false positive, owner's decision).
// Playwright's global teardown of playwright.qa.config.ts; alone: node tests/qa/informe.ts
// No imports from src/: it must run with plain Node (type stripping).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INFORME = process.env.QA_INFORME ? `${process.env.QA_INFORME.replace(/\/$/, '')}/` : new URL('./informe/', import.meta.url).pathname;
const TRIAJE = new URL('./triaje.json', import.meta.url).pathname;

type Sev = 'error' | 'funcional' | 'visual' | 'rendimiento' | 'accesibilidad' | 'texto';
const ORDEN: Sev[] = ['error', 'funcional', 'visual', 'rendimiento', 'accesibilidad', 'texto'];
const NOMBRE: Record<Sev, string> = {
  error: 'Cuelgues y errores',
  funcional: 'Funcionales',
  visual: 'Visuales y de maquetación',
  rendimiento: 'Rendimiento',
  accesibilidad: 'Accesibilidad',
  texto: 'Textos',
};

interface Hallazgo {
  sev: Sev;
  tipo: string;
  firma: string;
  msg: string;
  ruta: string;
  perfil: string;
  prueba: string;
  captura?: string;
  semilla?: number;
  pasos?: string[];
}

interface Triaje {
  /** Regular expression over «tipo|firma». */
  patron: string;
  estado: 'corregido' | 'informado' | 'falso-positivo' | 'decision';
  nota: string;
}

interface Grupo {
  sev: Sev;
  tipo: string;
  firma: string;
  msg: string;
  veces: number;
  rutas: string[];
  nRutas: number;
  perfiles: string[];
  pruebas: string[];
  captura?: string;
  semilla?: number;
  pasos?: string[];
  triaje?: Omit<Triaje, 'patron'>;
}

const ESTADO: Record<Triaje['estado'], string> = {
  corregido: 'corregido',
  informado: 'solo informado',
  'falso-positivo': 'falso positivo',
  decision: 'decide el dueño',
};

export function generarInforme(): { grupos: Grupo[] } {
  const dir = `${INFORME}crudo/`;
  if (!existsSync(dir)) return { grupos: [] };
  const triaje: Triaje[] = existsSync(TRIAJE) ? (JSON.parse(readFileSync(TRIAJE, 'utf8')) as Triaje[]) : [];
  const grupos = new Map<string, Grupo & { _rutas: Set<string>; _perfiles: Set<string>; _pruebas: Set<string> }>();
  const cobertura: Record<string, Record<string, number>> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    for (const linea of readFileSync(dir + f, 'utf8').split('\n')) {
      if (!linea.trim()) continue;
      let x: ({ k: 'hallazgo' } & Hallazgo) | ({ k: 'cobertura'; perfil: string; prueba: string } & Record<string, unknown>);
      try {
        x = JSON.parse(linea);
      } catch {
        continue;
      }
      if (x.k === 'cobertura') {
        const c = (cobertura[x.perfil] ??= {});
        for (const [k, v] of Object.entries(x)) if (typeof v === 'number') c[k] = (c[k] ?? 0) + v;
        continue;
      }
      const h = x as Hallazgo;
      const clave = `${h.sev}|${h.tipo}|${h.firma}`;
      let g = grupos.get(clave);
      if (!g) {
        g = { sev: h.sev, tipo: h.tipo, firma: h.firma, msg: h.msg, veces: 0, rutas: [], nRutas: 0, perfiles: [], pruebas: [], _rutas: new Set(), _perfiles: new Set(), _pruebas: new Set() };
        grupos.set(clave, g);
      }
      g.veces++;
      g._rutas.add(`${h.perfil}:${h.ruta}`);
      g._perfiles.add(h.perfil);
      g._pruebas.add(h.prueba);
      if (!g.captura && h.captura) g.captura = h.captura;
      if (g.semilla === undefined && h.semilla !== undefined) {
        g.semilla = h.semilla;
        g.pasos = h.pasos;
      }
    }
  }
  const lista: Grupo[] = [...grupos.values()].map(({ _rutas, _perfiles, _pruebas, ...g }) => {
    const t = triaje.find((t) => new RegExp(t.patron).test(`${g.tipo}|${g.firma}`) || new RegExp(t.patron).test(`${g.tipo}|${g.msg}`));
    return { ...g, rutas: [..._rutas].slice(0, 25), nRutas: _rutas.size, perfiles: [..._perfiles], pruebas: [..._pruebas].slice(0, 5), triaje: t ? { estado: t.estado, nota: t.nota } : undefined };
  });
  lista.sort((a, b) => ORDEN.indexOf(a.sev) - ORDEN.indexOf(b.sev) || b.nRutas - a.nRutas || b.veces - a.veces);

  const metaRuta = `${dir}_ejecucion.json`;
  const meta = existsSync(metaRuta) ? (JSON.parse(readFileSync(metaRuta, 'utf8')) as { inicio: number; tramos: { inicio: number; fin?: number; shard: string | null; modo: string; semilla: string | null }[] }) : null;
  if (meta?.tramos.length) {
    const ultimo = meta.tramos[meta.tramos.length - 1]!;
    ultimo.fin ??= Date.now();
    writeFileSync(metaRuta, JSON.stringify(meta, null, 1));
  }
  const duracion = meta ? meta.tramos.reduce((s, t) => s + ((t.fin ?? Date.now()) - t.inicio), 0) : 0;
  const porSev = Object.fromEntries(ORDEN.map((s) => [s, lista.filter((g) => g.sev === s).length]));
  const abiertos = Object.fromEntries(ORDEN.map((s) => [s, lista.filter((g) => g.sev === s && (!g.triaje || g.triaje.estado === 'informado' || g.triaje.estado === 'decision')).length]));
  const json = { generado: new Date().toISOString(), modo: meta?.tramos.map((t) => t.modo).join('+') ?? '?', tramos: meta?.tramos ?? [], duracionMin: Math.round(duracion / 6000) / 10, cobertura, porSeveridad: porSev, sinCorregir: abiertos, grupos: lista };
  writeFileSync(`${INFORME}informe.json`, JSON.stringify(json, null, 1));

  // ---- readable summary
  const md: string[] = [];
  const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  md.push('# Informe de QA', '');
  md.push(`Generado el ${fecha} · modo ${json.modo} · ${json.duracionMin} min de ejecución${meta && meta.tramos.length > 1 ? ` en ${meta.tramos.length} tramos` : ''}.`, '');
  md.push('## Cobertura', '');
  const claves = [...new Set(Object.values(cobertura).flatMap((c) => Object.keys(c)))].sort();
  const perfiles = Object.keys(cobertura);
  if (claves.length) {
    md.push(`| | ${perfiles.join(' | ')} |`, `|---|${perfiles.map(() => '---:').join('|')}|`);
    for (const k of claves) md.push(`| ${k} | ${perfiles.map((p) => cobertura[p]![k] ?? '').join(' | ')} |`);
    md.push('');
  }
  md.push('## Resumen', '', '| Gravedad | Grupos | Sin corregir |', '|---|---:|---:|');
  for (const s of ORDEN) md.push(`| ${NOMBRE[s]} | ${porSev[s]} | ${abiertos[s]} |`);
  md.push('', 'Cada grupo es un mismo problema (tipo y firma: el elemento afectado) visto en una o más rutas. Las capturas están en `capturas/`. «Estado» es el triaje de `tests/qa/triaje.json`.', '');
  // a «corrected» group seen in this run: fine for a run of an older build, otherwise an incomplete fix, a regression
  // or a new problem caught by a too general pattern of the triage
  const vistos = lista.filter((g) => g.triaje?.estado === 'corregido').length;
  if (vistos)
    md.push(
      `**Ojo:** ${vistos} grupo(s) con triaje «corregido» aparecen en esta pasada. Si la compilación probada ya lleva los arreglos, cada uno es un arreglo incompleto, una regresión o un problema nuevo que encaja con un patrón demasiado general del triaje: hay que revisarlos.`,
      '',
    );
  for (const s of ORDEN) {
    const gs = lista.filter((g) => g.sev === s);
    if (!gs.length) continue;
    md.push(`## ${NOMBRE[s]} (${gs.length})`, '');
    for (const g of gs.slice(0, 150)) {
      const estado = g.triaje ? ` — **${ESTADO[g.triaje.estado]}**: ${g.triaje.nota}` : '';
      md.push(`- **${g.tipo}** · ${g.nRutas} ruta(s) · ${g.perfiles.join(', ')}${estado}`);
      md.push(`  ${g.msg.split('\n')[0]}`);
      md.push(`  Firma: \`${g.firma.replace(/`/g, "'")}\``);
      md.push(`  Rutas: ${g.rutas.slice(0, 6).join(', ')}${g.nRutas > 6 ? ` y ${g.nRutas - 6} más` : ''}`);
      if (g.semilla !== undefined) md.push(`  Mono: semilla ${g.semilla}; últimos pasos: ${(g.pasos ?? []).slice(-6).join(' → ')}`);
      if (g.captura) md.push(`  Captura: [${g.captura}](${g.captura})`);
    }
    if (gs.length > 150) md.push(`- … y ${gs.length - 150} grupos más en informe.json`);
    md.push('');
  }
  writeFileSync(`${INFORME}informe.md`, md.join('\n'));
  return { grupos: lista };
}

export default function informe(): void {
  const { grupos } = generarInforme();
  console.log(`\nInforme de QA: ${grupos.length} grupos de hallazgos → ${INFORME}informe.md e informe.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) informe();
