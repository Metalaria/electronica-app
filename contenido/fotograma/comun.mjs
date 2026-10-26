// Helpers shared by the «Un fotograma» generators: running the assemblers, reading their symbol files and the
// Spanish explanations of the demos, and choosing the recorded window of an emulation run.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Runs a tool if it can be found (env var with its folder, then PATH); returns false when it is missing. */
export function herramienta(nombre, envDir) {
  const dir = process.env[envDir];
  const ruta = dir ? join(dir, nombre) : nombre;
  try {
    execFileSync(ruta, ['--version'], { stdio: 'ignore' });
    return ruta;
  } catch {
    return dir && existsSync(ruta) ? ruta : null;
  }
}

export function ejecutar(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });
}

/**
 * Spanish explanations: lines «etiqueta+n: texto» (n = instruction index after the label, from 0); «#» starts a
 * comment line. Returns [{etiqueta, n, texto}].
 */
export function leerExplicaciones(ruta) {
  const out = [];
  for (const [i, l] of readFileSync(ruta, 'utf8').split('\n').entries()) {
    const s = l.trim();
    if (!s || s.startsWith('#')) continue;
    const m = /^([A-Za-z_.][\w.]*)\+(\d+):\s*(.+)$/.exec(s);
    if (!m) throw new Error(`${ruta}:${i + 1}: se esperaba «etiqueta+n: texto»`);
    out.push({ etiqueta: m[1], n: Number(m[2]), texto: m[3] });
  }
  return out;
}

/**
 * Turns the explanations into {address (hex): text}, walking `n` instructions from each label with `longitud(dir)`
 * (bytes of the instruction at an address). Fails on an unknown label.
 */
export function explicacionesPorDireccion(lista, etiquetas, longitud) {
  const porNombre = new Map(Object.entries(etiquetas).map(([d, n]) => [n, parseInt(d, 16)]));
  const out = {};
  for (const e of lista) {
    let a = porNombre.get(e.etiqueta);
    if (a === undefined) throw new Error(`Etiqueta desconocida en las explicaciones: ${e.etiqueta}`);
    for (let i = 0; i < e.n; i++) a += longitud(a);
    out[hex4(a)] = e.texto;
  }
  return out;
}

export function hex4(a) {
  return a.toString(16).toUpperCase().padStart(4, '0');
}

