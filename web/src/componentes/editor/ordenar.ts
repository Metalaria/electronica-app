// «Ordenar el esquema»: the drawing laid out again by the automatic schematics (esquema-auto, the same layout as
// a netlist opened in the editor), keeping every part as it is (kind, name, values). The generated netlist is
// laid out (two-terminal loads written as resistors for the layout only, so they get a two-terminal place), each
// part takes the place of its netlist line(s); a part whose symbol differs from the layout's (potentiometer,
// relay, controlled sources, boxes…) is put where the layout put its line(s) and its pins are wired to the
// layout's wires with the router. Probes and notes are put back near their nets. The result must give the same
// connections as before, otherwise nothing changes.

import type { EditableAuto } from '../esquema-auto/editable.ts';
import { ES_CONEXION } from './catalogo.ts';
import { conectividad } from './conectividad.ts';
import { geometria, pinesMundo } from './geometria.ts';
import { documentoDeEditable } from './importar.ts';
import { generarNetlist, type Netlist } from './netlist.ts';
import { huecoLibre, puntosDeRed, ruta, tramos, type P } from './rutas.ts';
import type { Cable, Componente, DocumentoEsquema } from './tipos.ts';

/** Kinds written for the layout as a plain resistor (their symbol has the same two pins as a resistor). */
const COMO_RESISTENCIA = new Set(['LAMP', 'ZUMB', 'MOTOR', 'XTAL']);

/** The netlist for the layout: the drawing's, with some two-terminal subcircuits as resistors. */
export function netlistParaOrdenar(doc: DocumentoEsquema, nl: Netlist): { texto: string; alias: Map<string, string> } {
  const lineas = nl.texto.split('\n');
  const alias = new Map<string, string>();
  const porId = new Map(doc.componentes.map((c) => [c.id, c]));
  for (const [i, id] of nl.lineaDe) {
    const c = porId.get(id);
    if (!c || !COMO_RESISTENCIA.has(c.tipo)) continue;
    const t = lineas[i]!.trim().split(/\s+/);
    const proxy = `R${t[0]}`;
    alias.set(proxy.toLowerCase(), t[0]!.toLowerCase());
    lineas[i] = `${proxy} ${t[1]} ${t[2]} 1`;
  }
  return { texto: lineas.join('\n'), alias };
}

/** Pin → «instance#index» of every netlist line of a drawing. */
function pinesPorInstancia(nl: Netlist, alias?: Map<string, string>): Map<string, { comp: string; pin: string }> {
  const m = new Map<string, { comp: string; pin: string }>();
  for (const i of nl.instancias) {
    const n = alias?.get(i.nombre) ?? i.nombre;
    for (const [pin, k] of Object.entries(i.pines)) m.set(`${n}#${k}`, { comp: i.comp, pin });
  }
  return m;
}

/** The nets of a netlist as sets of «instance#index» (names of the nets left out). */
export function particion(nl: Netlist): string[] {
  const porRed = new Map<string, string[]>();
  for (const i of nl.instancias) {
    for (const [pin, k] of Object.entries(i.pines)) {
      const r = nl.con.redDePin.get(`${i.comp}.${pin}`);
      const red = r == null ? `?${i.comp}.${pin}` : nl.con.redes[r]!.nombre;
      (porRed.get(red) ?? porRed.set(red, []).get(red)!).push(`${i.nombre}#${k}`);
    }
  }
  return [...porRed.values()].map((x) => x.sort().join(' ')).sort();
}

export function mismasConexiones(a: Netlist, b: Netlist): boolean {
  const pa = particion(a);
  const pb = particion(b);
  return pa.length === pb.length && pa.every((x, i) => x === pb[i]);
}

function centro(c: Componente): P {
  const b = geometria(c).cuerpo;
  return [c.x + (b[0] + b[2]) / 2, c.y + (b[1] + b[3]) / 2];
}

/** The drawing laid out again, or an error in plain Spanish. */
export function ordenarDocumento(doc: DocumentoEsquema, nl: Netlist, e: EditableAuto, alias: Map<string, string>, texto: string, comprobar = true): { doc: DocumentoEsquema } | { error: string } {
  const imp = documentoDeEditable(texto, e, doc.origen);
  const nlImp = generarNetlist(imp);
  const destino = pinesPorInstancia(nl);
  // For each original part: the layout's pins that are its own (layout part, its pin, the original's pin).
  const pares = new Map<string, { ic: Componente; ip: string; op: string }[]>();
  const impPorId = new Map(imp.componentes.map((c) => [c.id, c]));
  for (const i of nlImp.instancias) {
    const ic = impPorId.get(i.comp);
    if (!ic) continue;
    const n = alias.get(i.nombre) ?? i.nombre;
    for (const [ip, k] of Object.entries(i.pines)) {
      const d = destino.get(`${n}#${k}`);
      if (!d) continue;
      (pares.get(d.comp) ?? pares.set(d.comp, []).get(d.comp)!).push({ ic, ip, op: d.pin });
    }
  }
  const componentes: Componente[] = [];
  const reconectar: [P, P, string, P | undefined][] = [];
  /** Parts drawn with another symbol than the layout's: placed once the layout's wires are in. */
  const otros: { nuevo: Componente; ps: { ic: Componente; ip: string; op: string }[]; centro: P }[] = [];
  const pinImp = (ic: Componente, nombre: string) => pinesMundo(ic).find((q) => q.nombre === nombre);
  const sueltos: Componente[] = [];
  let nId = 0;
  for (const c of doc.componentes) nId = Math.max(nId, Number(/(\d+)$/.exec(c.id)?.[1] ?? 0));
  for (const c of doc.cables) nId = Math.max(nId, Number(/(\d+)$/.exec(c.id)?.[1] ?? 0));
  for (const c of doc.componentes) {
    if (ES_CONEXION.has(c.tipo) && c.tipo !== 'NOTA') continue; // the layout draws its own grounds, supplies and labels
    const ps = pares.get(c.id);
    if (!ps?.length) {
      sueltos.push(JSON.parse(JSON.stringify(c)) as Componente);
      continue;
    }
    // The layout part holding most of its pins.
    const cuenta = new Map<Componente, number>();
    for (const p of ps) cuenta.set(p.ic, (cuenta.get(p.ic) ?? 0) + 1);
    const ancla = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const nuevo = JSON.parse(JSON.stringify(c)) as Componente;
    // Same symbol: the layout's place, orientation and variant.
    nuevo.x = ancla.x;
    nuevo.y = ancla.y;
    nuevo.o = ancla.o;
    if (ancla.v) nuevo.v = ancla.v;
    else delete nuevo.v;
    const encaja = (n: Componente) => {
      const mios = new Map(pinesMundo(n).map((q) => [q.nombre, q]));
      return ps.every((p) => {
        const a = pinImp(p.ic, p.ip);
        const b = mios.get(p.op);
        return a && b && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
      });
    };
    if (!encaja(nuevo)) {
      // Another symbol: placed later in a free spot near the layout's part(s), wired to where its pins were.
      const cs = [...cuenta.keys()].map(centro);
      nuevo.o = c.o;
      delete nuevo.v;
      if (c.v) nuevo.v = c.v;
      otros.push({ nuevo, ps, centro: [cs.reduce((a, q) => a + q[0], 0) / cs.length, cs.reduce((a, q) => a + q[1], 0) / cs.length] });
      continue;
    }
    componentes.push(nuevo);
  }
  // Grounds, supplies and labels of the layout.
  for (const ic of imp.componentes) if (ES_CONEXION.has(ic.tipo)) componentes.push({ ...ic, id: `c${++nId}` });
  const cables: Cable[] = imp.cables.map((w) => ({ ...w, id: `w${++nId}` }));
  const nuevoDoc: DocumentoEsquema = { ...JSON.parse(JSON.stringify(doc)), componentes, cables };
  // Parts with another symbol: a free spot near the layout's place (none: that place), then their pins wired.
  for (const { nuevo, ps, centro: cc } of otros) {
    const sitio = huecoLibre(nuevoDoc, nuevo, cc, 24);
    const g = geometria(nuevo).cuerpo;
    nuevo.x = sitio ? sitio[0] : Math.round(cc[0] - (g[0] + g[2]) / 2);
    nuevo.y = sitio ? sitio[1] : Math.round(cc[1] - (g[1] + g[3]) / 2);
    componentes.push(nuevo);
    const mios = new Map(pinesMundo(nuevo).map((q) => [q.nombre, q]));
    const hechos = new Set<string>();
    for (const p of ps) {
      const a = pinImp(p.ic, p.ip);
      const b = mios.get(p.op);
      if (!a || !b) continue;
      const kk = `${a.x},${a.y}|${p.op}`;
      if (hechos.has(kk)) continue;
      hechos.add(kk);
      if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6) reconectar.push([[a.x, a.y], [b.x, b.y], nuevo.id, [b.dx, b.dy]]);
    }
  }
  // Wires from the layout's pins to those parts.
  for (const [a, b, , dir] of reconectar) {
    const pts = ruta(nuevoDoc, b, [a], { salida: dir }) ?? ruta(nuevoDoc, b, [a], { salida: dir, margen: 10 });
    if (pts) {
      for (const t of tramos(pts)) if (Math.hypot(t[2] - t[0], t[3] - t[1]) > 1e-6) cables.push({ id: `w${++nId}`, p: t });
      continue;
    }
    // No way: a pair of net labels (or grounds) joins the pin and the layout's wire.
    const red = cables.find((w) => (Math.abs(w.p[0] - a[0]) < 1e-6 && Math.abs(w.p[1] - a[1]) < 1e-6) || (Math.abs(w.p[2] - a[0]) < 1e-6 && Math.abs(w.p[3] - a[1]) < 1e-6))?.red;
    for (const q of [a, b]) componentes.push(red ? { id: `c${++nId}`, tipo: 'ETQ', nombre: '', x: q[0], y: q[1], o: 0, campos: { red } } : { id: `c${++nId}`, tipo: 'GND', nombre: '', x: q[0], y: q[1], o: 0, campos: {} });
  }
  // Probes and meters: back on their nets, near their old place, with a wire.
  const conViejo = nl.con;
  for (const s of sueltos) {
    if (s.tipo === 'NOTA') {
      componentes.push(s);
      continue;
    }
    const conAhora = conectividad(nuevoDoc);
    const pines = pinesMundo(s);
    // Target nets by name (the layout keeps the netlist's node names on its wires).
    const nombresRed = pines.map((p) => {
      const r = conViejo.redDePin.get(`${s.id}.${p.nombre}`);
      return r == null ? null : conViejo.redes[r]!.nombre;
    });
    const destinos = nombresRed.map((n) => {
      const r = conAhora.redes.find((x) => x.nombre === n);
      return r ? puntosDeRed(nuevoDoc, r.pines, r.cables) : [];
    });
    const primero = destinos.find((d) => d.length)?.[0];
    if (!primero) {
      componentes.push(s);
      continue;
    }
    // A free spot near the first point of its first net, then each pin wired.
    const sitio = huecoLibre(nuevoDoc, s, [primero[0] + 1, primero[1] - 2], 16);
    const g = geometria(s);
    const p0 = g.pines[0]!;
    s.x = sitio ? sitio[0] : Math.round(primero[0] - p0.x + 1);
    s.y = sitio ? sitio[1] : Math.round(primero[1] - p0.y - 2);
    componentes.push(s);
    pinesMundo(s).forEach((p, i) => {
      const d = destinos[i] ?? [];
      if (!d.length) return;
      const pts = ruta(nuevoDoc, [p.x, p.y], d, { ignorar: new Set([s.id]), salida: [p.dx, p.dy] });
      if (pts) for (const t of tramos(pts)) if (Math.hypot(t[2] - t[0], t[3] - t[1]) > 1e-6) cables.push({ id: `w${++nId}`, p: t });
    });
  }
  const nlNuevo = generarNetlist(nuevoDoc);
  if (comprobar && !mismasConexiones(nl, nlNuevo)) return { error: 'No se ha podido ordenar el esquema sin cambiar sus conexiones: se queda como estaba.' };
  return { doc: nuevoDoc };
}
