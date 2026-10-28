// Drawing of the breadboard and its parts as SVG markup (world units: one pitch = 1, y down), seen from
// above: the board with its holes, rails and channel; resistors with their colour bands, diodes with the
// cathode band, LEDs (long anode leg, flat side on the cathode, glowing when lit), ceramic, film and
// electrolytic capacitors (the − stripe), TO-92/TO-220/TO-126 transistors with their marking, DIP ICs with
// the notch and pin-1 dot, trimmers, slide switches, bridges, modules, jumper wires and the bench
// equipment. Plain TypeScript (strings), so the page, the tests and future thumbnails share it; the
// board stays light in every theme (it is a physical object, like the book's figure plates).

import { leerValor } from '../editor/valores.ts';
import { formatoCorto } from '../grafica/formato.ts';
import { textoValor } from '../editor/catalogo.ts';
import { bandas, colorLed, COLOR_CODIGO, ORO } from './colores.ts';
import { cajaExterno, cuerpoDe, direccion, encapsuladoDe, medidasDos, normal, diametroElectrolitico } from './encapsulados.ts';
import { ALTO_PLACA, columnasRiel, FILAS_ABAJO, FILAS_ARRIBA, FILAS_RIEL, LETRAS, type ConfigPlaca, type Pt } from './placa.ts';
import type { CableProto, DocumentoProtoboard, Pieza } from './tipos.ts';

const f = (v: number) => (Math.round(v * 1000) / 1000).toString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ang = (u: Pt) => (Math.atan2(u[1], u[0]) * 180) / Math.PI;
/** Extra turn for a text inside a body turned by ang(u), so it never reads upside down. */
const derecho = (u: Pt) => {
  const a = ang(u);
  return a > 90 || a <= -90 ? 180 : 0;
};

/** Gradients and filters shared by every part (one <defs> per SVG). */
export function defsProtoboard(): string {
  return `<defs>
<linearGradient id="pb-brillo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
<radialGradient id="pb-cupula" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>
<linearGradient id="pb-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e6ea"/><stop offset="1" stop-color="#9da3aa"/></linearGradient>
</defs>`;
}

// ------------------------------------------------------------------ board

/** The boards: body, rails with their lines, channel, holes and the row/column labels. */
export function svgPlacas(cfg: ConfigPlaca): string {
  const N = cfg.columnas;
  const partes: string[] = [];
  const rielX = columnasRiel(N);
  for (let p = 0; p < cfg.placas; p++) {
    const oy = p * ALTO_PLACA;
    const x0 = -0.9;
    const x1 = N + 1.9;
    partes.push(`<rect x="${f(x0 + 0.08)}" y="${f(oy - 1.0)}" width="${f(x1 - x0)}" height="19.3" rx=".6" fill="#000" opacity=".16"/>`);
    partes.push(`<rect x="${f(x0)}" y="${f(oy - 1.1)}" width="${f(x1 - x0)}" height="19.2" rx=".6" fill="#f4f2ec" stroke="#d6d1c3" stroke-width=".06"/>`);
    // rails area slightly separated, as on a real board (two snap-off strips)
    partes.push(`<rect x="${f(x0 + 0.15)}" y="${f(oy + 1.75)}" width="${f(x1 - x0 - 0.3)}" height=".07" fill="#d8d3c5"/>`);
    partes.push(`<rect x="${f(x0 + 0.15)}" y="${f(oy + 15.18)}" width="${f(x1 - x0 - 0.3)}" height=".07" fill="#d8d3c5"/>`);
    // centre channel
    partes.push(`<rect x="${f(x0 + 0.15)}" y="${f(oy + 8.05)}" width="${f(x1 - x0 - 0.3)}" height=".9" rx=".25" fill="#e4e0d4"/>`);
    partes.push(`<rect x="${f(x0 + 0.15)}" y="${f(oy + 8.05)}" width="${f(x1 - x0 - 0.3)}" height=".22" fill="#cfc9b9" opacity=".7"/>`);
    // rail lines: red outside, blue inside
    const linea = (y: number, c: string) => `<rect x="${f(rielX[0]! - 0.6)}" y="${f(y)}" width="${f(rielX[rielX.length - 1]! - rielX[0]! + 1.2)}" height=".09" fill="${c}"/>`;
    partes.push(linea(oy - 0.62, '#d23a2c'), linea(oy + 1.52, '#2d5bc4'), linea(oy + 15.4, '#2d5bc4'), linea(oy + 17.52, '#d23a2c'));
    const signo = (x: number, y: number, s: string, c: string) => `<text x="${f(x)}" y="${f(y)}" font-size=".72" font-weight="700" fill="${c}" text-anchor="middle" dominant-baseline="central">${s}</text>`;
    partes.push(signo(rielX[0]! - 1.25, oy, '+', '#d23a2c'), signo(rielX[0]! - 1.25, oy + 1, '−', '#2d5bc4'), signo(rielX[0]! - 1.25, oy + 16, '−', '#2d5bc4'), signo(rielX[0]! - 1.25, oy + 17, '+', '#d23a2c'));
    partes.push(signo(rielX[rielX.length - 1]! + 1.25, oy, '+', '#d23a2c'), signo(rielX[rielX.length - 1]! + 1.25, oy + 1, '−', '#2d5bc4'), signo(rielX[rielX.length - 1]! + 1.25, oy + 16, '−', '#2d5bc4'), signo(rielX[rielX.length - 1]! + 1.25, oy + 17, '+', '#d23a2c'));
    // holes: one path
    let d = '';
    const hueco = (x: number, y: number) => {
      d += `M${f(x - 0.2)} ${f(y - 0.2)}h.4v.4h-.4z`;
    };
    for (const x of rielX) for (const r of FILAS_RIEL) hueco(x, oy + r);
    for (let x = 1; x <= N; x++) for (const r of [...FILAS_ARRIBA, ...FILAS_ABAJO]) hueco(x, oy + r);
    partes.push(`<path d="${d}" fill="#45443f"/>`);
    // labels
    const t: string[] = [];
    for (let i = 0; i < 10; i++) {
      const y = oy + (i < 5 ? 3 + i : 5 + i);
      t.push(`<text x="0" y="${f(y)}">${LETRAS[i]}</text><text x="${N + 1}" y="${f(y)}">${LETRAS[i]}</text>`);
    }
    for (let x = 1; x <= N; x++) if (x === 1 || x % 5 === 0) t.push(`<text x="${x}" y="${f(oy + 2.25)}">${x}</text><text x="${x}" y="${f(oy + 15.0)}">${x}</text>`);
    partes.push(`<g font-size=".5" fill="#8b8676" text-anchor="middle" dominant-baseline="central" font-family="Source Sans 3, sans-serif">${t.join('')}</g>`);
    if (cfg.placas > 1) partes.push(`<text x="${f(x1 - 0.3)}" y="${f(oy - 0.45)}" font-size=".55" fill="#8b8676" text-anchor="end" font-family="Source Sans 3, sans-serif">placa ${p + 1}</text>`);
  }
  return partes.join('');
}

// ------------------------------------------------------------------ parts

function pata(a: Pt, b: Pt, ancho = 0.11): string {
  return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#a7adb4" stroke-width="${ancho}" stroke-linecap="round"/><circle cx="${f(a[0])}" cy="${f(a[1])}" r=".1" fill="#6b7076"/>`;
}

/** Point at distance t along u from c. */
const en = (c: Pt, u: Pt, t: number, nn: Pt = [0, 0], s = 0): Pt => [c[0] + u[0] * t + nn[0] * s, c[1] + u[1] * t + nn[1] * s];

function valor(p: Pieza, campo = 'valor', unidad = ''): number | null {
  const l = leerValor(p.comp.campos[campo] ?? '', unidad);
  return l.ok && l.v != null ? l.v : null;
}

/** Ceramic capacitor code in pF («104»). */
export function codigoCeramico(c: number): string {
  const pf = c * 1e12;
  if (pf < 100) return formatoCorto(pf, '').replace(/\s/g, '');
  const e = Math.floor(Math.log10(pf)) - 1;
  return `${Math.round(pf / 10 ** e)}${e}`;
}

function cuerpoAxial(p: Pieza, color: string, ancho: number, largo: number, extra: string): string {
  const [a, b] = [p.pos[0]!, p.pos[1]!];
  const u = direccion(p);
  const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const e0 = en(c, u, -largo / 2 + 0.05);
  const e1 = en(c, u, largo / 2 - 0.05);
  const hw = ancho / 2;
  return (
    pata(a, e0) +
    pata(b, e1) +
    `<g transform="translate(${f(c[0])} ${f(c[1])}) rotate(${f(ang(u))})">` +
    `<rect x="${f(-largo / 2)}" y="${f(-hw)}" width="${f(largo)}" height="${f(ancho)}" rx="${f(hw * 0.95)}" fill="${color}"/>` +
    extra +
    `<rect x="${f(-largo / 2)}" y="${f(-hw)}" width="${f(largo)}" height="${f(ancho)}" rx="${f(hw * 0.95)}" fill="url(#pb-brillo)"/>` +
    `</g>`
  );
}

/** A two-leg part standing up (span too short to lie flat): the body above its first leg. */
function dePie(p: Pieza, color: string, bandasHtml = ''): string {
  const [a, b] = [p.pos[0]!, p.pos[1]!];
  return (
    `<path d="M${f(a[0])} ${f(a[1])}Q${f(a[0] + 0.1)} ${f(a[1] - 0.9)} ${f((a[0] + b[0]) / 2)} ${f(Math.min(a[1], b[1]) - 0.7)}T${f(b[0])} ${f(b[1])}" fill="none" stroke="#a7adb4" stroke-width=".11"/>` +
    `<circle cx="${f(b[0])}" cy="${f(b[1])}" r=".1" fill="#6b7076"/>` +
    `<circle cx="${f(a[0])}" cy="${f(a[1])}" r=".5" fill="${color}"/>${bandasHtml}<circle cx="${f(a[0])}" cy="${f(a[1])}" r=".5" fill="url(#pb-cupula)"/>`
  );
}

function resistencia(p: Pieza): string {
  const v = valor(p, 'valor', 'Ω');
  const b = v != null ? bandas(v) : null;
  const m = medidasDos(p);
  const cuerpo = b?.precision ? '#86b6df' : '#d9c39a';
  if (m.pie) {
    const a = p.pos[0]!;
    const anillos = (b?.colores ?? []).slice(0, 3).map((c, i) => `<circle cx="${f(a[0])}" cy="${f(a[1])}" r="${f(0.42 - i * 0.12)}" fill="none" stroke="${c}" stroke-width=".07"/>`).join('');
    return dePie(p, cuerpo, anillos);
  }
  let extra = '';
  if (b) {
    const n = b.colores.length;
    const xs = n === 4 ? [-0.78, -0.5, -0.22, 0.72] : [-0.82, -0.58, -0.34, -0.1, 0.74];
    b.colores.forEach((c, i) => {
      extra += `<rect x="${f(xs[i]! - 0.085)}" y="${f(-m.ancho / 2)}" width=".17" height="${f(m.ancho)}" fill="${c}"/>`;
    });
  } else if (p.comp.tipo === 'GEN') extra = `<text x="0" y=".05" font-size=".42" text-anchor="middle" dominant-baseline="central" fill="#333">${esc((p.comp.campos['resto'] ?? '').slice(0, 8))}</text>`;
  return cuerpoAxial(p, cuerpo, m.ancho, m.largo, extra);
}

function bobina(p: Pieza): string {
  const m = medidasDos(p);
  if (m.pie) return dePie(p, '#3f7a4c');
  const v = valor(p, 'valor', 'H');
  const b = v != null ? bandas(v * 1e6) : null;
  let extra = '';
  if (b) {
    const xs = [-0.7, -0.42, -0.14, 0.7];
    b.colores.slice(0, 3).concat([ORO]).forEach((c, i) => (extra += `<rect x="${f(xs[i]! - 0.085)}" y="${f(-m.ancho / 2)}" width=".17" height="${f(m.ancho)}" fill="${c}"/>`));
  }
  return cuerpoAxial(p, '#3f7a4c', m.ancho, m.largo, extra);
}

function diodo(p: Pieza): string {
  const m = medidasDos(p);
  const modelo = (p.comp.campos['modelo'] ?? p.comp.campos['resto'] ?? '').toLowerCase();
  const negro = /400\d|1n54|sch|dsch|1n58|uf|by|ds/.test(modelo) || p.comp.tipo === 'DS';
  const zener = p.enc === 'zener';
  const color = negro ? '#2b2b2d' : zener ? '#d9a14e' : '#e6a25a';
  const franja = negro ? '#c6c9cd' : '#1d1d1d';
  if (m.pie) return dePie(p, color);
  const extra =
    (!negro ? `<rect x="${f(-m.largo / 2 + 0.25)}" y="${f(-m.ancho / 2 + 0.17)}" width="${f(m.largo - 0.7)}" height="${f(m.ancho - 0.34)}" rx=".1" fill="#7a4518" opacity=".55"/>` : '') +
    `<rect x="${f(m.largo / 2 - 0.42)}" y="${f(-m.ancho / 2)}" width=".2" height="${f(m.ancho)}" fill="${franja}"/>`;
  return cuerpoAxial(p, color, m.ancho, m.largo, extra);
}

function led(p: Pieza, encendido: number): string {
  const [a, k] = [p.pos[0]!, p.pos[1]!];
  const u = direccion(p);
  const nn = normal(u);
  const c: Pt = [(a[0] + k[0]) / 2, (a[1] + k[1]) / 2];
  const col = colorLed(p.comp.campos['modelo'] ?? '');
  // The anode leg is the long one: drawn with a bend.
  const codo = en(a, u, 0.2, nn, 0.32);
  const legs =
    `<path d="M${f(a[0])} ${f(a[1])}L${f(codo[0])} ${f(codo[1])}L${f(c[0] + nn[0] * 0.12 - u[0] * 0.2)} ${f(c[1] + nn[1] * 0.12 - u[1] * 0.2)}" fill="none" stroke="#a7adb4" stroke-width=".11" stroke-linejoin="round"/><circle cx="${f(a[0])}" cy="${f(a[1])}" r=".1" fill="#6b7076"/>` +
    pata(k, en(c, u, 0.2));
  // Dome with the flange cut flat on the cathode side.
  const r = 0.74;
  const plano = 0.6;
  const p1 = en(c, u, plano, nn, Math.sqrt(r * r - plano * plano));
  const p2 = en(c, u, plano, nn, -Math.sqrt(r * r - plano * plano));
  const brida = `<path d="M${f(p1[0])} ${f(p1[1])}A${r} ${r} 0 1 0 ${f(p2[0])} ${f(p2[1])}Z" fill="${col.cuerpo}" opacity=".9" stroke="#000" stroke-opacity=".25" stroke-width=".05"/>`;
  // Glow: concentric discs of the LED's colour (a gradient in <defs> cannot take each LED's colour).
  let luz = '';
  if (encendido > 0) {
    const R = 1.1 + 1.5 * encendido;
    for (let k = 5; k >= 1; k--) luz += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f((R * k) / 5)}" fill="${col.luz}" opacity="${f(0.1 + 0.08 * encendido)}"/>`;
    luz = `<g class="pb-luz">${luz}<circle cx="${f(c[0])}" cy="${f(c[1])}" r=".35" fill="#fff" opacity="${f(0.5 + 0.4 * encendido)}"/></g>`;
  }
  return (
    legs +
    brida +
    `<circle cx="${f(c[0])}" cy="${f(c[1])}" r=".62" fill="${encendido > 0 ? col.luz : col.cuerpo}" opacity="${encendido > 0 ? 1 : 0.85}"/>` +
    `<circle cx="${f(c[0])}" cy="${f(c[1])}" r=".62" fill="url(#pb-cupula)"/>` +
    `<path d="M${f(en(c, u, -0.22, nn, 0.16)[0])} ${f(en(c, u, -0.22, nn, 0.16)[1])}L${f(en(c, u, 0.16, nn, 0.06)[0])} ${f(en(c, u, 0.16, nn, 0.06)[1])}" stroke="#000" stroke-opacity=".25" stroke-width=".09"/>` +
    luz
  );
}

function ceramico(p: Pieza): string {
  const m = medidasDos(p);
  const v = valor(p, 'valor', 'F');
  const txt = v != null ? codigoCeramico(v) : '';
  const [a, b] = [p.pos[0]!, p.pos[1]!];
  const u = direccion(p);
  const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return (
    pata(a, en(c, u, -0.3)) +
    pata(b, en(c, u, 0.3)) +
    `<g transform="translate(${f(c[0])} ${f(c[1])}) rotate(${f(ang(u))})"><ellipse rx="${f(m.largo / 2)}" ry="${f(m.ancho / 2)}" fill="#d48a33"/><ellipse rx="${f(m.largo / 2)}" ry="${f(m.ancho / 2)}" fill="url(#pb-brillo)"/>` +
    `<text x="0" y=".02" font-size=".46" font-weight="600" fill="#4a2a08" text-anchor="middle" dominant-baseline="central" transform="rotate(${derecho(u)})">${esc(txt)}</text></g>`
  );
}

function film(p: Pieza): string {
  const m = medidasDos(p);
  const v = valor(p, 'valor', 'F');
  const txt = v != null ? (v >= 1e-6 ? formatoCorto(v, '').replace(/\s/g, '') + 'µ' : 'µ' + String(Math.round(v * 1e8)).padStart(2, '0').replace(/0$/, '')) : '';
  const [a, b] = [p.pos[0]!, p.pos[1]!];
  const u = direccion(p);
  const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return (
    pata(a, en(c, u, -0.3)) +
    pata(b, en(c, u, 0.3)) +
    `<g transform="translate(${f(c[0])} ${f(c[1])}) rotate(${f(ang(u))})"><rect x="${f(-m.largo / 2)}" y="${f(-m.ancho / 2)}" width="${f(m.largo)}" height="${f(m.ancho)}" rx=".18" fill="#b8312f"/><rect x="${f(-m.largo / 2)}" y="${f(-m.ancho / 2)}" width="${f(m.largo)}" height="${f(m.ancho)}" rx=".18" fill="url(#pb-brillo)"/>` +
    `<text x="0" y=".03" font-size=".5" font-weight="600" fill="#fde9e4" text-anchor="middle" dominant-baseline="central" transform="rotate(${derecho(u)})">${esc(txt)}</text></g>`
  );
}

function electrolitico(p: Pieza): string {
  const [a, b] = [p.pos[0]!, p.pos[1]!];
  const polo = p.polo ?? 0;
  const mas = polo === 0 ? a : b;
  const menos = polo === 0 ? b : a;
  const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const v = valor(p, 'valor', 'F') ?? 1e-6;
  const r = diametroElectrolitico(v) / 2;
  // − stripe: a sector towards the − leg.
  const um: Pt = [menos[0] - c[0], menos[1] - c[1]];
  const L = Math.hypot(um[0], um[1]) || 1;
  const d: Pt = [um[0] / L, um[1] / L];
  const th = Math.atan2(d[1], d[0]);
  const s0: Pt = [c[0] + r * Math.cos(th - 0.55), c[1] + r * Math.sin(th - 0.55)];
  const s1: Pt = [c[0] + r * Math.cos(th + 0.55), c[1] + r * Math.sin(th + 0.55)];
  const i0: Pt = [c[0] + r * 0.62 * Math.cos(th + 0.55), c[1] + r * 0.62 * Math.sin(th + 0.55)];
  const i1: Pt = [c[0] + r * 0.62 * Math.cos(th - 0.55), c[1] + r * 0.62 * Math.sin(th - 0.55)];
  const franja = `<path d="M${f(s0[0])} ${f(s0[1])}A${f(r)} ${f(r)} 0 0 1 ${f(s1[0])} ${f(s1[1])}L${f(i0[0])} ${f(i0[1])}A${f(r * 0.62)} ${f(r * 0.62)} 0 0 0 ${f(i1[0])} ${f(i1[1])}Z" fill="#c9ced6"/>`;
  const menosTxt = `<text x="${f(c[0] + d[0] * r * 0.8)}" y="${f(c[1] + d[1] * r * 0.8)}" font-size="${f(Math.max(0.42, r * 0.36))}" font-weight="700" fill="#24324a" text-anchor="middle" dominant-baseline="central">−</text>`;
  const k = r * 0.42;
  const cruz = `<path d="M${f(c[0] - k)} ${f(c[1])}h${f(2 * k)}M${f(c[0])} ${f(c[1] - k)}v${f(2 * k)}" stroke="#7e8aa0" stroke-width=".07"/>`;
  const txt = formatoCorto(v, '').replace(/\s/g, '') + 'µ';
  return (
    pata(mas, mas) +
    pata(menos, menos) +
    `<circle cx="${f(c[0] + 0.07)}" cy="${f(c[1] + 0.09)}" r="${f(r)}" fill="#000" opacity=".2"/>` +
    `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="#22324e"/>` +
    franja +
    menosTxt +
    `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r * 0.6)}" fill="#a9b1bd"/>` +
    cruz +
    `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="url(#pb-cupula)"/>` +
    (r >= 1.2 ? `<text x="${f(c[0] - d[0] * r * 0.78)}" y="${f(c[1] - d[1] * r * 0.78)}" font-size=".38" fill="#e9eef8" text-anchor="middle" dominant-baseline="central">${esc(txt.replace('µµ', 'µ'))}</text>` : '')
  );
}

function enFila(p: Pieza): { u: Pt; nn: Pt; mid: Pt } {
  const u = direccion(p);
  const nn = normal(u);
  const a = p.pos[0]!;
  const b = p.pos[p.pos.length - 1]!;
  return { u, nn, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
}

function marcaTexto(c: Pt, u: Pt, s: string, tam: number, color: string, maxLargo?: number): string {
  let a = ang(u);
  if (a > 90 || a <= -90) a += 180;
  const t = maxLargo ? s.slice(0, Math.max(1, Math.floor(maxLargo / (tam * 0.55)))) : s;
  return `<text x="${f(c[0])}" y="${f(c[1])}" font-size="${f(tam)}" font-weight="600" fill="${color}" text-anchor="middle" dominant-baseline="central" transform="rotate(${f(a)} ${f(c[0])} ${f(c[1])})" font-family="Source Sans 3, sans-serif">${esc(t)}</text>`;
}

function to92(p: Pieza): string {
  const { u, nn, mid } = enFila(p);
  const b = cuerpoDe(p)!;
  // D shape: flat face on the −n side, round back on the +n side.
  const plano = en(b.c, nn, 0, nn, -b.hw);
  const iz = en(plano, u, -b.hl);
  const de = en(plano, u, b.hl);
  const patas = p.pos.map((q) => pata(q, en(q, nn, 0, nn, 0.2))).join('');
  const dS = `M${f(iz[0])} ${f(iz[1])}L${f(de[0])} ${f(de[1])}A${f(b.hl)} ${f(b.hw * 2)} 0 0 ${u[0] * nn[1] - u[1] * nn[0] > 0 ? 1 : 0} ${f(iz[0])} ${f(iz[1])}Z`;
  void mid;
  return (
    patas +
    `<path d="${dS}" fill="#232323"/>` +
    `<path d="${dS}" fill="url(#pb-cupula)" opacity=".7"/>` +
    marcaTexto(en(plano, nn, 0, nn, 0.42), u, p.comp.tipo === 'GEN' ? encapsuladoDe(p.comp).marca : encapsuladoDe(p.comp).marca, 0.36, '#cfcfcf', 1.9)
  );
}

function to220(p: Pieza, chico = false): string {
  const { u, nn } = enFila(p);
  const b = cuerpoDe(p)!;
  const patas = p.pos.map((q) => pata(q, en(q, nn, 0, nn, 0.3), 0.16)).join('');
  const caja = (c: Pt, hl: number, hw: number, color: string, rx = 0.1) =>
    `<rect x="${f(-hl)}" y="${f(-hw)}" width="${f(2 * hl)}" height="${f(2 * hw)}" rx="${rx}" fill="${color}" transform="translate(${f(c[0])} ${f(c[1])}) rotate(${f(ang(u))})"/>`;
  const fondo = en(b.c, nn, 0, nn, chico ? 0.35 : 0.55);
  const frente = en(b.c, nn, 0, nn, chico ? -0.2 : -0.35);
  return (
    patas +
    (chico ? '' : caja(fondo, b.hl, 0.45, 'url(#pb-metal)')) +
    caja(frente, b.hl, chico ? 0.55 : 0.62, '#202020') +
    `<g transform="translate(${f(frente[0])} ${f(frente[1])}) rotate(${f(ang(u))})"><rect x="${f(-b.hl)}" y="-.62" width="${f(2 * b.hl)}" height="1.24" fill="url(#pb-brillo)" opacity=".5"/></g>` +
    marcaTexto(frente, u, encapsuladoDe(p.comp).marca, 0.42, '#d8d8d8', b.hl * 2 - 0.2)
  );
}

function dip(p: Pieza): string {
  const b = cuerpoDe(p)!;
  const u = b.u;
  const nn = normal(u);
  const pines = p.pos
    .map((q) => {
      const haciaCuerpo: Pt = [b.c[0] - q[0], b.c[1] - q[1]];
      const s = Math.sign(haciaCuerpo[0] * nn[0] + haciaCuerpo[1] * nn[1]) || 1;
      const e = en(q, nn, 0, nn, 0.55 * s);
      return `<line x1="${f(q[0])}" y1="${f(q[1])}" x2="${f(e[0])}" y2="${f(e[1])}" stroke="#b9bec4" stroke-width=".32"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r=".1" fill="#6b7076"/>`;
    })
    .join('');
  const muesca = en(b.c, u, -b.hl);
  const punto = en(b.c, u, -b.hl + 0.55, nn, -b.hw + 0.4);
  return (
    pines +
    `<rect x="${f(-b.hl)}" y="${f(-b.hw)}" width="${f(2 * b.hl)}" height="${f(2 * b.hw)}" rx=".14" fill="#1f2023" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    `<rect x="${f(-b.hl)}" y="${f(-b.hw)}" width="${f(2 * b.hl)}" height="${f(2 * b.hw)}" rx=".14" fill="url(#pb-brillo)" opacity=".45" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    `<circle cx="${f(muesca[0])}" cy="${f(muesca[1])}" r=".32" fill="#45474c"/>` +
    `<circle cx="${f(punto[0])}" cy="${f(punto[1])}" r=".14" fill="#4b4d52"/>` +
    marcaTexto(en(b.c, u, 0.25), u, encapsuladoDe(p.comp).marca, 0.46, '#d9d9d9', b.hl * 2 - 0.9)
  );
}

function trimmer(p: Pieza): string {
  const { u, nn } = enFila(p);
  const b = cuerpoDe(p)!;
  const pos = valor(p, 'pos', '%') ?? 50;
  const a = ((pos / 100) * 270 - 135 + ang(u)) * (Math.PI / 180);
  const r = 0.62;
  const patas = p.pos.map((q) => pata(q, en(q, nn, 0, nn, 0.3), 0.14)).join('');
  return (
    patas +
    `<rect x="${f(-b.hl)}" y="${f(-b.hw)}" width="${f(2 * b.hl)}" height="${f(2 * b.hw)}" rx=".2" fill="#2f69c9" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    `<circle cx="${f(b.c[0])}" cy="${f(b.c[1])}" r="${r}" fill="#f1f1ee"/>` +
    `<line x1="${f(b.c[0] - Math.sin(a) * r * 0.8)}" y1="${f(b.c[1] + Math.cos(a) * r * 0.8)}" x2="${f(b.c[0] + Math.sin(a) * r * 0.8)}" y2="${f(b.c[1] - Math.cos(a) * r * 0.8)}" stroke="#6d6d6d" stroke-width=".16" stroke-linecap="round"/>` +
    `<rect x="${f(-b.hl)}" y="${f(-b.hw)}" width="${f(2 * b.hl)}" height="${f(2 * b.hw)}" rx=".2" fill="url(#pb-brillo)" opacity=".5" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>`
  );
}

function conmutador(p: Pieza): string {
  const { u } = enFila(p);
  const b = cuerpoDe(p)!;
  const cerrado = (p.comp.campos['estado'] ?? 'cerrado') !== 'abierto';
  const palanca = en(b.c, u, cerrado ? -0.55 : 0.55);
  return (
    p.pos.map((q) => `<circle cx="${f(q[0])}" cy="${f(q[1])}" r=".12" fill="#6b7076"/>`).join('') +
    `<rect x="${f(-b.hl)}" y="${f(-b.hw)}" width="${f(2 * b.hl)}" height="${f(2 * b.hw)}" rx=".12" fill="#2a2a2c" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    `<rect x="-.75" y="-.32" width="1.5" height=".64" rx=".08" fill="#58595d" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    `<rect x="-.32" y="-.27" width=".64" height=".54" rx=".08" fill="#f2f2f2" transform="translate(${f(palanca[0])} ${f(palanca[1])}) rotate(${f(ang(u))})"/>`
  );
}

function puente(p: Pieza): string {
  const { u, nn } = enFila(p);
  const b = cuerpoDe(p)!;
  const marcas = ['+', '~', '~', '−'];
  return (
    p.pos.map((q) => pata(q, q)).join('') +
    `<rect x="${f(-b.hl)}" y="${f(-b.hw)}" width="${f(2 * b.hl)}" height="${f(2 * b.hw)}" rx=".12" fill="#28292b" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    p.pos.map((q, i) => marcaTexto(en(q, nn, 0, nn, 0.3), u, marcas[i] ?? '', 0.42, '#e0e0e0')).join('')
  );
}

function modulo(p: Pieza): string {
  const { u, nn } = enFila(p);
  const b = cuerpoDe(p)!;
  const e = encapsuladoDe(p.comp);
  const pines = p.pos.map((q) => `<rect x="${f(q[0] - 0.22)}" y="${f(q[1] - 0.22)}" width=".44" height=".44" fill="#1b1b1b"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r=".11" fill="#d8b04a"/>`).join('');
  const rotulos = p.pos.map((q, i) => marcaTexto(en(q, nn, 0, nn, 0.72), u, e.nombres[i] ?? '', 0.34, '#f2f6f0', 0.95)).join('');
  return (
    pines +
    `<rect x="${f(-b.hl)}" y="${f(-b.hw)}" width="${f(2 * b.hl)}" height="${f(2 * b.hw)}" rx=".18" fill="#1e7a50" opacity=".94" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    `<rect x="${f(-b.hl + 0.12)}" y="${f(-b.hw + 0.12)}" width="${f(2 * b.hl - 0.24)}" height="${f(2 * b.hw - 0.24)}" rx=".12" fill="none" stroke="#9fd8b5" stroke-width=".04" opacity=".7" transform="translate(${f(b.c[0])} ${f(b.c[1])}) rotate(${f(ang(u))})"/>` +
    rotulos +
    marcaTexto(en(b.c, nn, 0, nn, 0.35), u, e.marca, 0.46, '#ffffff', b.hl * 2 - 0.3)
  );
}

function medida(p: Pieza): string {
  const [a, b] = [p.pos[0]!, p.pos[1]!];
  const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return (
    cable({ id: '', a, b, color: '#5d6168' }) +
    `<circle cx="${f(c[0])}" cy="${f(c[1])}" r=".55" fill="#f2cf3a" stroke="#6a5a10" stroke-width=".06"/><text x="${f(c[0])}" y="${f(c[1] + 0.02)}" font-size=".62" font-weight="700" fill="#3b3000" text-anchor="middle" dominant-baseline="central">A</text>`
  );
}

function sonda(p: Pieza): string {
  const a = p.pos[0]!;
  return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(a[0] + 0.6)}" y2="${f(a[1] - 1.1)}" stroke="#6d4fb0" stroke-width=".12"/><circle cx="${f(a[0])}" cy="${f(a[1])}" r=".14" fill="#6d4fb0"/><rect x="${f(a[0] + 0.45)}" y="${f(a[1] - 1.85)}" width="1.1" height=".8" rx=".18" fill="#6d4fb0"/><text x="${f(a[0] + 1.0)}" y="${f(a[1] - 1.44)}" font-size=".52" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">V</text>`;
}

// ------------------------------------------------------------------ equipment

function textoEquipo(p: Pieza): string {
  const c = p.comp;
  if (p.enc === 'voltimetro') return 'V';
  const forma = c.campos['forma'] ?? 'dc';
  const spec = (forma === 'texto' ? (c.campos['spec'] ?? '') : c.tipo === 'GEN' ? (c.campos['resto'] ?? c.spice?.resto ?? '') : '').trim();
  if (spec) {
    // A SPICE specification: its kind of waveform, not its text.
    if (/\bsin\s*\(/i.test(spec)) return '∿ SIN';
    if (/\bpulse\s*\(/i.test(spec)) return '⎍ PULSE';
    if (/\bpwl\s*\(/i.test(spec)) return 'PWL';
    if (/\bexp\s*\(/i.test(spec)) return 'EXP';
    if (/\bsffm\s*\(/i.test(spec)) return 'FM';
    if (/^\s*(dc\s+)?\{/i.test(spec)) return '{…} V';
  }
  const t = textoValor(c);
  if (/\{/.test(t)) return t.replace(/\{[^}]*\}/g, '{…}');
  return t || spec.slice(0, 11);
}

/** A designator short enough for the board (a bridge of four diodes is «DA1…»). */
export function rotuloCorto(nombre: string): string {
  const n = nombre.split(/[,·\s]+/)[0] ?? nombre;
  return n !== nombre || n.length > 10 ? `${n.slice(0, 9)}…` : n;
}

function externo(p: Pieza): string {
  const [x0, y0, x1, y1] = cajaExterno(p);
  const titulos: Record<string, string> = { alimentacion: 'FUENTE', generador: 'GENERADOR', corriente: 'CORRIENTE', voltimetro: 'VOLTÍMETRO' };
  const e = encapsuladoDe(p.comp);
  const borne = (q: Pt, i: number) => {
    const rojo = i === 0;
    return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r=".55" fill="${rojo ? '#c9302a' : '#222'}" stroke="#000" stroke-opacity=".35" stroke-width=".06"/><circle cx="${f(q[0])}" cy="${f(q[1])}" r=".22" fill="#9aa0a7"/><text x="${f(q[0])}" y="${f(q[1] - 0.95)}" font-size=".46" fill="#e8ebee" text-anchor="middle">${esc(e.nombres[i] ?? '')}</text>`;
  };
  const lcd = textoEquipo(p);
  return (
    `<rect x="${f(x0 + 0.12)}" y="${f(y0 + 0.15)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" rx=".5" fill="#000" opacity=".22"/>` +
    `<rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" rx=".5" fill="#3a3f46"/>` +
    `<rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" rx=".5" fill="url(#pb-brillo)" opacity=".35"/>` +
    `<text x="${f(x0 + 0.45)}" y="${f(y0 + 0.75)}" font-size=".46" font-weight="700" fill="#c8ced6" font-family="Source Sans 3, sans-serif">${esc(titulos[p.enc] ?? '')}</text>` +
    `<text x="${f(x1 - 0.45)}" y="${f(y0 + 0.75)}" font-size=".5" font-weight="700" fill="#f0c94a" text-anchor="end" font-family="Source Sans 3, sans-serif">${esc(rotuloCorto(p.comp.nombre))}</text>` +
    `<rect x="${f(x0 + 0.45)}" y="${f(y0 + 1.15)}" width="${f(x1 - x0 - 0.9)}" height="1.75" rx=".2" fill="#132018"/>` +
    `<text x="${f((x0 + x1) / 2)}" y="${f(y0 + 2.06)}" font-size="${f(Math.min(0.95, 6.6 / (Math.max(lcd.length, 1) * 0.6)))}" fill="#8ef0a6" text-anchor="middle" dominant-baseline="central" font-family="Source Code Pro, monospace">${esc(lcd.slice(0, 22))}</text>` +
    p.pos.map((q, i) => borne(q, i)).join('')
  );
}

// ------------------------------------------------------------------ wires

export function cable(w: CableProto, curva = false): string {
  const { a, b } = w;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const u: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const pelado = Math.min(0.32, L / 4);
  const a1 = en(a, u, pelado);
  const b1 = en(b, u, -pelado);
  let d: string;
  if (curva) {
    // An equipment lead: a sagging curve; one that goes deep into the board runs down the left edge first,
    // like a real lead laid around the board instead of across its parts.
    const [arriba, abajo] = a[1] < b[1] ? [a1, b1] : [b1, a1];
    if (abajo[1] - arriba[1] > 9 && abajo[0] < 16) {
      const xb = -1.3;
      d = `M${f(arriba[0])} ${f(arriba[1])}C${f(arriba[0])} ${f(arriba[1] + 4)} ${f(xb)} ${f(arriba[1] + 3)} ${f(xb)} ${f(arriba[1] + 6)}L${f(xb)} ${f(abajo[1] - 1.2)}Q${f(xb)} ${f(abajo[1])} ${f(abajo[0])} ${f(abajo[1])}`;
    } else {
      const caida = Math.min(3, L * 0.18);
      d = `M${f(a1[0])} ${f(a1[1])}Q${f((a1[0] + b1[0]) / 2)} ${f((a1[1] + b1[1]) / 2 + caida)} ${f(b1[0])} ${f(b1[1])}`;
    }
  } else d = `M${f(a1[0])} ${f(a1[1])}L${f(b1[0])} ${f(b1[1])}`;
  const claro = /^#(e|f|d)/i.test(w.color);
  return (
    `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(a1[0])}" y2="${f(a1[1])}" stroke="#b5bbc2" stroke-width=".12" stroke-linecap="round"/>` +
    `<line x1="${f(b[0])}" y1="${f(b[1])}" x2="${f(b1[0])}" y2="${f(b1[1])}" stroke="#b5bbc2" stroke-width=".12" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${claro ? '#9a9a9a' : '#000'}" stroke-opacity="${claro ? 0.9 : 0.35}" stroke-width="${curva ? 0.46 : 0.4}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${w.color}" stroke-width="${curva ? 0.34 : 0.28}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".07" stroke-linecap="round" transform="translate(-.04 -.05)"/>`
  );
}

// ------------------------------------------------------------------ dispatch

export interface OpcionesPieza {
  /** LED brightness 0–1 (simulated forward current). */
  encendido?: number;
}

export function svgPieza(p: Pieza, o: OpcionesPieza = {}): string {
  switch (p.enc) {
    case 'resistencia':
      return resistencia(p);
    case 'bobina':
      return bobina(p);
    case 'diodo':
    case 'zener':
      return diodo(p);
    case 'led':
      return led(p, o.encendido ?? 0);
    case 'ceramico':
      return ceramico(p);
    case 'film':
      return film(p);
    case 'electrolitico':
      return electrolitico(p);
    case 'to92':
      return to92(p);
    case 'to220':
      return to220(p);
    case 'to126':
      return to220(p, true);
    case 'dip':
      return dip(p);
    case 'trimmer':
      return trimmer(p);
    case 'conmutador':
      return conmutador(p);
    case 'puente':
      return puente(p);
    case 'medida':
      return medida(p);
    case 'sonda':
      return sonda(p);
    case 'alimentacion':
    case 'generador':
    case 'corriente':
    case 'voltimetro':
      return externo(p);
    default:
      return modulo(p);
  }
}

/** Where to write a part's designator: beside its body, away from its legs. */
export function posRotulo(p: Pieza): { x: number; y: number; ancla: 'start' | 'middle' | 'end' } | null {
  const b = cuerpoDe(p);
  if (!b) return null;
  const horizontal = Math.abs(b.u[0]) >= Math.abs(b.u[1]);
  if (b.redondo) return { x: b.c[0] + b.hl + 0.15, y: b.c[1] - b.hl * 0.55, ancla: 'start' };
  if (horizontal) {
    const ext = Math.abs(b.u[0]) * b.hw + Math.abs(b.u[1]) * b.hl;
    return { x: b.c[0], y: b.c[1] - ext - 0.42, ancla: 'middle' };
  }
  const ext = Math.abs(b.u[0]) * b.hl + Math.abs(b.u[1]) * b.hw;
  return { x: b.c[0] + ext + 0.15, y: b.c[1], ancla: 'start' };
}

/** The whole board as one SVG (tests, previews). */
export function svgMontaje(doc: DocumentoProtoboard, opciones: { rotulos?: boolean; encendidos?: Record<string, number> } = {}): string {
  const cfg = { placas: doc.placas, columnas: doc.columnas };
  let ymin = -1.5;
  for (const p of doc.piezas) if (p.enc in { alimentacion: 1, generador: 1, corriente: 1, voltimetro: 1 }) ymin = Math.min(ymin, cajaExterno(p)[1] - 0.6);
  const x0 = -1.6;
  const x1 = doc.columnas + 2.6;
  const y1 = doc.placas * ALTO_PLACA - 2.3;
  const externos = new Set(['alimentacion', 'generador', 'corriente', 'voltimetro']);
  const dentro = doc.piezas.filter((p) => !externos.has(p.enc));
  const fuera = doc.piezas.filter((p) => externos.has(p.enc));
  const puntosBorne = new Set(fuera.flatMap((p) => p.pos.map((q) => q.join(','))));
  const rot = opciones.rotulos !== false
    ? dentro
        .map((p) => {
          const r = posRotulo(p);
          return r ? `<text x="${f(r.x)}" y="${f(r.y)}" text-anchor="${r.ancla}" dominant-baseline="central">${esc(rotuloCorto(p.comp.nombre))}</text>` : '';
        })
        .join('')
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(ymin)} ${f(x1 - x0)} ${f(y1 - ymin)}" font-family="Source Sans 3, sans-serif">` +
    defsProtoboard() +
    svgPlacas(cfg) +
    doc.cables.filter((w) => !puntosBorne.has(w.a.join(',')) && !puntosBorne.has(w.b.join(','))).map((w) => cable(w)).join('') +
    dentro.map((p) => svgPieza(p, { encendido: opciones.encendidos?.[p.id] })).join('') +
    fuera.map((p) => svgPieza(p)).join('') +
    doc.cables.filter((w) => puntosBorne.has(w.a.join(',')) || puntosBorne.has(w.b.join(','))).map((w) => cable(w, true)).join('') +
    `<g font-size=".62" font-weight="700" fill="#1d2a3a" stroke="#f7f5ef" stroke-width=".22" paint-order="stroke" stroke-linejoin="round">${rot}</g>` +
    `</svg>`
  );
}

export { COLOR_CODIGO };
