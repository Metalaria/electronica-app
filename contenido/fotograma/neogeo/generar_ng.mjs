// «Un fotograma» trace of the Neo Geo AES (NEO-AES3-5): runs the native tool ng_traza (68000 = Moira, LSPC = our
// model of the documented access pattern) on the demo and on the homebrew programs of contenido/fotograma/juegos.json
// («maquina»: «neogeo»), and writes web/public/consolas/fotograma/neogeo/<programa>.bin and indice.json.
// Usage: node contenido/fotograma/neogeo/generar_ng.mjs

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escribirTraza } from '../traza.mjs';
import { copiarLicencias, infoJuego, ejecutarTraza, explicacionesDeListado, juegosDe, leerExplicacionesB, leerListado, leerSimbolos } from '../comun_b.mjs';
import { herramientas } from '../nucleos_b.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../../..');
const DEMO = join(RAIZ, 'contenido/consolas_demos/neogeo');
const SALIDA = join(RAIZ, 'web/public/consolas/fotograma/neogeo');
const HZ = 48000000;               // half master cycles

export const FASES_NG = [
  { id: 'activa', titulo: 'Imagen' },
  { id: 'borrado', titulo: 'Borrado (bordes apagados en NTSC)' },
  { id: 'hsync', titulo: 'Sincronismo horizontal' },
  { id: 'vsync', titulo: 'Sincronismo vertical' },
];
export const SENALES_NG = [
  { id: 'ipl', titulo: 'Nivel de interrupción en /IPL0–2' },
  { id: 'hsync', titulo: 'Sincronismo horizontal', activaBaja: true },
  { id: 'vsync', titulo: 'Sincronismo vertical', activaBaja: true },
];
export const CHIPS_68K_NG = [
  { id: 'ninguno', titulo: 'Nadie' },
  { id: 'prom', titulo: 'ROM P del cartucho' },
  { id: 'ram', titulo: 'RAM del 68000 (U1, U2)' },
  { id: 'io', titulo: 'NEO-C1 (U4): mandos y perro guardián' },
  { id: 'sistema', titulo: 'Registros del sistema ($3A0000)' },
  { id: 'lspc', titulo: 'LSPC2-A2 (U21)' },
  { id: 'paleta', titulo: 'RAM de paleta (U6, U7)' },
  { id: 'bios', titulo: 'ROM del sistema (U36; aquí nullbios, libre)' },
];
export const TIPOS_68K_NG = [
  { id: 'programa', titulo: 'Lectura de programa (cola de prebúsqueda)' },
  { id: 'lectura', titulo: 'Lectura de datos (palabra)' },
  { id: 'escritura', titulo: 'Escritura (palabra)' },
  { id: 'lectura-byte', titulo: 'Lectura de un byte' },
  { id: 'escritura-byte', titulo: 'Escritura de un byte' },
  { id: 'iack', titulo: 'Reconocimiento de interrupción (autovector)' },
];
const TIPOS_LENTA = [
  { id: 'scb1-par', titulo: 'SCB1: número de patrón (palabra par)' },
  { id: 'scb1-impar', titulo: 'SCB1: paleta y giros (palabra impar)' },
  { id: 'cpu', titulo: 'Acceso del 68000' },
  { id: 'fija', titulo: 'Tabla de la capa fija' },
];
const TIPOS_RAPIDA = [
  { id: 'analisis', titulo: 'Análisis: Y y altura de un sprite (SCB3)' },
  { id: 'lista-esc', titulo: 'Análisis: el sprite entra en la lista' },
  { id: 'relleno', titulo: 'Análisis: relleno de la lista' },
  { id: 'lista', titulo: 'Dibujo: entrada de la lista' },
  { id: 'scb2', titulo: 'Dibujo: reducción (SCB2)' },
  { id: 'scb3', titulo: 'Dibujo: Y y altura (SCB3)' },
  { id: 'scb4', titulo: 'Dibujo: X (SCB4)' },
  { id: 'cpu', titulo: 'Acceso del 68000' },
];
const REG68 = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'SR'];

/** RGB of a Neo Geo colour word (D R0 G0 B0 R4-1 G4-1 B4-1): 5 bits per channel, the dark bit lowers it a little. */
export function colorNeoGeo(c) {
  const r = (((c >> 8) & 0xf) << 1) | ((c >> 14) & 1);
  const g = (((c >> 4) & 0xf) << 1) | ((c >> 13) & 1);
  const b = ((c & 0xf) << 1) | ((c >> 12) & 1);
  const k = c & 0x8000 ? 0.94 : 1;
  const e = (v) => Math.round((v * 255 / 31) * k);
  return (e(r) << 16) | (e(g) << 8) | e(b);
}

function construirDemo(tmp) {
  try {
    execFileSync('m68k-linux-gnu-as', ['--version'], { stdio: 'ignore' });
    execFileSync('sh', [join(DEMO, 'build.sh'), tmp], { stdio: 'inherit' });
    for (const f of ['demo.p1', 'demo.lst', 'demo.sym', 'c1.bin', 'c2.bin', 's1.bin']) copyFileSync(join(tmp, f), join(DEMO, f));
    console.log('neogeo: demo.s ensamblado con binutils-m68k');
  } catch {
    console.log('neogeo: sin binutils-m68k: se usan los ficheros guardados');
  }
}

export function generarNg({ tmp, cuadrosPrevios = 2 }) {
  mkdirSync(tmp, { recursive: true });
  construirDemo(tmp);
  const { ng_traza } = herramientas(tmp);
  const listado = leerListado(join(DEMO, 'demo.lst'));
  const simbolos = leerSimbolos(join(DEMO, 'demo.sym'), 0xfffff);
  const { explicaciones, lineas } = explicacionesDeListado(listado, leerExplicacionesB(join(DEMO, 'explicaciones.es.txt')));
  const f = (n) => join(DEMO, n);
  const x = ejecutarTraza(ng_traza, [f('demo.p1'), f('c1.bin'), f('c2.bin'), f('s1.bin'), String(cuadrosPrevios)]);
  // the start-up segment ends with the STOP instruction (the last one that starts before the CPU stops)
  let iStop = x.ins68.t.findIndex((t) => t >= x.t_stop) - 1;
  if (iStop < 0) iStop = x.ins68.t.length - 1;
  const tFin = x.ins68.t[iStop] + 16 * 4;
  const segs = [
    { id: 'arranque', titulo: 'Desde USER ($122)', descripcion: 'La ROM del sistema de SNK (que no va en la aplicación) ya ha comprobado el cartucho, borrado la VRAM y las paletas y llamado a USER. Desde aquí, la demo patea el perro guardián, toma los vectores del cartucho, carga tres paletas, escribe «NEO GEO» en la capa fija, describe 22 sprites (la pelota y el suelo) en la VRAM a través de la LSPC y se para en STOP.', t0: 0, t1: tFin },
    { id: 'fotograma', titulo: 'Un cuadro completo', descripcion: `El cuadro ${cuadrosPrevios + 1} tras el STOP, de la primera línea visible a la siguiente: 264 líneas de 384 puntos. En cada línea la LSPC analiza los 381 sprites para la línea N + 2, dibuja la N + 1 en un búfer de línea (VRAM rápida y lenta, ROM C) y saca la línea actual con la capa fija encima (ROM S). Al empezar el borde inferior pide la interrupción de nivel 1 y el 68000 mueve la pelota.`, t0: x.t0, t1: x.t1 },
  ];
  const bytes = escribirNg({
    x, segs, salida: join(SALIDA, 'demo.bin'), idPrograma: 'demo', titulo: 'Paso a paso', tipo: 'demo',
    memoria: [{ nombre: 'ROM P del cartucho', array: 'mem_prom', base: 0, datos: readFileSync(f('demo.p1')) }],
    programa: { fuente: 'contenido/consolas_demos/neogeo/demo.s', licencia: 'CC0 1.0', autor: 'Demostración escrita para esta aplicación', etiquetas: simbolos, explicaciones, lineas },
  });
  const programas = [{ id: 'demo', titulo: 'Paso a paso', tipo: 'demo', archivo: 'demo.bin', bytes, resumen: 'Demostración propia: una pelota de dos sprites enganchados sobre una tira de suelo de 20 sprites, y «NEO GEO» en la capa fija.' }];
  for (const j of juegosDe('neogeo')) programas.push(generarJuegoNg(ng_traza, j));
  writeFileSync(join(SALIDA, 'indice.json'), JSON.stringify({ version: 1, programas }, null, 1));
  return bytes;
}

/** «Un juego de verdad»: a cartridge (P, C1, C2, S1) booted by a free system ROM (nullbios), from the reset. */
export function generarJuegoNg(ng_traza, j) {
  const r = (n) => join(RAIZ, j.rom[n]);
  const cuadro = j.cuadro ?? 120;
  const arranque = j.arranque ?? 4000;
  const guion = (j.entradas ?? []).map(([c, b]) => {
    const bits = { arriba: 1, abajo: 2, izquierda: 4, derecha: 8, a: 16, b: 32, c: 64, d: 128 };
    const est = { start: 1, select: 2 };
    let p1 = 0, e = 0;
    for (const k of String(b).split('+').filter(Boolean)) { p1 |= bits[k] ?? 0; e |= est[k] ?? 0; }
    return `${c}:${p1}:${e}`;
  }).join(',');
  const args = [r('p1'), r('c1'), r('c2'), r('s1'), String(cuadro), '--bios', r('bios'), String(arranque)];
  if (guion) args.push(guion);
  const x = ejecutarTraza(ng_traza, args);
  const segs = [
    { id: 'arranque', titulo: 'Tras el reset', descripcion: `Los primeros ${arranque} ciclos del 68000 desde que se suelta el reset: lee la pila y el PC de la ROM del sistema (aquí nullbios, la BIOS libre de ngdevkit, no la de SNK), que llama a USER del cartucho para que se prepare, conmuta los vectores y la capa fija al cartucho y le pasa el control.`, t0: 0, t1: x.t_stop },
    { id: 'fotograma', titulo: 'Un cuadro completo', descripcion: `El cuadro ${cuadro} desde el reset, de la primera línea visible a la siguiente: 264 líneas de 384 puntos. ${j.descripcion ?? ''}`.trim(), t0: x.t0, t1: x.t1 },
  ];
  const simbolos = { ...leerSimbolos(join(RAIZ, j.simbolos.bios)), ...leerSimbolos(join(RAIZ, j.simbolos.programa), 0xfffff) };
  const archivo = `${j.id}.bin`;
  const bytes = escribirNg({
    x, segs, salida: join(SALIDA, archivo), idPrograma: j.id, titulo: 'Un juego de verdad', tipo: 'juego',
    memoria: [
      { nombre: 'ROM P del cartucho', array: 'mem_prom', base: 0, datos: readFileSync(r('p1')) },
      { nombre: 'ROM del sistema (nullbios)', array: 'mem_bios', base: 0xc00000, datos: recortar(readFileSync(r('bios'))) },
    ],
    programa: { fuente: j.url, licencia: j.licencia, autor: j.autor, url: j.url, nombre: j.nombre, etiquetas: simbolos, explicaciones: {}, lineas: {} },
  });
  copiarLicencias(j, SALIDA);
  return { id: j.id, titulo: 'Un juego de verdad', tipo: 'juego', archivo, bytes, resumen: `${j.nombre}, de ${j.autor} (${j.licencia}).`, juego: infoJuego(j) };
}

/** Drops the trailing 0xFF fill of a ROM image. */
function recortar(b) {
  let n = b.length;
  while (n > 0 && b[n - 1] === 0xff) n--;
  return b.subarray(0, (n + 1) & ~1);
}

function escribirNg({ x, segs, salida, idPrograma, titulo, tipo, memoria, programa }) {
  const dentro = (t) => segs.some((s) => t >= s.t0 && t < s.t1);
  const copiar = (src) => {
    const out = { t: [], a: [], d: [], f: [], c: [], k: [] };
    const idx = new Map();
    const orden = src.t.map((_, i) => i).filter((i) => dentro(src.t[i])).sort((a, b) => src.t[a] - src.t[b] || a - b);
    for (const i of orden) {
      idx.set(i, out.t.length);
      for (const c of Object.keys(out)) out[c].push(src[c][i]);
    }
    return { out, idx };
  };
  const { out: m, idx: im } = copiar(x.m68k);
  const lenta = copiar(x.lenta).out;
  const rapida = copiar(x.rapida).out;
  const crom = copiar(x.crom).out;
  const srom = copiar(x.srom).out;
  const ins = { t: [], pc: [], ciclo: [], k: [], r: Object.fromEntries(REG68.map((r) => [r, []])) };
  for (let i = 0; i < x.ins68.t.length; i++) {
    if (!dentro(x.ins68.t[i])) continue;
    ins.t.push(x.ins68.t[i]); ins.pc.push(x.ins68.pc[i]);
    let c = im.get(x.ins68.ciclo[i]);
    if (c === undefined) { c = 0; while (c < m.t.length && m.t[c] < x.ins68.t[i]) c++; }
    ins.ciclo.push(c); ins.k.push(x.ins68.k[i]);
    for (const r of REG68) ins.r[r].push(x.ins68[r][i]);
  }

  // pixels of the frame, in scan order, and the frame buffer
  const P = x.pix;
  const orden = P.t.map((_, i) => i).filter((i) => P.t[i] >= x.t0 && P.t[i] < x.t1).sort((a, b) => P.y[a] - P.y[b] || P.x[a] - P.x[b]);
  if (orden.length !== 320 * 224) throw new Error(`neogeo: ${orden.length} píxeles en el cuadro`);
  const paleta = [];
  const ic = new Map();
  const px = { t: [], c: [] };
  for (const i of orden) {
    const rgb = colorNeoGeo(P.color[i]);
    if (!ic.has(rgb)) { ic.set(rgb, paleta.length); paleta.push(rgb); }
    px.t.push(P.t[i]); px.c.push(ic.get(rgb));
  }
  const fb = px.c.slice();

  // phases and sync (wiki.neogeodev.org «Display timing»): from the start of the H sync of each line
  const LINEA = 1536 * 2;
  const H = [['hsync', 28], ['borrado', 28], ['activa', 320], ['borrado', 8]];
  const fases = { t: [], k: [], linea: [] };
  const sen = { t: [], k: [], v: [] };
  const idf = (id) => FASES_NG.findIndex((q) => q.id === id);
  const ids = (id) => SENALES_NG.findIndex((q) => q.id === id);
  const nivel = { hsync: 1, vsync: 1 };
  const ponerSen = (t, id, val) => {
    if (nivel[id] === val) return;
    nivel[id] = val; sen.t.push(t); sen.k.push(ids(id)); sen.v.push(val);
  };
  for (const s of segs) {
    for (let la = Math.floor(s.t0 / LINEA); la * LINEA < s.t1; la++) {
      const v = la % 264;                         // 0 = raster $F8
      const r = 0xf8 + v;
      const tipoV = v < 8 ? 'vsync' : r >= 0x110 && r <= 0x1ef ? 'activa' : 'borrado';
      const lv = (r - 0x110 + 264) % 264;
      ponerSen(Math.max(s.t0, la * LINEA), 'vsync', tipoV === 'vsync' ? 0 : 1);
      let tp = la * LINEA;
      for (const [id, n] of H) {
        const fin = tp + n * 8;
        if (fin > s.t0 && tp < s.t1) {
          const t = Math.max(tp, s.t0);
          const tipo = tipoV === 'activa' ? id : tipoV === 'vsync' ? 'vsync' : id === 'hsync' ? 'hsync' : 'borrado';
          if (!(fases.linea.length && fases.linea.at(-1) === lv && fases.k.at(-1) === idf(tipo))) { fases.t.push(t); fases.k.push(idf(tipo)); fases.linea.push(lv); }
          ponerSen(t, 'hsync', id === 'hsync' ? 0 : 1);
        }
        tp = fin;
      }
    }
  }
  for (let i = 0; i < x.sen.t.length; i++) if (dentro(x.sen.t[i]) || x.sen.t[i] === 0) { sen.t.push(x.sen.t[i]); sen.k.push(ids('ipl')); sen.v.push(x.sen.v[i]); }
  const ord = sen.t.map((_, i) => i).sort((a, b) => sen.t[a] - sen.t[b] || a - b);
  const senO = { t: ord.map((i) => sen.t[i]), k: ord.map((i) => sen.k[i]), v: ord.map((i) => sen.v[i]) };

  // video lines: dot 0 = first visible pixel (224 master cycles after the H sync starts), numbered from the first
  // visible line (raster $110)
  const lineasV = { t: [], n: [] };
  for (const s of segs) {
    for (let la = Math.floor(s.t0 / LINEA) - 1; la * LINEA < s.t1; la++) {
      const t = la * LINEA + 224 * 2;
      if (t + LINEA <= s.t0 || t >= s.t1) continue;
      lineasV.t.push(Math.max(0, t));   // the first, partial line of the start-up segment starts at 0
      lineasV.n.push(((0xf8 + (la % 264)) - 0x110 + 264) % 264);
    }
  }
  const bus = (id, b, anchoA, anchoD) => ({
    [id + '_t']: { tipo: 'u32', cod: 'vlqd', datos: b.t },
    [id + '_a']: { tipo: anchoA > 16 ? 'u32' : 'u16', cod: 'vlqd', datos: b.a },
    [id + '_d']: { tipo: anchoD > 16 ? 'u32' : anchoD > 8 ? 'u16' : 'u8', cod: 'crudo', datos: b.d },
    [id + '_f']: { tipo: 'u8', cod: 'crudo', datos: b.f },
    [id + '_c']: { tipo: 'u8', cod: 'crudo', datos: b.c },
    [id + '_k']: { tipo: 'u8', cod: 'crudo', datos: b.k },
  });
  const nombres = (id) => ({ t: id + '_t', a: id + '_a', d: id + '_d', f: id + '_f', c: id + '_c', k: id + '_k' });
  const arrays = {
    ...bus('m68k', m, 24, 16), ...bus('lenta', lenta, 15, 16), ...bus('rapida', rapida, 16, 16),
    ...bus('crom', crom, 24, 32), ...bus('srom', srom, 17, 8),
    i68_t: { tipo: 'u32', cod: 'vlqd', datos: ins.t }, i68_pc: { tipo: 'u32', cod: 'vlqd', datos: ins.pc },
    i68_ciclo: { tipo: 'u32', cod: 'vlqd', datos: ins.ciclo }, i68_k: { tipo: 'u8', cod: 'crudo', datos: ins.k },
    fase_t: { tipo: 'u32', cod: 'vlqd', datos: fases.t }, fase_k: { tipo: 'u8', cod: 'crudo', datos: fases.k },
    fase_linea: { tipo: 'u16', cod: 'vlqd', datos: fases.linea },
    sen_t: { tipo: 'u32', cod: 'vlqd', datos: senO.t }, sen_k: { tipo: 'u8', cod: 'crudo', datos: senO.k }, sen_v: { tipo: 'u8', cod: 'crudo', datos: senO.v },
    px_t: { tipo: 'u32', cod: 'vlqd', datos: px.t }, px_c: { tipo: 'u8', cod: 'vlqd', datos: px.c },
    lin_t: { tipo: 'u32', cod: 'vlqd', datos: lineasV.t }, lin_n: { tipo: 'u16', cod: 'vlqd', datos: lineasV.n },
    fb: { tipo: 'u8', cod: 'crudo', datos: fb },
  };
  for (const m of memoria) arrays[m.array] = { tipo: 'u8', cod: 'crudo', datos: m.datos };
  for (const r of REG68) arrays['i68_r_' + r] = { tipo: r === 'SR' ? 'u16' : 'u32', cod: 'vlqd', datos: ins.r[r] };
  const manifiesto = {
    maquina: 'neogeo',
    idPrograma,
    titulo,
    tipo,
    generador: {
      emulador: 'contenido/fotograma/neogeo/ng_traza.cpp: Moira (68000, MIT) + modelo propio de la LSPC',
      detalle: '68000 como en la Mega Drive (SingleStepTests 680x0). La LSPC no tiene un núcleo libre con su temporización: es un modelo propio del reparto de accesos que documenta wiki.neogeodev.org («Rendering logic», con el análisis de sprites aún en borrador; «Display timing»), con la interrupción vertical en el instante de MAME. La imagen se compone a partir de esos mismos accesos.',
    },
    reloj: { hz: HZ, nombre: 'medio ciclo del reloj maestro de 24 MHz' },
    cpus: [{ id: 'm68k', tipo: '68000', titulo: '68000 (U3)', hz: 12000000, unidadesPorCiclo: 4, registros: REG68 }],
    buses: [
      { id: 'm68k', titulo: 'Bus del 68000', anchoDir: 24, anchoDato: 16, ...nombres('m68k'), chips: CHIPS_68K_NG, tipos: TIPOS_68K_NG, duracion: 16 },
      { id: 'lenta', titulo: 'LSPC ↔ VRAM lenta (U17, U18)', anchoDir: 15, anchoDato: 16, ...nombres('lenta'), chips: [{ id: 'vram-lenta', titulo: 'VRAM lenta: 32 K palabras (U17, U18)' }], tipos: TIPOS_LENTA, duracion: 8 },
      { id: 'rapida', titulo: 'LSPC ↔ VRAM rápida (U19, U20)', anchoDir: 16, anchoDato: 16, ...nombres('rapida'), chips: [{ id: 'vram-rapida', titulo: 'VRAM rápida: 2 K palabras (U19, U20)' }], tipos: TIPOS_RAPIDA, duracion: 3 },
      { id: 'crom', titulo: 'ROM C del cartucho → NEO-B1 (32 bits)', anchoDir: 24, anchoDato: 32, ...nombres('crom'), chips: [{ id: 'crom', titulo: 'ROM C1 y C2 del cartucho' }], tipos: [{ id: 'patron', titulo: '8 puntos de una línea de sprite (C1: planos 0 y 1, C2: planos 2 y 3)' }], duracion: 16 },
      { id: 'srom', titulo: 'ROM S del cartucho → NEO-B1 (8 bits)', anchoDir: 17, anchoDato: 8, ...nombres('srom'), chips: [{ id: 'srom', titulo: 'ROM S1 del cartucho' }], tipos: [{ id: 'fija', titulo: '2 puntos de la capa fija' }], duracion: 16 },
    ],
    instrucciones: [{ cpu: 'm68k', t: 'i68_t', pc: 'i68_pc', ciclo: 'i68_ciclo', k: 'i68_k', r: REG68.map((r) => 'i68_r_' + r) }],
    video: { ancho: 320, alto: 224, puntosPorLinea: 384, lineas: 264, primeraVisible: 0, formato: 'indice', paleta, t0Cuadro: x.t0, unidadesPorPunto: 8, lineasT: 'lin_t', lineasN: 'lin_n' },
    fases: { tipos: FASES_NG, t: 'fase_t', k: 'fase_k', linea: 'fase_linea' },
    senales: { tipos: SENALES_NG, t: 'sen_t', k: 'sen_k', v: 'sen_v' },
    pixeles: { t: 'px_t', c: 'px_c' },
    fb: 'fb',
    segmentos: segs.map((s) => ({ ...s, pixel0: 0, pixel1: s.id === 'fotograma' ? px.t.length : 0 })),
    memoria: memoria.map(({ nombre, array, base }) => ({ nombre, array, base })),
    programa,
  };
  mkdirSync(SALIDA, { recursive: true });
  const bytes = escribirTraza(salida, manifiesto, arrays);
  console.log(`neogeo/${idPrograma}: ${m.t.length} ciclos del 68000, ${lenta.t.length} + ${rapida.t.length} accesos a la VRAM, ${crom.t.length} a la ROM C, ${srom.t.length} a la ROM S, ${ins.t.length} instrucciones, ${px.t.length} píxeles, ${(bytes / 1024).toFixed(0)} kB`);
  return bytes;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generarNg({ tmp: process.env.FOTOGRAMA_TMP ?? join(RAIZ, 'contenido/.cache/fotograma/bin') });
}
