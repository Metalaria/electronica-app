// 1.1 guided labs: Node loader for the bench harness (banco-node.ts). The app's loader (../actualizacion/hooks-svelte.mjs:
// TypeScript, `.svelte.ts` runes compiled with svelte/compiler) plus one swap: the simulator's client (a Web Worker in the
// app) becomes motor-node.ts, which runs the same WebAssembly ngspice in this process.
import { resolve as resolverApp, load } from '../actualizacion/hooks-svelte.mjs';

const MOTOR = new URL('./motor-node.ts', import.meta.url).href;

export async function resolve(spec, ctx, next) {
  const r = await resolverApp(spec, ctx, next);
  if (/\/simulador\/cliente\.svelte(\.ts)?$/.test(r.url ?? '')) return { url: MOTOR, shortCircuit: true };
  return r;
}

export { load };
