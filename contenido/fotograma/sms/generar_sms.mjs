// «Un fotograma» trace of the Master System II: runs the native tool sms_traza (Z80 = floooh's z80.h, VDP =
// BlastEm's, see ../vdp and ../z80) on the demo and on the homebrew games of contenido/fotograma/juegos.json
// («maquina»: «sms») and writes web/public/consolas/fotograma/sms/<programa>.bin and indice.json.
// Usage: node contenido/fotograma/sms/generar_sms.mjs   (builds the tools with ../nucleos_b.mjs if needed)

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escribirTraza } from '../traza.mjs';
import { copiarLicencias, infoJuego, ejecutarTraza, explicacionesDeListado, hex, juegosDe, leerExplicacionesB, leerListado, leerSimbolos } from '../comun_b.mjs';
import { herramientas } from '../nucleos_b.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../../..');
const DEMO = join(RAIZ, 'contenido/consolas_demos/sms');
const SALIDA = join(RAIZ, 'web/public/consolas/fotograma/sms');

const MCLK = 53203424;          // PAL oscillator
const LINEA = 3420;             // master cycles per line (342 pixels × 10)
const PUNTO = 10;               // master cycles per pixel

// Video timing of the 315-5246 in the 192-line PAL mode (Charles MacDonald, «msvdp.txt»): pixels of a line from
// the first visible one, and lines of the frame from the first visible one.
const TRAMOS_H = [['activa', 256], ['borde', 15], ['borrado', 8], ['hsync', 26], ['borrado', 2], ['salva', 14], ['borrado', 8], ['borde', 13]];
const TRAMOS_V = [['activa', 192], ['borde', 48], ['borrado', 3], ['vsync', 3], ['borrado', 13], ['borde', 54]];
export const FASES_SMS = [
  { id: 'activa', titulo: 'Imagen' },
  { id: 'borde', titulo: 'Borde' },
  { id: 'borrado', titulo: 'Borrado' },
  { id: 'hsync', titulo: 'Sincronismo horizontal' },
  { id: 'salva', titulo: 'Salva de color' },
  { id: 'vsync', titulo: 'Sincronismo vertical' },
];
export const SENALES_SMS = [
  { id: 'int', titulo: '/INT', activaBaja: true },
  { id: 'sync', titulo: '/SYNC', activaBaja: true },
];
export const CHIPS_Z80 = [
  { id: 'ninguno', titulo: 'Nadie (refresco o ciclo interno)' },
  { id: 'cartucho', titulo: 'ROM del cartucho (CN1, /CE3)' },
  { id: 'ram', titulo: 'RAM de trabajo (IC3, /CE1)' },
  { id: 'vdp', titulo: 'VDP 315-5246 (IC5)' },
  { id: 'psg', titulo: 'PSG del VDP (IC5)' },
  { id: 'io', titulo: '315-5237 (IC4): puertos $3E/$3F y mandos' },
];
export const TIPOS_Z80 = [
  { id: 'm1', titulo: 'Lectura del código de operación (M1)' },
  { id: 'lectura', titulo: 'Lectura de memoria' },
  { id: 'escritura', titulo: 'Escritura en memoria' },
  { id: 'es-lectura', titulo: 'Lectura de E/S (IN)' },
  { id: 'es-escritura', titulo: 'Escritura de E/S (OUT)' },
  { id: 'refresco', titulo: 'Refresco (/RFSH)' },
  { id: 'int-ack', titulo: 'Reconocimiento de interrupción' },
];
export const CHIPS_VRAM = [
  { id: 'vram', titulo: 'VRAM: IC6 (pares) e IC7 (impares) a la vez' },
  { id: 'vram-par', titulo: 'VRAM IC6 (bytes pares)' },
  { id: 'vram-impar', titulo: 'VRAM IC7 (bytes impares)' },
];
export const TIPOS_VRAM = [
  { id: 'nombre', titulo: 'Tabla de nombres (casilla)' },
  { id: 'patron', titulo: 'Patrón del fondo' },
  { id: 'spr-y', titulo: 'Búsqueda de sprites (Y)' },
  { id: 'spr-x', titulo: 'Sprite: X y patrón' },
  { id: 'spr-patron', titulo: 'Patrón del sprite' },
  { id: 'cpu', titulo: 'Acceso del Z80 (puerto $BE)' },
  { id: 'refresco', titulo: 'Refresco' },
];
// master cycles each kind of Z80 access lasts (M1: T1-T2, its refresh T3-T4; I/O with its automatic wait state)
export const DURACIONES_Z80 = [30, 45, 45, 60, 60, 30, 60];
const REGISTROS = ['A', 'F', 'B', 'C', 'D', 'E', 'H', 'L', 'IX', 'IY', 'SP', 'I'];

// BlastEm keeps the 16 KB of mode 4 in the Mega Drive's layout: bits 1 and 9 swapped, bytes of a word swapped.
const desdeBlastem = (a) => (((a & 0x3dfd) | ((a << 8) & 0x200) | ((a >> 8) & 2)) ^ 1) & 0x3fff;
const ETQ = { MAPA: 1, PATRON: 2, SPR_PATRON: 4, SPR_TABLA: 8, SPR_X: 16, EXTERNO: 32 };

function construirDemo(tmp) {
  try {
    execFileSync('z80-unknown-coff-as', ['--version'], { stdio: 'ignore' });
    execFileSync('sh', [join(DEMO, 'build.sh'), tmp], { stdio: 'inherit' });
    for (const f of ['demo.sms', 'demo.lst', 'demo.sym']) copyFileSync(join(tmp, f), join(DEMO, f));
    console.log('sms: demo.s ensamblado con binutils-z80');
  } catch {
    console.log('sms: sin binutils-z80: se usa el demo.sms guardado');
  }
}

export function generarSms({ tmp, cuadrosPrevios = 2 }) {
  mkdirSync(tmp, { recursive: true });
  construirDemo(tmp);
  const { sms_traza } = herramientas(tmp);
  const listado = leerListado(join(DEMO, 'demo.lst'));
  const simbolos = leerSimbolos(join(DEMO, 'demo.sym'), 0xffff);
  const dirDe = Object.fromEntries(Object.entries(simbolos).map(([d, n]) => [n, parseInt(d, 16)]));
  const { explicaciones, lineas } = explicacionesDeListado(listado, leerExplicacionesB(join(DEMO, 'explicaciones.es.txt')));
  const rom = readFileSync(join(DEMO, 'demo.sms'));
  const dirHalt = listado.find((e) => /^halt\b/.test(e.texto)).dir;
  const x = ejecutarTraza(sms_traza, [join(DEMO, 'demo.sms'), String(cuadrosPrevios), String(dirHalt)]);

  const tFinArranque = x.t_halt + 4 * 15;
  const segs0 = [
    { id: 'arranque', titulo: 'Desde la entrada del cartucho', descripcion: 'El Z80 empieza en $0000 del cartucho (la ROM de arranque de Sega ya lo ha comprobado y se ha apagado): prepara la pila, los registros del VDP, la paleta, los patrones, la tabla de nombres y el sprite, enciende la imagen y se duerme en HALT.', t0: 0, t1: tFinArranque },
    { id: 'fotograma', titulo: 'Un cuadro completo (PAL)', descripcion: `El cuadro ${cuadrosPrevios + 1} tras encender la imagen, de la primera línea visible a la siguiente: 192 líneas de imagen que el VDP lee de la VRAM mientras el Z80 duerme, el borde, la interrupción de cuadro en la que el Z80 mueve la pelota, y el sincronismo vertical. 313 líneas de 342 puntos.`, t0: x.t0, t1: x.t1 },
  ];
  const bytes = escribirSms({
    x, segs: segs0, rom, idPrograma: 'demo', titulo: 'Paso a paso', tipo: 'demo', salida: join(SALIDA, 'demo.bin'),
    programa: { fuente: 'contenido/consolas_demos/sms/demo.s', licencia: 'CC0 1.0', autor: 'Demostración escrita para esta aplicación', etiquetas: simbolos, explicaciones, lineas },
  });
  const programas = [{ id: 'demo', titulo: 'Paso a paso', tipo: 'demo', archivo: 'demo.bin', bytes, resumen: 'Demostración propia: un fondo de cielo, hierba y ladrillos y una pelota (sprite) que avanza un punto por cuadro.' }];
  for (const j of juegosDe('sms')) programas.push(generarJuegoSms(sms_traza, j));
  writeFileSync(join(SALIDA, 'indice.json'), JSON.stringify({ version: 1, programas }, null, 1));
  return { bytes, dirDe };
}

/** «Un juego de verdad» on the Master System: the cartridge from its entry point, the frame «cuadro» since reset. */
export function generarJuegoSms(sms_traza, j) {
  const cuadro = j.cuadro ?? 300;
  const arranque = j.arranque ?? 3000;
  const bits = { arriba: 1, abajo: 2, izquierda: 4, derecha: 8, '1': 16, '2': 32 };
  const guion = (j.entradas ?? []).map(([c, b]) => `${c}:${String(b).split('+').filter(Boolean).reduce((m, k) => m | (bits[k] ?? 0), 0)}`).join(',');
  const rutaRom = join(RAIZ, j.rom);
  const args = [rutaRom, String(cuadro), '--juego', String(arranque)];
  if (guion) args.push(guion);
  const x = ejecutarTraza(sms_traza, args);
  const segs = [
    { id: 'arranque', titulo: 'Tras el reset', descripcion: `Los primeros ${arranque} estados T del Z80 desde $0000 del cartucho (la ROM de arranque de Sega ya lo ha comprobado y se ha apagado): el arranque de devkitSMS prepara la pila, el modo de interrupción y el paginador y empieza a borrar la RAM.`, t0: 0, t1: x.t_halt },
    { id: 'fotograma', titulo: 'Un cuadro completo (PAL)', descripcion: `El cuadro ${cuadro} desde el reset, de la primera línea visible a la siguiente: 313 líneas de 342 puntos. ${j.descripcion ?? ''}`.trim(), t0: x.t0, t1: x.t1 },
  ];
  const archivo = `${j.id}.bin`;
  const simbolos = j.simbolos ? leerSimbolosNoi(join(RAIZ, j.simbolos)) : {};
  const bytes = escribirSms({
    x, segs, rom: readFileSync(rutaRom), idPrograma: j.id, titulo: 'Un juego de verdad', tipo: 'juego', salida: join(SALIDA, archivo),
    programa: { fuente: j.url, licencia: j.licencia, autor: j.autor, url: j.url, nombre: j.nombre, etiquetas: simbolos, explicaciones: {}, lineas: {} },
  });
  copiarLicencias(j, SALIDA);
  return { id: j.id, titulo: 'Un juego de verdad', tipo: 'juego', archivo, bytes, resumen: `${j.nombre}, de ${j.autor} (${j.licencia}).`, juego: infoJuego(j) };
}

/** Symbols of an SDCC .noi file («DEF _name 0x1234»): the C functions, without the leading underscore. */
function leerSimbolosNoi(ruta) {
  const out = {};
  for (const l of readFileSync(ruta, 'utf8').split('\n')) {
    const m = /^DEF (\w+) 0x([0-9A-Fa-f]+)$/.exec(l.trim());
    if (!m || !m[1].startsWith('_') || m[1].startsWith('__') || /^_?s__|^_?l__/.test(m[1])) continue;
    const a = parseInt(m[2], 16);
    if (a < 0x8000) out[hex(a)] = m[1].slice(1);
  }
  return out;
}

function escribirSms({ x, segs, rom, idPrograma, titulo, tipo, salida, programa }) {
  const dentro = (t) => segs.some((s) => t >= s.t0 && t < s.t1);

  // ---- Z80 bus and instructions
  const z = { t: [], a: [], d: [], f: [], c: [], k: [] };
  const indice = new Map();
  for (let i = 0; i < x.z80.t.length; i++) {
    if (!dentro(x.z80.t[i])) continue;
    indice.set(i, z.t.length);
    for (const c of ['t', 'a', 'd', 'f', 'c', 'k']) z[c].push(x.z80[c][i]);
  }
  const ins = { t: [], pc: [], ciclo: [], k: [], r: Object.fromEntries(REGISTROS.map((r) => [r, []])) };
  const intacks = [];
  for (let i = 0; i < z.t.length; i++) if (z.k[i] === 6) intacks.push(i);
  let ia = 0;
  const ponerIntack = () => {
    const i = intacks[ia++];
    const prev = ins.t.length - 1;
    ins.t.push(z.t[i]);
    ins.pc.push(z.a[i]);
    ins.ciclo.push(i);
    ins.k.push(2);
    for (const r of REGISTROS) ins.r[r].push(prev >= 0 ? ins.r[r][prev] : 0);
  };
  for (let i = 0; i < x.ins.t.length; i++) {
    const t = x.ins.t[i];
    if (!dentro(t)) continue;
    while (ia < intacks.length && z.t[intacks[ia]] < t) ponerIntack();
    ins.t.push(t);
    ins.pc.push(x.ins.pc[i]);
    ins.ciclo.push(indice.get(x.ins.ciclo[i]) ?? z.t.length);
    ins.k.push(0);
    for (const r of REGISTROS) ins.r[r].push(x.ins[r][i]);
  }
  while (ia < intacks.length) ponerIntack();

  // ---- VDP ↔ VRAM bus: one event per slot that reads (16 bits, both chips) or writes (8 bits, one chip)
  const v = { t: [], a: [], d: [], f: [], c: [], k: [] };
  const vr = (t, a, d, f, c, k) => {
    v.t.push(t); v.a.push(a); v.d.push(d); v.f.push(f); v.c.push(c); v.k.push(k);
  };
  const R = x.ranuras;
  for (let i = 0; i < R.t.length; i++) {
    const t = R.t[i];
    if (!dentro(t)) continue;
    const etq = R.etiquetas[i];
    if (R.n[i] > 0) {
      const k = etq & ETQ.MAPA ? 0 : etq & ETQ.PATRON ? 1 : etq & ETQ.SPR_TABLA ? 2 : etq & ETQ.SPR_X ? 3 : etq & ETQ.SPR_PATRON ? 4 : 5;
      const a0 = desdeBlastem(R.dir[i]);
      const b0 = R.val[i] & 0xff;
      const b1 = (R.val[i] >> 8) & 0xff;
      // the two bytes of a word: even (IC6, AD0–AD7) and odd (IC7, AD8–AD15)
      const par = a0 & ~1;
      const d = R.n[i] > 1 ? (a0 & 1 ? b0 << 8 | b1 : b1 << 8 | b0) : (a0 & 1 ? b0 << 8 : b0);
      vr(t, par, d, 0, 0, k);
    }
    if (R.esc_dir1[i] > 0) {
      const a = ((R.esc_dir1[i] - 1) ^ 1) & 0x3fff;   // the write hook sees the address before the layout change
      vr(t, a, R.esc_val[i] & 0xff, 1, a & 1 ? 2 : 1, 5);
    }
    if (!etq && R.n[i] === 0 && R.esc_dir1[i] === 0) vr(t, 0, 0, 0, 0, 6);
  }

  // ---- pixels of the recorded frame and the emulator's frame buffer (256 × 192 visible area)
  const paleta = x.paleta;
  const color = new Map(paleta.map((rgb, i) => [rgb, i]));
  const filaFb = (r) => 54 + r;          // BlastEm puts 54 border lines above the picture (PAL, 192 lines)
  const P = x.pixeles;
  const tPar = new Map();                 // `${row},${xbuf}` -> time of the slot that outputs that pair
  for (let i = 0; i < P.t.length; i++) if (P.t[i] >= x.t0 && P.t[i] < x.t1) tPar.set(`${P.fila[i]},${P.x[i]}`, P.t[i]);
  const px = { t: [], c: [] };
  const fb = [];
  for (let r = 0; r < 192; r++) {
    for (let c = 0; c < 256; c++) {
      const xb = 13 + c;                 // 13 border pixels on the left of the line buffer
      const base = xb & ~1;
      const t = tPar.get(`${filaFb(r)},${base}`);
      if (t === undefined) throw new Error(`sms: falta el instante del punto (${c}, ${r})`);
      const rgb = x.fb[filaFb(r) * 300 + xb];
      const k = color.get(rgb);
      if (k === undefined) throw new Error(`sms: color ${rgb.toString(16)} fuera de la paleta`);
      px.t.push(t + (xb & 1) * PUNTO);
      px.c.push(k);
      fb.push(k);
    }
  }
  const P0 = px.t[0];                    // first visible pixel of the frame

  // ---- phases and synchronisation, from the documented line and frame layout
  const fases = { t: [], k: [], linea: [] };
  const sen = { t: [], k: [], v: [] };
  const idFase = (id) => FASES_SMS.findIndex((f) => f.id === id);
  const lineasV = [];
  for (const [id, n] of TRAMOS_V) for (let i = 0; i < n; i++) lineasV.push(id);
  const ponerFase = (t, k, l) => {
    if (fases.k.length && fases.k[fases.k.length - 1] === k && fases.linea[fases.linea.length - 1] === l) return;
    fases.t.push(t); fases.k.push(k); fases.linea.push(l);
  };
  let syncPrevio = 1;
  const ponerSync = (t, nivel) => {
    if (nivel === syncPrevio) return;
    sen.t.push(t); sen.k.push(1); sen.v.push(nivel); syncPrevio = nivel;
  };
  for (const s of segs) {
    // first line whose pixel 0 is at or before the segment start
    let n = Math.floor((s.t0 - P0) / LINEA);
    for (; P0 + n * LINEA < s.t1; n++) {
      const tl = P0 + n * LINEA;
      const lv = ((n % 313) + 313) % 313;
      const tipoV = lineasV[lv];
      let tp = tl;
      for (const [id, ancho] of TRAMOS_H) {
        // the kind of each stretch of the line depends on the kind of line (picture, border, blanking, sync)
        const tipo = tipoV === 'activa' ? id : tipoV === 'borde' ? (id === 'activa' ? 'borde' : id) : tipoV === 'borrado' ? (id === 'hsync' ? 'hsync' : 'borrado') : 'vsync';
        // /SYNC: low in the horizontal sync pulse; in the vertical sync lines low except there (serration)
        const sync = tipoV === 'vsync' ? (id === 'hsync' ? 1 : 0) : id === 'hsync' ? 0 : 1;
        const fin = tp + ancho * PUNTO;
        if (fin > s.t0 && tp < s.t1) {
          const t = Math.max(tp, s.t0);
          ponerFase(t, idFase(tipo), lv);
          ponerSync(t, sync);
        }
        tp = fin;
      }
    }
  }
  for (let i = 0; i < x.sen.t.length; i++) if (dentro(x.sen.t[i]) || i === 0) { sen.t.push(x.sen.t[i]); sen.k.push(0); sen.v.push(x.sen.v[i]); }
  const orden = sen.t.map((_, i) => i).sort((a, b) => sen.t[a] - sen.t[b] || a - b);
  const senO = { t: orden.map((i) => sen.t[i]), k: orden.map((i) => sen.k[i]), v: orden.map((i) => sen.v[i]) };

  // ---- video lines: start = first visible pixel of each line (dot 0), numbered from the first visible line
  const lineasVideo = { t: [], n: [] };
  for (const s of segs) {
    for (let n = Math.floor((s.t0 - P0) / LINEA); P0 + n * LINEA < s.t1; n++) {
      if (P0 + (n + 1) * LINEA <= s.t0) continue;
      lineasVideo.t.push(Math.max(0, P0 + n * LINEA));   // the first, partial line of the start-up segment starts at 0
      lineasVideo.n.push(((n % 313) + 313) % 313);
    }
  }

  // ---- manifest
  const segmentos = segs.map((s) => ({ ...s, pixel0: s.id === 'fotograma' ? 0 : 0, pixel1: s.id === 'fotograma' ? px.t.length : 0 }));
  const etiquetas = Object.fromEntries(Object.entries(programa.etiquetas).filter(([d]) => parseInt(d, 16) < 0x8000));
  const arrays = {
    z80_t: { tipo: 'u32', cod: 'vlqd', datos: z.t }, z80_a: { tipo: 'u16', cod: 'vlqd', datos: z.a },
    z80_d: { tipo: 'u8', cod: 'crudo', datos: z.d }, z80_f: { tipo: 'u8', cod: 'crudo', datos: z.f },
    z80_c: { tipo: 'u8', cod: 'crudo', datos: z.c }, z80_k: { tipo: 'u8', cod: 'crudo', datos: z.k },
    vram_t: { tipo: 'u32', cod: 'vlqd', datos: v.t }, vram_a: { tipo: 'u16', cod: 'vlqd', datos: v.a },
    vram_d: { tipo: 'u16', cod: 'crudo', datos: v.d }, vram_f: { tipo: 'u8', cod: 'crudo', datos: v.f },
    vram_c: { tipo: 'u8', cod: 'crudo', datos: v.c }, vram_k: { tipo: 'u8', cod: 'crudo', datos: v.k },
    ins_t: { tipo: 'u32', cod: 'vlqd', datos: ins.t }, ins_pc: { tipo: 'u16', cod: 'vlqd', datos: ins.pc },
    ins_ciclo: { tipo: 'u32', cod: 'vlqd', datos: ins.ciclo }, ins_k: { tipo: 'u8', cod: 'crudo', datos: ins.k },
    fase_t: { tipo: 'u32', cod: 'vlqd', datos: fases.t }, fase_k: { tipo: 'u8', cod: 'crudo', datos: fases.k },
    fase_linea: { tipo: 'u16', cod: 'vlqd', datos: fases.linea },
    sen_t: { tipo: 'u32', cod: 'vlqd', datos: senO.t }, sen_k: { tipo: 'u8', cod: 'crudo', datos: senO.k },
    sen_v: { tipo: 'u8', cod: 'crudo', datos: senO.v },
    px_t: { tipo: 'u32', cod: 'vlqd', datos: px.t }, px_c: { tipo: 'u8', cod: 'vlqd', datos: px.c },
    lin_t: { tipo: 'u32', cod: 'vlqd', datos: lineasVideo.t }, lin_n: { tipo: 'u16', cod: 'vlqd', datos: lineasVideo.n },
    fb: { tipo: 'u8', cod: 'crudo', datos: fb },
    mem_rom: { tipo: 'u8', cod: 'crudo', datos: rom },
  };
  for (const r of REGISTROS) arrays['ins_r_' + r] = { tipo: r === 'IX' || r === 'IY' || r === 'SP' ? 'u16' : 'u8', cod: 'crudo', datos: ins.r[r] };
  const manifiesto = {
    maquina: 'sms',
    idPrograma,
    titulo,
    tipo,
    generador: {
      emulador: 'contenido/fotograma/sms/sms_traza.c: z80.h de floooh (zlib) + VDP de BlastEm (GPL-3), fuera de línea',
      detalle: 'Z80 ciclo a ciclo comparado con SingleStepTests/z80 (50 códigos, 50 000 pruebas, 130 000 accesos al bus con su dirección, dato y ciclo; solo difieren banderas no documentadas de LDIR y OTIR). VDP en modo 4 ranura a ranura (BlastEm, con el contador V de PAL de msvdp.txt). Sincronismos según msvdp.txt.',
    },
    reloj: { hz: MCLK, nombre: 'ciclo del oscilador de 53,203424 MHz' },
    cpus: [{ id: 'z80', tipo: 'z80', titulo: 'Z80A (IC1)', hz: MCLK / 15, unidadesPorCiclo: 15, registros: REGISTROS }],
    buses: [
      { id: 'z80', titulo: 'Bus del Z80', anchoDir: 16, anchoDato: 8, t: 'z80_t', a: 'z80_a', d: 'z80_d', f: 'z80_f', c: 'z80_c', k: 'z80_k', chips: CHIPS_Z80, tipos: TIPOS_Z80, duracion: 45, duraciones: DURACIONES_Z80 },
      { id: 'vram', titulo: 'Bus AD del VDP con la VRAM', anchoDir: 14, anchoDato: 16, t: 'vram_t', a: 'vram_a', d: 'vram_d', f: 'vram_f', c: 'vram_c', k: 'vram_k', chips: CHIPS_VRAM, tipos: TIPOS_VRAM, duracion: 20 },
    ],
    instrucciones: [{ cpu: 'z80', t: 'ins_t', pc: 'ins_pc', ciclo: 'ins_ciclo', k: 'ins_k', r: REGISTROS.map((r) => 'ins_r_' + r) }],
    video: { ancho: 256, alto: 192, puntosPorLinea: 342, lineas: 313, primeraVisible: 0, formato: 'indice', paleta, t0Cuadro: x.t0, unidadesPorPunto: PUNTO, lineasT: 'lin_t', lineasN: 'lin_n' },
    fases: { tipos: FASES_SMS, t: 'fase_t', k: 'fase_k', linea: 'fase_linea' },
    senales: { tipos: SENALES_SMS, t: 'sen_t', k: 'sen_k', v: 'sen_v' },
    pixeles: { t: 'px_t', c: 'px_c' },
    fb: 'fb',
    segmentos,
    memoria: [{ nombre: 'ROM del cartucho', array: 'mem_rom', base: 0 }],
    programa: { ...programa, etiquetas },
  };
  mkdirSync(SALIDA, { recursive: true });
  const bytes = escribirTraza(salida, manifiesto, arrays);
  console.log(`sms/${idPrograma}: ${z.t.length} ciclos del Z80, ${v.t.length} accesos a la VRAM, ${ins.t.length} instrucciones, ${px.t.length} píxeles, ${(bytes / 1024).toFixed(0)} kB`);
  return bytes;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generarSms({ tmp: process.env.FOTOGRAMA_TMP ?? join(RAIZ, 'contenido/.cache/fotograma/sms') });
}
