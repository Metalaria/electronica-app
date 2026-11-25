// 1.3.1 (qa131-plataforma): one device session of a given release's REAL modules (1.2.0, 1.2.1, 1.3.0 extracted from
// git, or HEAD) in Node with the fake browser (navegador.ts): fill every store through the public APIs as a reader
// would, export the backup, import one, synchronise against a fake GitHub kept in a file. Used by
// tests/compat131.spec.ts; one process per session (the modules are singletons).
//   node --no-warnings --import ./tests/actualizacion/registrar.mjs tests/actualizacion/sesion131.ts \
//     <src root> <ls-in|-> <ls-out> <repo.json|-> <acciones,comma> <clock start ms>
// acciones: llenar:<etiqueta> (a reader's realistic use, its texts marked with <etiqueta>), exportar:<fichero>,
// importar:<fichero> («Unir»), sustituir:<fichero>, sincronizar, consumidores (load the learning events' consumers). Prints JSON {importado, descartados, sinc, error}.
import { datos } from './navegador.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

setTimeout(() => {
  console.log(JSON.stringify({ error: 'TIEMPO AGOTADO' }));
  process.exit(3);
}, 150_000).unref?.();

const [raiz, lsIn, lsOut, repoF, acciones, reloj0] = process.argv.slice(2) as [string, string, string, string, string, string];
let t = Number(reloj0);
Date.now = () => (t += 1000);
if (lsIn !== '-') for (const [k, v] of Object.entries(JSON.parse(readFileSync(lsIn, 'utf8')) as Record<string, string>)) datos.set(k, v);
const imp = (p: string) => import(`file://${raiz}/${p}`);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const salida: Record<string, unknown> = {};

// a fake GitHub (contents API) whose file is kept in repo.json between sessions
const repo: { texto?: string; sha: number; commits: number } = repoF !== '-' && existsSync(repoF) ? JSON.parse(readFileSync(repoF, 'utf8')) : { sha: 0, commits: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
(globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init: RequestInit = {}) => {
  const u = new URL(String(url));
  if (u.hostname !== 'api.github.com') throw new Error('sin red');
  if ((init.method ?? 'GET') === 'GET') {
    if (!u.pathname.includes('/contents/')) return json(200, { full_name: 'x', private: true });
    if (repo.texto == null) return json(404, { message: 'Not Found' });
    return json(200, { type: 'file', sha: `s${repo.sha}`, encoding: 'base64', content: Buffer.from(repo.texto, 'utf8').toString('base64') });
  }
  const b = JSON.parse(String(init.body));
  if (b.sha !== (repo.texto == null ? undefined : `s${repo.sha}`)) return json(409, {});
  repo.texto = Buffer.from(b.content, 'base64').toString('utf8');
  repo.sha++;
  repo.commits++;
  return json(200, { content: { sha: `s${repo.sha}` } });
};

async function llenar(et: string): Promise<void> {
  const U = await imp('lib/usuario.svelte.ts');
  const A = await imp('lib/aprendizaje.svelte.ts');
  const Rp = await imp('componentes/repaso/estado.svelte.ts');
  const C = await imp('componentes/calculadoras/datos.svelte.ts');
  const E = await imp('componentes/editor/circuitos.svelte.ts');
  const P = await imp('componentes/protoboard/circuitos.svelte.ts');
  const D = await imp('lib/progreso-diario.svelte.ts');
  const L = await imp('lib/lecciones.svelte.ts');
  const Ev = await imp('lib/aprendizaje/eventos.ts');
  const Cu = await imp('lib/aprendizaje/cursos-estado.svelte.ts');
  const Se = await imp('lib/aprendizaje/seguridad.svelte.ts');
  const Lab = await imp('lib/laboratorio.svelte.ts');
  const Pr = await imp('lib/proyectos11/estado.svelte.ts');
  const Doc = await imp('lib/docente/estado.svelte.ts');
  const Pd = await imp('lib/aprendizaje/problema-dia.svelte.ts');
  await U.cargarUsuario();
  await A.cargarAprendizaje();
  await Rp.cargarRepaso();
  await C.cargarFavoritos();
  await E.cargarCircuitos();
  await P.cargarMontajes();
  await D.cargarProgresoDiario();
  await L.cargarLecciones();
  await Cu.cargarCursos();
  await Se.cargarSeguridad();
  await Lab.cargarLaboratorio();
  await Pr.cargarProyectos();
  await Doc.cargarDocente();
  await Pd.cargarProblemas();
  // the reader of the book: positions, bookmarks, notes, sections read
  for (let i = 1; i <= 9; i++) U.guardarPosicion(`cap0${i}`, { b: i * 4, sec: `sec-${i}.2` });
  for (let i = 1; i <= 8; i++) U.alternarMarcador({ label: `eq:${i}.${et}`, parte: `cap0${i}`, titulo: `Ecuación ${i} (${et})` });
  U.alternarMarcador({ label: `eq:3.${et}`, parte: 'cap03', titulo: 'x' });
  for (let i = 1; i <= 6; i++) U.guardarNota({ label: `fig:${i}.${et}`, parte: `cap0${i}`, titulo: `Figura ${i}` }, `nota ${i} de ${et}: áéíóú ñ «comillas» 4,7 kΩ`);
  await espera(800);
  // exercises, read sections
  for (let i = 1; i <= 10; i++) A.registrarIntento(`ej-5.${i}`, { a: String(i), b: '1k' }, ['a'], i % 2 === 0);
  A.usarPista('ej-5.3', 2);
  A.verSolucion('ej-5.4');
  for (let i = 1; i <= 12; i++) A.marcarLeida(`cap0${(i % 9) + 1}`, `sec-${(i % 9) + 1}.${i}`, true);
  A.guardarPasos('cap05:12', 3);
  // Repaso: flashcards, tests, wrong answers, exams, settings
  for (let i = 1; i <= 20; i++) Rp.calificar(`cap05-${String(i).padStart(2, '0')}`, (i % 4) + 1, Date.now());
  Rp.ponerAjustes({ nuevasDia: 12, inversas: true });
  for (let i = 1; i <= 4; i++) Rp.registrarTest(`cap0${i}`, i + 3, 10, Date.now());
  for (let i = 1; i <= 6; i++) Rp.registrarRespuesta(`cap0${i}-0${i}`, `cap0${i}`, false, Date.now());
  Rp.registrarExamen(['cap05', 'cap06'], 7, 10, Date.now());
  await espera(800);
  for (const id of ['senoide', 'carga-rc', 'tau-rc']) C.alternarFavorita(id);
  // the schematic editor and the breadboard: saved circuits
  const esquema = (n: number) => ({ version: 1, titulo: `Circuito ${n}`, componentes: Array.from({ length: 4 }, (_, k) => ({ id: `R${k + 1}`, tipo: 'R', x: k * 40, y: n * 20, rot: 0, valor: '4,7k', props: {} })), cables: [{ id: 'w1', puntos: [[0, 0], [40, 0]] }], origen: null });
  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) ids.push(await E.guardarNuevo(`Esquema ${i} de ${et}`, esquema(i)));
  await E.renombrar(ids[1], `Esquema renombrado de ${et}`);
  const placa = (n: number) => ({ version: 1, titulo: `Placa ${n}`, piezas: [{ id: 'p1', tipo: 'resistencia', pos: [3, n], valor: '220' }], cables: [{ id: 'c1', de: [1, 1], a: [5, n], color: 'rojo' }] });
  for (let i = 1; i <= 3; i++) await P.guardarMontaje(`Montaje ${i} de ${et}`, placa(i));
  // lessons «Estudiar por pasos» (1.1 lessons too), with their events: XP, mastery, achievements, the daily goal
  const lecciones: [string, string, number][] = [['cap01', 'sec-1.10', 12], ['cap08', 'sec-8.2', 14], ['cap00', 'sec-0.7', 11], ['cap05', 'sec-5.5', 9], ['cap22', 'sec-22.1', 8]];
  for (const [k, [p, s, n]] of lecciones.entries()) {
    for (let j = 0; j < (k < 2 ? n : 4); j++) {
      L.anotarPaso(p, s, j, n);
      L.completarPaso(p, s, j, n);
    }
    if (k < 2) {
      L.completarLeccion(p, s, n);
      Ev.emitir({ tipo: 'leccion-completada', parte: p, seccion: s, primera: true });
    }
  }
  const respuestas = ['cap01-l11-sec-1.10-cortocircuito', 'cap01-l11-sec-1.10-prediga-bornes', 'cap08-l11-sec-8.2-prediga-no-inversor', 'cap05-pred-sec-5.4', 'cap05-03'];
  for (const [k, id] of respuestas.entries()) {
    const sec = /sec-[\d.]+/.exec(id)?.[0];
    Ev.emitir({ tipo: 'respuesta', id, clase: k === 4 ? 'pregunta' : 'practica', origen: k === 4 ? 'repaso' : 'leccion', correcta: k % 2 === 0, intento: 1, pistas: 0, final: true, parte: id.slice(0, 5), ...(sec ? { seccion: sec } : {}) });
  }
  Ev.emitir({ tipo: 'ejercicio-resuelto', id: 'ej-5.2', parte: 'cap05', intentos: 2, fallos: 1, pistas: 0, conSolucion: false });
  Ev.emitir({ tipo: 'prueba-nivel', curso: 'fundamentos', aciertos: 6, total: 10, recomendado: 'cap03' });
  for (let i = 0; i < 5; i++) D.registrarActividad(i % 2 ? 'paso' : 'pregunta', 3);
  D.ponerObjetivo({ tipo: 'pasos', n: 15 });
  // courses (sections passed, a placement test), «¿Cuánto lo sabía?», a lab, a project stage, the teacher mode
  Cu.marcarSuperadas(['cap01/sec-1.1', 'cap01/sec-1.2', `cap02/sec-2.${et.length}`]);
  await Se.marcarSeguridad('cap05-pred-sec-5.4', 'dudaba');
  await Se.marcarSeguridad('cap05-03', 'sabia');
  await Lab.anotarPasoLaboratorio(1, 'medir-r1', 4.68, ['montar', 'medir-r1', 'medir-r2']);
  await Pr.anotarComprobacionEtapa('fuente-1', true, { r1: 1000 }, { vout: 5.02 });
  await Doc.crearCurso(`Curso de ${et}`, 'Notas del profesor', { elementos: [{ k: 'seccion', parte: 'cap05', label: 'sec-5.3' }, { k: 'ejercicio', label: 'ej-5.1' }, { k: 'pregunta', id: 'cap05-03' }] });
  await Doc.crearExamen(`Examen de ${et}`, '', { items: [{ k: 'ejercicio', ref: 'ej-5.1', puntos: 2 }, { k: 'pregunta', ref: 'cap05-03', puntos: 1 }], minutos: 30, variantes: true, barajar: true, semilla: 1313, espacio: 'corto' });
  Cu.guardarPrueba('fundamentos', { t: Date.now(), aciertos: 6, total: 10, recomendado: 'cap03', marcadas: 2 });
  const examen = Doc.listaPropios('examen')[0];
  await Doc.guardarResultado({ examen: examen.id, titulo: examen.titulo, semilla: 1313, inicio: Date.now() - 60_000, t: Date.now(), puntos: 2, maximo: 3, items: [{ k: 'ejercicio', ref: 'ej-5.1', puntos: 2, maximo: 2, valores: { a: '4,7' }, estado: 'bien' }, { k: 'pregunta', ref: 'cap05-03', puntos: 0, maximo: 1, valores: { r: '2' }, estado: 'mal' }] });
  // (the problem of the day as shown: in Node the book's data cannot be fetched to choose one)
  const dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  Pd.registrarResultado(dia, true, 1, { id: 'ej-5.1', k: 'ejercicio', parte: 'cap05', semilla: 7, curso: 'fundamentos', t: Date.now() });
  await Ev.eventosEntregados();
  await espera(2500);
  U.volcar();
  Rp.volcarRepaso();
  window.dispatchEvent(new Event('pagehide'));
  document.dispatchEvent(new Event('visibilitychange'));
  await espera(1500);
}

try {
  for (const a of acciones.split(',').filter(Boolean)) {
    const [orden, arg = ''] = a.split(/:(.*)/s) as [string, string?];
    if (orden === 'llenar') await llenar(arg);
    else if (orden === 'exportar') {
      const Co = await imp('lib/sincronizacion/copia.ts');
      const c = await Co.crearCopia();
      writeFileSync(arg, c.texto);
      salida.exportados = c.elementos;
    } else if (orden === 'importar' || orden === 'sustituir') {
      const Co = await imp('lib/sincronizacion/copia.ts');
      const leida = Co.leerFicheroCopia(readFileSync(arg, 'utf8'));
      salida.descartados = leida.descartados ?? null;
      const r = await Co.importar(leida, orden === 'importar' ? 'unir' : 'sustituir', true);
      salida.importado = r;
      await espera(1500);
    } else if (orden === 'consumidores') {
      // the learning events' consumers loaded now, as on a device in use (an event already happened in the session)
      const Ev = await imp('lib/aprendizaje/eventos.ts');
      await Ev.cargarConsumidores();
    } else if (orden === 'sincronizar') {
      datos.set('epa-credencial:github', 'tok');
      const U = await imp('lib/usuario.svelte.ts');
      await U.cargarUsuario();
      const S = await imp('lib/sincronizacion/sincronizar.svelte.ts');
      salida.sinc = await S.sincronizar(true);
      salida.errorSinc = S.sinc.error ?? null;
      await espera(1500);
    } else throw new Error(`acción desconocida: ${a}`);
  }
} catch (e) {
  salida.error = String((e as Error)?.stack ?? e).slice(0, 800);
}
const out: Record<string, string> = {};
for (const [k, v] of datos) if (k !== 'epa-credencial:github') out[k] = v;
if (lsOut !== '-') writeFileSync(lsOut, JSON.stringify(out, null, 1));
if (repoF !== '-') writeFileSync(repoF, JSON.stringify(repo));
salida.claves = Object.keys(out).length;
console.log(JSON.stringify(salida));
process.exit(0);
