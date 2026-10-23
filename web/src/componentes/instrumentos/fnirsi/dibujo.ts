// The 2C53T's screen (320 × 240 logical pixels, like the real 2.8" TFT): oscilloscope with its 12 × 8 grid,
// trigger and ground markers, automatic measurements, cursors, math, FFT and X-Y; the multimeter and the
// generator screens; the menus. Drawn on demand (no animation loop): the component calls `dibujar` when a
// capture or a setting changes. Returns the tap zones of what is drawn (menu items, generator fields).

import type { Fnirsi } from './logica.svelte.ts';
import { DIV_H, DIV_V, type Espectro } from '../motor/osciloscopio.ts';
import { FORMAS } from '../motor/generador.ts';
import { FN_DMM_LISTA, MATES } from './logica.svelte.ts';
import { aEspanol, prefijo } from '../../grafica/formato';

export const ANCHO = 320;
export const ALTO = 240;
const X0 = 10;
const Y0 = 18;
const DIV = 25;
const GW = DIV * DIV_H;
const GH = DIV * DIV_V;

export const COLOR = { ch1: '#f6e23c', ch2: '#3cd2f4', mates: '#f45fd8', fft: '#7cf47c', menu: '#2a8f4a', rejilla: '#5a5f66' };

export interface Zona {
  x: number;
  y: number;
  w: number;
  h: number;
  accion: string;
}

/** «1,00 V», «200 mV», «13,9 Hz»: three significant figures with the SI prefix (instrument style). */
export function si(v: number | null | undefined, u: string, cifras = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '----';
  const [m, p] = prefijo(v);
  const x = v / m;
  const dec = Math.max(0, cifras - 1 - Math.floor(Math.log10(Math.abs(x) || 1)));
  return `${aEspanol(x.toFixed(Math.min(dec, 4)))}${p}${u}`;
}

function texto(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, color: string, tam = 9, alinear: CanvasTextAlign = 'left', negrita = false) {
  ctx.fillStyle = color;
  ctx.font = `${negrita ? '700 ' : ''}${tam}px "Source Sans 3", system-ui, sans-serif`;
  ctx.textAlign = alinear;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y);
}

function pastilla(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, fondo: string, color = '#fff', w?: number): number {
  ctx.font = '700 8.5px "Source Sans 3", system-ui, sans-serif';
  const ancho = w ?? ctx.measureText(t).width + 8;
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, 12, 3);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(t, x + ancho / 2, y + 9);
  return ancho;
}

function rejilla(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = COLOR.rejilla;
  ctx.lineWidth = 0.6;
  ctx.setLineDash([1, 2.5]);
  ctx.beginPath();
  for (let i = 1; i < DIV_H; i++) {
    ctx.moveTo(X0 + i * DIV + 0.5, Y0);
    ctx.lineTo(X0 + i * DIV + 0.5, Y0 + GH);
  }
  for (let j = 1; j < DIV_V; j++) {
    ctx.moveTo(X0, Y0 + j * DIV + 0.5);
    ctx.lineTo(X0 + GW, Y0 + j * DIV + 0.5);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#8a9099';
  ctx.strokeRect(X0 + 0.5, Y0 + 0.5, GW, GH);
  // Centre axes with minor ticks.
  ctx.beginPath();
  const cx = X0 + GW / 2;
  const cy = Y0 + GH / 2;
  for (let i = 0; i <= DIV_H * 5; i++) {
    const x = X0 + (i * DIV) / 5;
    ctx.moveTo(x, cy - 2);
    ctx.lineTo(x, cy + 2);
  }
  for (let j = 0; j <= DIV_V * 5; j++) {
    const y = Y0 + (j * DIV) / 5;
    ctx.moveTo(cx - 2, y);
    ctx.lineTo(cx + 2, y);
  }
  ctx.stroke();
}

function traza(ctx: CanvasRenderingContext2D, y: Float64Array, vDiv: number, pos: number, color: string) {
  const n = y.length;
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, Y0, GW, GH);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const cy = Y0 + GH / 2;
  for (let i = 0; i < n; i++) {
    const px = X0 + (i / (n - 1)) * GW;
    const py = cy - (y[i]! / vDiv + pos) * DIV;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function marcadorCero(ctx: CanvasRenderingContext2D, pos: number, color: string, etiqueta: string) {
  const y = Math.max(Y0 + 4, Math.min(Y0 + GH - 4, Y0 + GH / 2 - pos * DIV));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(X0 - 9, y - 5);
  ctx.lineTo(X0 - 2, y - 5);
  ctx.lineTo(X0 + 3, y);
  ctx.lineTo(X0 - 2, y + 5);
  ctx.lineTo(X0 - 9, y + 5);
  ctx.closePath();
  ctx.fill();
  texto(ctx, etiqueta, X0 - 6, y + 3, '#000', 7.5, 'center', true);
}

export function dibujar(ctx: CanvasRenderingContext2D, f: Fnirsi): Zona[] {
  const zonas: Zona[] = [];
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ANCHO, ALTO);
  if (!f.encendido) return zonas;
  if (f.modo === 'osc') dibujarOsc(ctx, f, zonas);
  else if (f.modo === 'dmm') dibujarDmm(ctx, f);
  else dibujarGen(ctx, f, zonas);
  if (f.menu === 'principal') {
    // The menu covers the screen: only its tiles can be touched.
    zonas.length = 0;
    dibujarPrincipal(ctx, f, zonas);
  }
  return zonas;
}

// ------------------------------------------------------------------ oscilloscope

function dibujarOsc(ctx: CanvasRenderingContext2D, f: Fnirsi, zonas: Zona[]) {
  const c = f.captura;
  const fft = f.mates === 'fft1' || f.mates === 'fft2';
  // Top bar.
  let x = 4;
  x += pastilla(ctx, f.xy ? 'X-Y' : fft ? 'FFT' : 'Y-T', x, 3, '#3d6b49') + 4;
  x += pastilla(ctx, `H=${si(f.sDiv, 's')}`, x, 3, '#1f3f2a', '#d8ffd8') + 4;
  const estado = f.esperando ? 'ESPERA' : f.run ? (c && !c.disparada && f.disparo.modo === 'auto' && !c.estatica ? 'AUTO' : 'RUN') : 'STOP';
  x += pastilla(ctx, estado, x, 3, estado === 'STOP' ? '#c0392b' : estado === 'ESPERA' ? '#c27c0e' : '#2a8f4a', '#fff', 46) + 4;
  const src = f.disparo.fuente === 0 ? COLOR.ch1 : COLOR.ch2;
  texto(ctx, `${f.disparo.subida ? '↑' : '↓'} ${si(f.disparo.nivel, 'V')}`, x + 2, 12, src, 9, 'left', true);
  if (f.mover) texto(ctx, 'MOVE', 250, 12, '#ffb84d', 8.5, 'left', true);
  // Battery.
  ctx.strokeStyle = '#cfcfcf';
  ctx.strokeRect(296, 4, 18, 9);
  ctx.fillStyle = '#7cf47c';
  ctx.fillRect(298, 6, 12, 5);
  ctx.fillRect(314, 6.5, 2, 4);

  rejilla(ctx);

  if (fft) dibujarFft(ctx, f, f.espectro());
  else if (f.xy) {
    const a = c?.y[0];
    const b = c?.y[1];
    if (a && b) {
      const c1 = f.canales[0]!;
      const c2 = f.canales[1]!;
      ctx.save();
      ctx.beginPath();
      ctx.rect(X0, Y0, GW, GH);
      ctx.clip();
      ctx.strokeStyle = COLOR.ch1;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < a.length; i++) {
        const px = X0 + GW / 2 + (a[i]! / c1.vDiv + c1.pos) * DIV;
        const py = Y0 + GH / 2 - (b[i]! / c2.vDiv + c2.pos) * DIV;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    } else texto(ctx, 'X-Y: active los dos canales', X0 + GW / 2, Y0 + GH / 2, '#aaa', 10, 'center');
  } else {
    for (let k = 1; k >= 0; k--) {
      const y = c?.y[k];
      const ch = f.canales[k]!;
      if (y && ch.on) traza(ctx, y, ch.vDiv, ch.pos, k === 0 ? COLOR.ch1 : COLOR.ch2);
    }
    if (f.mates === 'suma' || f.mates === 'resta' || f.mates === 'producto') {
      const m = f.trazaMates();
      const ch = f.canales[0]!;
      if (m) traza(ctx, m, f.mates === 'producto' ? ch.vDiv * ch.vDiv * 2 : ch.vDiv, 0, COLOR.mates);
    }
  }

  if (!fft && !f.xy) {
    for (let k = 1; k >= 0; k--) {
      const ch = f.canales[k]!;
      if (ch.on) marcadorCero(ctx, ch.pos, k === 0 ? COLOR.ch1 : COLOR.ch2, String(k + 1));
    }
    // Trigger level (right edge) and trigger instant (top).
    const fc = f.canales[f.disparo.fuente]!;
    const ty = Y0 + GH / 2 - (f.disparo.nivel / fc.vDiv + fc.pos) * DIV;
    if (ty > Y0 && ty < Y0 + GH) {
      ctx.fillStyle = src;
      ctx.beginPath();
      ctx.moveTo(X0 + GW + 8, ty - 5);
      ctx.lineTo(X0 + GW + 2, ty);
      ctx.lineTo(X0 + GW + 8, ty + 5);
      ctx.fill();
    }
    const tx = X0 + GW / 2 - (f.hpos / f.sDiv) * DIV;
    if (tx >= X0 && tx <= X0 + GW) {
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath();
      ctx.moveTo(tx - 4, Y0);
      ctx.lineTo(tx + 4, Y0);
      ctx.lineTo(tx, Y0 + 6);
      ctx.fill();
    }
  }

  // Cursors.
  const lc = f.lecturaCursores();
  if (lc && !f.xy) {
    ctx.strokeStyle = '#ff8a3d';
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const p of [f.cur.a, f.cur.b]) {
      if (f.cursores === 'tiempo' || fft) {
        const px = X0 + GW / 2 + p * DIV;
        ctx.moveTo(px, Y0);
        ctx.lineTo(px, Y0 + GH);
      } else {
        const py = Y0 + GH / 2 - p * DIV;
        ctx.moveTo(X0, py);
        ctx.lineTo(X0 + GW, py);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(X0 + 2, Y0 + 2, 104, 36);
    if (fft) {
      const e = f.espectro();
      const fa = cursorFrecuencia(f, f.cur.a);
      const fb = cursorFrecuencia(f, f.cur.b);
      texto(ctx, `A: ${si(fa, 'Hz')} ${nivelTexto(e, fa)}`, X0 + 5, Y0 + 12, '#ffb07a', 8.5);
      texto(ctx, `B: ${si(fb, 'Hz')} ${nivelTexto(e, fb)}`, X0 + 5, Y0 + 23, '#ffb07a', 8.5);
      texto(ctx, `ΔF: ${si(fb - fa, 'Hz')}`, X0 + 5, Y0 + 34, '#ffb07a', 8.5);
    } else if (f.cursores === 'tiempo') {
      texto(ctx, `Δt: ${si(lc.delta, 's')}`, X0 + 5, Y0 + 12, '#ffb07a', 8.5);
      texto(ctx, `1/Δt: ${si(lc.inversa, 'Hz')}`, X0 + 5, Y0 + 23, '#ffb07a', 8.5);
      texto(ctx, `A ${si(lc.a, 's')}  B ${si(lc.b, 's')}`, X0 + 5, Y0 + 34, '#ffb07a', 8);
    } else {
      texto(ctx, `ΔV: ${si(lc.delta, 'V')}`, X0 + 5, Y0 + 12, '#ffb07a', 8.5);
      texto(ctx, `A: ${si(lc.a, 'V')}`, X0 + 5, Y0 + 23, '#ffb07a', 8.5);
      texto(ctx, `B: ${si(lc.b, 'V')}`, X0 + 5, Y0 + 34, '#ffb07a', 8.5);
    }
  }

  // Automatic measurements (PRM).
  if (f.prm && !fft) {
    const filas: { k: number; m: ReturnType<Fnirsi['medidas']> }[] = [];
    for (let k = 0; k < 2; k++) if (f.canales[k]!.on && c?.y[k]) filas.push({ k, m: f.medidas(k) });
    if (filas.length) {
      const h = filas.length * 22 + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(X0 + 1, Y0 + GH - h - 1, GW - 2, h);
      filas.forEach(({ k, m }, i) => {
        if (!m) return;
        const col = k === 0 ? COLOR.ch1 : COLOR.ch2;
        const y = Y0 + GH - h + 11 + i * 22;
        texto(ctx, `Frec:${si(m.f, 'Hz', 4)}`, X0 + 5, y, col, 8.5);
        texto(ctx, `Vpp:${si(m.vpp, 'V')}`, X0 + 85, y, col, 8.5);
        texto(ctx, `Vef:${si(m.vrms, 'V')}`, X0 + 155, y, col, 8.5);
        texto(ctx, `Vmed:${si(m.vmedia, 'V')}`, X0 + 225, y, col, 8.5);
        texto(ctx, `Per:${si(m.periodo, 's', 4)}`, X0 + 5, y + 10, col, 8.5);
        texto(ctx, `Ciclo:${m.ciclo === null ? '----' : aEspanol(m.ciclo.toFixed(1)) + '%'}`, X0 + 85, y + 10, col, 8.5);
        texto(ctx, `Vmáx:${si(m.vmax, 'V')}`, X0 + 155, y + 10, col, 8.5);
        texto(ctx, `Vmín:${si(m.vmin, 'V')}`, X0 + 225, y + 10, col, 8.5);
      });
    }
  }

  // Bottom bar.
  const info = (k: number) => {
    const ch = f.canales[k]!;
    return ch.on ? `${si(ch.vDiv, 'V')} ${ch.menuX10 ? 'X10' : 'X1'} ${ch.ac ? 'AC' : 'DC'}${ch.invertir ? ' INV' : ''}` : 'OFF';
  };
  texto(ctx, info(0), 4, 233, COLOR.ch1, 9, 'left', true);
  texto(ctx, `T ${{ auto: 'Auto', normal: 'Normal', single: 'Single' }[f.disparo.modo]} ${f.disparo.subida ? '↑' : '↓'} CH${f.disparo.fuente + 1}`, 160, 233, '#e8e8e8', 9, 'center', true);
  texto(ctx, info(1), 316, 233, COLOR.ch2, 9, 'right', true);
  if (f.mover) texto(ctx, `▲▼ mueve CH${f.activo + 1}`, 160, 224, '#ffb84d', 8, 'center');
  else texto(ctx, `CH${f.activo + 1} activo`, f.activo === 0 ? 4 : 316, 224, f.activo === 0 ? COLOR.ch1 : COLOR.ch2, 7.5, f.activo === 0 ? 'left' : 'right');

  if (!c && f.run && f.disparo.modo !== 'auto') texto(ctx, 'Esperando el disparo…', X0 + GW / 2, Y0 + 40, '#ffb84d', 10, 'center', true);

  if (f.menu && f.menu !== 'principal') dibujarMenu(ctx, f, zonas);
}

export function cursorFrecuencia(f: Fnirsi, div: number): number {
  const fs = f.captura ? 1 / f.captura.dt : 0;
  return ((div + DIV_H / 2) / DIV_H) * (fs / 2);
}

function nivelTexto(e: Espectro | null, fr: number): string {
  if (!e) return '';
  const k = Math.round(fr / (e.f[1]! - e.f[0]!));
  const v = e.db[Math.max(0, Math.min(e.db.length - 1, k))];
  return v === undefined ? '' : `${aEspanol(v.toFixed(1))} dBV`;
}

/** Spectrum: 10 dB/div, top of the screen at +10 dBV; 0 … fs/2 across the 12 divisions. */
function dibujarFft(ctx: CanvasRenderingContext2D, f: Fnirsi, e: Espectro | null) {
  if (!e) {
    texto(ctx, 'FFT: conecte y active el canal', X0 + GW / 2, Y0 + GH / 2, '#aaa', 10, 'center');
    return;
  }
  const n = e.f.length;
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, Y0, GW, GH);
  ctx.clip();
  ctx.strokeStyle = COLOR.fft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const px = X0 + (k / n) * GW;
    const py = Y0 + ((10 - e.db[k]!) / 10) * DIV;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
  const span = e.f[n - 1]! + (e.f[1]! - e.f[0]!);
  texto(ctx, `${si(span / DIV_H, 'Hz')}/div  10 dB/div  ref +10 dBV  Δf ${si(e.df, 'Hz')}`, X0 + 4, Y0 + GH - 4, COLOR.fft, 8);
  void f;
}

function dibujarMenu(ctx: CanvasRenderingContext2D, f: Fnirsi, zonas: Zona[]) {
  const items = f.itemsMenu();
  const titulo = f.menu === 'ch1' ? 'CH1' : f.menu === 'ch2' ? 'CH2' : f.menu === 'disparo' ? 'Disparo' : 'Funciones';
  const w = 118;
  const x = ANCHO - w - 4;
  const h = 18 + items.length * 26;
  ctx.fillStyle = 'rgba(20,28,24,0.94)';
  ctx.strokeStyle = COLOR.menu;
  ctx.beginPath();
  ctx.roundRect(x, Y0 + 2, w, h, 4);
  ctx.fill();
  ctx.stroke();
  texto(ctx, titulo, x + 6, Y0 + 14, '#9fe8b0', 9, 'left', true);
  items.forEach((it, i) => {
    const y = Y0 + 18 + i * 26;
    const sel = i === f.item;
    ctx.fillStyle = sel ? COLOR.menu : 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + 3, y, w - 6, 24);
    texto(ctx, it.nombre, x + 7, y + 9.5, sel ? '#fff' : '#bcd', 8);
    let valor = it.valor;
    if (it.nombre === 'Nivel') valor = si(f.disparo.nivel, 'V');
    texto(ctx, `◄ ${valor} ►`, x + w - 7, y + 20, '#fff', 9, 'right', true);
    zonas.push({ x: x + 3, y, w: w - 6, h: 24, accion: `item:${i}` });
  });
}

function dibujarPrincipal(ctx: CanvasRenderingContext2D, f: Fnirsi, zonas: Zona[]) {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, ANCHO, ALTO);
  texto(ctx, 'MENU', ANCHO / 2, 30, '#fff', 12, 'center', true);
  const op = ['Osciloscopio', 'Multímetro', 'Generador'];
  op.forEach((t, i) => {
    const x = 16 + i * 100;
    const y = 60;
    ctx.fillStyle = i === f.item ? COLOR.menu : '#1e2622';
    ctx.strokeStyle = '#4a7a5a';
    ctx.beginPath();
    ctx.roundRect(x, y, 88, 110, 8);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (i === 0) {
      for (let k = 0; k <= 40; k++) {
        const px = x + 14 + k * 1.5;
        const py = y + 45 - 18 * Math.sin((k / 40) * 2 * Math.PI * 1.5);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    } else if (i === 1) {
      ctx.rect(x + 22, y + 22, 44, 46);
      ctx.moveTo(x + 30, y + 34);
      ctx.lineTo(x + 58, y + 34);
    } else {
      ctx.moveTo(x + 14, y + 60);
      for (let k = 0; k < 3; k++) {
        ctx.lineTo(x + 14 + k * 20, y + 30);
        ctx.lineTo(x + 24 + k * 20, y + 30);
        ctx.lineTo(x + 24 + k * 20, y + 60);
        ctx.lineTo(x + 34 + k * 20, y + 60);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    texto(ctx, t, x + 44, y + 96, '#fff', 10, 'center', true);
    zonas.push({ x, y, w: 88, h: 110, accion: `modo:${['osc', 'dmm', 'gen'][i]}` });
  });
  texto(ctx, 'SELECT o toque para elegir · MENU para volver', ANCHO / 2, 200, '#aaa', 9, 'center');
}

// ------------------------------------------------------------------ multimeter

function dibujarDmm(ctx: CanvasRenderingContext2D, f: Fnirsi) {
  pastilla(ctx, 'Multímetro', 4, 3, '#3d6b49');
  texto(ctx, f.textoDmm || FN_DMM_LISTA[f.fnDmm]!.nombre, 160, 40, '#9fe8b0', 13, 'center', true);
  const l = f.lecturaDmm;
  const t = l ? l.texto.replace('.', ',') : '-----';
  texto(ctx, t, 160, 122, '#ffffff', 52, 'center', true);
  texto(ctx, l?.unidad ?? '', 160, 152, '#ffffff', 18, 'center', true);
  if (l && l.incertidumbre !== null) texto(ctx, `± ${si(l.incertidumbre, '').replace(/[a-zµ]?$/, '')} ${l.unidad.replace(/^[kMmµn]/, '')}`, 160, 172, '#888', 9, 'center');
  const borne = f.borne === 'V' ? 'VΩ' : f.borne === 'mA' ? 'mA' : '10A';
  texto(ctx, `Punta roja: ${borne}   ·   ▲▼ función   ·   19 999 cuentas`, 160, 200, '#aaa', 9, 'center');
  if (!f.fusibleMA && f.borne === 'mA') texto(ctx, 'Fusible mA fundido', 160, 216, '#ff6b6b', 10, 'center', true);
}

// ------------------------------------------------------------------ generator

function dibujarGen(ctx: CanvasRenderingContext2D, f: Fnirsi, zonas: Zona[]) {
  pastilla(ctx, 'Generador DDS', 4, 3, '#3d6b49');
  const d = f.dds;
  pastilla(ctx, d.salida ? 'SALIDA ON' : 'SALIDA OFF', 250, 3, d.salida ? '#2a8f4a' : '#7a2a2a', '#fff', 66);
  // Preview of the waveform (two periods).
  const x0 = 14;
  const y0 = 26;
  const w = 292;
  const h = 70;
  ctx.strokeStyle = '#333';
  ctx.strokeRect(x0, y0, w, h);
  ctx.strokeStyle = COLOR.ch1;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) {
    const fr = ((i / 300) * 2) % 1;
    const v = muestraForma(d.forma, fr, d.ciclo / 100, d.simetria / 100);
    const px = x0 + (i / 300) * w;
    const py = y0 + h - 6 - v * (h - 12);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  const items = f.itemsGen();
  items.forEach((it, i) => {
    const y = 104 + i * 22;
    const sel = i === f.itemGen;
    ctx.fillStyle = sel ? COLOR.menu : 'rgba(255,255,255,0.05)';
    ctx.fillRect(14, y, 292, 20);
    texto(ctx, it.nombre, 22, y + 14, sel ? '#fff' : '#bcd', 10);
    let v = it.valor;
    if (it.nombre === 'Frecuencia') v = si(d.frecuencia, 'Hz', 5);
    if (it.nombre === 'Amplitud') v = `${aEspanol(d.amplitud.toFixed(2))} V (0 … ${aEspanol(d.amplitud.toFixed(2))} V)`;
    texto(ctx, `◄ ${v} ►`, 298, y + 14, '#fff', 10, 'right', true);
    zonas.push({ x: 14, y, w: 292, h: 20, accion: `gen:${i}` });
  });
  void FORMAS;
}

/** One period of each DDS waveform, 0 … 1 (for the preview). */
export function muestraForma(forma: string, x: number, ciclo: number, sim: number): number {
  switch (forma) {
    case 'seno':
      return 0.5 - 0.5 * Math.cos(2 * Math.PI * x);
    case 'cuadrada':
    case 'pulso':
      return x < ciclo ? 1 : 0;
    case 'sierra':
      return x < sim ? x / Math.max(sim, 1e-6) : (1 - x) / Math.max(1 - sim, 1e-6);
    case 'media-onda':
      return Math.max(0, Math.sin(2 * Math.PI * x));
    case 'onda-completa':
      return Math.abs(Math.sin(Math.PI * x));
    case 'escalon-subida':
      return Math.floor(5 * x) / 4;
    case 'escalon-bajada':
      return 1 - Math.floor(5 * x) / 4;
    case 'exp-subida':
      return (1 - Math.exp(-5 * x)) / (1 - Math.exp(-5));
    case 'exp-bajada':
      return (Math.exp(-5 * x) - Math.exp(-5)) / (1 - Math.exp(-5));
    case 'multitono':
      return 0.5 * (1 + (Math.sin(2 * Math.PI * x) + Math.sin(4 * Math.PI * x) + Math.sin(6 * Math.PI * x)) / 2.6);
    case 'sinc': {
      const u = 16 * Math.PI * (x - 0.5) + 1e-9;
      return (Math.sin(u) / u + 0.2172) / 1.2172;
    }
    case 'lorentz': {
      const u = 20 * (x - 0.5);
      return 1 / (1 + u * u);
    }
  }
  return 0;
}

export function nombreMates(id: string): string {
  return MATES.find((m) => m.id === id)?.nombre ?? id;
}
