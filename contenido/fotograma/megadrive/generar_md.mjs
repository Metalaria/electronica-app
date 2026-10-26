// «Un fotograma» traces of the Mega Drive (model 1 VA6.8): runs the native tool md_traza (68000 = Moira, Z80 =
// z80.h, VDP = BlastEm's) on the demo, PAL (default, as the board) and NTSC, and writes
// web/public/consolas/fotograma/megadrive/demo.bin and demo-ntsc.bin.
// Usage: node contenido/fotograma/megadrive/generar_md.mjs

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escribirTraza } from '../traza.mjs';
import { copiarLicencias, infoJuego, ejecutarTraza, explicacionesDeListado, juegosDe, leerExplicacionesB, leerListado, leerSimbolos } from '../comun_b.mjs';
import { herramientas } from '../nucleos_b.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../../..');
const DEMO = join(RAIZ, 'contenido/consolas_demos/megadrive');
const SALIDA = join(RAIZ, 'web/public/consolas/fotograma/megadrive');

export const FASES_MD = [
  { id: 'activa', titulo: 'Imagen' },
  { id: 'borde', titulo: 'Borde' },
  { id: 'borrado', titulo: 'Borrado' },
  { id: 'hsync', titulo: 'Sincronismo horizontal' },
  { id: 'vsync', titulo: 'Sincronismo vertical (posición aproximada)' },
];
export const SENALES_MD = [
  { id: 'ipl', titulo: 'Nivel de interrupción en /IPL0–2' },
  { id: 'br', titulo: '/BR (el VDP pide el bus para un DMA)', activaBaja: true },
  { id: 'zbusreq', titulo: '/BUSREQ del Z80', activaBaja: true },
  { id: 'zbusack', titulo: '/BUSACK del Z80', activaBaja: true },
  { id: 'zreset', titulo: '/RESET del Z80', activaBaja: true },
  { id: 'hsync', titulo: '/HSYNC', activaBaja: true },
  { id: 'vsync', titulo: '/VSYNC (posición aproximada)', activaBaja: true },
];
export const CHIPS_68K = [
  { id: 'ninguno', titulo: 'Nadie' },
  { id: 'rom', titulo: 'ROM del cartucho (CN1)' },
  { id: 'ram', titulo: 'RAM del 68000 (U2, U3)' },
  { id: 'vdp', titulo: 'VDP 315-5313 (U8)' },
  { id: 'io', titulo: '315-5402 (U4): versión y mandos' },
  { id: 'arbitro', titulo: '315-5402 (U4): bus y reset del Z80' },
  { id: 'tmss', titulo: '315-5402 (U4): TMSS' },
  { id: 'zram', titulo: 'RAM del Z80 (U7), a través de U4' },
  { id: 'ym', titulo: 'YM2612 (U11)' },
  { id: 'psg', titulo: 'PSG del VDP (U8)' },
];
export const TIPOS_68K = [
  { id: 'programa', titulo: 'Lectura de programa (cola de prebúsqueda)' },
  { id: 'lectura', titulo: 'Lectura de datos (palabra)' },
  { id: 'escritura', titulo: 'Escritura (palabra)' },
  { id: 'lectura-byte', titulo: 'Lectura de un byte (/UDS o /LDS)' },
  { id: 'escritura-byte', titulo: 'Escritura de un byte (/UDS o /LDS)' },
  { id: 'iack', titulo: 'Reconocimiento de interrupción (autovector)' },
  { id: 'dma', titulo: 'El VDP lee el bus del 68000 (DMA)' },
];
export const CHIPS_Z80_MD = [
  { id: 'ninguno', titulo: 'Nadie (refresco o ciclo interno)' },
  { id: 'ram', titulo: 'RAM del Z80 (U7)' },
  { id: 'ym', titulo: 'YM2612 (U11)' },
  { id: 'banco', titulo: 'Registro de banco (U4)' },
  { id: 'vdp', titulo: 'VDP y PSG (U8)' },
  { id: 'ventana', titulo: 'Ventana al bus del 68000' },
];
export const TIPOS_Z80_MD = [
  { id: 'm1', titulo: 'Lectura del código de operación (M1)' },
  { id: 'lectura', titulo: 'Lectura de memoria' },
  { id: 'escritura', titulo: 'Escritura en memoria' },
  { id: 'es-lectura', titulo: 'Lectura de E/S' },
  { id: 'es-escritura', titulo: 'Escritura de E/S' },
  { id: 'refresco', titulo: 'Refresco (/RFSH)' },
  { id: 'int-ack', titulo: 'Reconocimiento de interrupción' },
];
export const TIPOS_VRAM_MD = [
  { id: 'nombre-a', titulo: 'Plano A: tabla de nombres (2 casillas)' },
  { id: 'patron-a', titulo: 'Plano A: patrón (8 puntos)' },
  { id: 'nombre-b', titulo: 'Plano B: tabla de nombres (2 casillas)' },
  { id: 'patron-b', titulo: 'Plano B: patrón (8 puntos)' },
  { id: 'spr-atributos', titulo: 'Sprite: atributos (patrón y X)' },
  { id: 'spr-patron', titulo: 'Sprite: patrón (8 puntos)' },
  { id: 'hscroll', titulo: 'Tabla de desplazamiento horizontal' },
  { id: 'cpu', titulo: 'Escritura desde la FIFO (68000)' },
  { id: 'dma', titulo: 'Escritura de un DMA' },
  { id: 'cpu-lectura', titulo: 'Lectura para el 68000' },
  { id: 'refresco', titulo: 'Refresco de la VRAM' },
];
const REG68 = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'SR'];
const REGZ = ['A', 'F', 'B', 'C', 'D', 'E', 'H', 'L', 'IX', 'IY', 'SP', 'I'];
const ETQ = { MAPA: 1, PATRON: 2, SPR_PATRON: 4, SPR_TABLA: 8, SPR_X: 16, EXTERNO: 32, MAPA_B: 64, PATRON_B: 128 };

function construirDemo(tmp) {
  try {
    execFileSync('m68k-linux-gnu-as', ['--version'], { stdio: 'ignore' });
    execFileSync('sh', [join(DEMO, 'build.sh'), tmp], { stdio: 'inherit' });
    for (const f of ['demo.md', 'demo.lst', 'demo.sym']) copyFileSync(join(tmp, f), join(DEMO, f));
    console.log('megadrive: demo.s ensamblado con binutils-m68k');
  } catch {
    console.log('megadrive: sin binutils-m68k: se usa el demo.md guardado');
  }
}

function generar({ exe, pal, cuadrosPrevios, programaInfo, rom, juego }) {
  const x = juego ? juego.ejecutar(pal) : ejecutarTraza(exe, [join(DEMO, 'demo.md'), String(cuadrosPrevios), pal ? '1' : '0']);
  const MCLK = x.reloj_hz;
  const LINEAS = pal ? 313 : 262;
  const BORDE_ARRIBA = pal ? 38 : 11;   // BlastEm's border lines above a V28 picture
  const BORDE_ABAJO = pal ? 32 : 8;

  // end of the start-up segment: the STOP after the instruction that switched the display on (16 CPU cycles)
  const i0 = x.ins68.t.findIndex((t) => t > x.t_encendido);
  const tFin = (x.ins68.t[i0] ?? x.t_encendido) + 16 * 7;
  const segs = juego ? juego.segmentos(x, pal) : [
    { id: 'arranque', titulo: 'Desde el reset', descripcion: 'El 68000 lee sus vectores en la ROM del cartucho y prepara la consola: desbloquea el VDP (TMSS), deja al Z80 un programa de dos bytes, programa los registros del VDP, copia los patrones con un DMA, rellena el plano B, limpia el plano A con un relleno del VDP, pone las nubes y el sprite y enciende la imagen.', t0: 0, t1: tFin },
    { id: 'fotograma', titulo: `Un cuadro completo (${pal ? 'PAL' : 'NTSC'})`, descripcion: `El cuadro ${cuadrosPrevios + 1} tras encender la imagen, de la primera línea visible a la siguiente: ${pal ? 313 : 262} líneas; en las 224 visibles el VDP lee los planos A y B, la tabla de desplazamiento y los sprites ranura a ranura; al llegar a la línea 224 pide la interrupción de nivel 6, el 68000 sale de STOP, mueve la pelota y las nubes y lanza un DMA de la RAM a la VRAM.`, t0: x.t0, t1: x.t1 },
  ];
  const dentro = (t) => segs.some((s) => t >= s.t0 && t < s.t1);

  const copiarBus = (src, campos = ['t', 'a', 'd', 'f', 'c', 'k']) => {
    const out = Object.fromEntries(campos.map((c) => [c, []]));
    const indice = new Map();
    const orden = src.t.map((_, i) => i).filter((i) => dentro(src.t[i])).sort((a, b) => src.t[a] - src.t[b] || a - b);
    for (const i of orden) {
      indice.set(i, out.t.length);
      for (const c of campos) out[c].push(src[c][i]);
    }
    return { out, indice };
  };
  const { out: m, indice: im } = copiarBus(x.m68k);
  const { out: z, indice: iz } = copiarBus(x.z80);

  const instr = (src, regs, indice, nBus) => {
    const out = { t: [], pc: [], ciclo: [], k: [], r: Object.fromEntries(regs.map((r) => [r, []])) };
    for (let i = 0; i < src.t.length; i++) {
      if (!dentro(src.t[i])) continue;
      out.t.push(src.t[i]);
      out.pc.push(src.pc[i]);
      let c = indice.get(src.ciclo[i]);
      if (c === undefined) {
        // first bus event at or after the instruction start
        c = 0;
        while (c < nBus.t.length && nBus.t[c] < src.t[i]) c++;
      }
      out.ciclo.push(c);
      out.k.push(src.k ? src.k[i] : 0);
      for (const r of regs) out.r[r].push(src[r][i]);
    }
    return out;
  };
  const ins68 = instr(x.ins68, REG68, im, m);
  const insz = instr(x.insz, REGZ, iz, z);

  // ---- VDP ↔ VRAM, slot by slot
  const ventanasDma = [];
  for (let i = 0; i < x.sen.t.length; i++) {
    if (x.sen.k[i] === 1 && x.sen.v[i] === 0) ventanasDma.push([x.sen.t[i], null]);
    if (x.sen.k[i] === 1 && x.sen.v[i] === 1 && ventanasDma.length) ventanasDma[ventanasDma.length - 1][1] = x.sen.t[i] + 6 * 16;
  }
  const enDma = (t) => ventanasDma.some(([a, b]) => t >= a && t <= (b ?? a));
  const v = { t: [], a: [], d: [], f: [], c: [], k: [] };
  const vr = (t, a, d, f, k) => {
    v.t.push(t); v.a.push(a); v.d.push(d >>> 0); v.f.push(f); v.c.push(0); v.k.push(k);
  };
  const R = x.ranuras;
  const idk = (id) => TIPOS_VRAM_MD.findIndex((q) => q.id === id);
  for (let i = 0; i < R.t.length; i++) {
    const t = R.t[i];
    if (!dentro(t)) continue;
    const e = R.etiquetas[i];
    if (R.n[i] > 0) {
      const k = e & ETQ.MAPA ? 'nombre-a' : e & ETQ.MAPA_B ? 'nombre-b' : e & ETQ.PATRON ? 'patron-a' : e & ETQ.PATRON_B ? 'patron-b' : e & ETQ.SPR_X ? 'spr-atributos' : e & ETQ.SPR_PATRON ? 'spr-patron' : e & ETQ.EXTERNO ? 'cpu-lectura' : 'hscroll';
      // up to four bytes read in the slot, in VRAM address order
      const b = [0, 1, 2, 3].map((j) => (R.val[i] >>> (8 * j)) & 0xff);
      const d = R.n[i] >= 4 ? (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0 : R.n[i] === 2 ? b[0] << 8 | b[1] : b[0];
      vr(t, R.dir[i] & 0xffff, d, 0, idk(k));
    }
    if (R.esc_dir1[i] > 0) {
      const dma = R.esc_dma[i] || enDma(t);
      vr(t, (R.esc_dir1[i] - 1) & 0xffff, R.esc_val[i], dma ? 9 : 1, idk(dma ? 'dma' : 'cpu'));
    }
    if (!e && R.n[i] === 0 && R.esc_dir1[i] === 0) vr(t, 0, 0, 0, idk('refresco'));
  }

  // ---- pixels (320 × 224) and the frame buffer; colours: the distinct RGB values of the frame
  const P = x.pixeles;
  const tPar = new Map();
  for (let i = 0; i < P.t.length; i++) if (P.t[i] >= x.t0 && P.t[i] < x.t1 && P.x[i] <= 360) tPar.set(`${P.fila[i]},${P.x[i]}`, P.t[i]);
  const paleta = [];
  const indiceColor = new Map();
  const px = { t: [], c: [] };
  const fb = [];
  for (let r = 0; r < 224; r++) {
    for (let c = 0; c < 320; c++) {
      const xb = 13 + c;
      const fila = BORDE_ARRIBA + r;
      const t = tPar.get(`${fila},${xb & ~1}`);
      if (t === undefined) throw new Error(`megadrive: falta el instante del punto (${c}, ${r})`);
      const rgb = x.fb[fila * x.fb_ancho + xb];
      if (!indiceColor.has(rgb)) { indiceColor.set(rgb, paleta.length); paleta.push(rgb); }
      const k = indiceColor.get(rgb);
      px.t.push(t + (xb & 1) * 8);
      px.c.push(k);
      fb.push(k);
    }
  }

  // ---- phases and sync: horizontal from the slots (H sync slots last 18–20 master cycles instead of 16) and the
  // pixels; vertical from the border sizes; /VSYNC: 3 lines placed 3 lines after the bottom border (approximate)
  const P0 = px.t[0];
  const LINEA = 3420;
  const durs = [];
  let hs0 = null, hs1 = null;
  for (let i = 0; i + 1 < R.t.length; i++) {
    if (R.t[i] < x.t0 || R.t[i] >= x.t0 + LINEA) continue;
    const dd = R.t[i + 1] - R.t[i];
    durs.push(dd);
    if (dd !== 16 && hs0 === null) hs0 = R.t[i];
    if (dd !== 16) hs1 = R.t[i + 1];
  }
  const rel = (t) => ((t - P0) % LINEA + LINEA) % LINEA;
  const tramosH = [
    ['activa', 0, 320 * 8],
    ['borde', 320 * 8, 334 * 8],
    ['borrado', 334 * 8, rel(hs0)],
    ['hsync', rel(hs0), rel(hs1)],
    ['borrado', rel(hs1), LINEA - 13 * 8],
    ['borde', LINEA - 13 * 8, LINEA],
  ];
  const tipoV = (lv) => (lv < 224 ? 'activa' : lv < 224 + BORDE_ABAJO ? 'borde' : lv >= LINEAS - BORDE_ARRIBA ? 'borde' : lv >= 224 + BORDE_ABAJO + 3 && lv < 224 + BORDE_ABAJO + 6 ? 'vsync' : 'borrado');
  const fases = { t: [], k: [], linea: [] };
  const sen = { t: [], k: [], v: [] };
  const idf = (id) => FASES_MD.findIndex((f) => f.id === id);
  const ids = (id) => SENALES_MD.findIndex((s) => s.id === id);
  const nivel = { hsync: 1, vsync: 1 };
  const ponerSen = (t, id, val) => {
    if (nivel[id] === val) return;
    nivel[id] = val;
    sen.t.push(t); sen.k.push(ids(id)); sen.v.push(val);
  };
  for (const s of segs) {
    for (let n = Math.floor((s.t0 - P0) / LINEA); P0 + n * LINEA < s.t1; n++) {
      const lv = ((n % LINEAS) + LINEAS) % LINEAS;
      const tv = tipoV(lv);
      ponerSen(Math.max(s.t0, P0 + n * LINEA), 'vsync', tv === 'vsync' ? 0 : 1);
      for (const [id, a, b] of tramosH) {
        const ta = P0 + n * LINEA + a;
        const tb = P0 + n * LINEA + b;
        if (tb <= s.t0 || ta >= s.t1 || tb <= ta) continue;
        const tipo = tv === 'activa' ? id : tv === 'borde' ? (id === 'activa' ? 'borde' : id) : id === 'hsync' ? 'hsync' : tv;
        const t = Math.max(ta, s.t0);
        if (!(fases.linea.length && fases.linea.at(-1) === lv && fases.k.at(-1) === idf(tipo))) {
          fases.t.push(t); fases.k.push(idf(tipo)); fases.linea.push(lv);
        }
        ponerSen(t, 'hsync', id === 'hsync' ? 0 : 1);
      }
    }
  }
  const mapa = { 0: 'ipl', 1: 'br', 2: 'zbusreq', 3: 'zbusack', 4: 'zreset' };
  for (let i = 0; i < x.sen.t.length; i++) {
    if (!dentro(x.sen.t[i]) && x.sen.t[i] !== 0) continue;
    sen.t.push(x.sen.t[i]); sen.k.push(ids(mapa[x.sen.k[i]])); sen.v.push(x.sen.v[i]);
  }
  const ord = sen.t.map((_, i) => i).sort((a, b) => sen.t[a] - sen.t[b] || a - b);
  const senO = { t: ord.map((i) => sen.t[i]), k: ord.map((i) => sen.k[i]), v: ord.map((i) => sen.v[i]) };

  const lineasV = { t: [], n: [] };
  for (const s of segs) {
    for (let n = Math.floor((s.t0 - P0) / LINEA); P0 + n * LINEA < s.t1; n++) {
      if (P0 + (n + 1) * LINEA <= s.t0) continue;
      lineasV.t.push(Math.max(0, P0 + n * LINEA));   // the first, partial line of the start-up segment starts at 0
      lineasV.n.push(((n % LINEAS) + LINEAS) % LINEAS);
    }
  }
  const arrays = {
    m68k_t: { tipo: 'u32', cod: 'vlqd', datos: m.t }, m68k_a: { tipo: 'u32', cod: 'vlqd', datos: m.a },
    m68k_d: { tipo: 'u16', cod: 'crudo', datos: m.d }, m68k_f: { tipo: 'u8', cod: 'crudo', datos: m.f },
    m68k_c: { tipo: 'u8', cod: 'crudo', datos: m.c }, m68k_k: { tipo: 'u8', cod: 'crudo', datos: m.k },
    z80_t: { tipo: 'u32', cod: 'vlqd', datos: z.t }, z80_a: { tipo: 'u16', cod: 'vlqd', datos: z.a },
    z80_d: { tipo: 'u8', cod: 'crudo', datos: z.d }, z80_f: { tipo: 'u8', cod: 'crudo', datos: z.f },
    z80_c: { tipo: 'u8', cod: 'crudo', datos: z.c }, z80_k: { tipo: 'u8', cod: 'crudo', datos: z.k },
    vram_t: { tipo: 'u32', cod: 'vlqd', datos: v.t }, vram_a: { tipo: 'u16', cod: 'vlqd', datos: v.a },
    vram_d: { tipo: 'u32', cod: 'crudo', datos: v.d }, vram_f: { tipo: 'u8', cod: 'crudo', datos: v.f },
    vram_c: { tipo: 'u8', cod: 'crudo', datos: v.c }, vram_k: { tipo: 'u8', cod: 'crudo', datos: v.k },
    i68_t: { tipo: 'u32', cod: 'vlqd', datos: ins68.t }, i68_pc: { tipo: 'u32', cod: 'vlqd', datos: ins68.pc },
    i68_ciclo: { tipo: 'u32', cod: 'vlqd', datos: ins68.ciclo }, i68_k: { tipo: 'u8', cod: 'crudo', datos: ins68.k },
    iz_t: { tipo: 'u32', cod: 'vlqd', datos: insz.t }, iz_pc: { tipo: 'u16', cod: 'vlqd', datos: insz.pc },
    iz_ciclo: { tipo: 'u32', cod: 'vlqd', datos: insz.ciclo }, iz_k: { tipo: 'u8', cod: 'crudo', datos: insz.k },
    fase_t: { tipo: 'u32', cod: 'vlqd', datos: fases.t }, fase_k: { tipo: 'u8', cod: 'crudo', datos: fases.k },
    fase_linea: { tipo: 'u16', cod: 'vlqd', datos: fases.linea },
    sen_t: { tipo: 'u32', cod: 'vlqd', datos: senO.t }, sen_k: { tipo: 'u8', cod: 'crudo', datos: senO.k },
    sen_v: { tipo: 'u8', cod: 'crudo', datos: senO.v },
    px_t: { tipo: 'u32', cod: 'vlqd', datos: px.t }, px_c: { tipo: 'u8', cod: 'vlqd', datos: px.c },
    lin_t: { tipo: 'u32', cod: 'vlqd', datos: lineasV.t }, lin_n: { tipo: 'u16', cod: 'vlqd', datos: lineasV.n },
    fb: { tipo: 'u8', cod: 'crudo', datos: fb },
    mem_rom: { tipo: 'u8', cod: 'crudo', datos: rom },
  };
  for (const r of REG68) arrays['i68_r_' + r] = { tipo: r === 'SR' ? 'u16' : 'u32', cod: 'vlqd', datos: ins68.r[r] };
  for (const r of REGZ) arrays['iz_r_' + r] = { tipo: ['IX', 'IY', 'SP'].includes(r) ? 'u16' : 'u8', cod: 'crudo', datos: insz.r[r] };
  const sufijo = pal ? '' : '-ntsc';
  const id = (juego ? juego.id : 'demo') + sufijo;
  const manifiesto = {
    maquina: 'megadrive',
    idPrograma: id,
    titulo: `${juego ? 'Un juego de verdad' : 'Paso a paso'} (${pal ? 'PAL' : 'NTSC'})`,
    tipo: juego ? 'juego' : 'demo',
    norma: pal ? 'pal' : 'ntsc',
    generador: {
      emulador: 'contenido/fotograma/megadrive/md_traza.cpp: Moira (68000, MIT) + z80.h (zlib) + VDP de BlastEm (GPL-3), fuera de línea',
      detalle: '68000 en modo de temporización precisa, comparado con SingleStepTests 680x0 (ver contenido/fotograma/m68k/validar_m68k.py: dirección, dato y ciclo de inicio de cada acceso); Z80 como en la Master System; VDP ranura a ranura (BlastEm, según las medidas de Nemesis). Las esperas de /DTACK del VDP y el DMA siguen a genesis.c de BlastEm.',
    },
    reloj: { hz: MCLK, nombre: `ciclo del reloj maestro de ${(MCLK / 1e6).toFixed(6).replace('.', ',')} MHz` },
    cpus: [
      { id: 'm68k', tipo: '68000', titulo: '68000 (U1)', hz: MCLK / 7, unidadesPorCiclo: 7, registros: REG68 },
      { id: 'z80', tipo: 'z80', titulo: 'Z80 (U6)', hz: MCLK / 15, unidadesPorCiclo: 15, registros: REGZ },
    ],
    buses: [
      { id: 'm68k', titulo: 'Bus del 68000', anchoDir: 24, anchoDato: 16, t: 'm68k_t', a: 'm68k_a', d: 'm68k_d', f: 'm68k_f', c: 'm68k_c', k: 'm68k_k', chips: CHIPS_68K, tipos: TIPOS_68K, duracion: 28 },
      { id: 'z80', titulo: 'Bus del Z80', anchoDir: 16, anchoDato: 8, t: 'z80_t', a: 'z80_a', d: 'z80_d', f: 'z80_f', c: 'z80_c', k: 'z80_k', chips: CHIPS_Z80_MD, tipos: TIPOS_Z80_MD, duracion: 45, duraciones: [30, 45, 45, 60, 60, 30, 60] },
      { id: 'vram', titulo: 'VDP ↔ VRAM (U9, U10)', anchoDir: 16, anchoDato: 32, t: 'vram_t', a: 'vram_a', d: 'vram_d', f: 'vram_f', c: 'vram_c', k: 'vram_k', chips: [{ id: 'vram', titulo: 'VRAM de 64 KB (U9, U10)' }], tipos: TIPOS_VRAM_MD, duracion: 16 },
    ],
    instrucciones: [
      { cpu: 'm68k', t: 'i68_t', pc: 'i68_pc', ciclo: 'i68_ciclo', k: 'i68_k', r: REG68.map((r) => 'i68_r_' + r) },
      { cpu: 'z80', t: 'iz_t', pc: 'iz_pc', ciclo: 'iz_ciclo', k: 'iz_k', r: REGZ.map((r) => 'iz_r_' + r) },
    ],
    video: { ancho: 320, alto: 224, puntosPorLinea: 420, lineas: LINEAS, primeraVisible: 0, formato: 'indice', paleta, t0Cuadro: x.t0, unidadesPorPunto: 8, lineasT: 'lin_t', lineasN: 'lin_n' },
    fases: { tipos: FASES_MD, t: 'fase_t', k: 'fase_k', linea: 'fase_linea' },
    senales: { tipos: SENALES_MD, t: 'sen_t', k: 'sen_k', v: 'sen_v' },
    pixeles: { t: 'px_t', c: 'px_c' },
    fb: 'fb',
    segmentos: segs.map((s) => ({ ...s, pixel0: 0, pixel1: s.id === 'fotograma' ? px.t.length : 0 })),
    memoria: [
      { nombre: 'ROM del cartucho', array: 'mem_rom', base: 0 },
    ],
    programa: programaInfo,
  };
  mkdirSync(SALIDA, { recursive: true });
  const bytes = escribirTraza(join(SALIDA, `${id}.bin`), manifiesto, arrays);
  console.log(`megadrive/${id}: ${m.t.length} ciclos del 68000, ${z.t.length} del Z80, ${v.t.length} accesos a la VRAM, ${ins68.t.length} + ${insz.t.length} instrucciones, ${px.t.length} píxeles, ${paleta.length} colores, ${(bytes / 1024).toFixed(0)} kB`);
  return bytes;
}

export function generarMd({ tmp, cuadrosPrevios = 2 }) {
  mkdirSync(tmp, { recursive: true });
  construirDemo(tmp);
  const { md_traza } = herramientas(tmp);
  const listado = leerListado(join(DEMO, 'demo.lst'));
  const simbolos = leerSimbolos(join(DEMO, 'demo.sym'), 0x3fffff);
  const { explicaciones, lineas } = explicacionesDeListado(listado, leerExplicacionesB(join(DEMO, 'explicaciones.es.txt')));
  const rom = readFileSync(join(DEMO, 'demo.md'));
  const programaInfo = {
    fuente: 'contenido/consolas_demos/megadrive/demo.s',
    licencia: 'CC0 1.0',
    autor: 'Demostración escrita para esta aplicación',
    etiquetas: simbolos,
    explicaciones,
    lineas,
  };
  const pal = generar({ exe: md_traza, pal: true, cuadrosPrevios, programaInfo, rom });
  const ntsc = generar({ exe: md_traza, pal: false, cuadrosPrevios, programaInfo, rom });
  const resumen = 'Demostración propia: cielo y suelo en el plano B, nubes que se desplazan en el plano A y una pelota (sprite) cuya entrada de la tabla de sprites copia un DMA en cada borrado vertical.';
  const programas = [
    { id: 'demo', titulo: 'Paso a paso', tipo: 'demo', norma: 'pal', archivo: 'demo.bin', bytes: pal, resumen },
    { id: 'demo-ntsc', titulo: 'Paso a paso (NTSC)', tipo: 'demo', norma: 'ntsc', archivo: 'demo-ntsc.bin', bytes: ntsc, resumen },
  ];
  for (const j of juegosDe('megadrive')) programas.push(...generarJuegoMd(md_traza, j));
  writeFileSync(join(SALIDA, 'indice.json'), JSON.stringify({ version: 1, programas }, null, 1));
}

/** «Un juego de verdad» on the Mega Drive, PAL and NTSC: the frame «cuadro» since reset, a 3-button pad script. */
export function generarJuegoMd(md_traza, j) {
  const rutaRom = join(RAIZ, j.rom);
  const rom = readFileSync(rutaRom);
  const arranque = j.arranque ?? 4000;
  const bits = { arriba: 1, abajo: 2, izquierda: 4, derecha: 8, a: 16, b: 32, c: 64, start: 128 };
  const guion = (j.entradas ?? []).map(([c, b]) => `${c}:${String(b).split('+').filter(Boolean).reduce((m, k) => m | (bits[k] ?? 0), 0)}`).join(',');
  const cuadro = (pal) => (pal ? j.cuadro : j.cuadroNtsc ?? j.cuadro) ?? 300;
  const juego = {
    id: j.id,
    ejecutar: (pal) => ejecutarTraza(md_traza, [rutaRom, String(cuadro(pal)), pal ? '1' : '0', '--juego', String(arranque), ...(guion ? [guion] : [])]),
    segmentos: (x, pal) => [
      { id: 'arranque', titulo: 'Desde el reset', descripcion: `Los primeros ${arranque} ciclos del 68000: lee sus vectores en la ROM del cartucho y empieza el arranque de SGDK (desbloqueo del VDP por TMSS, borrado de la RAM).`, t0: 0, t1: x.t_arranque },
      { id: 'fotograma', titulo: `Un cuadro completo (${pal ? 'PAL' : 'NTSC'})`, descripcion: `El cuadro ${cuadro(pal)} desde el reset, de la primera línea visible a la siguiente: ${pal ? 313 : 262} líneas. ${j.descripcion ?? ''}`.trim(), t0: x.t0, t1: x.t1 },
    ],
  };
  const programaInfo = { fuente: j.url, licencia: j.licencia, autor: j.autor, url: j.url, nombre: j.nombre, etiquetas: {}, explicaciones: {}, lineas: {} };
  const out = [];
  for (const pal of [true, false]) {
    const bytes = generar({ exe: md_traza, pal, programaInfo, rom, juego });
    const id = j.id + (pal ? '' : '-ntsc');
    out.push({ id, titulo: `Un juego de verdad${pal ? '' : ' (NTSC)'}`, tipo: 'juego', norma: pal ? 'pal' : 'ntsc', archivo: `${id}.bin`, bytes, resumen: `${j.nombre}, de ${j.autor} (${j.licencia}).`, ...(pal ? { juego: infoJuego(j) } : {}) });
  }
  copiarLicencias(j, SALIDA);
  copiarLicencias({ ...j, id: j.id + '-ntsc' }, SALIDA);   // the page links «<idPrograma>-LICENCIA.txt»
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generarMd({ tmp: process.env.FOTOGRAMA_TMP ?? join(RAIZ, 'contenido/.cache/fotograma/bin') });
}
