// Application log (0.9.2): a small ring of timestamped lines kept in localStorage, so that what happened before
// a freeze or a crash (the Android WebView closes the whole app when its renderer dies, with nothing to catch)
// can be read the next time and pasted into a conversation from «Diagnóstico» → «Registro de la aplicación».
// Each line is written to storage at once (a crash a moment later must not lose it); lines are short and rare
// (errors, warnings and a few milestones of the heavy views), so this costs nothing measurable.

export type NivelRegistro = 'info' | 'aviso' | 'error';

export interface LineaRegistro {
  /** Epoch ms. */
  t: number;
  n: NivelRegistro;
  /** Where it comes from: «app», «placa 3D», «diagnóstico», «consola»… */
  o: string;
  x: string;
}

const CLAVE = 'epa-registro';
/** Lines kept (the oldest are dropped). */
const MAX_LINEAS = 400;
/** Characters kept per line. */
const MAX_TEXTO = 600;

let lineas: LineaRegistro[] | null = null;

function cargar(): LineaRegistro[] {
  if (lineas) return lineas;
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(CLAVE) ?? '[]') as unknown;
    lineas = Array.isArray(v) ? (v as LineaRegistro[]).filter((l) => l && typeof l.t === 'number' && typeof l.x === 'string') : [];
  } catch {
    lineas = [];
  }
  return lineas;
}

function guardar(): void {
  try {
    globalThis.localStorage?.setItem(CLAVE, JSON.stringify(lineas ?? []));
  } catch {
    // Storage full or unavailable: keep the newest half and try once more.
    try {
      if (lineas) lineas = lineas.slice(-Math.floor(MAX_LINEAS / 2));
      globalThis.localStorage?.setItem(CLAVE, JSON.stringify(lineas ?? []));
    } catch {
      /* no storage: the log lives only in memory */
    }
  }
}

/** Adds a line to the log (and stores it at once). */
export function registrar(n: NivelRegistro, o: string, x: string): void {
  const l = cargar();
  l.push({ t: Date.now(), n, o, x: x.length > MAX_TEXTO ? `${x.slice(0, MAX_TEXTO)}…` : x });
  if (l.length > MAX_LINEAS) l.splice(0, l.length - MAX_LINEAS);
  guardar();
}

export function lineasRegistro(): readonly LineaRegistro[] {
  return cargar();
}

export function borrarRegistro(): void {
  lineas = [];
  guardar();
}

const dos = (x: number) => String(x).padStart(2, '0');

function hora(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

const MARCA: Record<NivelRegistro, string> = { info: ' ', aviso: '!', error: '✗' };

/** The whole log as plain text, oldest first, to copy or save. */
export function textoRegistro(version: string): string {
  const cab = [
    `Registro de la aplicación · Electrónica Práctica Avanzada ${version}`,
    `Copiado el ${hora(Date.now())} · ${globalThis.navigator?.userAgent ?? ''}`,
    '',
  ];
  return [...cab, ...cargar().map((l) => `${hora(l.t)} ${MARCA[l.n] ?? ' '} [${l.o}] ${l.x}`)].join('\n');
}

function aTexto(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}${v.stack ? `\n${v.stack.split('\n').slice(1, 4).join('\n')}` : ''}`;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

let instalado = false;

/**
 * Starts the log for this run: a first line with the version and the device, and the capture of uncaught
 * errors, rejected promises and console errors and warnings (the console keeps working as before).
 */
export function iniciarRegistro(version: string): void {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  registrar(
    'info',
    'app',
    `inicio ${version}; pantalla ${screen.width}×${screen.height} a ${window.devicePixelRatio || 1}x${nav.deviceMemory ? `; memoria ${nav.deviceMemory} GB` : ''}; ${nav.hardwareConcurrency ?? '?'} núcleos`,
  );
  window.addEventListener('error', (e) => {
    registrar('error', 'app', `${e.message || 'error'}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno}:${e.colno})` : ''}`);
  });
  window.addEventListener('unhandledrejection', (e) => registrar('error', 'app', `promesa rechazada: ${aTexto(e.reason)}`));
  const error = console.error.bind(console);
  const warn = console.warn.bind(console);
  console.error = (...a: unknown[]) => {
    registrar('error', 'consola', a.map(aTexto).join(' '));
    error(...a);
  };
  console.warn = (...a: unknown[]) => {
    registrar('aviso', 'consola', a.map(aTexto).join(' '));
    warn(...a);
  };
}
