// Reading of what ngspice prints: measurements grouped in sections, errors and warnings, clean text.
// Plain TypeScript (runs in the app and in Node, for the build-time validator).

import { MARCA_ECO, numeroSpice } from './netlist.ts';

export interface Medida {
  nombre: string;
  valor: number;
  /** Imaginary part when ngspice printed a complex value («re,im»). */
  im?: number;
  /** What follows the value: «at= 3.0e-03», «targ= … trig= …». */
  extra?: string;
  /** Printed by an `echo` of the netlist («R = 2.2k»), not by ngspice itself. */
  eco?: true;
}

export interface SeccionSalida {
  /** Heading: the text of an `echo`, «Medidas (.meas) del análisis de alterna», or '' before the first. */
  titulo: string;
  /** Further echo lines printed before the first measurement of the section. */
  notas: string[];
  medidas: Medida[];
}

export interface Diagnostico {
  /** ngspice error lines, as printed. */
  errores: string[];
  avisos: string[];
  /** Explanations in Spanish for the errors recognised. */
  explicaciones: string[];
}

export interface SalidaAnalizada extends Diagnostico {
  secciones: SeccionSalida[];
  /** Output as shown to the reader (markers removed). */
  texto: string;
}

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[-+]?(?:inf|nan)`;
const RE_MEDIDA = new RegExp(String.raw`^\s*([A-Za-z_@#][^\s=]*)\s*=\s*(${NUM})(?:\s*,\s*(${NUM}))?(?:\s+(\S.*))?$`);

const ANALISIS_ES: Record<string, string> = {
  ac: 'de alterna',
  dc: 'de continua',
  tran: 'transitorio',
  transient: 'transitorio',
  noise: 'de ruido',
  op: 'del punto de trabajo',
  sp: 'de parámetros S',
};

function numero(s: string): number {
  const t = s.toLowerCase();
  if (t.endsWith('inf')) return t.startsWith('-') ? -Infinity : Infinity;
  if (t.endsWith('nan')) return NaN;
  return parseFloat(s);
}

/** A «name = value» line (print of a scalar, meas result), or null. */
export function leerMedida(linea: string): Medida | null {
  const m = RE_MEDIDA.exec(linea);
  if (!m) return null;
  const med: Medida = { nombre: m[1]!, valor: numero(m[2]!) };
  if (m[3] !== undefined) med.im = numero(m[3]);
  if (m[4]) {
    // Only accept known trailers, so ordinary sentences with «=» are not taken as measurements.
    if (!/^(at|targ|trig|from|to|width|integ|avg|rms|pp|min|max)\b|^[a-z_]+\s*=/i.test(m[4])) return null;
    med.extra = m[4].replace(/\s+/g, ' ').trim();
  }
  return med;
}

const EXPLICACIONES: [RegExp, string][] = [
  [/timestep too small/i, 'El paso de tiempo se ha hecho demasiado pequeño: el análisis transitorio no converge.'],
  [/singular matrix/i, 'Matriz singular: suele deberse a un nodo flotante (sin camino de continua a masa) o a una malla de fuentes de tensión o bobinas.'],
  [/gmin stepping failed|source stepping failed|iteration limit|no convergence|failed to converge/i, 'El punto de trabajo no converge.'],
  [/could not find a valid modelname|unable to find definition of model|model .* not found|can't find model/i, 'Falta el .model de algún componente (o su nombre está mal escrito).'],
  [/unknown subckt|could not find subckt|subcircuit .* not found/i, 'Falta la definición de un subcircuito (.subckt).'],
  [/no such vector|vector .* not (found|available)|is not available/i, 'Se pide un vector que no existe: nodo mal escrito o análisis que no se ha ejecutado.'],
  [/circuit not parsed|error on line|syntax error|unknown device type|too few nodes|unknown parameter/i, 'Hay errores de sintaxis en la netlist.'],
  [/there is no circuit|no circuit loaded/i, 'No hay circuito cargado: la netlist no se ha podido leer.'],
  [/duplicate|already defined|already exists/i, 'Hay nombres repetidos (componentes o modelos).'],
  [/measure.*(failed|out of interval)|meas.*failed/i, 'Alguna medida (.meas) no ha encontrado el punto que busca.'],
];

function esError(l: string): boolean {
  return (
    /^\s*(error|fatal)\b/i.test(l) ||
    /\berror:|simulation\(s\) aborted|simulation interrupted|circuit not parsed|timestep too small|singular matrix|no such vector/i.test(l)
  );
}

function esAviso(l: string): boolean {
  return /^\s*warning\b/i.test(l);
}

/** Splits the printed output into sections of measurements and collects errors and warnings. */
export function analizarSalida(salida: string): SalidaAnalizada {
  const secciones: SeccionSalida[] = [{ titulo: '', notas: [], medidas: [] }];
  const errores: string[] = [];
  const avisos: string[] = [];
  const texto: string[] = [];
  let actual = secciones[0]!;

  // A heading before any measurement of the current section completes it; otherwise it starts a new one.
  const abrir = (titulo: string) => {
    if (actual.medidas.length) {
      actual = { titulo, notas: [], medidas: [] };
      secciones.push(actual);
    } else if (actual.titulo) {
      actual.notas.push(titulo);
    } else {
      actual.titulo = titulo;
    }
  };

  // «Error on line N or its substitute:» is followed by the offending line and the cause: join them.
  let continuar = 0;
  for (const l of salida.split('\n')) {
    if (continuar > 0 && l.trim() && !l.startsWith(MARCA_ECO)) {
      continuar--;
      texto.push(l);
      errores[errores.length - 1] += ` ${continuar === 1 ? '→' : '—'} ${l.trim()}`;
      continue;
    }
    continuar = 0;
    if (l.startsWith(MARCA_ECO)) {
      const t = l.slice(MARCA_ECO.length).replace(/^ /, '');
      texto.push(t);
      // «echo R = $rval» prints «R = 2.2k»: a value (with a SPICE suffix), not a heading.
      const eco = /^\s*([A-Za-z_][\w().]*)\s*=\s*(\S+)\s*$/.exec(t);
      const vEco = eco ? numeroSpice(eco[2]!) : null;
      const med = leerMedida(t) ?? (eco && vEco !== null ? { nombre: eco[1]!, valor: vEco, eco: true as const } : null);
      if (med) {
        actual.medidas.push(med);
        continue;
      }
      // Decorative separators («-----», «=== x ===») are trimmed; empty echoes do not start a section.
      const titulo = t.replace(/^[\s\-=*#_:.]+|[\s\-=*#_:]+$/g, '').trim();
      if (titulo) abrir(titulo);
      continue;
    }
    texto.push(l);
    const ban = /^\s*Measurements for (\w+)/i.exec(l);
    if (ban) {
      const a = ban[1]!.toLowerCase();
      abrir(`Medidas (.meas) del análisis ${ANALISIS_ES[a] ?? a}`);
      continue;
    }
    // «Warning: singular matrix» is recoverable (ngspice goes on with gmin stepping): warnings first.
    if (esAviso(l)) {
      avisos.push(l.trim());
      continue;
    }
    if (esError(l)) {
      errores.push(l.trim());
      if (/error on line \d+.*:\s*$/i.test(l)) continuar = 2;
      continue;
    }
    const med = leerMedida(l);
    if (med) actual.medidas.push(med);
  }

  const explicaciones: string[] = [];
  for (const [re, txt] of EXPLICACIONES) {
    if (errores.some((e) => re.test(e)) && !explicaciones.includes(txt)) explicaciones.push(txt);
  }
  // The generic «syntax» explanation only when nothing more specific was recognised.
  const generica = 'Hay errores de sintaxis en la netlist.';
  if (explicaciones.length > 1 && explicaciones.includes(generica)) explicaciones.splice(explicaciones.indexOf(generica), 1);
  return {
    secciones: secciones.filter((s) => s.medidas.length || s.titulo),
    errores,
    avisos,
    explicaciones,
    texto: texto.join('\n'),
  };
}

/** All measurements in order, flattened (for tests and comparisons). */
export function todasLasMedidas(s: { secciones: SeccionSalida[] }): Medida[] {
  return s.secciones.flatMap((x) => x.medidas);
}
