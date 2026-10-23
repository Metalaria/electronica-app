// Canvas drawing of the block diagram with the activity of the current instant.

import type { Vista } from '../../animaciones/nucleo/dibujo';
import { rr } from '../../animaciones/nucleo/dibujo';
import { alfa, mezcla, type Paleta } from '../../animaciones/nucleo/paleta';
import { activo, type Bloque, type Conexion, type Diagrama } from './diagrama';
import type { Escenario, Muestra } from './modelo';

function colorClase(c: Conexion['clase'], pal: Paleta): string {
  switch (c) {
    case 'bus':
      return pal.acento;
    case 'dato':
      return pal.serie[0];
    case 'seleccion':
      return pal.peligro;
    case 'reloj':
      return pal.campoE;
    case 'interrupcion':
      return pal.aviso;
    default:
      return pal.campoB;
  }
}

function conexionActiva(e: Escenario | null, m: Muestra, c: Conexion): boolean {
  if (!c.pista) return false;
  return activo(e, m, { pista: c.pista, nivel: c.nivel });
}

function posEtiqueta(c: Conexion): [number, number] {
  if (c.pos) return c.pos;
  let mejor = 0;
  let p: [number, number] = c.puntos[0]!;
  for (let i = 1; i < c.puntos.length; i++) {
    const a = c.puntos[i - 1]!;
    const b = c.puntos[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > mejor) {
      mejor = l;
      p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 6];
    }
  }
  return p;
}

export function dibujarDiagrama(
  v: Vista,
  d: Diagrama,
  e: Escenario | null,
  m: Muestra,
  elegido: string | null,
  resaltado: string | null,
  animado: boolean,
): void {
  const { ctx, pal } = v;
  ctx.fillStyle = pal.fondo;
  ctx.fillRect(0, 0, v.w, v.h);

  // wires: idle first, active on top
  const activas: Conexion[] = [];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const c of d.conexiones) {
    const on = conexionActiva(e, m, c);
    if (on) activas.push(c);
    ctx.strokeStyle = alfa(pal.tinta, pal.oscuro ? 0.22 : 0.18);
    ctx.lineWidth = c.bits > 1 ? 5 : 1.8;
    trazar(ctx, c.puntos);
  }
  for (const c of activas) {
    const col = colorClase(c.clase, pal);
    ctx.strokeStyle = alfa(col, 0.28);
    ctx.lineWidth = c.bits > 1 ? 11 : 6;
    trazar(ctx, c.puntos);
    ctx.strokeStyle = col;
    ctx.lineWidth = c.bits > 1 ? 5 : 2.4;
    trazar(ctx, c.puntos);
    if (animado && c.bits > 1) {
      ctx.save();
      ctx.strokeStyle = alfa('#ffffff', pal.oscuro ? 0.45 : 0.6);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -((v.t * 40) % 16);
      trazar(ctx, c.puntos);
      ctx.restore();
    }
  }

  // blocks
  for (const b of d.bloques) dibujarBloque(v, b, e, m, b.id === elegido, b.id === resaltado);

  // labels (with the bus value when driven)
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (const c of d.conexiones) {
    if (!c.etiqueta) continue;
    const on = conexionActiva(e, m, c);
    let txt = c.etiqueta;
    if (c.valor && c.pista && on && c.pista in m.buses) txt += ` = ${m.buses[c.pista]}`;
    const [x, y] = posEtiqueta(c);
    ctx.font = v.fuente(11.5, on ? 700 : 600);
    const w = ctx.measureText(txt).width + 10;
    const h = v.f(16);
    ctx.fillStyle = alfa(pal.fondo, 0.88);
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = on ? colorClase(c.clase, pal) : pal.suave;
    ctx.fillText(txt, x, y + 0.5);
  }
}

function trazar(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();
}

function dibujarBloque(v: Vista, b: Bloque, e: Escenario | null, m: Muestra, elegido: boolean, resaltado: boolean): void {
  const { ctx, pal } = v;
  const on = (b.actividad ?? []).some((a) => activo(e, m, a));
  ctx.save();
  rr(ctx, b.x, b.y, b.w, b.h, 10);
  ctx.fillStyle = on ? mezcla(pal.panel, pal.acento, pal.oscuro ? 0.28 : 0.14) : pal.panel;
  ctx.fill();
  if (b.externo) ctx.setLineDash([6, 4]);
  ctx.strokeStyle = on ? pal.acento : pal.linea;
  ctx.lineWidth = on ? 2.4 : 1.4;
  ctx.stroke();
  ctx.setLineDash([]);
  if (elegido || resaltado) {
    rr(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 14);
    ctx.strokeStyle = resaltado ? pal.peligro : pal.aviso;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = b.x + b.w / 2;
  const t1 = v.f(15);
  const t2 = v.f(11.5);
  const cy = b.y + b.h / 2;
  ctx.fillStyle = pal.tinta;
  ctx.font = v.fuente(15, 700);
  ajustarTexto(ctx, b.titulo, cx, cy - t2 * 0.7, b.w - 10);
  ctx.fillStyle = pal.suave;
  ctx.font = v.fuente(11.5, 600);
  ajustarTexto(ctx, b.sub, cx, cy + t1 * 0.62, b.w - 10);
  ctx.restore();
}

function ajustarTexto(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, max: number): void {
  if (ctx.measureText(t).width <= max) {
    ctx.fillText(t, x, y);
    return;
  }
  ctx.fillText(t, x, y, max);
}

export function bloqueEn(d: Diagrama, x: number, y: number): Bloque | null {
  for (const b of d.bloques) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  return null;
}
