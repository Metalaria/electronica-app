// Checks that a breadboard reproduces its schematic: every original net is one net of the board and no
// two original nets are joined; legs in holes, one lead per hole, no overlapping bodies, no leg hidden
// under a body; 74HC chips powered with no input in the air. Used by the tests over every circuit and, in the app, after each auto-placement.

import { chipSinConectar } from './comprobaciones.ts';
import { conexiones } from './conexiones.ts';
import { bajoCuerpo, cuerpoDe, solapan } from './encapsulados.ts';
import { nombreAgujero } from './placa.ts';
import type { DocumentoProtoboard } from './tipos.ts';

export function verificarMontaje(doc: DocumentoProtoboard): string[] {
  const res: string[] = [];
  const con = conexiones(doc);
  const cfg = { placas: doc.placas, columnas: doc.columnas };
  const orig = doc.original ?? {};
  const porOriginal = new Map<string, Set<number>>();
  const porActual = new Map<number, Set<string>>();
  for (const [pin, nombre] of Object.entries(orig)) {
    const i = con.redDePin.get(pin);
    if (i == null) {
      res.push(`el terminal ${pin} no está en ninguna red`);
      continue;
    }
    (porOriginal.get(nombre) ?? porOriginal.set(nombre, new Set()).get(nombre)!).add(i);
    (porActual.get(i) ?? porActual.set(i, new Set()).get(i)!).add(nombre);
  }
  for (const [n, s] of porOriginal) if (s.size > 1) res.push(`la red ${n} queda partida en ${s.size}`);
  for (const [, s] of porActual) if (s.size > 1) res.push(`quedan unidas las redes ${[...s].join(', ')}`);
  for (const s of con.sueltas) res.push(`una pata de ${s.pieza} no está en ningún agujero`);
  for (const s of con.extremosSueltos) res.push(`un extremo del cable ${s.cable} no está en ningún agujero`);
  for (const p of con.dobles) res.push(`dos patas o cables en el agujero ${nombreAgujero(cfg, p[0], p[1])}`);
  // 74HC chips: powered, and no input in the air.
  for (const p of doc.piezas) {
    if (!p.chip) continue;
    const c = chipSinConectar(doc, con, p);
    if (c.flotantes.length) res.push(`${p.comp.nombre} tiene entradas al aire (${c.flotantes.map((i) => i + 1).join(', ')})`);
    if (c.sinVcc || c.sinGnd) res.push(`${p.comp.nombre} no está alimentado`);
    for (const x of c.rotas) res.push(x.texto);
  }
  const cuerpos = doc.piezas.map((p) => ({ p, b: cuerpoDe(p) })).filter((x) => x.b);
  for (let i = 0; i < cuerpos.length; i++)
    for (let j = i + 1; j < cuerpos.length; j++)
      if (solapan(cuerpos[i]!.b!, cuerpos[j]!.b!)) res.push(`se solapan ${cuerpos[i]!.p.comp.nombre} y ${cuerpos[j]!.p.comp.nombre}`);
  const puntos: { x: number; y: number; de: string }[] = [];
  for (const p of doc.piezas) for (const q of p.pos) puntos.push({ x: q[0], y: q[1], de: p.id });
  for (const w of doc.cables) for (const q of [w.a, w.b]) puntos.push({ x: q[0], y: q[1], de: w.id });
  for (const { p, b } of cuerpos)
    for (const q of puntos) if (q.de !== p.id && bajoCuerpo(b!, q.x, q.y)) res.push(`${q.de} queda debajo de ${p.comp.nombre}`);
  return res;
}
