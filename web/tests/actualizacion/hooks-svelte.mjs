// Node loader for the upgrade/downgrade and malformed-data checks (fourth review): the app's modules as the browser
// runs them — TypeScript with extensionless imports (as Vite resolves them), `.svelte.ts` rune modules compiled with
// svelte/compiler (client), `import.meta.glob`/`env` stubbed; a `.svelte` component imports as an empty one. Works
// for any source tree (the 0.10.1 one is extracted by escenario.ts); svelte comes from web/node_modules.
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createRequire } from 'node:module';
const req = createRequire(new URL('../../package.json', import.meta.url));
const { compileModule } = req('svelte/compiler');
const vite = (c) => c.replace(/import\.meta\.glob\(/g, '((..._a) => ({}))(').replace(/import\.meta\.env/g, '({ DEV: false, PROD: true, BASE_URL: "/", MODE: "production" })');
const esTs = (u) => /\.ts(\?|$)/.test(u);
export async function resolve(spec, ctx, next) {
  const padre = ctx.parentURL || '';
  let s = spec;
  if ((s.startsWith('./') || s.startsWith('../')) && esTs(padre) && !/\.(ts|mjs|js|json|svelte|css)$/.test(s)) s += '.ts';
  if (s.endsWith('.svelte')) {
    try {
      return await next(s + '.ts', ctx);
    } catch {
      return { url: 'data:text/javascript,export default function(){}', shortCircuit: true };
    }
  }
  const r = await next(s, ctx);
  return r;
}
export async function load(url, ctx, next) {
  if (/\.svelte\.ts(\?|$)/.test(url)) {
    const src = await readFile(new URL(url), 'utf8');
    const js = vite(stripTypeScriptTypes(src, { mode: 'transform' }));
    const out = compileModule(js, { filename: new URL(url).pathname, generate: 'client', dev: false });
    return { format: 'module', source: out.js.code, shortCircuit: true };
  }
  if (url.endsWith('.json')) return next(url, { ...ctx, importAttributes: { type: 'json' } });
  if (esTs(url)) {
    const src = await readFile(new URL(url), 'utf8');
    return { format: 'module', source: vite(stripTypeScriptTypes(src, { mode: 'transform' })), shortCircuit: true };
  }
  return next(url, ctx);
}
