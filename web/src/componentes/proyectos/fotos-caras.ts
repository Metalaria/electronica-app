// Photographs as the faces of a board (0.11): a board reconstructed from photos (the Master System II's
// 171-5922A, contenido/consolas_sms_placa.py) carries `placa.fotos`, one rectified JPEG per face in the board's
// frame. They are decoded once into ImageBitmaps (fetch + createImageBitmap, which also exist in the faces'
// worker) and painted by pintarLado instead of the drawn copper, mask and silkscreen; the pads, the drills and
// the highlights keep coming from the board data. No DOM here: this module also runs in caras.trabajador.ts.

import type { DatosPlaca } from './datos';
import type { Geometria, Lado } from './geometria';

const cache = new Map<string, Promise<ImageBitmap>>();

function decodificar(url: string): Promise<ImageBitmap> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar ${url} (${r.status})`);
        return r.blob();
      })
      .then((b) => createImageBitmap(b));
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** Whether the board's faces are photographs. */
export function tieneFotos(d: Pick<DatosPlaca, 'placa'>): boolean {
  return !!d.placa.fotos && Object.keys(d.placa.fotos).length > 0;
}

/**
 * Decodes the board's face photos and puts them on its geometry (`g.fotos`). Resolves when done; a face that
 * fails to load is left out (its face is then drawn from the pads, as a board without photos), and the error is
 * returned so the caller can log it.
 */
export async function cargarFotosCaras(d: Pick<DatosPlaca, 'placa'>, g: Geometria, base?: string): Promise<string | null> {
  const fotos = d.placa.fotos;
  if (!fotos) return null;
  const out: Partial<Record<Lado, ImageBitmap>> = {};
  let error: string | null = null;
  await Promise.all(
    (['F', 'B'] as const).map(async (lado) => {
      const f = fotos[lado];
      if (!f) return;
      try {
        out[lado] = await decodificar(base ? new URL(f.src, base).href : f.src);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }),
  );
  g.fotos = out;
  return error;
}

/** The board data with its photos' URLs made absolute (for the worker, whose relative URLs resolve elsewhere). */
export function fotosAbsolutas(d: DatosPlaca, base: string): DatosPlaca {
  const f = d.placa.fotos;
  if (!f) return d;
  const fotos: NonNullable<DatosPlaca['placa']['fotos']> = {};
  for (const lado of ['F', 'B'] as const) {
    const x = f[lado];
    if (x) fotos[lado] = { ...x, src: new URL(x.src, base).href };
  }
  return { ...d, placa: { ...d.placa, fotos } };
}
