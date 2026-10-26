// Reader of the «EPAF» traces of «Un fotograma» (contenido/fotograma/traza.mjs writes them): the manifest, the
// typed arrays (LZ-decompressed, varint-decoded) and fast lookups by time (binary search).

import type { IdMaquina } from '../datos';
import type { AccesoBus, ArrayNum, BusTraza, IndicePrograma, ManifiestoTraza, TipoArray } from './tipos';

const CTOR: Record<TipoArray, { new (n: number): ArrayNum }> = { u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i32: Int32Array };

function descomprimirLz(src: Uint8Array, total: number): Uint8Array {
  const out = new Uint8Array(total);
  let p = 0;
  let o = 0;
  const leer = (): number => {
    let r = 0;
    let s = 1;
    let b: number;
    do {
      b = src[p++]!;
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
    if (d >= m) {
      out.copyWithin(o, o - d, o - d + m);
      o += m;
    } else for (let j = 0; j < m; j++, o++) out[o] = out[o - d]!;
  }
  return out;
}

export interface BusDecodificado {
  def: BusTraza;
  t: ArrayNum;
  a: ArrayNum;
  d: ArrayNum;
  f: ArrayNum;
  c: ArrayNum;
  k: ArrayNum | null;
}

export class Traza {
  readonly m: ManifiestoTraza;
  readonly arrays: Record<string, ArrayNum>;
  readonly buses: BusDecodificado[];
  /** Per signal kind: times and levels. */
  readonly senales: { t: number[]; v: number[] }[];
  readonly bytes: number;

  constructor(buf: ArrayBuffer) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    if (String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!) !== 'EPAF') throw new Error('No es una traza «EPAF»');
    const n = dv.getUint32(8, true);
    this.m = JSON.parse(new TextDecoder().decode(u8.subarray(12, 12 + n))) as ManifiestoTraza;
    this.bytes = buf.byteLength;
    let zona: Uint8Array = u8.subarray(12 + n);
    if (this.m.compresion?.tipo === 'lz') zona = descomprimirLz(zona, this.m.compresion.bytes);
    this.arrays = {};
    for (const [nombre, a] of Object.entries(this.m.arrays)) {
      const Ctor = CTOR[a.tipo];
      const out = new Ctor(a.n);
      const src = zona.subarray(a.offset, a.offset + a.bytes);
      if (a.cod === 'crudo') {
        const copia = src.slice();
        out.set(new (Ctor as unknown as { new (b: ArrayBuffer): ArrayNum })(copia.buffer));
      } else {
        let p = 0;
        let acc = 0;
        const delta = a.cod === 'vlqd';
        for (let i = 0; i < a.n; i++) {
          let r = 0;
          let s = 1;
          let b: number;
          do {
            b = src[p++]!;
            r += (b & 0x7f) * s;
            s *= 128;
          } while (b & 0x80);
          const v = r % 2 === 1 ? -(r + 1) / 2 : r / 2;
          acc = delta ? acc + v : v;
          out[i] = acc;
        }
      }
      this.arrays[nombre] = out;
    }
    const A = (n?: string): ArrayNum | null => (n ? (this.arrays[n] ?? null) : null);
    this.buses = this.m.buses.map((b) => ({ def: b, t: A(b.t)!, a: A(b.a)!, d: A(b.d)!, f: A(b.f)!, c: A(b.c)!, k: A(b.k) }));
    this.senales = this.m.senales.tipos.map(() => ({ t: [] as number[], v: [] as number[] }));
    const st = A(this.m.senales.t)!;
    const sk = A(this.m.senales.k)!;
    const sv = A(this.m.senales.v)!;
    for (let i = 0; i < st.length; i++) {
      const s = this.senales[sk[i]!];
      if (s) {
        s.t.push(st[i]!);
        s.v.push(sv[i]!);
      }
    }
  }

  array(nombre: string): ArrayNum {
    const a = this.arrays[nombre];
    if (!a) throw new Error(`La traza no tiene el array «${nombre}»`);
    return a;
  }

  get ins() {
    const i = this.m.instrucciones[0]!;
    return {
      t: this.array(i.t),
      pc: this.array(i.pc),
      ciclo: this.array(i.ciclo),
      k: i.k ? this.array(i.k) : null,
      r: i.r.map((n) => this.array(n)),
      nombres: this.m.cpus[0]!.registros,
    };
  }

  /** Byte of the program's memory images (ROM, HRAM…) at a CPU address, or -1. */
  leer(dir: number): number {
    for (const m of this.m.memoria) {
      const a = this.arrays[m.array];
      if (!a) continue;
      if (m.nombre === 'PRG-ROM') {
        // NROM: the PRG is mirrored over $8000–$FFFF
        if (dir >= 0x8000) return a[(dir - 0x8000) % a.length]!;
        continue;
      }
      const o = dir - m.base;
      if (o >= 0 && o < a.length) return a[o]!;
    }
    return -1;
  }

  /** Signal level at t: the last change at or before t (before the first change, the opposite of it). */
  nivel(k: number, t: number): number {
    const s = this.senales[k];
    if (!s || !s.t.length) return 0;
    const i = ultimoHasta(s.t, t);
    return i < 0 ? (s.v[0] ? 0 : 1) : s.v[i]!;
  }

  acceso(b: BusDecodificado, i: number, t: number): AccesoBus {
    return {
      t: b.t[i]!,
      a: b.a[i]!,
      d: b.d[i]!,
      f: b.f[i]!,
      c: b.def.chips[b.c[i]!]?.id ?? '',
      k: b.k && b.def.tipos ? b.def.tipos[b.k[i]!]?.id : undefined,
      fase: t - b.t[i]!,
    };
  }
}

/** Index of the last element <= t in a sorted array, or -1. */
export function ultimoHasta(a: ArrayLike<number>, t: number, lo = 0, hi = a.length - 1): number {
  let r = lo - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (a[m]! <= t) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}

const cache = new Map<string, Promise<unknown>>();

function pedir<T>(ruta: string): Promise<T> {
  let p = cache.get(ruta);
  if (!p) {
    p = fetch(ruta).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
      return r.json();
    });
    p.catch(() => cache.delete(ruta));
    cache.set(ruta, p);
  }
  return p as Promise<T>;
}

export function cargarIndiceFotograma(m: IdMaquina): Promise<{ version: number; programas: IndicePrograma[] }> {
  return pedir(`consolas/fotograma/${m}/indice.json`);
}

const trazas = new Map<string, Promise<Traza>>();

export function cargarTraza(m: IdMaquina, archivo: string): Promise<Traza> {
  const ruta = `consolas/fotograma/${m}/${archivo}`;
  let p = trazas.get(ruta);
  if (!p) {
    p = fetch(ruta)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
        return r.arrayBuffer();
      })
      .then((b) => new Traza(b));
    p.catch(() => trazas.delete(ruta));
    trazas.set(ruta, p);
  }
  return p;
}
