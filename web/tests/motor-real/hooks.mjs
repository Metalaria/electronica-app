// Module resolution for the real-engine harness (arnes.ts): TypeScript sources with extensionless imports (as Vite
// resolves them), and one module graph per device or tab: a module imported with `?d=<name>` passes that query on to
// its relative imports, and its storage, credentials, user and store registry are the fakes of falsos/ (per device).
const FALSOS = new URL('./falsos/', import.meta.url).href;
const MAPA = {
  '../almacen': FALSOS + 'almacen.ts',
  '../usuario.svelte': FALSOS + 'usuario.ts',
  './credenciales': FALSOS + 'credenciales.ts',
  './registro.svelte': FALSOS + 'registro.ts',
  // (0.12: the daily-progress module's events)
  './aprendizaje/eventos': FALSOS + 'eventos.ts',
  // (1.1: «seguridad» hands mastery its adjustment; mastery itself — the catalogue, import.meta.glob — is not loaded)
  './dominio.svelte': FALSOS + 'dominio.ts',
  // (review 11a: the lessons' store — lecciones.svelte.ts — without the book and the navigation)
  './datos': FALSOS + 'datos.ts',
  './navegacion.svelte': FALSOS + 'navegacion.ts',
};
// EPA_SUSTITUIR='src/lib/sincronizacion/marcas.ts=/ruta/marcas-antes.ts,…' (paths from web/ or absolute) runs the
// harness with another version of a source module — to see a scenario fail before its fix.
const WEB = new URL('../../', import.meta.url);
const SUSTITUIR = Object.fromEntries(
  (process.env.EPA_SUSTITUIR ?? '')
    .split(',')
    .filter(Boolean)
    .map((par) => par.split('=').map((p) => new URL(p, WEB).href)),
);
const esTs = (u) => /\.ts(\?|$)/.test(u);
export async function resolve(spec, ctx, next) {
  const padre = ctx.parentURL || '';
  const i = padre.indexOf('?d=');
  const q = i >= 0 ? padre.slice(i) : '';
  if (q && MAPA[spec]) return { url: MAPA[spec] + q, shortCircuit: true, format: 'module-typescript' };
  let s = spec;
  if ((s.startsWith('./') || s.startsWith('../')) && esTs(padre) && !/\.(ts|mjs|js|json)$/.test(s)) s += '.ts';
  let r = await next(s, ctx);
  const otro = SUSTITUIR[r.url.split('?')[0]];
  if (otro) r = { ...r, url: otro + (r.url.includes('?') ? r.url.slice(r.url.indexOf('?')) : '') };
  if (q && r.url.startsWith('file:') && !r.url.includes('node_modules') && !r.url.includes('?'))
    return { ...r, url: r.url + q, format: esTs(r.url) ? 'module-typescript' : r.format };
  if (esTs(r.url)) return { ...r, format: 'module-typescript' };
  return r;
}
