// One session of the app with DAMAGED stored data (fourth review, finding 4): every key the app stores — each
// synchronised store, `sinc-estado`, `sinc-marcas`, the settings — holds the malformed value number <variante>
// (null, a number, a text, arrays, items null or of the wrong type, records that are not tuples…). The app must load,
// read every store and synchronise twice (fake GitHub) without throwing; prints JSON {variante, ok, error, problemas}.
//   node --no-warnings --import ./tests/actualizacion/registrar.mjs tests/actualizacion/datos-rotos.ts <variante>
import { datos } from './navegador.ts';

setTimeout(() => {
  console.log(JSON.stringify({ problemas: ['TIEMPO AGOTADO'] }));
  process.exit(3);
}, 90_000).unref?.();

const variante = Number(process.argv[2] ?? 0);
export const VARIANTES: unknown[] = [
  null,
  42,
  'texto',
  [],
  [1, null, 'x'],
  { a: null, b: 7 },
  { a: 'x', b: [1, 2], c: true },
  { a: {}, b: { t: 'no' } },
  { version: 1, circuitos: null, items: null, dias: null, xp: null, logros: null, superadas: null, pruebas: null },
  { version: 1, circuitos: { a: null, b: 3 }, items: { a: null }, dias: { a: 'x' }, xp: { a: null }, logros: { a: 'x' }, superadas: { a: null }, pruebas: { a: 1 } },
  { version: 99, circuitos: [], items: [], dias: [] },
];
const CLAVES = [
  'prefs', 'posiciones', 'marcadores', 'notas', 'leidas', 'ejercicios', 'deducciones',
  'repaso-tarjetas', 'repaso-diario', 'repaso-ajustes', 'repaso-tests', 'repaso-fallos', 'repaso-examenes',
  'calc-favoritos', 'editor-circuitos', 'protoboard-circuitos', 'progreso-diario', 'progreso-objetivo', 'lecciones',
  'progreso-xp', 'cursos', 'dominio', 'problema-dia',
  // 0.12: the device id of the per-device records (the daily activity) and the automatic backup
  'dispositivo-local', 'copia-automatica',
  // 1.0: the schema versions (lib/migrar.ts: a damaged value is read as «0.12 data», every migration idempotent) and the
  // backup made before the migration
  'esquemas', 'copia-migracion',
];
const v = VARIANTES[variante % VARIANTES.length];
for (const k of CLAVES) datos.set(`epa:${k}`, JSON.stringify(v));
// the synchronisation's own records, damaged in their own ways
const estados: unknown[] = [
  { doc: 'd', dispositivo: 'x', ultima: 5, items: { notas: { a: null, b: 5, c: [1], d: [1, 'h', 'n'], e: 'x' }, marcadores: null }, borrados: { notas: { f: null, g: 'x' }, x: 4 } },
  { doc: 5, items: [], borrados: [] },
  null,
  'roto',
  { items: { notas: [1, 2] }, resumen: { dispositivos: 'no' } },
  { items: {}, resumen: { recibidos: 'x', dispositivos: [null, 5, { nombre: 3 }, { nombre: 'Mac', version: '0.11', ultima: 1, este: true }], porAlmacen: { notas: 'x', marcadores: 2 } } },
];
const marcas: unknown[] = [
  { cambios: { notas: { a: 'x', b: null } }, borrados: null, huellas: 5 },
  { cambios: [], borrados: { notas: [1] }, huellas: { notas: { a: 1 } } },
  null,
  'roto',
  { cambios: { notas: null }, borrados: { notas: { a: Infinity } } },
];
datos.set('epa:sinc-estado', JSON.stringify(estados[variante % estados.length]));
datos.set('epa:sinc-marcas', JSON.stringify(marcas[variante % marcas.length]));
datos.set('epa:sinc-ajustes', JSON.stringify(variante % 2 ? { auto: false } : { repositorio: 5, ruta: null, auto: 'x' }));
datos.set('epa-credencial:github', 'tok');

// a fake GitHub whose file holds valid items of some stores (they must be applied over the damaged local data); in
// every third variant its device list is damaged too (sixth review, finding 3: a null entry broke every run)
const rotosEnFichero = variante % 3 === 0;
let texto: string | undefined = JSON.stringify({
  formato: 'epa-sincronizacion',
  version: 1,
  id: 'f',
  actualizado: 1,
  podado: 0,
  dispositivos: rotosEnFichero ? { roto: null, texto: 'x', numero: 7, sinNombre: { nombre: 5, ultima: 1 }, tableta: { nombre: 'Tableta', version: '0.11', ultima: 3 } } : {},
  almacenes: {
    notas: { z: { t: 5, v: { parte: 'cap01', label: 'z', num: '1', titulo: 'Z', texto: 'del fichero', t: 5 } } },
    marcadores: { z: { t: 5, v: { parte: 'cap01', label: 'z', num: '1', titulo: 'Z', t: 5 } } },
  },
});
let sha = 1;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
(globalThis as { fetch: unknown }).fetch = async (url: string, init: RequestInit = {}) => {
  const u = new URL(String(url));
  if ((init.method ?? 'GET') === 'GET') {
    if (!u.pathname.includes('/contents/')) return json(200, { full_name: 'x', private: true });
    if (texto == null) return json(404, { message: 'Not Found' });
    return json(200, { type: 'file', sha: `s${sha}`, encoding: 'base64', content: Buffer.from(texto, 'utf8').toString('base64') });
  }
  const b = JSON.parse(String(init.body)) as { sha?: string; content: string };
  if (b.sha !== `s${sha}`) return json(409, {});
  texto = Buffer.from(b.content, 'base64').toString('utf8');
  sha++;
  return json(200, { content: { sha: `s${sha}` } });
};

const problemas: string[] = [];
const errores: string[] = [];
process.on('unhandledRejection', (e) => errores.push(`promesa rechazada sin capturar: ${(e as Error)?.message ?? e}`));
let ok: unknown = null;
let error = '';
let almacen = '';
try {
  const R = await import('../../src/lib/sincronizacion/registro.svelte.ts');
  const U = await import('../../src/lib/usuario.svelte.ts');
  await U.cargarUsuario();
  almacen = U.usuario.almacen;
  if (almacen !== (process.env.EPA_TAURI === '1' ? 'tauri' : 'navegador')) problemas.push(`almacenamiento inesperado: ${almacen}`);
  for (const s of R.sincronizables()) {
    try {
      const x = await s.leer();
      if (!x || typeof x !== 'object') problemas.push(`${s.clave}: leer() no da un objeto`);
    } catch (e) {
      problemas.push(`${s.clave}: leer() lanza ${(e as Error).message}`);
    }
  }
  const S = await import('../../src/lib/sincronizacion/sincronizar.svelte.ts');
  // the settings page's summary only holds well-formed entries (it renders each device's name)
  await S.cargarSinc();
  for (const d of S.sinc.resumen?.dispositivos ?? []) if (!d || typeof d.nombre !== 'string') problemas.push(`resumen con un dispositivo mal formado: ${JSON.stringify(d)}`);
  for (let i = 0; i < 2; i++) {
    ok = await S.sincronizar(true);
    error = S.sinc.error;
    if (ok !== true) problemas.push(`pasada ${i + 1}: ${error}`);
  }
  for (const d of S.sinc.resumen?.dispositivos ?? []) if (!d || typeof d.nombre !== 'string') problemas.push(`resumen tras sincronizar con un dispositivo mal formado: ${JSON.stringify(d)}`);
  if (rotosEnFichero) {
    if (!S.sinc.resumen?.dispositivos.some((d) => d.nombre === 'Tableta')) problemas.push('el resumen perdió el dispositivo válido del fichero');
    const disp = (JSON.parse(texto!) as { dispositivos: Record<string, unknown> }).dispositivos;
    for (const [k, d] of Object.entries(disp))
      if (!d || typeof d !== 'object' || typeof (d as { nombre?: unknown }).nombre !== 'string') problemas.push(`el fichero conserva un dispositivo mal formado: ${k}`);
    if (!disp.tableta) problemas.push('el fichero perdió el dispositivo válido');
  }
  // 0.12: the backup of the damaged data can be made and imported back («unir» and «sustituir»), and the daily progress
  // still adds up a step studied now
  const C = await import('../../src/lib/sincronizacion/copia.ts');
  try {
    const c = await C.crearCopia();
    const l = C.leerFicheroCopia(c.texto);
    await C.importar(l, 'unir');
    await C.importar(l, 'sustituir');
    if (!(await C.leerCopiaAutomatica())) problemas.push('no quedó la copia automática');
  } catch (e) {
    problemas.push(`copia de seguridad: ${(e as Error).message}`);
  }
  try {
    C.leerFicheroCopia(JSON.stringify(v));
    problemas.push('un fichero dañado se aceptó como copia');
  } catch (e) {
    if (!(e instanceof C.ErrorCopia)) problemas.push(`un fichero dañado lanza ${(e as Error).message}`);
  }
  const D = await import('../../src/lib/progreso-diario.svelte.ts');
  await D.cargarProgresoDiario();
  const antesPasos = D.progresoDiario.hoy.pasos;
  D.registrarActividad('paso', 2);
  if (D.progresoDiario.hoy.pasos !== antesPasos + 2) problemas.push(`el progreso diario no suma (${antesPasos} → ${D.progresoDiario.hoy.pasos})`);
  const notas = JSON.parse(datos.get('epa:notas') ?? 'null') as Record<string, { texto?: string }> | null;
  if (notas?.z?.texto !== 'del fichero') problemas.push('la nota del fichero no se aplicó sobre los datos dañados');
  JSON.parse(texto!);
} catch (e) {
  problemas.push(`lanza: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
}
await new Promise((r) => setTimeout(r, 300));
console.log(JSON.stringify({ variante, almacen, ok, error, problemas: [...problemas, ...errores] }));
process.exit(0);
