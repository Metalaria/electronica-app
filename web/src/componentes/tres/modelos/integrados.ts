// Integrated circuit packages (figures 5.2, 8.1, 8.8, 9.3; book 8.5, 45.4): DIP (also the bridge rectifier and
// the optocoupler), SOIC, LQFP and QFN, with the lead frame, the die on its paddle and the gold bond wires
// that a decapped package shows from above.

import { BoxGeometry, Group, Matrix4, MeshStandardMaterial, Color, Vector3 } from 'three';
import {
  ACABADOS,
  alaGaviota,
  caja,
  cilindro,
  colocar,
  finPatilla,
  hilos,
  instancias,
  malla,
  material,
  lineasMarcado,
  materialTextura,
  mt,
  parte,
  rotulo,
  texturaDado,
  unir,
  type Constructor,
  type Ctx,
} from './comun';
import type { DatosModelo, Pad } from './tipos';

type Res = { g: Group; datos: Partial<DatosModelo> };
type V3 = [number, number, number];

const ORO = ACABADOS.oro;
const MARCO = { color: '#c9b08a', metal: 1, rugosidad: 0.3 };

interface InfoCI {
  lineas: string[];
  dado: [number, number];
  semilla: number;
  et: string;
  ref?: string;
}

const CIS: Record<string, InfoCI> = {
  NE555P: { lineas: ['NE555P', 'TI 2309'], dado: [1.6, 1.4], semilla: 555, et: 'Temporizador NE555', ref: 'sec-8.5' },
  NE555D: { lineas: ['NE555', 'TI 309'], dado: [1.6, 1.4], semilla: 555, et: 'Temporizador NE555', ref: 'sec-8.5' },
  LM358N: { lineas: ['LM358N', 'ON 2310'], dado: [1.3, 1.1], semilla: 358, et: 'Doble operacional LM358', ref: 'sec-8.1' },
  LM358D: { lineas: ['LM358', 'ON 310'], dado: [1.3, 1.1], semilla: 358, et: 'Doble operacional LM358', ref: 'sec-8.1' },
  TL072CP: { lineas: ['TL072CP', 'TI 2311'], dado: [1.5, 1.3], semilla: 72, et: 'Doble operacional JFET TL072', ref: 'sec-8.1' },
  CD4069UBE: { lineas: ['CD4069UBE', 'TI 2308'], dado: [1.4, 1.4], semilla: 4069, et: 'Seis inversores CMOS', ref: 'sec-9.3' },
  SN74HC00N: { lineas: ['SN74HC00N', 'TI 2307'], dado: [1.2, 1.2], semilla: 7400, et: 'Cuatro NAND 74HC00', ref: 'sec-9.3' },
  SN74HC14D: { lineas: ['HC14', 'TI 307'], dado: [1.3, 1.2], semilla: 7414, et: 'Seis inversores Schmitt 74HC14', ref: 'sec-9.3' },
  ATMEGA328P: { lineas: ['ATMEGA328P', '-PU 2312'], dado: [3.0, 3.0], semilla: 328, et: 'Microcontrolador ATmega328P' },
  ADS1115: { lineas: ['ADS1115', 'BOGI'], dado: [1.6, 1.6], semilla: 1115, et: 'Convertidor A/D ADS1115' },
  STM32F103: { lineas: ['STM32F103', 'C8T6', 'GH2XQ 93'], dado: [3.4, 3.4], semilla: 103, et: 'Microcontrolador STM32F103' },
  ATMEGA32U4: { lineas: ['ATMEGA', '32U4-MU', '2311'], dado: [3.0, 3.0], semilla: 324, et: 'Microcontrolador ATmega32U4' },
  DB107: { lineas: ['DB107'], dado: [1.0, 1.0], semilla: 107, et: 'Puente rectificador' },
};

function infoCI(ref: string): InfoCI {
  // Exact reference, or one of the same family («NE555» → NE555P, «STM32F103C8T6» → STM32F103) printed as given.
  const r = ref.toUpperCase();
  const pariente = CIS[ref] ?? Object.entries(CIS).find(([k]) => r.startsWith(k) || k.startsWith(r))?.[1];
  if (pariente && !CIS[ref]) return { ...pariente, lineas: [ref.slice(0, 12), ...pariente.lineas.slice(1)] };
  return pariente ?? { lineas: [ref.slice(0, 12)], dado: [1.5, 1.5], semilla: ref.length * 97, et: ref };
}

/** Lead frame fingers (flat strips) from each lead's inner end towards the paddle. */
function dedos(ctx: Ctx, puntas: { de: V3; a: V3; ancho: number }[], grosor: number) {
  const geo = ctx.rec.geometria('caja-unidad', () => new BoxGeometry(1, 1, 1));
  const ms: Matrix4[] = puntas.map(({ de, a, ancho }) => {
    const dx = a[0] - de[0];
    const dy = a[1] - de[1];
    const len = Math.hypot(dx, dy);
    return mt((de[0] + a[0]) / 2, (de[1] + a[1]) / 2, (de[2] + a[2]) / 2, Math.atan2(dy, dx), len, ancho, grosor);
  });
  return instancias(geo, material(ctx, MARCO), ms);
}

// ------------------------------------------------------------------ DIP

export interface OpcionesDip {
  pines: number;
  referencia: string;
  interior: 'ci' | 'opto' | 'puente';
  /** Row spacing (7,62 or 15,24). */
  fila?: number;
  encendido?: boolean;
  /** Free marking printed verbatim («|» separates lines). */
  marcado?: string;
}

export function dipGenerico(ctx: Ctx, o: OpcionesDip): Res {
  const n = Math.max(4, o.pines - (o.pines % 2));
  const porLado = n / 2;
  const F = o.fila ?? (n >= 24 && o.referencia !== 'ATMEGA328P' ? 15.24 : 7.62);
  const ancha = F > 10 || o.referencia === 'ATMEGA328P';
  const fila = ancha ? 7.62 : F;
  const Wb = o.interior === 'puente' ? 6.4 : 6.35;
  const Lb = o.interior === 'puente' ? 8.3 : (porLado - 1) * 2.54 + (o.interior === 'opto' ? 2.1 : 1.9);
  const paso = o.interior === 'puente' ? 5.08 : 2.54;
  const H = o.interior === 'puente' ? 3.4 : 3.3;
  const zb = 0.5;
  const info = infoCI(o.referencia);
  const g = new Group();
  const blanco = o.interior === 'opto' && n === 6;
  const matCuerpo = material(ctx, blanco ? { ...ACABADOS.plasticoBlanco, corte: '#d9d4c8' } : ACABADOS.epoxiNegro);
  const cuerpo = malla(caja(ctx, Wb, Lb, H, 0.3), matCuerpo);
  const grupoCuerpo = parte('cuerpo', {
    etiqueta:
      o.interior === 'puente'
        ? { texto: 'Cuerpo con los terminales marcados: + , − y los dos de alterna (~)', ref: 'sec-5.4', punto: [Wb / 2, Lb * 0.2, H * 0.4] }
        : { texto: `${info.et}: la muesca y el punto marcan la patilla 1`, ref: info.ref ?? 'fig-8.1', punto: [-Wb * 0.3, Lb / 2, H / 2] },
    explosion: [0, 0, H * 2.4],
  }, cuerpo);
  // Pin-1 notch (half disc at +Y) and dimple near pin 1.
  const oscuro = material(ctx, { color: blanco ? '#bdb8ad' : '#111214', rugosidad: 0.8 });
  if (o.interior !== 'puente') {
    const muesca = malla(cilindro(ctx, 0.9, 0.02, 24), oscuro);
    muesca.position.set(0, Lb / 2 - 0.02, H / 2 - 0.005);
    muesca.scale.y = 0.5;
    const punto = malla(cilindro(ctx, 0.45, 0.02, 20), oscuro);
    punto.position.set(-Wb / 2 + 1.0, Lb / 2 - 1.0, H / 2 - 0.005);
    grupoCuerpo.add(muesca, punto);
  }
  const lineas0 = o.interior === 'puente' ? ['~  +', 'DB107', '~  −'] : o.interior === 'opto' ? (n === 4 ? ['PC817', 'C 2309'] : ['4N35', '2309']) : info.lineas;
  const lineas = o.marcado ? lineasMarcado({ marcado: o.marcado }, lineas0, 12) : lineas0;
  const tx = rotulo(ctx, lineas, Lb * 0.78, Wb * 0.62, { color: blanco ? '#2a2a2a' : '#d6d9dd', peso: 600 });
  tx.rotation.z = -Math.PI / 2;
  tx.position.z = H / 2 + 0.004;
  grupoCuerpo.add(tx);
  g.add(colocar(grupoCuerpo, 0, 0, zb + H / 2));

  // Leads: shoulder from the body side, bent down, wide down to the seating plane, then the narrow pin.
  const zl = zb + H * 0.35;
  const zFin = finPatilla(ctx, 3.3);
  const geoPata = ctx.rec.geometria(`dip-pata:${fila}:${Wb}:${zl}:${zFin}:${o.interior === 'puente'}`, () => {
    const partes = [];
    if (o.interior === 'puente') {
      const b = new BoxGeometry(0.6, 0.6, zb + 0.6 - zFin);
      b.translate(0, 0, (zb + 0.6 + zFin) / 2);
      partes.push(b);
    } else {
      const x0 = Wb / 2 - 0.2;
      const x1 = fila / 2;
      const hombro = new BoxGeometry(x1 - x0 + 0.13, 1.52, 0.25);
      hombro.translate((x0 + x1) / 2, 0, zl);
      const baja = new BoxGeometry(0.25, 1.52, zl - 0.4);
      baja.translate(x1, 0, (zl + 0.4) / 2 - 0.01);
      const pin = new BoxGeometry(0.25, 0.46, 0.45 - zFin);
      pin.translate(x1, 0, (0.45 + zFin) / 2);
      partes.push(hombro, baja, pin);
    }
    const g2 = unir(ctx, partes);
    return g2;
  });
  const matP = material(ctx, ACABADOS.estano);
  const ms: Matrix4[] = [];
  const pads: Pad[] = [];
  const yPin = (i: number) => ((porLado - 1) / 2 - i) * paso;
  for (let i = 0; i < porLado; i++) {
    const izq = new Matrix4().makeRotationZ(Math.PI);
    if (o.interior === 'puente') izq.makeRotationZ(0).setPosition(-fila / 2, yPin(i), 0);
    else izq.setPosition(0, yPin(i), 0);
    ms.push(izq);
    ms.push(o.interior === 'puente' ? mt(fila / 2, yPin(i), 0) : mt(0, -yPin(i), 0));
    pads.push({ n: String(i + 1), x: -fila / 2, y: yPin(i), forma: i === 0 ? 'rect' : 'ovalo', w: 1.6, h: 1.6, taladro: 0.8 });
  }
  for (let i = 0; i < porLado; i++) pads.push({ n: String(porLado + i + 1), x: fila / 2, y: -yPin(i), forma: 'ovalo', w: 1.6, h: 1.6, taladro: 0.8 });
  g.add(parte('patillas', { etiqueta: { texto: o.interior === 'puente' ? 'Cuatro terminales a 5,08 × 7,62 mm' : `${n} patillas a 2,54 mm, filas a ${fila.toFixed(2).replace('.', ',')} mm`, ref: 'fig-5.2', punto: [-fila / 2, yPin(porLado - 1), 0.3] } }, instancias(geoPata, matP, ms)));

  // Inside.
  const zPad = zb + H * 0.35;
  if (o.interior === 'ci' && !ctx.bajo) {
    const [dw, dl] = info.dado;
    const pala = malla(caja(ctx, dw + 0.6, dl + 0.6, 0.2, 0.02), material(ctx, MARCO));
    pala.position.z = zPad;
    const dado = malla(caja(ctx, dw, dl, 0.25, 0.01), materialTextura(ctx, texturaDado(ctx, info.semilla, n), { metal: 0.4, rugosidad: 0.3 }));
    dado.position.z = zPad + 0.22;
    g.add(parte('dado', { etiqueta: { texto: 'Dado de silicio: el circuito, sobre su almohadilla', ref: info.ref ?? 'fig-9.3', punto: [dw * 0.3, -dl * 0.3, zPad + 0.35] }, interior: true, entero: true, explosion: [0, 0, H * 1.2] }, pala, dado));
    const puntas = [];
    const wires = [];
    for (let i = 0; i < porLado; i++)
      for (const s of [-1, 1]) {
        const y = s < 0 ? yPin(i) : -yPin(i);
        const yt = Math.max(-(dl / 2 + 0.25), Math.min(dl / 2 + 0.25, y * 0.55));
        const xt = s * (dw / 2 + 0.75);
        puntas.push({ de: [s * (Wb / 2 - 0.15), y, zPad] as V3, a: [xt, yt, zPad] as V3, ancho: 0.4 });
        const yd = Math.max(-dl / 2 + 0.12, Math.min(dl / 2 - 0.12, y * 0.25));
        wires.push({ a: [s * (dw / 2 - 0.1), yd, zPad + 0.35] as V3, b: [xt + s * 0.1, yt, zPad + 0.1] as V3, alto: 0.35 });
      }
    g.add(parte('marco', { etiqueta: { texto: 'Marco de patillas (lead frame)', ref: 'fig-5.2', punto: [Wb / 2 - 0.4, yPin(0), zPad] }, interior: true, entero: true }, dedos(ctx, puntas, 0.2)));
    g.add(parte('hilos', { etiqueta: { texto: 'Hilos de oro de 25 µm: dado → patillas', ref: 'fig-9.3', punto: [-(dw / 2 + 0.4), yPin(0) * 0.4, zPad + 0.5] }, interior: true, entero: true, explosion: [0, 0, H * 1.2] }, malla(hilos(ctx, wires, 0.02), material(ctx, ORO))));
  } else if (o.interior === 'puente' && !ctx.bajo) {
    // Four diode dice on the lead frame, wired as a bridge.
    const matD = materialTextura(ctx, texturaDado(ctx, 7, 0, '#5a6378'), { metal: 0.4, rugosidad: 0.3 });
    const dados = new Group();
    const placas = new Group();
    const wires = [];
    for (const [x, y] of [[-1.5, 1.4], [1.5, 1.4], [-1.5, -1.4], [1.5, -1.4]] as [number, number][]) {
      const pl = malla(caja(ctx, 1.9, 1.7, 0.2, 0.02), material(ctx, MARCO));
      pl.position.set(x, y, zPad);
      const d = malla(caja(ctx, 1.0, 1.0, 0.22, 0.01), matD);
      d.position.set(x, y, zPad + 0.21);
      placas.add(pl);
      dados.add(d);
      wires.push({ a: [x, y, zPad + 0.32] as V3, b: [-x * 0.25, y * 1.5, zPad + 0.1] as V3, alto: 0.4 });
    }
    g.add(parte('dados', { etiqueta: { texto: 'Cuatro dados de diodo conectados en puente', ref: 'sec-5.6', punto: [1.5, -1.4, zPad + 0.3] }, interior: true, entero: true, explosion: [0, 0, H] }, placas, dados));
    g.add(parte('hilos', { interior: true, entero: true, explosion: [0, 0, H] }, malla(hilos(ctx, wires, 0.06), material(ctx, ACABADOS.aluminio))));
  } else if (o.interior === 'opto' && !ctx.bajo) {
    // LED (pins 1-2 side) and phototransistor (other side) facing each other through clear silicone.
    const on = !!o.encendido;
    const zc = zPad + 0.9;
    const palaL = malla(caja(ctx, 0.2, 1.3, 1.4, 0.02), material(ctx, MARCO));
    palaL.position.set(-1.0, 0, zc);
    const palaF = malla(caja(ctx, 0.2, 1.5, 1.6, 0.02), material(ctx, MARCO));
    palaF.position.set(1.05, 0, zc);
    const matLed = ctx.rec.material(`opto-led:${on}`, () => new MeshStandardMaterial({ color: new Color('#6b2a2a'), roughness: 0.3, emissive: new Color(on ? '#ff3a2a' : '#000'), emissiveIntensity: on ? 2 : 0 }));
    const led = malla(caja(ctx, 0.18, 0.35, 0.35, 0.01), matLed);
    led.position.set(-0.81, 0, zc);
    const foto = malla(caja(ctx, 0.15, 0.9, 0.9, 0.01), materialTextura(ctx, texturaDado(ctx, 817, 3, '#3b4258'), { metal: 0.4, rugosidad: 0.3 }));
    foto.position.set(0.88, 0, zc);
    foto.rotation.y = Math.PI / 2;
    g.add(parte('led', { etiqueta: { texto: 'LED infrarrojo (GaAs) mirando al detector', ref: 'sec-45.4', punto: [-0.81, 0, zc + 0.25] }, interior: true, entero: true, explosion: [-2, 0, 0] }, palaL, led));
    g.add(parte('fototransistor', { etiqueta: { texto: 'Fototransistor: la luz es su corriente de base', ref: 'sec-45.4', punto: [0.88, 0.3, zc + 0.5] }, interior: true, entero: true, explosion: [2, 0, 0] }, palaF, foto));
    const silicona = malla(caja(ctx, 1.9, 1.8, 1.9, 0.5), material(ctx, { color: '#cfe3ef', rugosidad: 0.2, transparente: on ? 0.55 : 0.35, emisivo: on ? '#ff6a4a' : undefined, emision: on ? 0.4 : 0 }));
    silicona.position.set(0, 0, zc);
    g.add(parte('silicona', { etiqueta: { texto: 'Silicona transparente: la luz cruza la barrera aislante (kV)', ref: 'sec-45.4', punto: [0, -0.9, zc + 0.7] }, interior: true, explosion: [0, 0, H * 0.9] }, silicona));
    const matP2 = material(ctx, MARCO);
    const tiras = new Group();
    for (let i = 0; i < porLado; i++)
      for (const s of [-1, 1]) {
        const y = s < 0 ? yPin(i) : -yPin(i);
        const t = malla(caja(ctx, Wb / 2 - 1.1, 0.4, 0.2, 0.02), matP2);
        t.position.set(s * (Wb / 4 + 0.55), y * 0.7, zPad);
        tiras.add(t);
      }
    g.add(parte('marco', { interior: true, entero: true }, tiras));
  }
  return {
    g,
    datos: {
      huella: { pads, ancho: fila + 1.6, fondo: Lb, alto: zb + H, origenKicad: [pads[0]!.x, pads[0]!.y], kicad: o.interior === 'puente' ? 'Diode_THT:Diode_Bridge_DIP-4_W7.62mm_P5.08mm' : `Package_DIP:DIP-${n}_W${fila.toFixed(2)}mm` },
      cortes: [
        { nombre: 'Desde arriba', normal: [0, 0, -1], min: -(zb + H + 0.05), max: -zPad, inicial: -(zPad + (o.interior === 'opto' ? 0.9 : 0.75)) },
        { nombre: 'Vertical', normal: [0, 1, 0], min: -Lb / 2, max: Lb / 2, inicial: o.interior === 'puente' ? -1.4 : 0 },
      ],
      explosionable: o.interior !== 'ci' || !ctx.bajo,
      marcado: lineas.join(' '),
    },
  };
}

const marca = (p: Record<string, unknown>) => (typeof p.marcado === 'string' && p.marcado.trim() ? p.marcado : undefined);
const dip: Constructor = (ctx, p) => dipGenerico(ctx, { pines: Number(p.pines) || 8, referencia: String(p.referencia ?? 'NE555P'), interior: 'ci', marcado: marca(p) });
const optoacoplador: Constructor = (ctx, p) => dipGenerico(ctx, { pines: Number(p.pines) === 6 ? 6 : 4, referencia: Number(p.pines) === 6 ? '4N35' : 'PC817', interior: 'opto', encendido: p.encendido === true, marcado: marca(p) });

// ------------------------------------------------------------------ SMD packages: SOIC, LQFP, QFN

interface Plano {
  /** Body size (X × Y × Z) and its bottom height. */
  bx: number;
  by: number;
  bz: number;
  z0: number;
  /** Lead positions: side (0 left, 1 bottom, 2 right, 3 top) and offset along the side. */
  pines: { lado: number; pos: number }[];
  /** Lead: length beyond the body, width, thickness, exit height, foot length. */
  largo: number;
  ancho: number;
  grosor: number;
  pie: number;
  /** QFN: flat pads under the body instead of gull-wing leads. */
  qfn?: boolean;
  /** Exposed pad size (QFN). */
  ep?: number;
}

function pinesPorLado(n: number, lados: number, paso: number): { lado: number; pos: number }[] {
  const porLado = n / lados;
  const r: { lado: number; pos: number }[] = [];
  for (let l = 0; l < lados; l++) for (let i = 0; i < porLado; i++) r.push({ lado: lados === 2 ? l * 2 : l, pos: ((porLado - 1) / 2 - i) * paso });
  return r;
}

/** World position (x, y) and rotation of a lead leaving side `lado` (counter-clockwise from the left). */
function posLado(p: Plano, lado: number, pos: number): { x: number; y: number; rz: number } {
  switch (lado) {
    case 0:
      return { x: -p.bx / 2, y: pos, rz: Math.PI };
    case 1:
      return { x: -pos, y: -p.by / 2, rz: -Math.PI / 2 };
    case 2:
      return { x: p.bx / 2, y: -pos, rz: 0 };
    default:
      return { x: pos, y: p.by / 2, rz: Math.PI / 2 };
  }
}

function plano(ctx: Ctx, p: Plano, ref: string, kicad: string, marcado?: unknown): Res {
  const info0 = infoCI(ref);
  const info = { ...info0, lineas: lineasMarcado({ marcado }, info0.lineas, 12) };
  const g = new Group();
  const n = p.pines.length;
  const cuerpo = malla(caja(ctx, p.bx, p.by, p.bz, Math.min(0.15, p.bz * 0.12)), material(ctx, ACABADOS.epoxiNegro));
  const grupo = parte('cuerpo', { etiqueta: { texto: `${info.et}: el punto marca la patilla 1`, ref: info.ref ?? 'fig-8.1', punto: [-p.bx / 2 + 0.6, p.by / 2 - 0.6, p.bz / 2] }, explosion: [0, 0, p.bz * 3.5] }, cuerpo);
  const dimple = malla(cilindro(ctx, Math.min(0.4, p.bx * 0.07), 0.02, 20), material(ctx, { color: p.qfn ? '#d9d9d6' : '#101113', rugosidad: 0.8 }));
  dimple.position.set(-p.bx / 2 + Math.min(1, p.bx * 0.18), p.by / 2 - Math.min(1, p.by * 0.18), p.bz / 2 - 0.005);
  const vertical = p.by > p.bx * 1.3;
  const tx = rotulo(ctx, info.lineas, (vertical ? p.by : p.bx) * 0.78, (vertical ? p.bx : p.by) * 0.5, { color: '#d6d9dd', peso: 600 });
  if (vertical) tx.rotation.z = -Math.PI / 2;
  tx.position.z = p.bz / 2 + 0.004;
  grupo.add(dimple, tx);
  g.add(colocar(grupo, 0, 0, p.z0 + p.bz / 2));
  const matP = material(ctx, ACABADOS.estano);
  const ms: Matrix4[] = [];
  const pads: Pad[] = [];
  const geo = p.qfn ? caja(ctx, p.largo, p.ancho, p.grosor, 0.01) : alaGaviota(ctx, p.largo + 0.1, p.z0 + p.bz * 0.42, p.grosor, p.ancho, p.pie);
  p.pines.forEach(({ lado, pos }, i) => {
    const { x, y, rz } = posLado(p, lado, pos);
    const m = new Matrix4().makeRotationZ(rz);
    if (p.qfn) {
      const d = p.largo / 2 - 0.02;
      m.setPosition(x - Math.cos(rz) * d, y - Math.sin(rz) * d, p.grosor / 2);
    } else m.setPosition(x - Math.cos(rz) * 0.1, y - Math.sin(rz) * 0.1, 0);
    ms.push(m);
    const ext = p.qfn ? -p.largo / 2 + 0.15 : p.largo - p.pie / 2;
    const horizontal = lado === 0 || lado === 2;
    pads.push({ n: String(i + 1), x: x + Math.cos(rz) * ext, y: y + Math.sin(rz) * ext, forma: 'rect', w: horizontal ? p.pie + 0.6 : p.ancho + 0.1, h: horizontal ? p.ancho + 0.1 : p.pie + 0.6 });
  });
  g.add(parte('patillas', { etiqueta: { texto: p.qfn ? `${n} contactos en el borde, sin patillas` : `${n} patillas de ala de gaviota`, ref: 'fig-8.1', punto: [ms.length ? new Vector3().setFromMatrixPosition(ms[0]!).x : 0, new Vector3().setFromMatrixPosition(ms[0]!).y, 0.1] } }, instancias(geo, matP, ms)));
  if (p.ep) {
    const ep = malla(caja(ctx, p.ep, p.ep, p.grosor, 0.02), matP);
    ep.position.z = p.grosor / 2;
    g.add(parte('almohadilla', { etiqueta: { texto: 'Almohadilla térmica expuesta (debajo)', ref: 'sec-7.3', punto: [p.ep / 2, -p.ep / 2, 0] }, interior: true }, ep));
    pads.push({ n: String(n + 1), x: 0, y: 0, forma: 'rect', w: p.ep, h: p.ep });
  }
  // Die, paddle, fingers and bond wires.
  const zPad = p.z0 + p.bz * (p.qfn ? 0.3 : 0.42);
  if (!ctx.bajo) {
    const [dw0, dl0] = info.dado;
    const dw = Math.min(dw0, p.bx * 0.55);
    const dl = Math.min(dl0, p.by * 0.55);
    const pala = malla(caja(ctx, dw + 0.5, dl + 0.5, 0.15, 0.02), material(ctx, MARCO));
    pala.position.z = zPad;
    const dado = malla(caja(ctx, dw, dl, 0.2, 0.01), materialTextura(ctx, texturaDado(ctx, info.semilla, n), { metal: 0.4, rugosidad: 0.3 }));
    dado.position.z = zPad + 0.17;
    g.add(parte('dado', { etiqueta: { texto: 'Dado de silicio sobre su almohadilla', ref: info.ref ?? 'fig-9.3', punto: [dw * 0.3, -dl * 0.3, zPad + 0.28] }, interior: true, entero: true, explosion: [0, 0, p.bz * 2] }, pala, dado));
    const puntas = [];
    const wires = [];
    for (const { lado, pos } of p.pines) {
      const { x, y } = posLado(p, lado, pos);
      const tx2 = lado === 0 || lado === 2 ? Math.sign(x) * (dw / 2 + 0.55) : Math.max(-dw / 2 - 0.3, Math.min(dw / 2 + 0.3, x * 0.6));
      const ty2 = lado === 1 || lado === 3 ? Math.sign(y) * (dl / 2 + 0.55) : Math.max(-dl / 2 - 0.3, Math.min(dl / 2 + 0.3, y * 0.6));
      const de: V3 = [x * 0.97, y * 0.97, zPad];
      puntas.push({ de, a: [tx2, ty2, zPad] as V3, ancho: Math.min(0.3, p.ancho) });
      const ddx = lado === 0 || lado === 2 ? Math.sign(x) * (dw / 2 - 0.08) : Math.max(-dw / 2 + 0.08, Math.min(dw / 2 - 0.08, x * 0.4));
      const ddy = lado === 1 || lado === 3 ? Math.sign(y) * (dl / 2 - 0.08) : Math.max(-dl / 2 + 0.08, Math.min(dl / 2 - 0.08, y * 0.4));
      wires.push({ a: [ddx, ddy, zPad + 0.28] as V3, b: [tx2 + Math.sign(tx2) * 0.08, ty2 + Math.sign(ty2) * 0.08, zPad + 0.08] as V3, alto: 0.22 });
    }
    g.add(parte('marco', { etiqueta: { texto: 'Dedos del marco de patillas', ref: 'fig-5.2', punto: [puntas[0]!.de[0] * 0.8, puntas[0]!.de[1], zPad] }, interior: true, entero: true }, dedos(ctx, puntas, 0.12)));
    g.add(parte('hilos', { etiqueta: { texto: 'Hilos de oro', ref: 'fig-9.3', punto: [wires[wires.length - 1]!.b[0], wires[wires.length - 1]!.b[1], zPad + 0.3] }, interior: true, entero: true, explosion: [0, 0, p.bz * 2] }, malla(hilos(ctx, wires, 0.015), material(ctx, ORO))));
  }
  return {
    g,
    datos: {
      huella: { pads, ancho: p.bx + 2 * (p.qfn ? 0 : p.largo), fondo: p.by + 2 * (p.qfn ? 0 : p.largo), alto: p.z0 + p.bz, origenKicad: [0, 0], kicad },
      cortes: [
        { nombre: 'Desde arriba', normal: [0, 0, -1], min: -(p.z0 + p.bz + 0.05), max: -zPad, inicial: -(zPad + 0.42) },
        { nombre: 'Vertical', normal: [0, 1, 0], min: -p.by / 2, max: p.by / 2, inicial: 0 },
      ],
      explosionable: !ctx.bajo,
      marcado: info.lineas.join(' '),
    },
  };
}

const SOIC_L: Record<number, number> = { 8: 4.9, 14: 8.65, 16: 9.9 };

const soic: Constructor = (ctx, p) => {
  const n = [8, 14, 16].includes(Number(p.pines)) ? Number(p.pines) : 8;
  return plano(
    ctx,
    { bx: 3.9, by: SOIC_L[n]!, bz: 1.45, z0: 0.12, pines: pinesPorLado(n, 2, 1.27), largo: 1.05, ancho: 0.42, grosor: 0.2, pie: 0.6 },
    String(p.referencia ?? 'LM358D'),
    `Package_SO:SOIC-${n}_3.9x${SOIC_L[n]!.toFixed(1)}mm_P1.27mm`,
    p.marcado,
  );
};

const QFP: Record<number, { b: number; e: number }> = { 32: { b: 7, e: 0.8 }, 44: { b: 10, e: 0.8 }, 48: { b: 7, e: 0.5 }, 64: { b: 10, e: 0.5 } };

const qfp: Constructor = (ctx, p) => {
  const n = QFP[Number(p.pines)] ? Number(p.pines) : 48;
  const { b, e } = QFP[n]!;
  return plano(
    ctx,
    { bx: b, by: b, bz: 1.4, z0: 0.1, pines: pinesPorLado(n, 4, e), largo: 1.0, ancho: e > 0.6 ? 0.37 : 0.22, grosor: 0.15, pie: 0.6 },
    String(p.referencia ?? 'STM32F103'),
    `Package_QFP:LQFP-${n}_${b}x${b}mm_P${e}mm`,
    p.marcado,
  );
};

const QFN: Record<number, { b: number; e: number; ep: number }> = { 16: { b: 3, e: 0.5, ep: 1.7 }, 20: { b: 4, e: 0.5, ep: 2.6 }, 32: { b: 5, e: 0.5, ep: 3.45 }, 48: { b: 7, e: 0.5, ep: 5.15 } };

const qfn: Constructor = (ctx, p) => {
  const n = QFN[Number(p.pines)] ? Number(p.pines) : 32;
  const { b, e, ep } = QFN[n]!;
  return plano(
    ctx,
    { bx: b, by: b, bz: 0.85, z0: 0.02, pines: pinesPorLado(n, 4, e), largo: 0.4, ancho: 0.25, grosor: 0.05, pie: 0.4, qfn: true, ep },
    String(p.referencia ?? 'ATMEGA32U4'),
    `Package_DFN_QFN:QFN-${n}-1EP_${b}x${b}mm_P${e}mm_EP${ep}x${ep}mm`,
    p.marcado,
  );
};

export const CONSTRUCTORES_CI: Record<string, Constructor> = { dip, soic, qfp, qfn, optoacoplador };

