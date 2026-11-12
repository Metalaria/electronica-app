// 1.2 (motor12c): what the lesson generator needs to resolve a «figura» widget (contenido/lecciones11/GUIA.md §11):
// a book figure by its label in any part, the pixel size of a photo (PNG or JPEG header) and a console of the
// «Consolas» explorer with its photos and hotspots. Used by scripts/lecciones11.mjs and the tests (lib/leccion12/
// digital/generar-digital.ts RecursosLibro); reads only.
import fs from 'node:fs';
import path from 'node:path';

/** Width and height of a PNG or JPEG file, or null. */
export function tamanoImagen(fichero) {
  let b;
  try {
    b = fs.readFileSync(fichero);
  } catch {
    return null;
  }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      const largo = b.readUInt16BE(i + 2);
      // SOF0…SOF15 except DHT (C4), JPG (C8) and DAC (CC)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { ancho: b.readUInt16BE(i + 7), alto: b.readUInt16BE(i + 5) };
      i += 2 + largo;
    }
  }
  return null;
}

/**
 * The resources of a book folder (web/public/libro, or EPA_LIBRO) and of the app's public folder (consoles):
 * `libro` is the book folder, `publico` web/public.
 */
export function recursosLibro(libro, publico) {
  let figuras = null;
  const cargarFiguras = () => {
    if (figuras) return figuras;
    figuras = new Map();
    const dir = path.join(libro, 'partes');
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) {
      if (!f.endsWith('.json')) continue;
      let d;
      try {
        d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch {
        continue;
      }
      for (const b of d.bloques ?? []) if (b && b.t === 'figura' && typeof b.label === 'string' && !figuras.has(b.label)) figuras.set(b.label, b);
    }
    return figuras;
  };
  const consolas = new Map();
  return {
    figura: (label) => cargarFiguras().get(label) ?? null,
    tamano: (ruta) => {
      const limpia = String(ruta).replace(/^\/+/, '');
      if (limpia.includes('..')) return null;
      const f = limpia.startsWith('libro/') ? path.join(libro, limpia.slice(6)) : path.join(publico, limpia);
      return tamanoImagen(f);
    },
    consola: (maquina) => {
      if (!/^[a-z0-9]+$/.test(String(maquina))) return null;
      if (!consolas.has(maquina)) {
        const f = path.join(publico, 'consolas', `${maquina}.json`);
        consolas.set(maquina, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
      }
      return consolas.get(maquina);
    },
  };
}
