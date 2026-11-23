// 1.4 (contenido14) in Node (no browser, no server): every tappable zone of every published lesson figure reaches a
// finger on a phone. The 1.3.1 QA found ~200 cards (mostly console board photos and the rows of the book's tables)
// whose zones measured 3–24 px on a phone; their YAML now uses the engine's own `recorte` / `ampliar` (GUIA §11.1).
// Rule, measured as the generator measures (generar-digital.ts): a zone's size is the shorter side of its largest
// rectangle (or of a polygon's bounding box) × ANCHO_TELEFONO (the 312 px figure of a 360 px phone) × `ampliar` /
// the width shown (the crop's, or the whole figure's). Every zone of a figure that starts cropped or zoomed measures at
// least DEDO_TELEFONO (44 px); any other zone at least 24 px (WCAG 2.5.8). The 412 px phone of the owner is wider,
// so this also holds there (the browser spec contenido14-zonas-navegador measures the real boxes on it).
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.contenido14.config.ts tests/contenido14-zonas-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WidgetFigura, ZonaFigura } from '../src/lib/leccion12/digital/tipos.ts';
import { ANCHO_TELEFONO, DEDO_TELEFONO } from '../src/lib/leccion12/digital/generar-digital.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LECCIONES = path.join(web, 'public', 'libro', 'lecciones11');

/** Every figure card of the published lessons: lesson id, card id and its widget. */
function figuras(): { leccion: string; tarjeta: string; w: WidgetFigura }[] {
  const out: { leccion: string; tarjeta: string; w: WidgetFigura }[] = [];
  for (const parte of fs.readdirSync(LECCIONES).sort()) {
    const dir = path.join(LECCIONES, parte);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith('.json')) continue;
      const l = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { tarjetas: { id: string; widget?: { tipo?: string } }[] };
      for (const t of l.tarjetas)
        if (t.widget?.tipo === 'figura' && !(t.widget as WidgetFigura).fuente.codigo) out.push({ leccion: `${parte}/${f.slice(0, -5)}`, tarjeta: t.id, w: t.widget as WidgetFigura });
    }
  }
  return out;
}

/** A zone's size in picture units: the shorter side of its largest rectangle, or of a polygon's bounding box. */
function lado(z: ZonaFigura): number {
  let m = 0;
  for (const r of z.rects) m = Math.max(m, Math.min(r[2], r[3]));
  if (z.poligono?.length) {
    const xs = z.poligono.map((p) => p[0]);
    const ys = z.poligono.map((p) => p[1]);
    m = Math.max(m, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
  }
  return m;
}

test('cada zona de cada figura publicada se toca con el dedo en un teléfono (44 px si la figura se recorta o amplía, 24 px si no)', () => {
  const todas = figuras();
  expect(todas.length).toBeGreaterThan(2000);
  const fallos: string[] = [];
  for (const { leccion, tarjeta, w } of todas) {
    const ancho = w.recorte ? w.recorte[2] : w.fuente.vista[2];
    const escala = (ANCHO_TELEFONO * (w.ampliar ?? 1)) / ancho;
    const minimo = w.recorte || w.ampliar ? DEDO_TELEFONO : 24;
    for (const z of w.zonas) {
      const px = lado(z) * escala;
      if (px < minimo - 1e-6) fallos.push(`${leccion} ${tarjeta} ${z.id}: ${px.toFixed(1)} px (< ${minimo})`);
    }
  }
  expect(fallos, `${fallos.length} zonas pequeñas`).toEqual([]);
});

test('ninguna figura recortada o ampliada deja de mostrar una zona entera ni empieza con un zoom mayor que el del «+»', () => {
  for (const { leccion, tarjeta, w } of figuras()) {
    if (w.ampliar != null) expect(w.ampliar, `${leccion} ${tarjeta}`).toBeLessThanOrEqual(4);
    if (!w.recorte) continue;
    const [rx, ry, rw, rh] = w.recorte;
    for (const z of w.zonas) {
      expect(z.rects.length + (z.poligono ? 1 : 0), `${leccion} ${tarjeta} ${z.id}`).toBeGreaterThan(0);
      for (const r of z.rects) {
        expect(r[0] >= rx - 1e-6 && r[1] >= ry - 1e-6 && r[0] + r[2] <= rx + rw + 1e-6 && r[1] + r[3] <= ry + rh + 1e-6, `${leccion} ${tarjeta} ${z.id}`).toBe(true);
      }
    }
  }
});
