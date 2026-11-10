// 1.1 guided labs: what the bench needs of the simulator's client (simulador/cliente.svelte.ts), in Node: the same
// WebAssembly ngspice the app runs in its worker, compiled once in this process (no worker, no download).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilar } from '../../src/simulador/motor/nucleo.ts';
import { simular, type Simulacion } from '../../src/simulador/motor/simular.ts';

export const motor = { fase: 'inactivo', descarga: null as number | null };
export class SimulacionCancelada extends Error {}
export function precalentarMotor(): void {}
export function motorConXspice(): boolean {
  return true;
}

const WASM = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'ngspice', 'ngspice-xspice.wasm');
let modulo: Promise<WebAssembly.Module> | null = null;

export async function simularTexto(texto: string): Promise<Simulacion> {
  modulo ??= compilar(fs.readFileSync(WASM));
  return simular(await modulo, texto, undefined, 'xspice');
}
