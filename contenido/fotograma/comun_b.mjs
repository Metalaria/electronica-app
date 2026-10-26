// Helpers of the «Un fotograma» generators of the Master System, the Mega Drive and the Neo Geo (agent B): GNU as
// listings and symbol tables of the demos, their Spanish explanations («[tag] text» files), the native trace
// tools (C, built by nucleos_b.mjs) and the video timing helpers.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const hex = (a, n = 4) => a.toString(16).toUpperCase().padStart(n, '0');

/**
 * GNU as listing (`-al`): for every line that emits code, its address, bytes and source text.
 * Returns [{linea, dir, bytes: number[], texto}] (data directives included).
 */
export function leerListado(ruta) {
  const out = [];
  let ultimo = null;
  for (const l of readFileSync(ruta, 'utf8').split('\n')) {
    const m = /^\s*(\d+)\s+([0-9a-f]{4,8})\s+([0-9A-F]+(?: [0-9A-F]+)*)\s*(?:\t(.*))?$/.exec(l);
    if (m) {
      const linea = Number(m[1]);
      const bytes = m[3].replace(/ /g, '').match(/../g).map((h) => parseInt(h, 16));
      if (ultimo && ultimo.linea === linea && m[4] === undefined) {
        ultimo.bytes.push(...bytes);
        continue;
      }
      ultimo = { linea, dir: parseInt(m[2], 16), bytes, texto: (m[4] ?? '').trim() };
      out.push(ultimo);
    } else if (/^\s*\d+\s+[0-9A-F]+\s*$/.test(l) && ultimo) {
      // continuation of the bytes of the previous line (long .byte lists)
    }
  }
  return out;
}

/** Symbols of `nm` output: {'0068': 'main'} (code labels; local «.L» symbols and equates above `max` left out). */
export function leerSimbolos(ruta, max = 0xffffff) {
  const out = {};
  for (const l of readFileSync(ruta, 'utf8').split('\n')) {
    const m = /^([0-9a-f]+) ([tTdDbBaA]) (\w+)$/.exec(l.trim());
    if (!m || m[3].startsWith('.')) continue;
    const a = parseInt(m[1], 16);
    if (a > max || /[aA]/.test(m[2])) continue;
    out[hex(a, a > 0xffff ? 6 : 4)] = m[3];
  }
  return out;
}

/** «[tag] text» lines (# comments) → Map(tag → text). */
export function leerExplicacionesB(ruta) {
  const out = new Map();
  for (const [i, l] of readFileSync(ruta, 'utf8').split('\n').entries()) {
    const s = l.trim();
    if (!s || s.startsWith('#')) continue;
    const m = /^\[([\w-]+)\]\s+(.+)$/.exec(s);
    if (!m) throw new Error(`${ruta}:${i + 1}: se esperaba «[etiqueta] texto»`);
    if (out.has(m[1])) throw new Error(`${ruta}:${i + 1}: etiqueta repetida ${m[1]}`);
    out.set(m[1], m[2]);
  }
  return out;
}

/**
 * Address → explanation and address → source line, joining the listing (instructions carry «; [tag]» comments)
 * with the explanations. Every tag of the source must have a text and every text a tag.
 */
export function explicacionesDeListado(listado, explicaciones, digitos = 4) {
  const porDir = {};
  const lineas = {};
  const vistos = new Set();
  for (const e of listado) {
    const clave = hex(e.dir, digitos);
    if (!/^\.(byte|word|long|ascii|rept|endr|org|equ|align|space)/.test(e.texto) && !(clave in lineas)) lineas[clave] = [e.linea, e.texto.replace(/\s+/g, ' ')];
    const m = /;\s*\[([\w-]+)\]/.exec(e.texto) || /\|\s*\[([\w-]+)\]/.exec(e.texto);
    if (!m) continue;
    const texto = explicaciones.get(m[1]);
    if (!texto) throw new Error(`La etiqueta [${m[1]}] del fuente no tiene explicación`);
    porDir[clave] = texto;
    vistos.add(m[1]);
  }
  for (const k of explicaciones.keys()) if (!vistos.has(k)) throw new Error(`La explicación [${k}] no corresponde a ninguna instrucción`);
  return { explicaciones: porDir, lineas };
}

/** Runs a native trace tool and parses its JSON output. */
export function ejecutarTraza(exe, args) {
  const salida = execFileSync(exe, args, { maxBuffer: 1 << 30, encoding: 'utf8' });
  return JSON.parse(salida);
}

/** Indices of the sorted array `t` whose values fall in [t0, t1). */
export function rango(t, t0, t1) {
  let i = 0;
  while (i < t.length && t[i] < t0) i++;
  let j = i;
  while (j < t.length && t[j] < t1) j++;
  return [i, j];
}

/** Collects events of several time windows into plain arrays (kept in time order). */
export class Coleccion {
  constructor(campos) {
    this.campos = campos;
    for (const c of campos) this[c] = [];
  }
  poner(obj) {
    for (const c of this.campos) this[c].push(obj[c] ?? 0);
  }
  get n() {
    return this[this.campos[0]].length;
  }
}

const RAIZ_B = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Homebrew entries of contenido/fotograma/juegos.json for one machine (see juegos.mjs; B's machines use them here). */
export function juegosDe(maquina) {
  const r = join(RAIZ_B, 'contenido/fotograma/juegos.json');
  return existsSync(r) ? JSON.parse(readFileSync(r, 'utf8')).juegos.filter((j) => j.maquina === maquina) : [];
}

/** Licence texts and source note next to the trace (as A's game channel does). */
export function copiarLicencias(j, salidaDir) {
  const textos = Array.isArray(j.licenciaTexto) ? j.licenciaTexto : j.licenciaTexto ? [j.licenciaTexto] : [];
  textos.forEach((t, i) => copyFileSync(join(RAIZ_B, t), join(salidaDir, `${j.id}-LICENCIA${i ? '-' + (i + 1) : ''}.txt`)));
  writeFileSync(join(salidaDir, `${j.id}-FUENTE.txt`), `${j.nombre}, de ${j.autor}. Licencia: ${j.licencia}.\nCódigo fuente: ${j.url}\n${j.nota ? j.nota + '\n' : ''}`);
}

/** The «juego» object of an index entry (shown in «Fuentes» by FotogramaFuentes.svelte). */
export function infoJuego(j) {
  return { nombre: j.nombre, autor: j.autor, licencia: j.licencia, url: j.url, commit: j.commit ?? '', licenciaTexto: `${j.id}-LICENCIA.txt` };
}
