// 1.0 performance and stability, without a browser: the «Informe de fallos» (ring buffer and its size bound,
// repetitions counted, rate limit, redaction of tokens / user text / paths, no loop when reporting fails or a listener
// reports again, a broken stored value), the WOFF → sfnt conversion of the PDF fonts (same glyphs, same PDF bytes,
// fontkit no longer reads a WOFF) and the PDF's time with a generous bound.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.rendimiento10.config.ts tests/rendimiento10-unidad.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';
import {
  alNuevoFallo,
  detectaCierres,
  informarNativos,
  ocultarEnInforme,
  revisarCierres,
  borrarInforme,
  describir,
  entradasInforme,
  informarFallo,
  MAX_ENTRADAS,
  MAX_MIGAS,
  MAX_TAMANO,
  miga,
  olvidarTextosDelLector,
  plataforma,
  redactar,
  rutaSegura,
  textoDelLector,
  textoInforme,
  usarAlmacenamiento,
} from '../src/lib/informe-fallos';
import { esWoff, sfntDeWoff } from '../src/lib/woff';
import { cargarLibro, recursosNode } from './docente10/libro-node';
import { bancoDe } from '../src/lib/docente/banco';
import { montarExamen } from '../src/lib/docente/examen';
import { documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import { PDFFont } from 'pdf-lib';

class Memoria {
  m = new Map<string, string>();
  escrituras = 0;
  falla = false;
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.escrituras++;
    if (this.falla) throw new DOMException('lleno', 'QuotaExceededError');
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const TOKEN_CLASICO = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
const TOKEN_FINO = ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_');

test.beforeEach(() => usarAlmacenamiento(new Memoria()));
test.afterAll(() => usarAlmacenamiento(undefined));

// ------------------------------------------------------------------ the ring

test('anillo: acotado en entradas y en tamaño, lo más nuevo se queda, sobrevive a «recargar» (otro módulo, mismo almacén)', () => {
  const a = new Memoria();
  usarAlmacenamiento(a);
  const ahora = Date.now;
  let t = 1_800_000_000_000;
  Date.now = () => (t += 61_000); // one a minute: the rate limit does not apply
  try {
    for (let i = 0; i < MAX_ENTRADAS + 25; i++) informarFallo('error', new Error(`fallo número ${i} ` + 'x'.repeat(i % 3 ? 10 : 300)));
  } finally {
    Date.now = ahora;
  }
  const l = entradasInforme();
  expect(l.length).toBeLessThanOrEqual(MAX_ENTRADAS);
  expect(l.at(-1)!.m).toContain(`fallo número ${MAX_ENTRADAS + 24}`);
  expect(a.getItem('epa-informe-fallos')!.length).toBeLessThanOrEqual(MAX_TAMANO);
  // stored at once, read back by a fresh module state on the same storage
  usarAlmacenamiento(a);
  expect(entradasInforme().length).toBe(l.length);
  // never under the reader's data prefix (not in backups nor in the synchronisation)
  expect([...a.m.keys()].every((k) => !k.startsWith('epa:'))).toBe(true);
});

test('anillo: un tamaño enorme por entrada se acota (mensaje, pila, migas)', () => {
  const e = new Error('m'.repeat(5000));
  e.stack = `Error: ${'m'.repeat(5000)}\n` + Array.from({ length: 50 }, (_, i) => `    at f${i} (index-abc.js:1:${i}) ${'y'.repeat(400)}`).join('\n');
  for (let i = 0; i < 40; i++) miga(`ruta #/cap${i}`);
  const r = informarFallo('error', e)!;
  expect(r.m.length).toBeLessThanOrEqual(401);
  expect(r.s!.split('\n').length).toBeLessThanOrEqual(8);
  expect(r.s!.split('\n').every((x) => x.length <= 161)).toBe(true);
  expect(r.b.length).toBe(MAX_MIGAS);
  expect(r.b.at(-1)).toContain('ruta #/cap39');
});

test('repeticiones contadas, límite por minuto, sin volver a empezar con «Borrar»', () => {
  for (let i = 0; i < 30; i++) informarFallo('promesa', new Error('lo mismo'));
  expect(entradasInforme()).toHaveLength(1);
  expect(entradasInforme()[0]!.n).toBe(30);
  for (let i = 0; i < 30; i++) informarFallo('error', new Error(`distinto ${i}`));
  // 10 new entries a minute at most (the first one above counts)
  expect(entradasInforme().length).toBe(10);
  expect(textoInforme('1.0.0')).toContain('omitidos por repetirse demasiado');
  borrarInforme();
  expect(entradasInforme()).toHaveLength(0);
  expect(textoInforme('1.0.0')).toContain('Sin fallos registrados.');
});

test('ruido que no es un fallo: ResizeObserver, «Script error.», simulación sustituida, AbortError', () => {
  informarFallo('error', 'ResizeObserver loop completed with undelivered notifications.');
  informarFallo('error', 'Script error.');
  informarFallo('promesa', new Error('Simulación sustituida o detenida'));
  informarFallo('promesa', new DOMException('The user aborted a request.', 'AbortError'));
  expect(entradasInforme()).toHaveLength(0);
});

// ------------------------------------------------------------------ no loop

test('sin bucles: un oyente que falla, un oyente que vuelve a informar, un almacenamiento que lanza o devuelve basura', () => {
  let llamadas = 0;
  const q1 = alNuevoFallo(() => {
    llamadas++;
    throw new Error('el aviso falla');
  });
  const q2 = alNuevoFallo(() => {
    llamadas++;
    // reporting from inside a report is ignored (no recursion)
    expect(informarFallo('error', new Error('desde el oyente'))).toBeNull();
  });
  expect(() => informarFallo('error', new Error('primero'), { avisar: true })).not.toThrow();
  expect(llamadas).toBe(2);
  expect(entradasInforme().map((e) => e.m)).toEqual(['primero']);
  q1();
  q2();
  // storage full: nothing thrown, the entry stays in memory
  const a = new Memoria();
  a.falla = true;
  usarAlmacenamiento(a);
  expect(() => informarFallo('almacenamiento', new Error('lleno'))).not.toThrow();
  expect(entradasInforme()).toHaveLength(1);
  expect(a.escrituras).toBeLessThanOrEqual(2);
  // a getter that throws and a damaged value
  usarAlmacenamiento({
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
    removeItem: () => {},
  });
  expect(() => informarFallo('error', 'x')).not.toThrow();
  const b = new Memoria();
  b.m.set('epa-informe-fallos', '{"no es": "una lista"');
  usarAlmacenamiento(b);
  expect(entradasInforme()).toEqual([]);
  b.m.set('epa-informe-fallos', JSON.stringify([{ t: 1, m: 'bien', k: 'error', b: [], n: 1, v: '1', p: 'x', r: '#/' }, 7, null, { t: 'mal' }]));
  usarAlmacenamiento(b);
  expect(entradasInforme().map((e) => e.m)).toEqual(['bien']);
  // something thrown that is not an Error and whose getters throw
  const raro = new Proxy({}, { get: () => { throw new Error('trampa'); } });
  expect(() => informarFallo('promesa', raro)).not.toThrow();
});

// ------------------------------------------------------------------ redaction

test('redacción: ni tokens de GitHub, ni textos del lector, ni rutas con nombres de usuario, ni correos', () => {
  const casos = [
    `Bad credentials for ${TOKEN_CLASICO}`,
    `token ${TOKEN_FINO} rechazado`,
    `Authorization: Bearer ${TOKEN_FINO}`,
    `{"token":"${TOKEN_FINO}"}`,
  ];
  for (const c of casos) {
    const r = redactar(c);
    expect(r, c).not.toContain('PRUEBA0123456789');
    expect(r, c).not.toContain('A1b2C3d4');
  }
  expect(redactar('falló «nota número 3 con un texto largo del propio lector»')).toBe('falló «[texto]»');
  expect(redactar('Unexpected token \'x\', "mis apuntes del capítulo 5 sobre diodos" is not valid JSON')).toContain('"[texto]"');
  // short quoted names of the app stay (they explain the failure)
  expect(redactar('No se pudo guardar «Mis circuitos»')).toBe('No se pudo guardar «Mis circuitos»');
  expect(redactar('at f (file:///Users/ana/Library/App/index-abc.js:1:2)')).toBe('at f ([ruta]/index-abc.js:1:2)');
  expect(redactar('at http://localhost:4651/assets/index-D1x2.js:10:5')).toBe('at index-D1x2.js:10:5');
  expect(redactar('C:\\Users\\ana\\AppData\\datos.json no existe')).toBe('[ruta]\\datos.json no existe');
  expect(redactar('escriba a alguien@example.com')).toBe('escriba a [correo]');
  expect(redactar('clave a1B2c3D4e5F6g7H8i9J0k1L2m3')).toBe('clave […]');
  // ordinary messages, identifiers and file names are kept
  for (const m of ['TypeError: Cannot read properties of undefined (reading \'x\')', 'construirGeometriaPlaca falló', 'Escena3D.cargarPiezas', 'pieza 237: R1'])
    expect(redactar(m)).toBe(m);
  // an object thrown is never serialised (it can carry the reader's data)
  expect(describir({ notas: 'texto privado del lector' }).m).not.toContain('privado');
  // and the report text has none of it
  informarFallo('sincronizacion', new Error(`GitHub: 401 con ${TOKEN_FINO}`));
  expect(textoInforme('1.0.0')).not.toContain('PRUEBA0123456789');
});

test('redacción de lo que escribe el lector aunque el mensaje no lo entrecomille o lo corte (QA 1.0)', () => {
  olvidarTextosDelLector();
  // before: none of this was registered, so an unquoted or short repetition went into the report
  expect(redactar('valor no válido: 3,3 kΩ x')).toBe('valor no válido: 3,3 kΩ x');
  textoDelLector('3,3 kΩ x', 'campo-1');
  textoDelLector('hola, estos son mis apuntes del tema 3 sobre el diodo', 'nota');
  textoDelLector('Respuesta del examen\nla corriente sube porque baja R', 'examen');
  expect(redactar('valor no válido: 3,3 kΩ x')).toBe('valor no válido: [texto]');
  // a parse error quotes only the first characters
  const json = redactar(`Unexpected token 'h', "hola, esto"... is not valid JSON`);
  expect(json).not.toContain('hola, esto');
  expect(json).toContain('[texto]');
  // each line of a multi-line text, unquoted
  expect(redactar('No se pudo leer: la corriente sube porque baja R')).toBe('No se pudo leer: [texto]');
  // a short answer only as a whole word: the app's own words around it stay
  textoDelLector('zener', 'campo-2');
  expect(redactar('falta el zener en la placa')).toBe('falta el [texto] en la placa');
  expect(redactar('zeners del catálogo')).toBe('zeners del catálogo');
  // the field's latest value replaces its earlier one; very short texts are not taken
  textoDelLector('abc', 'campo-3');
  expect(redactar('abc')).toBe('abc');
  // and the report itself has none of it
  informarFallo('error', new Error('valor no válido: 3,3 kΩ x'));
  expect(textoInforme('1.0.0')).not.toContain('3,3 kΩ x');
  olvidarTextosDelLector();
  expect(redactar('valor no válido: 3,3 kΩ x')).toBe('valor no válido: 3,3 kΩ x');
});

test('ruta: solo identificadores (nada de texto libre), plataforma legible', () => {
  expect(rutaSegura('#/cap05/sec-5.2')).toBe('#/cap05/sec-5.2');
  expect(rutaSegura('#/docente/examen/x1a2b3')).toBe('#/docente/examen/x1a2b3');
  expect(rutaSegura('#/buscar/mi%20b%C3%BAsqueda%20privada')).toBe('#/buscar/…');
  expect(rutaSegura('#/a/b/c/d/e/f/g')).toBe('#/a/b/c/d/e');
  const ua = 'Mozilla/5.0 (Linux; Android 14; 23043RP34G Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Safari/537.36';
  expect(plataforma(ua, true)).toBe('Android · tableta · Tauri · Chromium 129');
  expect(plataforma('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)', true)).toBe('macOS · Tauri · WebKit');
  expect(plataforma('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', true)).toBe('Windows · Tauri · Edge');
});

test('texto del informe: lo más nuevo primero, con versión, plataforma, ruta, zona, pila y migas', () => {
  miga('ruta #/cap05');
  miga('simulación');
  const e = new Error('se rompió');
  e.stack = 'Error: se rompió\n    at dibujar (Grafica-abc.js:3:9)';
  informarFallo('componente', e, { zona: 'la figura 5.3' });
  informarFallo('webgl', 'contexto WebGL perdido (placa 3D)', { zona: 'la vista 3D de la placa' });
  const t = textoInforme('1.0.0');
  expect(t).toMatch(/^Informe de fallos · Electrónica Práctica Avanzada 1\.0\.0/);
  expect(t.indexOf('WebGL')).toBeLessThan(t.indexOf('se rompió'));
  for (const x of ['Fallo de un componente (recuperado)', 'la figura 5.3', 'at dibujar (Grafica-abc.js:3:9)', 'Antes:', 'simulación', 'ruta #/cap05']) expect(t).toContain(x);
});

// ------------------------------------------------------------------ review 10c

test('r10c·3 rutas con espacios bajo la carpeta del usuario: no queda nada del nombre (Windows, macOS, Linux, file://)', () => {
  const casos: [string, string][] = [
    ['No se pudo leer C:\\Users\\Ana García\\AppData\\Roaming\\com.epa\\lector.json: acceso denegado', 'No se pudo leer [ruta]\\lector.json: acceso denegado'],
    ['ENOENT: /Users/Ana García/Library/Application Support/com.epa/lector.json', 'ENOENT: [ruta]/lector.json'],
    ['failed to open /home/ana garcia/.local/share/com.epa/lector.json', 'failed to open [ruta]/lector.json'],
    ['at file:///Users/Ana García/app/index-abc.js:3:9', 'at [ruta]/index-abc.js:3:9'],
    ['D:/Users/Ana María López/Documents/mis apuntes.pdf', '[ruta]/mis apuntes.pdf'],
    ['carpeta personal /home/Ana García', 'carpeta personal [ruta]'],
    ['C:\\Documents and Settings\\Pepe Pérez\\x.txt', '[ruta]\\x.txt'],
  ];
  for (const [m, esperado] of casos) {
    const r = redactar(m);
    expect(r, m).not.toMatch(/Ana|ana|Mejías|mejias|Ana|López|Pepe|Pérez/);
    expect(r, m).toBe(esperado);
  }
  // other paths keep only their file name too
  expect(redactar('/data/user/0/com.epa/files/lector.json no existe')).toBe('[ruta]/lector.json no existe');
});

test('r10f·5 cualquier ruta absoluta (otra unidad, «D:/», recurso de red, apóstrofos): solo queda el fichero', () => {
  const casos: [string, string][] = [
    ['No se pudo crear el fichero: D:\\Ana García\\Exámenes\\examen.pdf (os error 5)', 'No se pudo crear el fichero: [ruta]\\examen.pdf (os error 5)'],
    ['No se pudo crear el fichero: D:/Ana García/Exámenes/examen.pdf', 'No se pudo crear el fichero: [ruta]/examen.pdf'],
    ['No se pudo crear el fichero: \\\\NAS-CASA\\ana.garcia\\Exámenes\\examen.pdf', 'No se pudo crear el fichero: [ruta]\\examen.pdf'],
    ['No se pudo crear el fichero: //NAS-CASA/ana.garcia/Exámenes/examen.pdf', 'No se pudo crear el fichero: [ruta]/examen.pdf'],
    ['E:\\Datos de Ana García\\examen.pdf', '[ruta]\\examen.pdf'],
    ["ENOENT: /Users/Juan O'Brien/Library/lector.json", 'ENOENT: [ruta]/lector.json'],
    ["C:\\Users\\D'Artagnan Gascón\\x.json no existe", '[ruta]\\x.json no existe'],
    ['abrir \\\\NAS-CASA\\ana.garcia', 'abrir [ruta]'],
    ['/mnt/Disco de Ana/copia.json', '[ruta]/copia.json'],
    ['D:\\examen.pdf', '[ruta]\\examen.pdf'],
  ];
  for (const [m, esperado] of casos) {
    const r = redactar(m);
    expect(r, m).not.toMatch(/Ana|ana|Brien|Artagnan|Gascón|NAS-CASA/);
    expect(r, m).toBe(esperado);
  }
  // URLs and ordinary text are not paths
  expect(redactar('GET https://cdn.example.org/data/x/fig.svg')).toBe('GET fig.svg');
  expect(redactar('relación 1:2 y a/b de 3 mA/V')).toBe('relación 1:2 y a/b de 3 mA/V');
});

test('r10c·3 (repositorio) el «propietario/nombre» del repositorio de datos no llega al informe', () => {
  const casos = [
    'El repositorio «Metalaria/electronica-datos» no tiene la forma propietario/nombre.',
    'No se encuentra el repositorio Metalaria/electronica-datos, o el token no tiene acceso a él.',
    'La ruta del fichero de sincronización es una carpeta en Metalaria/electronica-datos; indique un fichero .json.',
    'El fichero sincronizacion/datos.json de Metalaria/electronica-datos no se puede usar: roto.',
    'GET https://api.github.com/repos/Metalaria/electronica-datos/contents/x.json → 404',
    'ver https://github.com/Metalaria/electronica-datos/releases/latest',
    'repo "ana-g/apuntes" vacío',
  ];
  for (const m of casos) expect(redactar(m), m).not.toMatch(/Metalaria|electronica-datos|ana-g|apuntes/);
  // registered strings of this device (the sync settings): replaced wherever they are, even unquoted and without a cue
  ocultarEnInforme('MiUsuario/mis-datos', '[repositorio]');
  ocultarEnInforme('MiUsuario', '[propietario]');
  expect(redactar('falló MiUsuario/mis-datos y luego MiUsuario')).toBe('falló [repositorio] y luego [propietario]');
  // units and short fractions stay
  for (const m of ['la ganancia de 38,5 mA/V', 'a 90 km/h en km/h', 'tensión de 5 V/div', '1/2 de 3/4']) expect(redactar(m)).toBe(m);
});

test('r10c·4 pánicos nativos: ninguno se pierde tras vaciar el fichero, los iguales se cuentan juntos', () => {
  // the rate limit already used up this minute
  for (let i = 0; i < 12; i++) informarFallo('error', new Error(`antes ${i}`));
  const lineas = [
    ...Array.from({ length: 25 }, (_, i) => `${1_800_000_000_000 + i}\tpánico: índice fuera de rango (src/lib.rs:10)`),
    ...Array.from({ length: 15 }, (_, i) => `${1_800_000_100_000 + i}\tpánico: distinto ${i} (src/lib.rs:${20 + i})`),
    'basura sin tabulador',
  ].join('\n');
  expect(informarNativos(lineas)).toBe(40);
  const nativos = entradasInforme().filter((e) => e.k === 'nativo');
  expect(nativos).toHaveLength(16);
  expect(nativos.reduce((s, e) => s + e.n, 0)).toBe(40);
  const igual = nativos.find((e) => e.m.includes('fuera de rango'))!;
  expect(igual.n).toBe(25);
  expect(igual.t).toBe(1_800_000_000_024);
});

test('r10c·5 una parte que no llega, avisada tres veces (Vite, la promesa y la página), es una sola entrada', () => {
  const url = 'http://localhost:4651/assets/PaginaCursos-BVRg3MRf.js';
  informarFallo('carga', new Error(`Failed to fetch dynamically imported module: ${url}`), { avisar: true });
  informarFallo('carga', new TypeError(`Failed to fetch dynamically imported module: ${url}`), { avisar: true });
  informarFallo('carga', new TypeError(`Failed to fetch dynamically imported module: ${url}`), { zona: 'No se pudieron abrir los cursos' });
  const l = entradasInforme().filter((e) => e.k === 'carga');
  expect(l).toHaveLength(1);
  expect(l[0]!.z).toBe('No se pudieron abrir los cursos');
  expect(l[0]!.n).toBe(1);
  // another chunk is another failure
  informarFallo('carga', new Error('Failed to fetch dynamically imported module: http://localhost:4651/assets/Repaso-AAAA1111.js'));
  expect(entradasInforme().filter((e) => e.k === 'carga')).toHaveLength(2);
});

test('r10c·2 cierres: una página ocupada (su latido avanza) o cerrada bien no es un cierre; una sin latido sí', async () => {
  const a = new Memoria();
  usarAlmacenamiento(a);
  const ahora = Date.now();
  const reg = (x: Record<string, unknown>) => a.setItem('epa-informe-sesion', JSON.stringify(x));
  const leer = () => JSON.parse(a.getItem('epa-informe-sesion') ?? '{}') as Record<string, { t: number }>;
  const S = { sinLatido: 120_000, respuesta: 0 };
  // a page that was busy (PDF, synchronisation) while this one started: its record is recent, its heartbeat comes
  reg({ ocupada: { t: ahora - 2000, e: 'activa', v: '1.0.0', r: '#/docente', b: [] } });
  let esperas = 0;
  let r = await revisarCierres({ ...S, esperar: async () => {
    esperas++;
    const s = leer();
    if (s.ocupada) s.ocupada.t = Date.now();
    a.setItem('epa-informe-sesion', JSON.stringify(s));
  } });
  expect(r).toEqual([]);
  expect(esperas).toBeGreaterThan(0);
  // one that closed properly while waited for (pagehide removes its record)
  reg({ cerrada: { t: ahora - 1000, e: 'activa', v: '1.0.0', r: '#/', b: [] } });
  r = await revisarCierres({ ...S, esperar: async () => a.removeItem('epa-informe-sesion') });
  expect(r).toEqual([]);
  // hidden pages are never crashes (the system closes background pages), however old
  reg({ oculta: { t: ahora - 3600_000, e: 'oculta', v: '1.0.0', r: '#/', b: [] } });
  expect(await revisarCierres({ ...S, esperar: async () => {} })).toEqual([]);
  // a visible page whose heartbeat stopped: reported once, with its own route, version and breadcrumbs
  reg({ muerta: { t: ahora - 10 * 60_000, e: 'activa', v: '0.12.9', r: '#/proyectos/neogeo/3d', b: ['10:00:00 ruta #/proyectos/neogeo/3d'] } });
  r = await revisarCierres({ ...S, esperar: async () => {} });
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ k: 'cierre', v: '0.12.9', r: '#/proyectos/neogeo/3d', b: ['10:00:00 ruta #/proyectos/neogeo/3d'] });
  expect(leer().muerta).toBeUndefined();
  expect(await revisarCierres({ ...S, esperar: async () => {} })).toEqual([]);
  // a recent one whose heartbeat does not come within the wait: reported after it
  reg({ reciente: { t: ahora - 1000, e: 'activa', v: '1.0.0', r: '#/', b: [] } });
  r = await revisarCierres({ sinLatido: 50, respuesta: 0 });
  expect(r.map((e) => e.k)).toEqual(['cierre']);
});

test('r10c·2 la aplicación de escritorio no vigila cierres (Tauri puede cerrar sin pagehide); Android y navegadores sí', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  const android = 'Mozilla/5.0 (Linux; Android 14; 23043RP34G Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Safari/537.36';
  expect(detectaCierres(mac, true)).toBe(false);
  expect(detectaCierres(win, true)).toBe(false);
  expect(detectaCierres(android, true)).toBe(true);
  expect(detectaCierres(mac, false)).toBe(true);
});

test('r10f·6 dos pestañas: lo que escribe la otra no se pierde, y «Borrar» en una no vuelve con la siguiente escritura de la otra', () => {
  const a = new Memoria();
  usarAlmacenamiento(a);
  const guardado = () => JSON.parse(a.getItem('epa-informe-fallos')!) as { x: string[]; e: { i: string; m: string; visto?: boolean }[] };
  informarFallo('error', new Error('de esta pestaña 1'));
  // the other tab writes its own entry meanwhile (its copy: what was stored plus its new one)
  const otra = guardado();
  otra.e.push({ i: 'otra1', t: Date.now(), v: '1.0.0', p: 'x', r: '#/', k: 'promesa', m: 'de la otra pestaña', b: [], n: 1 } as never);
  a.setItem('epa-informe-fallos', JSON.stringify(otra));
  informarFallo('error', new Error('de esta pestaña 2'));
  expect(guardado().e.map((e) => e.m)).toEqual(['de esta pestaña 1', 'de la otra pestaña', 'de esta pestaña 2']);
  expect(entradasInforme().map((e) => e.m)).toContain('de la otra pestaña');
  // «Borrar» in the other tab: this one still holds the old entries in memory, and they must not come back
  const visto = guardado();
  a.setItem('epa-informe-fallos', JSON.stringify({ x: [...visto.x, ...visto.e.map((e) => e.i)], e: [] }));
  expect(entradasInforme()).toEqual([]);
  informarFallo('webgl', 'contexto perdido después de borrar');
  expect(guardado().e.map((e) => e.m)).toEqual(['contexto perdido después de borrar']);
  // and «Borrar» here sticks against the other tab's stale copy of the same entries
  const antes = guardado();
  borrarInforme();
  a.setItem('epa-informe-fallos', JSON.stringify({ x: [], e: antes.e }));
  expect(entradasInforme()).toEqual([]);
  // the 10f builds' time-based clear is read as the ids it covered
  usarAlmacenamiento(a);
  a.setItem('epa-informe-fallos', JSON.stringify({ borrado: 2000, e: [{ i: 'v1', t: 1000, v: '1', p: 'x', r: '#/', k: 'error', m: 'antiguo', b: [], n: 1 }, { i: 'v2', t: 3000, v: '1', p: 'x', r: '#/', k: 'error', m: 'posterior', b: [], n: 1 }] }));
  expect(entradasInforme().map((e) => e.m)).toEqual(['posterior']);
  // an entry seen in one tab stays seen when the other writes
  informarFallo('error', new Error('nuevo'));
  const g = guardado();
  g.e.find((e) => e.m === 'nuevo')!.visto = true;
  a.setItem('epa-informe-fallos', JSON.stringify(g));
  informarFallo('error', new Error('otro'));
  expect(entradasInforme().find((e) => e.m === 'nuevo')!.visto).toBe(true);
});

test('r10h·8 «Borrar» con el reloj adelantado (o atrasado) no hace desaparecer los fallos siguientes', () => {
  const real = Date.now;
  try {
    const ahora = real();
    informarFallo('error', new Error('antes de borrar'));
    Date.now = () => ahora + 30 * 86_400_000;
    borrarInforme();
    Date.now = () => ahora + 60_000;
    informarFallo('error', new Error('tras corregir la hora'));
    Date.now = () => ahora - 86_400_000;
    informarFallo('webgl', 'con el reloj atrasado');
    expect(entradasInforme().map((e) => e.m).sort()).toEqual(['con el reloj atrasado', 'tras corregir la hora']);
  } finally {
    Date.now = real;
  }
});

test('r10h·7 las demás formas de ruta absoluta: «file:/…» de Java, WSL, \\\\?\\, content://, ~/, %USERPROFILE%, $HOME, otras raíces', () => {
  const casos: [string, string][] = [
    ['java.io.FileNotFoundException: file:/storage/emulated/0/Documents/Ana García/examen.pdf (Permission denied)', 'java.io.FileNotFoundException: [ruta]/examen.pdf (Permission denied)'],
    ['No se pudo crear el fichero: \\\\wsl$\\Ubuntu\\home\\ana\\examen.pdf', 'No se pudo crear el fichero: [ruta]\\examen.pdf'],
    ['\\\\wsl.localhost\\Ubuntu\\home\\ana garcia\\x.json', '[ruta]\\x.json'],
    ['\\\\?\\C:\\Users\\Ana García\\x.json', '[ruta]\\x.json'],
    ['abrir content://com.android.externalstorage.documents/document/primary%3ADocuments%2FAna%20Mej%C3%ADas%2Fexamen.pdf', 'abrir [documento]'],
    ['/sdcard/Ana García/copia.json', '[ruta]/copia.json'],
    ['/data/user/0/com.metalaria.epa/files/Ana/lector.json', '[ruta]/lector.json'],
    ['~/Documentos/Ana García/apuntes.md', '[ruta]/apuntes.md'],
    ['%USERPROFILE%\\Ana García\\x.txt', '[ruta]\\x.txt'],
    ['$HOME/Ana/x.txt y ${HOME}/Ana/y.txt', '[ruta]/y.txt'],
    ['/Volumes/Disco de Ana/copia.json', '[ruta]/copia.json'],
    ['/root/Ana/x.json', '[ruta]/x.json'],
    ['file:///home/ana', '[ruta]'],
    ['https://example.org/a/Ana%2FMej%C3%ADas%2Fx.pdf', 'x.pdf'],
  ];
  for (const [m, esperado] of casos) {
    const r = redactar(m);
    expect(r, m).not.toMatch(/Ana|ana|Mejías|mejias/);
    expect(r, m).toBe(esperado);
  }
  // the app's own routes, fractions and units are not paths
  for (const m of ['en #/cap05/sec-5.2', 'y/o', 'de 3 mA/V', 'relación 1/2']) expect(redactar(m)).toBe(m);
});

// ------------------------------------------------------------------ PDF fonts

const MODULOS = path.join(path.dirname(createRequire(import.meta.url).resolve('@fontsource/dejavu-sans/package.json')), '..');

test('WOFF → sfnt: los mismos glifos y medidas; lo que no es WOFF no se toca; fontkit ya no lee un WOFF', async () => {
  const fontkitMod = (await import('@pdf-lib/fontkit')) as unknown as { default?: unknown };
  const fontkit = (fontkitMod.default ?? fontkitMod) as { create(b: Uint8Array): { numGlyphs: number; unitsPerEm: number; constructor: { name: string }; glyphForCodePoint(c: number): { id: number; advanceWidth: number }; layout(t: string): { advanceWidth: number } } };
  for (const f of ['source-serif-4/files/source-serif-4-latin-400-normal.woff', 'dejavu-sans/files/dejavu-sans-latin-400-normal.woff']) {
    const woff = new Uint8Array(fs.readFileSync(path.join(MODULOS, f)));
    expect(esWoff(woff)).toBe(true);
    const sfnt = await sfntDeWoff(woff);
    expect(esWoff(sfnt)).toBe(false);
    const a = fontkit.create(woff);
    const b = fontkit.create(sfnt);
    expect(a.constructor.name).not.toBe(b.constructor.name);
    expect(b.numGlyphs).toBe(a.numGlyphs);
    expect(b.unitsPerEm).toBe(a.unitsPerEm);
    for (const c of 'AÁñ€≤√0'.split('')) expect(b.glyphForCodePoint(c.codePointAt(0)!)).toMatchObject({ id: a.glyphForCodePoint(c.codePointAt(0)!).id, advanceWidth: a.glyphForCodePoint(c.codePointAt(0)!).advanceWidth });
    expect(b.layout('Tensión de 5,6 V en R₁ ≈ 2,2 kΩ').advanceWidth).toBe(a.layout('Tensión de 5,6 V en R₁ ≈ 2,2 kΩ').advanceWidth);
  }
  const otro = new Uint8Array([0, 1, 0, 0, 9, 9, 9]);
  expect(await sfntDeWoff(otro)).toBe(otro);
  // a damaged WOFF (a table past the end) is returned as it was
  const roto = new Uint8Array(fs.readFileSync(path.join(MODULOS, 'dejavu-sans/files/dejavu-sans-latin-400-normal.woff'))).slice(0, 400);
  expect(await sfntDeWoff(roto)).toBe(roto);
});

test('PDF de las soluciones de 40 ejercicios: mismos bytes leyendo WOFF o sfnt, y en un tiempo razonable', async () => {
  test.setTimeout(240_000);
  const L = cargarLibro();
  const items = bancoDe(L.banco)
    .filter((e) => e.k === 'ejercicio')
    .slice(0, 40)
    .map((e) => ({ k: 'ejercicio', ref: e.ref, puntos: 1 }));
  const ex = montarExamen({ items, variantes: 1, barajar: false, espacio: 'corto', minutos: 0 } as never, L.libro, 0);
  const o = { titulo: 'Soluciones', notas: '', fecha: '6 de noviembre de 2026', espacio: 'corto' as const, creado: 1 };
  const doc = documentoSoluciones(ex, L.libro, o);
  // operation count (load-independent): fontkit shapes each distinct run once per font and size — before 1.0 every
  // measure and every drawn run shaped it again (9 375 widths and 9 375 encodings for this document; now 3 075 / 2 672)
  const P = PDFFont.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const cuenta = { ancho: 0, codigo: 0 };
  const [w0, e0] = [P.widthOfTextAtSize!, P.encodeText!];
  P.widthOfTextAtSize = function (this: unknown, ...a: unknown[]) {
    cuenta.ancho++;
    return w0.apply(this, a);
  };
  P.encodeText = function (this: unknown, ...a: unknown[]) {
    cuenta.codigo++;
    return e0.apply(this, a);
  };
  // the app's path (Fuentes.archivo converts the WOFF files) and fonts handed over already converted: the same bytes
  // (before the change, the PDF read from the WOFF files was compared byte for byte with this one: identical)
  const t0 = performance.now();
  const a = await generarPdf(doc, recursosNode);
  const ms = performance.now() - t0;
  P.widthOfTextAtSize = w0;
  P.encodeText = e0;
  expect(cuenta.ancho).toBeLessThan(4000);
  expect(cuenta.codigo).toBeLessThan(3600);
  const b = await generarPdf(doc, { ...recursosNode, fuente: async (id) => sfntDeWoff(await recursosNode.fuente(id)) });
  expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  expect(a.faltan).toEqual([]);
  // generous: 4,1 s with fontkit reading the WOFF files on this machine, 1,9 s converted, ≈ 1 s with the runs remembered;
  // 15 s only fails if it regresses badly
  expect(ms).toBeLessThan(15_000);
});
