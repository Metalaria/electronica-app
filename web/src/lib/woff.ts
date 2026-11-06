// WOFF 1.0 → plain sfnt (TrueType/OpenType) in memory (1.0 performance review). fontkit reads a WOFF table by
// inflating it again on every access (`WOFFFont._getTableStream`, no cache), so laying out and subsetting a PDF's text
// with WOFF files inflated the `glyf`/`GPOS` tables thousands of times: 80 % of the teacher-mode PDF's time (CPU ×4:
// 4,7 s of 5,6 s in `tinf_uncompress`). The same font as an sfnt is read straight from the buffer; the glyphs, metrics
// and the embedded subset are the same (fontkit builds the subset from the glyph data, not from the container).
// The tables are inflated with DecompressionStream('deflate') (Chromium 80, Safari 16.4, Node 18); without it, or for
// anything that is not a valid WOFF 1.0, the bytes are returned unchanged (slower, same result).

/** zlib (RFC 1950) inflate. */
export type Inflar = (datos: Uint8Array) => Promise<Uint8Array>;

/** zlib inflate with the platform's DecompressionStream (null where there is none). */
export const inflarNativo: Inflar | null =
  typeof DecompressionStream === 'undefined'
    ? null
    : async (datos) => new Uint8Array(await new Response(new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());

export function esWoff(b: Uint8Array): boolean {
  return b.length >= 44 && b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x46; // 'wOFF'
}

export async function sfntDeWoff(b: Uint8Array, inflar: Inflar | null = inflarNativo): Promise<Uint8Array> {
  if (!esWoff(b) || !inflar) return b;
  try {
    return await convertir(b, inflar);
  } catch {
    return b;
  }
}

async function convertir(b: Uint8Array, inflar: Inflar): Promise<Uint8Array> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const flavor = v.getUint32(4);
  const n = v.getUint16(12);
  if (44 + n * 20 > b.length) return b;
  const tablas: { tag: number; suma: number; datos: Uint8Array }[] = [];
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const tag = v.getUint32(o);
    const desde = v.getUint32(o + 4);
    const comp = v.getUint32(o + 8);
    const orig = v.getUint32(o + 12);
    const suma = v.getUint32(o + 16);
    if (desde + comp > b.length) return b;
    const crudo = b.subarray(desde, desde + comp);
    const datos = comp < orig ? await inflar(crudo) : crudo;
    if (datos.length !== orig) return b;
    tablas.push({ tag, suma, datos });
  }
  // sfnt: offset table, table records (sorted by tag, as in the WOFF directory), tables padded to 4 bytes
  let potencia = 1;
  let log = 0;
  while (potencia * 2 <= n) {
    potencia *= 2;
    log++;
  }
  const cab = 12 + n * 16;
  const total = tablas.reduce((s, t) => s + ((t.datos.length + 3) & ~3), cab);
  const r = new Uint8Array(total);
  const w = new DataView(r.buffer);
  w.setUint32(0, flavor);
  w.setUint16(4, n);
  w.setUint16(6, potencia * 16);
  w.setUint16(8, log);
  w.setUint16(10, n * 16 - potencia * 16);
  let pos = cab;
  tablas.forEach((t, i) => {
    const o = 12 + i * 16;
    w.setUint32(o, t.tag);
    w.setUint32(o + 4, t.suma);
    w.setUint32(o + 8, pos);
    w.setUint32(o + 12, t.datos.length);
    r.set(t.datos, pos);
    pos += (t.datos.length + 3) & ~3;
  });
  return r;
}
