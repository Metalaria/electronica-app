// The size of the drawing each book netlist shows (0.12 QA), so the simulator page and the instruments bench can
// keep exactly its place while the drawing is decided — a fixed 16:9 or 5:2 place moved everything under a much wider
// or taller drawing up to 300 px when it came. Same choice as the app (figuras-vivas/circuito/CircuitoVivo.svelte):
// the book figure whose schematic matches the netlist (its schematic's box when clearly smaller than the figure), or
// else the automatic schematic, laid out from precalculado.json at the three sheet shapes the app uses
// (esquema-auto/index.ts aspectoPantalla: 1.1, 1.5 and 2). Writes src/componentes/figuras-vivas/circuito/proporciones.json:
//   { "<netlist id>": { "l"?: [w, h] (the book figure the page shows), "a": [w, h] (the automatic schematic, the same
//     at every shape) | { "1.1": [w, h], "1.5": [w, h], "2": [w, h] } | null (nothing to draw) } }
// The simulator page shows «l» when there is one, else «a»; the instruments bench always lays out «a».
//   node scripts/circuitos-proporciones.mjs
// Run it again after changing the netlists, the figures' data or the layout code (esquema-auto-precalcular.mjs first):
// a stale entry only makes the reserved place a little wrong (a small shift), never breaks the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public/libro');
const { generarEsquema, sembrarDibujos } = await import(path.join(web, 'src/componentes/esquema-auto/generar.ts'));
const { emparejar } = await import(path.join(web, 'src/componentes/figuras-vivas/circuito/netlist.ts'));
sembrarDibujos(JSON.parse(fs.readFileSync(path.join(web, 'src/componentes/esquema-auto/precalculado.json'), 'utf8')));
const indice = JSON.parse(fs.readFileSync(path.join(libro, 'spice.json'), 'utf8'));

/** CircuitoVivo.svelte recorteDe: the schematic's box (6 px margin) when clearly smaller than the figure. */
function recorte(d, esq, vista) {
  const ej = d.ejes?.[esq.eje];
  if (!ej) return null;
  const [x, y, w, h] = ej.pos_svg;
  const m = 6;
  const x0 = Math.max(vista[0], x - m);
  const y0 = Math.max(vista[1], y - m);
  const x1 = Math.min(vista[0] + vista[2], x + w + m);
  const y1 = Math.min(vista[1] + vista[3], y + h + m);
  if ((x1 - x0) * (y1 - y0) > vista[2] * vista[3] * 0.8) return null;
  return [x0, y0, x1 - x0, y1 - y0];
}

const r = {};
let libroN = 0;
let autoN = 0;
for (const [id, nl] of Object.entries(indice.netlists)) {
  const texto = fs.readFileSync(path.join(libro, nl.fichero), 'utf8');
  let hecho = false;
  for (const ref of nl.refs ?? []) {
    if (!ref.startsWith('fig-')) continue;
    const f = path.join(libro, 'datos', `${ref.slice(4)}.json`);
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const esq of d.esquemas ?? []) {
      if (!emparejar(esq, texto)) continue;
      const vista = [0, 0, d.lienzo.svg.ancho, d.lienzo.svg.alto];
      const m = recorte(d, esq, vista) ?? vista;
      r[id] = { l: [Math.round(m[2] * 10) / 10, Math.round(m[3] * 10) / 10] };
      hecho = true;
      libroN++;
      break;
    }
    if (hecho) break;
  }
  const a = {};
  for (const aspecto of [1.1, 1.5, 2]) {
    const e = generarEsquema(texto, { subckt: null, aspecto });
    a[String(aspecto)] = e ? [e.vista[2], e.vista[3]] : null;
  }
  const v = Object.values(a);
  r[id] = { ...r[id], a: v.every((x) => JSON.stringify(x) === JSON.stringify(v[0])) ? v[0] : a };
  if (!hecho && v.some((x) => x !== null)) autoN++;
}
const destino = path.join(web, 'src/componentes/figuras-vivas/circuito/proporciones.json');
fs.writeFileSync(destino, JSON.stringify(r));
console.log(`${Object.keys(r).length} netlists: ${libroN} con la figura del libro, ${autoN} automáticas → ${path.relative(web, destino)} (${(fs.statSync(destino).size / 1024).toFixed(1)} kB)`);
