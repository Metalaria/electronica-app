// Writer of «EPAF» v1 trace files (one frame of a console, cycle by cycle), read by
// web/src/componentes/consolas/fotograma/traza.ts. Format (little-endian):
//   'EPAF', u16 version = 1, u16 0, u32 n = manifest bytes, manifest JSON (UTF-8, space padded to a multiple of 4),
//   then the array area: every array at manifest.arrays[name] = {tipo, n, cod, offset, bytes}, offsets relative
//   to the start of the area and aligned to 4. When manifest.compresion = {tipo: 'lz', bytes} the array area is
//   stored LZ-compressed (comprimirLz below) and `bytes` is its size once decompressed.
// Encodings: 'crudo' (the typed array as is), 'vlq' (zigzag + LEB128 of each value), 'vlqd' (zigzag + LEB128 of the
// differences between consecutive values; the reader does the running sum). See ESQUEMA.md, «Un fotograma».

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TIPOS = { u8: [Uint8Array, 0, 0xff], u16: [Uint16Array, 0, 0xffff], u32: [Uint32Array, 0, 0xffffffff], i32: [Int32Array, -0x80000000, 0x7fffffff] };

function vlq(valores, delta) {
  const out = [];
  let previo = 0;
  for (let i = 0; i < valores.length; i++) {
    const v = Number(valores[i]);
    let d = delta ? v - previo : v;
    previo = v;
    // zigzag, with plain arithmetic so that values up to 2^52 are safe
    let z = d < 0 ? -2 * d - 1 : 2 * d;
    do {
      let b = z % 128;
      z = Math.floor(z / 128);
      if (z > 0) b |= 0x80;
      out.push(b);
    } while (z > 0);
  }
  return Uint8Array.from(out);
}

/** Every array named in the manifest must exist; returns the list of names referenced. */
function nombresUsados(m) {
  const usados = new Set();
  const mas = (x) => {
    if (typeof x === 'string' && x) usados.add(x);
  };
  for (const b of m.buses ?? []) for (const k of ['t', 'a', 'd', 'f', 'c', 'k']) mas(b[k]);
  for (const i of m.instrucciones ?? []) {
    mas(i.t);
    mas(i.pc);
    mas(i.ciclo);
    for (const r of i.r ?? []) mas(r);
  }
  if (m.fases) ['t', 'k', 'linea'].forEach((k) => mas(m.fases[k]));
  if (m.senales) ['t', 'k', 'v'].forEach((k) => mas(m.senales[k]));
  if (m.pixeles) ['t', 'c'].forEach((k) => mas(m.pixeles[k]));
  if (m.video) ['lineasT', 'lineasN'].forEach((k) => mas(m.video[k]));
  mas(m.fb);
  for (const x of m.memoria ?? []) mas(x.array);
  return usados;
}

/**
 * Writes a trace. `arrays`: {name: {tipo: 'u8'|'u16'|'u32'|'i32', cod: 'crudo'|'vlq'|'vlqd', datos: ArrayLike<number>}}.
 * Checks value ranges, that every array the manifest names exists and that every time array is sorted.
 * Returns the number of bytes written.
 */
export function escribirTraza(ruta, manifiesto, arrays) {
  const m = { ...manifiesto, formato: 'EPAF', version: 1, arrays: {} };
  for (const n of nombresUsados(m)) if (!arrays[n]) throw new Error(`El manifiesto nombra el array «${n}», que no existe`);
  const tiempos = [...(m.buses ?? []).map((b) => b.t), ...(m.instrucciones ?? []).map((i) => i.t), m.fases?.t, m.senales?.t, m.pixeles?.t, m.video?.lineasT].filter(Boolean);
  for (const n of tiempos) {
    const d = arrays[n].datos;
    for (let i = 1; i < d.length; i++) if (d[i] < d[i - 1]) throw new Error(`«${n}» no está ordenado en ${i}: ${d[i - 1]} > ${d[i]}`);
  }
  const trozos = [];
  let offset = 0;
  for (const [nombre, a] of Object.entries(arrays)) {
    const def = TIPOS[a.tipo];
    if (!def) throw new Error(`Tipo desconocido en «${nombre}»: ${a.tipo}`);
    const [Ctor, min, max] = def;
    for (let i = 0; i < a.datos.length; i++) {
      const v = a.datos[i];
      if (!Number.isInteger(v) || v < min || v > max) throw new Error(`«${nombre}»[${i}] = ${v} fuera del tipo ${a.tipo}`);
    }
    let bytes;
    if (a.cod === 'crudo') bytes = new Uint8Array(Ctor.from(a.datos).buffer);
    else if (a.cod === 'vlq' || a.cod === 'vlqd') bytes = vlq(a.datos, a.cod === 'vlqd');
    else throw new Error(`Codificación desconocida en «${nombre}»: ${a.cod}`);
    const relleno = (4 - (bytes.length % 4)) % 4;
    m.arrays[nombre] = { tipo: a.tipo, n: a.datos.length, cod: a.cod, offset, bytes: bytes.length };
    trozos.push(bytes, new Uint8Array(relleno));
    offset += bytes.length + relleno;
  }
  // the whole array area, LZ-compressed when that saves space (long idle loops and repeated fetch patterns)
  const zona = Buffer.concat(trozos.map((t) => Buffer.from(t.buffer, t.byteOffset, t.byteLength)));
  const lz = comprimirLz(zona);
  let cuerpo = zona;
  if (lz.length < zona.length * 0.9) {
    m.compresion = { tipo: 'lz', bytes: zona.length };
    cuerpo = lz;
  }
  let json = Buffer.from(JSON.stringify(m), 'utf8');
  const pad = (4 - (json.length % 4)) % 4;
  if (pad) json = Buffer.concat([json, Buffer.from(' '.repeat(pad))]);
  const cab = Buffer.alloc(12);
  cab.write('EPAF', 0, 'latin1');
  cab.writeUInt16LE(1, 4);
  cab.writeUInt16LE(0, 6);
  cab.writeUInt32LE(json.length, 8);
  const total = Buffer.concat([cab, json, cuerpo]);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, total);
  return total.length;
}

// ---------------------------------------------------------------- LZ (byte-oriented LZ77, LZ4-like sequences)
// Stream of sequences: varint L, L literal bytes, varint M (match length; 0 only at the very end), varint D
// (distance back, when M > 0). Matches are at least 4 bytes and may overlap their own output (runs).

function varint(out, v) {
  while (v >= 128) {
    out.push((v & 127) | 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
}

export function comprimirLz(src) {
  const n = src.length;
  const out = [];
  const BITS = 16;
  const cabeza = new Int32Array(1 << BITS).fill(-1);
  const previo = new Int32Array(n).fill(-1);
  const hash = (i) => (((src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24)) * 2654435761) >>> (32 - BITS)) >>> 0;
  let lit = 0;
  let i = 0;
  const meter = (j) => {
    if (j + 3 >= n) return;
    const h = hash(j);
    previo[j] = cabeza[h];
    cabeza[h] = j;
  };
  while (i < n) {
    let mejor = 0;
    let dist = 0;
    if (i + 3 < n) {
      let c = cabeza[hash(i)];
      for (let k = 0; k < 48 && c >= 0 && i - c < 1 << 22; k++, c = previo[c]) {
        let l = 0;
        while (i + l < n && src[c + l] === src[i + l] && l < 65535) l++;
        if (l > mejor) {
          mejor = l;
          dist = i - c;
        }
      }
    }
    if (mejor >= 4) {
      varint(out, i - lit);
      for (let j = lit; j < i; j++) out.push(src[j]);
      varint(out, mejor);
      varint(out, dist);
      for (let j = 0; j < mejor; j++) meter(i + j);
      i += mejor;
      lit = i;
    } else {
      meter(i);
      i++;
    }
  }
  varint(out, n - lit);
  for (let j = lit; j < n; j++) out.push(src[j]);
  varint(out, 0);
  return Buffer.from(out);
}

export function descomprimirLz(src, total) {
  const out = new Uint8Array(total);
  let p = 0;
  let o = 0;
  const leer = () => {
    let r = 0;
    let s = 1;
    let b;
    do {
      b = src[p++];
      r += (b & 127) * s;
      s *= 128;
    } while (b & 128);
    return r;
  };
  while (o < total) {
    const l = leer();
    out.set(src.subarray(p, p + l), o);
    p += l;
    o += l;
    if (o >= total) break;
    const m = leer();
    const d = leer();
    for (let j = 0; j < m; j++, o++) out[o] = out[o - d];
  }
  return out;
}

/** Reader (Node), the same decoding as the app's traza.ts: used by the generators' self-checks. */
export function leerTraza(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'EPAF') throw new Error('No es una traza EPAF');
  const n = dv.getUint32(8, true);
  const m = JSON.parse(Buffer.from(buf.buffer, buf.byteOffset + 12, n).toString('utf8'));
  let zona = new Uint8Array(buf.buffer, buf.byteOffset + 12 + n, buf.byteLength - 12 - n);
  if (m.compresion?.tipo === 'lz') zona = descomprimirLz(zona, m.compresion.bytes);
  const arrays = {};
  for (const [nombre, a] of Object.entries(m.arrays)) {
    const Ctor = TIPOS[a.tipo][0];
    const out = new Ctor(a.n);
    const src = zona.subarray(a.offset, a.offset + a.bytes);
    if (a.cod === 'crudo') out.set(new Ctor(src.slice().buffer));
    else {
      let p = 0;
      let acc = 0;
      for (let i = 0; i < a.n; i++) {
        let r = 0;
        let s = 1;
        let b;
        do {
          b = src[p++];
          r += (b & 0x7f) * s;
          s *= 128;
        } while (b & 0x80);
        const v = r % 2 === 1 ? -(r + 1) / 2 : r / 2;
        acc = a.cod === 'vlqd' ? acc + v : v;
        out[i] = acc;
      }
    }
    arrays[nombre] = out;
  }
  return { manifiesto: m, arrays };
}
