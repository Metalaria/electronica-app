// «Informe de fallos» (1.0): a local crash and error report, separate from the application log (lib/registro.ts).
// Each entry is one failure with what is needed to understand it — time, version, platform, route, message, a trimmed
// stack and the last breadcrumbs (route changes and named actions of the app, never what the reader wrote) —, kept in
// a bounded ring in localStorage `epa-informe-fallos` (outside the `epa:` prefix: never in the reader's data, its
// backups or the synchronisation; nothing is ever sent anywhere). It survives reloads and a hard crash: the session
// record `epa-informe-sesion` is marked active while a page is visible and removed when it closes, so the next start
// finds a page that died while visible (the Android WebView kills the whole app when its renderer or GPU work dies,
// with nothing for the page to catch) and reports it with that page's breadcrumbs.
//
// Safety rules: no function here throws; a failure while reporting is swallowed (never a report of the report: an
// error event raised by a listener here would otherwise loop); entries are rate-limited and repeated ones counted;
// every text goes through `redactar` (GitHub tokens, long opaque strings, e-mails, quoted text, URLs reduced to the
// file name) and the breadcrumbs are only the app's own words.

export type TipoFallo =
  | 'error'
  | 'promesa'
  | 'componente'
  | 'simulador'
  | 'webgl'
  | 'almacenamiento'
  | 'migracion'
  | 'sincronizacion'
  | 'carga'
  | 'nativo'
  | 'cierre';

export interface EntradaFallo {
  /** Id (merging the copies of two tabs). */
  i?: string;
  /** Epoch ms (of the last repetition). */
  t: number;
  /** App version. */
  v: string;
  /** Platform («Android · tableta · Tauri», «macOS · navegador»…). */
  p: string;
  /** Route at the time (redacted: ids only). */
  r: string;
  k: TipoFallo;
  /** Message (redacted, ≤ 400 characters). */
  m: string;
  /** Stack (redacted, ≤ 8 lines). */
  s?: string;
  /** Where in the page: «la vista 3D», «la figura 5.3»… */
  z?: string;
  /** Last breadcrumbs before it, oldest first («11:02:03 ruta #/cap05»). */
  b: string[];
  /** Times it happened (consecutive repetitions within 10 minutes are counted, not added). */
  n: number;
  /** Already seen in «Diagnóstico». */
  visto?: boolean;
}

const CLAVE = 'epa-informe-fallos';
const CLAVE_SESION = 'epa-informe-sesion';
export const MAX_ENTRADAS = 40;
/** Characters of the stored JSON (the oldest entries are dropped first). */
export const MAX_TAMANO = 80_000;
export const MAX_MIGAS = 12;
const MAX_MENSAJE = 400;
const MAX_LINEAS_PILA = 8;
const MAX_LINEA_PILA = 160;
/** Rate limit: at most this many new entries per minute (repetitions only count). */
const POR_MINUTO = 10;

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

let almacenPropio: Almacen | null | undefined;
function almacen(): Almacen | null {
  if (almacenPropio !== undefined) return almacenPropio;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Tests: another storage (or null: memory only); `undefined` returns to localStorage. Resets the module's state. */
export function usarAlmacenamiento(a: Almacen | null | undefined): void {
  almacenPropio = a;
  memoria = { x: [], e: [] };
  migas = [];
  recientes = [];
  omitidas = 0;
  oyentes.clear();
  dentro = false;
}

// ------------------------------------------------------------------ redaction

/**
 * Exact texts of this device that must never be in the report, with what stands for them (review 10c: the data
 * repository «owner/name» and the synchronisation file's path, registered by AvisoFallo.svelte from the sync settings).
 */
const ocultos = new Map<string, string>();
export function ocultarEnInforme(texto: string, en: string): void {
  const x = String(texto ?? '').trim();
  if (x.length >= 3) ocultos.set(x, en);
}

/**
 * QA 1.0: what the reader typed in this page (answers, notes, an exam's texts, a search…), kept only in memory — never
 * stored — so that a message that repeats it (a parse error quoting a short answer, «"mis apuntes…" is not valid
 * JSON») is redacted even when it is not quoted or is short. The fields edited last (each one's current value, every
 * line of it); `iniciarInforme` feeds it from the document's `input` events, `textoDelLector` from anywhere else.
 */
const MAX_CAMPOS = 40;
const MAX_TEXTO_LECTOR = 4000;
const campos = new Map<unknown, string>();
export function textoDelLector(texto: string, de: unknown = texto): void {
  const x = String(texto ?? '').slice(0, MAX_TEXTO_LECTOR);
  campos.delete(de);
  if (x.trim().length < 4) return;
  campos.set(de, x);
  while (campos.size > MAX_CAMPOS) campos.delete(campos.keys().next().value);
}
/** Forgets the reader's texts (tests). */
export function olvidarTextosDelLector(): void {
  campos.clear();
}
const escaparRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function sinTextosDelLector(t: string): string {
  if (!campos.size) return t;
  const trozos = new Set<string>();
  for (const v of campos.values()) for (const l of v.split(/\r?\n/)) if (l.trim().length >= 4) trozos.add(l.trim());
  for (const x of [...trozos].sort((a, b) => b.length - a.length)) {
    if (x.length < 8) {
      // a short answer («10 kΩ», «hola») only as a whole word: not inside the app's own words
      t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaparRe(x)}(?![\\p{L}\\p{N}])`, 'gu'), '[texto]');
      continue;
    }
    t = t.split(x).join('[texto]');
    // a message that quotes only its beginning (a parse error shows the first characters): its longest prefix of
    // 8 characters or more found in the message
    for (let k = Math.min(x.length - 1, 200); k >= 8; k--) {
      const p = x.slice(0, k);
      if (t.includes(p)) {
        t = t.split(p).join('[texto]');
        break;
      }
    }
  }
  return t;
}

/**
 * The start of an absolute path, with how many of its first segments must never be kept: a user folder
 * («C:\\Users\\<name>», «Documents and Settings», «/Users/<name>», «/home/<name>»: 1), a network share
 * («\\\\server\\share», «//server/share»: 2), any other drive («D:\\», «D:/») or system root («/data/», «/mnt/»…: 0).
 * `file://` in front is part of it. Not inside a URL («https://host/data/…»: the host comes before).
 */
/**
 * Where an absolute path starts (review 10h: the last round of path forms). Alternatives, specific first:
 * `file:` with 0–3 slashes (Java's `file:/storage/…` has one) before a drive or a root; a drive «X:\» / «X:/»; a share or
 * device path «\\server\…», «//server/…», «\\wsl$\…», «\\?\C:\…», «\\.\…»; «/Users/», «/home/»; any other root
 * «/<name>/…» (Android's /storage, /sdcard, /data/user/0/<pkg>, macOS's /Volumes, /private, Linux's /mnt, /media, /run,
 * /root, /snap…); and the shorthands «~/», «%USERPROFILE%\», «$HOME/», «${HOME}/». Not inside a URL (the host comes
 * before) nor after «#» (the app's own routes).
 */
const INICIO_RUTA = new RegExp(
  [
    String.raw`file:\/{0,3}[A-Za-z]:[\\/](?:(?:Users|Documents and Settings)[\\/])?`,
    String.raw`file:\/{0,2}\/(?:Users|home)\/`,
    String.raw`file:\/{0,2}\/(?=[\w.$~-])`,
    String.raw`(?<![\w])[A-Za-z]:[\\/](?:(?:Users|Documents and Settings)[\\/])?`,
    String.raw`(?<![\w:/\\])(?:\\\\|\/\/)(?=[\w.$?-]+[\\/])`,
    String.raw`(?<![\w.:/#\\-])\/(?:Users|home)\/`,
    String.raw`(?<![\w.:/#\\-])\/(?=[\w.$-]+[\\/])`,
    String.raw`(?<![\w~])~[\\/]`,
    String.raw`%[A-Za-z_]+%[\\/]`,
    String.raw`\$\{?[A-Za-z_]+\}?[\\/]`,
  ].join('|'),
  'gi',
);

/**
 * An absolute path → «[ruta]<sep><file>» and what follows it (reviews 10c and 10f: names of people in a path carry
 * spaces and apostrophes — «C:\\Users\\Nombre Apellido\\…», «D:\\Datos de Nombre\\…», «/Users/Juan O'Brien/…» — and a
 * share names its server and user). The path is taken up to the end of the line (or a double or angle quote) and cut
 * at its LAST separator: everything before it goes; when the last segment is still one of the protected ones (the
 * user's own folder, the server or the share), the whole path goes.
 */
function sinRutas(t: string): string {
  let r = '';
  let desde = 0;
  INICIO_RUTA.lastIndex = 0;
  for (let m = INICIO_RUTA.exec(t); m; m = INICIO_RUTA.exec(t)) {
    if (m.index < desde) continue;
    const inicio = m[0];
    const protegidos = /^(?:\\\\|\/\/)/.test(inicio) ? 2 : /(?:Users|Documents and Settings|home)[\\/]$/i.test(inicio) ? 1 : 0;
    const fin = t.slice(m.index).search(/[\n"«»<>]/);
    const ruta = fin < 0 ? t.slice(m.index) : t.slice(m.index, m.index + fin);
    const resto = ruta.slice(inicio.length);
    const tramos = resto.split(/[\\/]/);
    let sustituto: string;
    if (tramos.length - 1 < protegidos) sustituto = '[ruta]';
    else {
      const ultimo = Math.max(ruta.lastIndexOf('/'), ruta.lastIndexOf('\\'));
      const cola = tramos[tramos.length - 1]!;
      sustituto = `[ruta]${ultimo >= inicio.length - 1 ? ruta[ultimo] : inicio[inicio.length - 1]}${cola}`;
    }
    r += t.slice(desde, m.index) + sustituto;
    desde = m.index + ruta.length;
    INICIO_RUTA.lastIndex = desde;
  }
  return r + t.slice(desde);
}

/** Removes from a text what must never be in the report: tokens, long opaque strings, e-mails, quoted text, paths. */
export function redactar(texto: string): string {
  let t = String(texto ?? '');
  // this device's own repository and file path, wherever they appear
  for (const [x, en] of ocultos) t = t.split(x).join(en);
  // what the reader typed (QA 1.0: the page promises «no incluye sus textos»)
  t = sinTextosDelLector(t);
  // GitHub tokens (classic, fine-grained, OAuth, app) and anything after «token», «Bearer», «Authorization»
  t = t.replace(/\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/g, '[token]');
  t = t.replace(/\b(bearer|token|authorization)(["':=\s]+)[A-Za-z0-9_\-.~+/]{12,}=*/gi, '$1$2[token]');
  // absolute paths, whole (before the URLs: «file:///Users/Nombre Apellido/…» has a space too)
  t = sinRutas(t);
  // GitHub addresses name the owner and the repository: nothing of them is kept
  t = t.replace(/\bhttps?:\/\/(?:api\.)?github(?:usercontent)?\.com\/[^\s()<>"'«»]*/gi, '[github]');
  // «owner/name» of a repository: quoted (any short quoted owner/name), or after «repositorio», «repo», «de», «en»
  t = t.replace(/([«"'“])[\w.-]+\/[\w.-]+([»"'”])/g, '$1[repositorio]$2');
  t = t.replace(/\b(repositorios?|repos?|de|en)(\s+)([A-Za-z0-9][\w.-]*)\/([A-Za-z0-9][\w.-]*)(?=[\s.,;:)]|$)/gi, (m0, a: string, b: string, x: string, y: string) =>
    // after «de» / «en» only owner/name shapes (both sides 3+ characters starting with a letter): «de 5 mA/V», «en km/h» stay
    /^repo/i.test(a) || (/^[A-Za-z][\w.-]{2,}$/.test(x) && /^[A-Za-z][\w.-]{2,}$/.test(y)) ? `${a}${b}[repositorio]` : m0,
  );
  // Android's content:// URIs carry the document's path percent-encoded in one segment («primary%3ADocuments%2F…»)
  t = t.replace(/\bcontent:\/\/[^\s()<>"'«»]*/gi, '[documento]');
  // URLs → their last path segment (an origin or a path can carry a user name: file:///Users/<name>/…), decoded
  // first (an encoded «%2F» hides more of the path inside one segment)
  t = t.replace(/\b(?:https?|file|tauri|asset|blob|ipc):\/\/[^\s()<>"'«»]*/gi, (u) => {
    const sin = u.split(/[?#]/)[0]!.replace(/\/+$/, '');
    let ultimo = sin.split('/').pop() ?? '';
    try {
      ultimo = decodeURIComponent(ultimo);
    } catch {
      /* kept encoded: it fails the check below */
    }
    ultimo = ultimo.split(/[\\/]/).pop() ?? '';
    return /^[\w.\-]{1,80}(:\d+){0,2}$/.test(ultimo) && !/^(https?|file|tauri|asset|blob|content|ipc):?$/i.test(ultimo) ? ultimo : '[url]';
  });
  // e-mail addresses
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]');
  // quoted text (the reader's own text or a piece of their data inside a message): kept only when short
  t = t.replace(/«[^«»]{33,}»|"[^"\n]{33,}"|“[^“”]{33,}”|'[^'\n]{33,}'/g, (q) => `${q[0]}[texto]${q[q.length - 1]}`);
  // long opaque strings (keys, hashes, tokens of any shape): letters and digits mixed, 24 characters or more
  t = t.replace(/\b[A-Za-z0-9_\-]{24,}\b/g, (w) => (/\d/.test(w) && /[A-Za-z]/.test(w) && !/^[a-z]+(?:[-_][a-z]+)*\d{0,3}$/i.test(w) ? '[…]' : w));
  return t;
}

/** A route with only its ids: segments that are not plain ids become «…» (no search text, no free text). */
export function rutaSegura(hash: string): string {
  let h = String(hash ?? '');
  try {
    h = decodeURIComponent(h);
  } catch {
    /* keep it encoded */
  }
  const [camino] = h.replace(/^#?\/?/, '').split(/[?]/);
  const partes = (camino ?? '').split('/').filter(Boolean).slice(0, 5);
  return '#/' + partes.map((p) => (/^[\w.:\-]{1,40}$/.test(p) ? p : '…')).join('/');
}

function recortar(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Message and trimmed stack of anything thrown. */
export function describir(e: unknown): { m: string; s?: string } {
  try {
    if (e instanceof Error || (e && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string')) {
      const err = e as Error;
      const nombre = err.name && err.name !== 'Error' ? `${err.name}: ` : '';
      const m = recortar(redactar(`${nombre}${err.message || '(sin mensaje)'}`), MAX_MENSAJE);
      const lineas = typeof err.stack === 'string' ? err.stack.split('\n') : [];
      // V8 repeats the message as the first line; WebKit and Gecko do not
      const pila = lineas
        .filter((l, i) => !(i === 0 && err.message && l.includes(err.message.slice(0, 40))))
        .map((l) => recortar(redactar(l.trim()), MAX_LINEA_PILA))
        .filter(Boolean)
        .slice(0, MAX_LINEAS_PILA);
      return pila.length ? { m, s: pila.join('\n') } : { m };
    }
    if (typeof e === 'string') return { m: recortar(redactar(e), MAX_MENSAJE) };
    // objects are not serialised: they can carry the reader's data
    if (e && typeof e === 'object') return { m: `(${(e as object).constructor?.name ?? 'objeto'} sin mensaje)` };
    return { m: recortar(redactar(String(e)), MAX_MENSAJE) };
  } catch {
    return { m: '(error sin descripción)' };
  }
}

// ------------------------------------------------------------------ platform and route

let versionApp = '0.0.0';
let rutaActual: () => string = () => rutaSegura(globalThis.location?.hash ?? '');

/** «Android · tableta · Tauri», «macOS · navegador», «Windows · Tauri»… from the user agent. */
export function plataforma(ua = globalThis.navigator?.userAgent ?? '', tauri = !!(globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__): string {
  const so = /Android/i.test(ua)
    ? `Android · ${/Mobile/i.test(ua) ? 'móvil' : 'tableta'}`
    : /iPhone|iPad/i.test(ua)
      ? 'iOS'
      : /Mac OS X|Macintosh/i.test(ua)
        ? 'macOS'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'desconocido';
  const motor = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/(\d+)/.test(ua) ? `Chromium ${/Chrome\/(\d+)/.exec(ua)![1]}` : /AppleWebKit/.test(ua) ? 'WebKit' : '';
  return [so, tauri ? 'Tauri' : 'navegador', motor].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------------ breadcrumbs

let migas: string[] = [];

const dos = (x: number) => String(x).padStart(2, '0');
function horaCorta(t: number): string {
  const d = new Date(t);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

/**
 * A breadcrumb: a route change or a named action of the app («simulación», «placa 3D: abrir», «PDF del examen»).
 * Only the app's own words: never a text the reader wrote, an exercise's statement or a value they typed.
 */
export function miga(texto: string): void {
  try {
    migas.push(`${horaCorta(Date.now())} ${recortar(redactar(texto), 80)}`);
    if (migas.length > MAX_MIGAS) migas.splice(0, migas.length - MAX_MIGAS);
    guardarSesion();
  } catch {
    /* never throws */
  }
}

export function migasActuales(): readonly string[] {
  return migas;
}

// ------------------------------------------------------------------ the ring

/**
 * What this page knows of the report: the stored one merged with its own entries (review 10f: each tab kept its own
 * copy and wrote it whole, so one tab's write dropped the other's new entries, and a «Borrar» in one tab came back with
 * the other's next write). Every read and every write merges with what is stored now: entries by id (the newer version
 * of each: more repetitions, then a later time; «seen» if either says so), and `x`, the ids cleared by «Borrar»
 * (the union of both), drops those entries in every tab, so a clear sticks. Review 10h (r10h·8): the first version
 * cleared by a time (`borrado`) and dropped every entry not later than it — with the clock ahead when «Borrar» was
 * pressed, every later failure disappeared until real time passed that moment; ids do not depend on the clock.
 */
interface Guardado {
  /** Ids cleared by «Borrar» (the newest MAX_BORRADOS). */
  x: string[];
  e: EntradaFallo[];
}
const MAX_BORRADOS = 400;
let memoria: Guardado = { x: [], e: [] };
let recientes: number[] = [];
let omitidas = 0;
let dentro = false;
const oyentes = new Set<(e: EntradaFallo) => void>();

function esEntrada(x: unknown): x is EntradaFallo {
  const e = x as EntradaFallo;
  return !!e && typeof e === 'object' && typeof e.t === 'number' && typeof e.m === 'string' && typeof e.k === 'string';
}

const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** The stored report (null: storage unavailable). Reads the 1.0 array form too. */
function leerGuardado(): Guardado | null {
  const a = almacen();
  if (!a) return null;
  let crudo: string | null;
  try {
    crudo = a.getItem(CLAVE);
  } catch {
    return null;
  }
  try {
    const v = JSON.parse(crudo ?? '[]') as unknown;
    const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Partial<Guardado> & { borrado?: unknown }) : null;
    const lista = Array.isArray(v) ? v : Array.isArray(o?.e) ? o!.e : [];
    const x = Array.isArray(o?.x) ? o!.x.filter((y): y is string => typeof y === 'string') : [];
    const e = lista.filter(esEntrada).map((e) => ({
        ...e,
        i: typeof e.i === 'string' ? e.i : `${e.t}|${e.k}|${e.m}`,
        b: Array.isArray(e.b) ? e.b.filter((x) => typeof x === 'string') : [],
        n: typeof e.n === 'number' ? e.n : 1,
      }));
    // the time-based clear of the 10f builds: what it covered, by id
    if (typeof o?.borrado === 'number') for (const y of e) if (y.t <= (o.borrado as number)) x.push(y.i);
    return { x, e };
  } catch {
    return { x: [], e: [] };
  }
}

/** Two views of the report as one (`a` wins a tie: this page's own latest change). */
function fusionar(a: Guardado, b: Guardado): Guardado {
  const borrados = new Set([...b.x, ...a.x]);
  const x = [...borrados].slice(-MAX_BORRADOS);
  const porId = new Map<string, EntradaFallo>();
  for (const x of [...b.e, ...a.e]) {
    const y = porId.get(x.i!);
    if (!y) {
      porId.set(x.i!, x);
      continue;
    }
    // x comes from `a` when both have it
    const nuevo = x.n > y.n || (x.n === y.n && x.t >= y.t) ? x : y;
    const otro = nuevo === x ? y : x;
    if (otro.visto && nuevo.n === otro.n && nuevo.t === otro.t) nuevo.visto = true;
    if (!nuevo.z && otro.z) nuevo.z = otro.z;
    if (!nuevo.s && otro.s) nuevo.s = otro.s;
    porId.set(x.i!, nuevo);
  }
  const e = [...porId.values()].filter((y) => !borrados.has(y.i!)).sort((p, q) => p.t - q.t);
  return { x, e };
}

function cargar(): EntradaFallo[] {
  const g = leerGuardado();
  memoria = g ? fusionar(memoria, g) : memoria;
  return memoria.e;
}

function acotar(g: Guardado): string {
  if (g.e.length > MAX_ENTRADAS) g.e.splice(0, g.e.length - MAX_ENTRADAS);
  let texto = JSON.stringify(g);
  while (texto.length > MAX_TAMANO && g.e.length > 1) {
    g.e.shift();
    texto = JSON.stringify(g);
  }
  return texto;
}

function guardar(): void {
  try {
    const g = leerGuardado();
    memoria = g ? fusionar(memoria, g) : memoria;
    const texto = acotar(memoria);
    const a = almacen();
    if (!a || !g) return;
    try {
      a.setItem(CLAVE, texto);
    } catch {
      // storage full: keep the newest quarter and try once more; else the report lives in memory only
      try {
        memoria.e.splice(0, memoria.e.length - Math.max(1, Math.floor(MAX_ENTRADAS / 4)));
        a.setItem(CLAVE, JSON.stringify(memoria));
      } catch {
        /* memory only */
      }
    }
  } catch {
    /* never throws */
  }
}

export interface OpcionesFallo {
  /** Where in the page («la vista 3D», «la figura 5.3»). */
  zona?: string;
  /** Show the notice «Ver el informe» (uncaught failures; a recovered one already shows its own fallback). */
  avisar?: boolean;
  /** Time of the failure (a crash found at the next start), else now. */
  t?: number;
  /** Breadcrumbs of another session (a crash found at the next start). */
  migas?: string[];
  ruta?: string;
  /** Version of another session (a crash found at the next start). */
  v?: string;
  /**
   * Failures recovered from elsewhere (the native side's file, emptied when read; a crash found at start): never
   * dropped by the rate limit (review 10c, r10c·4: panics beyond ten a minute were lost after being drained).
   */
  sinLimite?: boolean;
  /** Times it happened (several identical native lines merged into one entry). */
  n?: number;
}

/** The chunk a failed load names («PaginaCursos-BVRg3MRf.js»), to merge its two or three reports into one. */
function parteDe(m: string): string | null {
  return /[\w.-]+\.(?:m?js|css)\b/.exec(m)?.[0] ?? null;
}

/**
 * Adds a failure to the report (at once to storage). Returns the entry, or null when it was ignored (noise, the rate
 * limit, a failure while reporting). Never throws.
 */
export function informarFallo(k: TipoFallo, error: unknown, op: OpcionesFallo = {}): EntradaFallo | null {
  if (dentro) return null;
  dentro = true;
  try {
    const { m, s } = describir(error);
    if (esRuido(m)) return null;
    const ahora = Date.now();
    const l = cargar();
    const ultima = l[l.length - 1];
    const z = op.zona ? recortar(redactar(op.zona), 80) : undefined;
    let e: EntradaFallo;
    // one failed load reaches here two or three times (Vite's vite:preloadError, the rejected import, the page's
    // ErrorCarga — review 10c, r10c·5): within 15 s, the same chunk (or the same message) is the same failure
    const parte = k === 'carga' ? (parteDe(m) ?? m) : null;
    const misma = parte ? [...l].reverse().find((x) => x.k === 'carga' && ahora - x.t < 15_000 && (parteDe(x.m) ?? x.m) === parte) : undefined;
    if (misma) {
      if (z && !misma.z) misma.z = z;
      if (s && !misma.s) misma.s = s;
      e = misma;
    } else if (ultima && ultima.k === k && ultima.m === m && ultima.s === s && ultima.z === z && ahora - ultima.t < 10 * 60_000 && op.t === undefined) {
      ultima.n += op.n ?? 1;
      ultima.t = ahora;
      ultima.visto = false;
      e = ultima;
    } else {
      recientes = recientes.filter((t) => ahora - t < 60_000);
      if (!op.sinLimite && recientes.length >= POR_MINUTO) {
        omitidas++;
        return null;
      }
      if (!op.sinLimite) recientes.push(ahora);
      e = {
        i: nuevoId(),
        t: op.t ?? ahora,
        v: op.v ?? versionApp,
        p: plataforma(),
        r: op.ruta ?? safe(rutaActual, '#/'),
        k,
        m,
        ...(s ? { s } : {}),
        ...(z ? { z } : {}),
        b: (op.migas ?? migas).slice(-MAX_MIGAS),
        n: Math.max(1, Math.round(op.n ?? 1)),
      };
      l.push(e);
    }
    guardar();
    if (op.avisar)
      for (const f of [...oyentes]) {
        try {
          f(e);
        } catch {
          /* a listener that fails is not reported (it would loop) */
        }
      }
    return e;
  } catch {
    return null;
  } finally {
    dentro = false;
  }
}

function safe<T>(f: () => T, defecto: T): T {
  try {
    return f();
  } catch {
    return defecto;
  }
}

/** Messages that are not failures of the app. */
function esRuido(m: string): boolean {
  return (
    /^ResizeObserver loop/i.test(m) ||
    /^Script error\.?$/i.test(m) ||
    /^AbortError/.test(m) ||
    /Simulación sustituida o detenida/.test(m) ||
    /^SimulacionCancelada/.test(m)
  );
}

/**
 * The native side's file (`fallos_nativos`: lines «ms<TAB>text», emptied when read) into the report: identical
 * messages merged into one entry with their count and last time, none dropped by the rate limit (review 10c,
 * r10c·4). Returns how many lines were taken.
 */
export function informarNativos(texto: string): number {
  const grupos = new Map<string, { t: number; n: number }>();
  let lineas = 0;
  for (const l of String(texto ?? '').split('\n')) {
    const m = /^(\d+)\t(.+)$/.exec(l.trim());
    if (!m) continue;
    lineas++;
    const g = grupos.get(m[2]!);
    const t = Number(m[1]);
    if (g) {
      g.n++;
      g.t = Math.max(g.t, t);
    } else grupos.set(m[2]!, { t, n: 1 });
  }
  for (const [x, g] of grupos) informarFallo('nativo', x, { t: g.t, n: g.n, avisar: true, sinLimite: true });
  return lineas;
}

/** Called with each new failure that asks for the notice. Returns the function that stops listening. */
export function alNuevoFallo(f: (e: EntradaFallo) => void): () => void {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function entradasInforme(): readonly EntradaFallo[] {
  return cargar();
}

export function sinVer(): number {
  return cargar().filter((e) => !e.visto).length;
}

export function marcarVistas(): void {
  try {
    const l = cargar();
    if (!l.some((e) => !e.visto)) return;
    for (const e of l) e.visto = true;
    guardar();
  } catch {
    /* never throws */
  }
}

export function borrarInforme(): void {
  omitidas = 0;
  // the ids of every entry known now are cleared, not just removed: another tab's copy cannot bring them back
  // (review 10f), and nothing depends on the clock (review 10h)
  const g = leerGuardado();
  const todo = g ? fusionar(memoria, g) : memoria;
  memoria = { x: [...todo.x, ...todo.e.map((y) => y.i!)].slice(-MAX_BORRADOS), e: [] };
  guardar();
}

const NOMBRE: Record<TipoFallo, string> = {
  error: 'Error no capturado',
  promesa: 'Promesa rechazada sin capturar',
  componente: 'Fallo de un componente (recuperado)',
  simulador: 'Simulador (ngspice)',
  webgl: 'WebGL',
  almacenamiento: 'Almacenamiento',
  migracion: 'Actualización de los datos',
  sincronizacion: 'Sincronización',
  carga: 'Carga de una parte de la aplicación',
  nativo: 'Parte nativa (Tauri)',
  cierre: 'Cierre inesperado',
};

function fecha(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${horaCorta(t)}`;
}

/** The report as plain text (to paste in a conversation), newest first. */
export function textoInforme(version: string): string {
  const l = cargar();
  const cab = [
    `Informe de fallos · Electrónica Práctica Avanzada ${version}`,
    `Copiado el ${fecha(Date.now())} · ${plataforma()}`,
    `${l.length === 1 ? '1 fallo' : `${l.length} fallos`}${omitidas ? ` (${omitidas} más omitidos por repetirse demasiado)` : ''}`,
    '',
  ];
  if (!l.length) return [...cab, 'Sin fallos registrados.'].join('\n');
  const cuerpo = [...l].reverse().map((e, i) =>
    [
      `${i + 1}. ${fecha(e.t)} · ${NOMBRE[e.k] ?? e.k}${e.n > 1 ? ` (×${e.n})` : ''}`,
      `   Versión ${e.v} · ${e.p} · ${e.r}${e.z ? ` · ${e.z}` : ''}`,
      `   ${e.m}`,
      ...(e.s ? e.s.split('\n').map((x) => `     ${x}`) : []),
      ...(e.b.length ? ['   Antes:', ...e.b.map((x) => `     ${x}`)] : []),
    ].join('\n'),
  );
  return [...cab, cuerpo.join('\n\n')].join('\n');
}

// ------------------------------------------------------------------ the session record (hard crashes)

interface Sesion {
  /** Last update. */
  t: number;
  e: 'activa' | 'oculta';
  v: string;
  r: string;
  b: string[];
}

const idSesion = Math.random().toString(36).slice(2, 10);
let sesionIniciada = false;

function leerSesiones(): Record<string, Sesion> {
  try {
    const v = JSON.parse(almacen()?.getItem(CLAVE_SESION) ?? '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Sesion>) : {};
  } catch {
    return {};
  }
}

function escribirSesiones(s: Record<string, Sesion>): void {
  try {
    if (Object.keys(s).length) almacen()?.setItem(CLAVE_SESION, JSON.stringify(s));
    else almacen()?.removeItem(CLAVE_SESION);
  } catch {
    /* never throws */
  }
}

let estadoSesion: Sesion['e'] = 'activa';
function guardarSesion(): void {
  if (!sesionIniciada) return;
  const s = leerSesiones();
  s[idSesion] = { t: Date.now(), e: estadoSesion, v: versionApp, r: safe(rutaActual, '#/'), b: migas.slice(-MAX_MIGAS) };
  escribirSesiones(s);
}

function cerrarSesion(): void {
  if (!sesionIniciada) return;
  const s = leerSesiones();
  delete s[idSesion];
  escribirSesiones(s);
}

/**
 * How long a visible page's record may go without its heartbeat before the page counts as dead (review 10c,
 * r10c·2: a 1,2 s answer window took a tab busy with a PDF or a synchronisation at CPU ×6 for a crash). A live visible
 * page writes its record every `SIN_LATIDO_MS / 6` (20 s); a page busy for two minutes without a single free moment
 * is hung in any case. Tests shorten it with `window.__epaInformeSinLatido` (ms).
 */
export const SIN_LATIDO_MS = 120_000;
let sinLatido = SIN_LATIDO_MS;

export interface OpcionesCierres {
  sinLatido?: number;
  /** Waits (tests: a fake clock). */
  esperar?: (ms: number) => Promise<void>;
  /** How long live pages get to answer on the channel before a record is taken as dead (only an extra check). */
  respuesta?: number;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Pages that died while visible: a record of another page still marked active whose heartbeat does not advance for
 * `sinLatido` (checked again after waiting when it is recent: right after a crash the next start comes within
 * seconds) and that does not answer on the channel either. Each becomes a «cierre» entry (with its own time,
 * version, route and breadcrumbs). A page that was hidden, closed properly (pagehide, beforeunload) or is still
 * writing its heartbeat is never reported: a false negative is preferred to a false positive.
 */
export async function revisarCierres(op: OpcionesCierres = {}): Promise<EntradaFallo[]> {
  const limite = op.sinLatido ?? sinLatido;
  const esperar = op.esperar ?? dormir;
  try {
    const ahora = Date.now();
    const s0 = leerSesiones();
    // records of hidden pages long gone: forgotten (the system closes background pages; not a crash)
    let limpiar = false;
    for (const [id, x] of Object.entries(s0))
      if (id !== idSesion && (!x || x.e !== 'activa') && ahora - (typeof x?.t === 'number' ? x.t : 0) > 7 * 86_400_000) {
        delete s0[id];
        limpiar = true;
      }
    if (limpiar) escribirSesiones(s0);
    const vistas = Object.entries(s0).filter(([id, x]) => id !== idSesion && x && x.e === 'activa' && typeof x.t === 'number');
    if (!vistas.length) return [];
    // a recent record: wait until its heartbeat would have come again, then look once more
    const masReciente = Math.max(...vistas.map(([, x]) => x.t));
    const falta = masReciente + limite - Date.now();
    if (falta > 0) await esperar(Math.min(limite, falta + 1000));
    const s = leerSesiones();
    const muertas = vistas.filter(([id, x]) => {
      const y = s[id];
      // gone (closed properly), hidden now, or its heartbeat moved on: alive
      return !!y && y.e === 'activa' && y.t === x.t && Date.now() - y.t >= limite;
    });
    if (!muertas.length) return [];
    // and the last word to the page itself: a page that answers is alive (it was hung, not dead)
    const vivas = new Set<string>();
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const canal = new BroadcastChannel('epa-informe');
        canal.onmessage = (ev: MessageEvent<{ vivo?: string }>) => {
          if (typeof ev.data?.vivo === 'string') vivas.add(ev.data.vivo);
        };
        canal.postMessage({ pregunta: idSesion });
        await esperar(op.respuesta ?? 3000);
        canal.close();
      } catch {
        /* no channel: the heartbeat decides */
      }
    }
    const s2 = leerSesiones();
    const nuevas: EntradaFallo[] = [];
    for (const [id, x] of muertas) {
      if (vivas.has(id) || !s2[id] || s2[id]!.t !== x.t || s2[id]!.e !== 'activa') continue;
      delete s2[id];
      const e = informarFallo('cierre', 'La aplicación se cerró de golpe mientras se usaba (la página no llegó a terminar).', {
        t: x.t,
        v: typeof x.v === 'string' ? x.v : undefined,
        migas: Array.isArray(x.b) ? x.b.filter((y) => typeof y === 'string') : [],
        ruta: typeof x.r === 'string' ? rutaSegura(x.r) : '#/',
        avisar: true,
        sinLimite: true,
      });
      if (e) nuevas.push(e);
    }
    escribirSesiones(s2);
    return nuevas;
  } catch {
    return [];
  }
}

/**
 * Whether this page takes part in the crash detection: not in the desktop app (review 10c: Tauri may close the
 * window — Cmd+Q, closing it, the restart after an update — without pagehide, which would read as a crash next
 * time; there the WebView rarely dies on its own). The Android app and the browsers do.
 */
export function detectaCierres(ua = globalThis.navigator?.userAgent ?? '', tauri = !!(globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__): boolean {
  return !tauri || /Android|iPhone|iPad/i.test(ua);
}

let instalado = false;

/**
 * Starts the report for this page: the version, how to read the route, the capture of uncaught errors, rejected
 * promises and failed chunk loads (Vite's `vite:preloadError`), the session record and the check for an earlier page
 * that died while visible.
 */
export function iniciarInforme(version: string, op: { ruta?: () => string } = {}): void {
  versionApp = version;
  if (op.ruta) rutaActual = op.ruta;
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  try {
    // the reader's texts, as typed (only in memory: see textoDelLector)
    document.addEventListener(
      'input',
      (e: Event) => {
        const el = e.target as HTMLElement | null;
        if (el instanceof HTMLTextAreaElement) textoDelLector(el.value, el);
        else if (el instanceof HTMLInputElement && !/^(range|checkbox|radio|color|file|button|submit|reset|hidden|image)$/i.test(el.type)) textoDelLector(el.value, el);
        else if (el?.isContentEditable) textoDelLector(el.textContent ?? '', el);
      },
      true,
    );
    window.addEventListener('error', (e: ErrorEvent) => {
      // resource errors (an <img> that did not load) have no message and are not failures of the app
      if (!e.message && !e.error) return;
      if (e.filename && /^(chrome|moz|safari)-extension:/.test(e.filename)) return;
      informarFallo('error', e.error ?? `${e.message}${e.filename ? ` (${e.filename}:${e.lineno}:${e.colno})` : ''}`, { avisar: true });
    });
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      const r = e.reason as unknown;
      informarFallo(esCargaFallida(r) ? 'carga' : 'promesa', r, { avisar: true });
    });
    // A lazy chunk that did not arrive (a stale cache after an update, or no network): Vite fires this before the
    // import rejects; the page that asked for it shows its own notice with «Reintentar».
    window.addEventListener('vite:preloadError', (e: Event) => {
      informarFallo('carga', (e as Event & { payload?: unknown }).payload ?? 'No se pudo cargar una parte de la aplicación', { avisar: true });
    });
    if (!detectaCierres()) return;
    const prueba = (window as unknown as { __epaInformeSinLatido?: number }).__epaInformeSinLatido;
    if (typeof prueba === 'number' && prueba > 0) sinLatido = prueba;
    sesionIniciada = true;
    estadoSesion = document.visibilityState === 'hidden' ? 'oculta' : 'activa';
    guardarSesion();
    document.addEventListener('visibilitychange', () => {
      estadoSesion = document.visibilityState === 'hidden' ? 'oculta' : 'activa';
      guardarSesion();
    });
    // the heartbeat of a visible page (a hidden one is not watched)
    setInterval(() => {
      if (document.visibilityState !== 'hidden') guardarSesion();
    }, Math.max(1000, Math.round(sinLatido / 6)));
    // closed properly: no record left behind
    window.addEventListener('pagehide', cerrarSesion);
    window.addEventListener('beforeunload', cerrarSesion);
    // frozen by the browser (Page Lifecycle): like hidden
    document.addEventListener('freeze', () => {
      estadoSesion = 'oculta';
      guardarSesion();
    });
    // a page shown again from the back-forward cache is alive again
    window.addEventListener('pageshow', (e: PageTransitionEvent) => {
      if (e.persisted) guardarSesion();
    });
    try {
      const canal = new BroadcastChannel('epa-informe');
      canal.onmessage = (ev: MessageEvent<{ pregunta?: string }>) => {
        if (typeof ev.data?.pregunta === 'string' && ev.data.pregunta !== idSesion) canal.postMessage({ vivo: idSesion });
      };
    } catch {
      /* no channel */
    }
    void revisarCierres();
  } catch {
    /* never throws */
  }
}

/** A dynamic import or a lazy chunk that did not arrive. */
export function esCargaFallida(e: unknown): boolean {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return /dynamically imported module|importing a module script failed|error loading dynamically imported|unable to preload|failed to load module script/i.test(m);
}
