// One device session: localStorage from <ls-in>, optional edits through the module APIs, optional synchronisation
// against a fake GitHub kept in <repo.json>; saves localStorage to <ls-out>. Prints a summary.
// usage: pasada.ts <src root> <ls-in> <ls-out> <repo.json> <acciones,comma> <sync:0|1> <clock start ms>
import { datos, escrituras } from './navegador.ts';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
setTimeout(() => { console.error('TIMEOUT'); process.exit(3); }, 90000).unref?.();
const [raiz, lsIn, lsOut, repoF, acciones, hacerSinc, reloj0] = process.argv.slice(2);
let t = Number(reloj0);
Date.now = () => (t += 1000);
if (lsIn !== '-') for (const [k, v] of Object.entries(JSON.parse(readFileSync(lsIn, 'utf8')) as Record<string, string>)) datos.set(k, v);
datos.set('epa-credencial:github', 'tok');
const repo: { texto?: string; sha: number; commits: number } = existsSync(repoF) ? JSON.parse(readFileSync(repoF, 'utf8')) : { sha: 0, commits: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const u = new URL(String(url));
  if ((init.method ?? 'GET') === 'GET') {
    if (!u.pathname.includes('/contents/')) return json(200, { full_name: 'x', private: true });
    if (repo.texto == null) return json(404, { message: 'Not Found' });
    return json(200, { type: 'file', sha: `s${repo.sha}`, encoding: 'base64', content: Buffer.from(repo.texto, 'utf8').toString('base64') });
  }
  const b = JSON.parse(String(init.body));
  if (b.sha !== (repo.texto == null ? undefined : `s${repo.sha}`)) return json(409, {});
  repo.texto = Buffer.from(b.content, 'base64').toString('utf8');
  repo.sha++; repo.commits++;
  return json(200, { content: { sha: `s${repo.sha}` } });
};
const imp = (p: string) => import(`file://${raiz}/${p}`);
const R = await imp('lib/sincronizacion/registro.svelte.ts');
const U = await imp('lib/usuario.svelte.ts');
await U.cargarUsuario();
const S = await imp('lib/sincronizacion/sincronizar.svelte.ts');
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (const a of acciones.split(',').filter(Boolean)) {
  if (a === 'editar') {
    U.guardarNota({ label: 'fig:1', parte: 'cap02', titulo: 'Figura 1' }, 'nota 1 EDITADA sin conexión');
    U.quitarMarcador('eq:1');
    U.guardarPosicion('cap01', { b: 99, sec: 'sec:1.9' });
    const E = await imp('componentes/editor/circuitos.svelte.ts');
    await E.cargarCircuitos();
    const id = E.listaCircuitos().find((c: any) => c.nombre === 'Circuito 1').id;
    await E.renombrar(id, 'Circuito 1 renombrado sin conexión');
    const A = await imp('lib/aprendizaje.svelte.ts');
    await A.cargarAprendizaje();
    A.marcarLeida('cap05', 'sec:40', true);
    A.guardarPasos('cap09:999', 4);
  }
  if (a === 'editarY') {
    U.guardarNota({ label: 'fig:2', parte: 'cap03', titulo: 'Figura 2' }, 'nota 2 editada en Y');
    const E = await imp('componentes/editor/circuitos.svelte.ts');
    await E.cargarCircuitos();
    const id = E.listaCircuitos().find((c: any) => c.nombre === 'Circuito 2 editado').id;
    await E.renombrar(id, 'Circuito 2 renombrado en Y');
    const Rp = await imp('componentes/repaso/estado.svelte.ts'); await Rp.cargarRepaso();
    Rp.ponerAjustes({ nuevasDia: 5 });
  }
  if (a === 'leer') {
    // merely open things: load every module, read positions and lists (no reader change)
    const E = await imp('componentes/editor/circuitos.svelte.ts'); await E.cargarCircuitos(); E.listaCircuitos();
    const Rp = await imp('componentes/repaso/estado.svelte.ts'); await Rp.cargarRepaso();
    U.guardarPosicion('cap03', { ...U.usuario.posiciones.cap03 }); // same position again (scroll back to it)
  }
}
await espera(2500);
U.volcar();
window.dispatchEvent(new Event('pagehide'));
await espera(500);
let ok: unknown = 'sin sincronizar';
const antesCommits = repo.commits;
if (hacerSinc === '1') {
  ok = await S.sincronizar(true);
  await espera(800);
}
const out: Record<string, string> = {};
for (const [k, v] of datos) if (k !== 'epa-credencial:github') out[k] = v;
writeFileSync(lsOut, JSON.stringify(out, null, 1));
writeFileSync(repoF, JSON.stringify(repo));
console.log(JSON.stringify({ almacen: U.usuario.almacen, ok, error: S.sinc.error, commits: repo.commits - antesCommits, recibidos: S.sinc.resumen?.recibidos, porAlmacen: S.sinc.resumen?.porAlmacen }));
process.exit(0);
