// Capacitors (book 3.4, 3.10; figures 3.6 and 3.7): ceramic disc (also the radial disc of NTC/PTC/varistors),
// MLCC with its interleaved nickel electrodes, film box with the metallized winding and sprayed end contacts,
// aluminium electrolytic (radial and SMD) with the anode and cathode foils rolled with the paper separator,
// tantalum chip with its sintered pellet, and the double-layer supercapacitor.

import { BufferGeometry, ExtrudeGeometry, Group, LatheGeometry, Matrix4, Path, Shape, Vector2, CircleGeometry } from 'three';
import { codigoCondensador, leerValor, textoValor } from './codigos';
import {
  ACABADOS,
  caja,
  cilindro,
  colocar,
  finPatilla,
  hilo,
  instancias,
  malla,
  material,
  materialTextura,
  mt,
  parte,
  rotulo,
  texturaPintada,
  torno,
  type Constructor,
  type Ctx,
} from './comun';
import { padsChip } from './resistencias';
import type { DatosModelo, Huella } from './tipos';

type Res = { g: Group; datos: Partial<DatosModelo> };

// ------------------------------------------------------------------ radial disc (ceramic, NTC, PTC, MOV)

export interface OpcionesDisco {
  D: number;
  t: number;
  paso: number;
  /** Lead diameter. */
  d: number;
  color: string;
  colorCorte: string;
  marcado: string[];
  colorTexto?: string;
  /** Dielectric / active disc. */
  interior: { color: string; corte: string; etiqueta: string; ref?: string };
  electrodo: { etiqueta: string; ref?: string };
  recubrimiento: { etiqueta: string; ref?: string };
}

/** Rounded disc profile revolved around Y (faces towards ±Y). */
function geoDisco(ctx: Ctx, R: number, t: number, clave: string): BufferGeometry {
  return ctx.rec.geometria(`disco:${clave}:${R}:${t}:${ctx.bajo}`, () => {
    const rc = Math.min(t / 2, R * 0.3);
    const pts: Vector2[] = [new Vector2(0.0001, -t / 2)];
    pts.push(new Vector2(R - rc, -t / 2));
    for (let i = 1; i <= 6; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 6;
      pts.push(new Vector2(R - rc + rc * Math.cos(a), rc * Math.sin(a) * (t / 2 / rc)));
    }
    pts.push(new Vector2(0.0001, t / 2));
    // Revolved around Y with the profile's second coordinate along Y (the thickness): the disc already
    // stands in the XZ plane with its faces towards ±Y.
    return new LatheGeometry(pts, ctx.seg(40));
  });
}

export function discoRadial(ctx: Ctx, o: OpcionesDisco): Res {
  const R = o.D / 2;
  const g = new Group();
  const zKink = 2.2; // the snap-in kink keeps the disc this high above the board
  const zc = zKink + 1.2 + R;
  // Coating: rounded disc plus the drip where the leads come out.
  const cub = malla(geoDisco(ctx, R, o.t, 'cub'), material(ctx, { color: o.color, rugosidad: 0.5, corte: o.colorCorte }));
  const gota = malla(cilindro(ctx, Math.min(R * 0.55, o.paso * 0.45), R * 0.5, 24, Math.min(R * 0.3, o.paso * 0.3)), material(ctx, { color: o.color, rugosidad: 0.5, corte: o.colorCorte }));
  gota.scale.y = (o.t * 0.8) / (2 * Math.min(R * 0.55, o.paso * 0.45));
  gota.rotation.x = Math.PI;
  gota.position.z = -R + R * 0.5 - 0.1;
  const grupoCub = parte('recubrimiento', { etiqueta: { texto: o.recubrimiento.etiqueta, ref: o.recubrimiento.ref, punto: [R * 0.6, -o.t / 2, R * 0.5] }, explosion: [0, -o.D * 0.9, 0] }, cub, gota);
  if (o.marcado.length) {
    const tx = rotulo(ctx, o.marcado, o.D * 0.62, o.D * 0.22 * o.marcado.length, { color: o.colorTexto ?? '#1b1b1b', peso: 700 });
    tx.rotation.x = Math.PI / 2;
    tx.position.y = -o.t / 2 - 0.012;
    grupoCub.add(tx);
  }
  g.add(colocar(grupoCub, 0, 0, zc));

  // Active disc and its two electrodes (one on each face).
  const ti = o.t * 0.42;
  const disco = malla(cilindro(ctx, R * 0.8, ti, 40), material(ctx, { color: o.interior.color, rugosidad: 0.75, corte: o.interior.corte }));
  disco.rotation.x = Math.PI / 2;
  disco.position.y = ti / 2;
  g.add(colocar(parte('dielectrico', { etiqueta: { texto: o.interior.etiqueta, ref: o.interior.ref, punto: [-R * 0.35, 0, R * 0.55] }, interior: true }, disco), 0, 0, zc));
  const matElec = material(ctx, { ...ACABADOS.plata, corte: '#b9b9b6' });
  for (const s of [-1, 1]) {
    const e = malla(cilindro(ctx, R * 0.74, 0.06, 40), matElec);
    e.rotation.x = Math.PI / 2;
    e.position.y = s < 0 ? -ti / 2 : ti / 2 + 0.06;
    g.add(
      colocar(
        parte(s < 0 ? 'electrodo-1' : 'electrodo-2', {
          etiqueta: s < 0 ? { texto: o.electrodo.etiqueta, ref: o.electrodo.ref, punto: [R * 0.3, -ti / 2 - 0.06, -R * 0.2] } : undefined,
          interior: true,
          explosion: [0, s * o.t * 1.6, 0],
        }, e),
        0,
        0,
        zc,
      ),
    );
  }

  // Leads: soldered to each electrode inside, out of the drip, splayed to the pitch, kinked and down.
  const zFin = finPatilla(ctx, 22);
  const matPat = material(ctx, ACABADOS.estano);
  for (const s of [-1, 1]) {
    const yf = s < 0 ? -ti / 2 - 0.12 : ti / 2 + 0.18;
    const x0 = s * Math.min(R * 0.35, o.paso * 0.3);
    const pts: [number, number, number][] = [
      [x0, yf, zc - R * 0.1],
      [x0, yf * 0.4, zc - R - 0.6],
      [s * (o.paso / 2), 0, zKink + 0.9],
      [s * (o.paso / 2), 0, zKink + 0.3],
      [s * (o.paso / 2 + 0.45), 0, zKink],
      [s * (o.paso / 2), 0, zKink - 0.3],
      [s * (o.paso / 2), 0, zFin],
    ];
    g.add(parte(s < 0 ? 'patilla-1' : 'patilla-2', {}, malla(hilo(ctx, pts, o.d / 2, { curva: o.d * 0.9, clave: `disco-pat:${o.D}:${o.paso}:${s}:${zFin}:${ti}` }), matPat)));
  }

  const huella: Huella = {
    pads: [
      { n: '1', x: -o.paso / 2, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: o.d + 0.3 },
      { n: '2', x: o.paso / 2, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: o.d + 0.3 },
    ],
    ancho: Math.max(o.D, o.paso + 1.6),
    fondo: o.t,
    alto: zc + R,
    origenKicad: [-o.paso / 2, 0],
  };
  return {
    g,
    datos: {
      huella,
      cortes: [
        { nombre: 'Transversal', normal: [1, 0, 0], min: -R, max: R, inicial: 0 },
        { nombre: 'Frontal', normal: [0, 1, 0], min: -o.t / 2 - 0.1, max: o.t / 2, inicial: -ti / 2 - 0.02 },
      ],
      explosionable: true,
      marcado: o.marcado.join(' '),
    },
  };
}

const condensadorDisco: Constructor = (ctx, p) => {
  const C = leerValor(p.valor as string | number, 100e-9);
  const D = Number(p.diametro) || 5;
  const V = Number(p.tension) || 50;
  const cod = codigoCondensador(C);
  return discoRadial(ctx, {
    D,
    t: D >= 7 ? 3 : 2.5,
    paso: D >= 7 ? 5.08 : D <= 4 ? 2.54 : 5.08,
    d: 0.5,
    color: '#c26a2c',
    colorCorte: '#a8582a',
    marcado: [cod, `${V}V`],
    interior: { color: '#f2eee6', corte: '#ece6da', etiqueta: 'Disco de cerámica: el dieléctrico', ref: 'sec-3.4.5' },
    electrodo: { etiqueta: 'Cara metalizada (plata): una placa del condensador', ref: 'fig-3.7' },
    recubrimiento: { etiqueta: `Recubrimiento con el código «${cod}» = ${textoValor(C, 'F')}`, ref: 'sec-3.4.5' },
  });
};

// ------------------------------------------------------------------ MLCC

const MLCC: Record<string, { L: number; W: number; H: number; t: number }> = {
  '0402': { L: 1.0, W: 0.5, H: 0.5, t: 0.25 },
  '0603': { L: 1.6, W: 0.8, H: 0.8, t: 0.35 },
  '0805': { L: 2.0, W: 1.25, H: 1.0, t: 0.5 },
  '1206': { L: 3.2, W: 1.6, H: 1.15, t: 0.55 },
  '1210': { L: 3.2, W: 2.5, H: 1.6, t: 0.6 },
  '1812': { L: 4.5, W: 3.2, H: 1.8, t: 0.6 },
};

const CERAMICA_MLCC: Record<string, { c: string; corte: string; nombre: string }> = {
  C0G: { c: '#c7ae86', corte: '#b79c74', nombre: 'C0G/NP0, clase I' },
  X7R: { c: '#a3835b', corte: '#93744f', nombre: 'X7R, clase II' },
  Y5V: { c: '#b49451', corte: '#a28447', nombre: 'Y5V, clase II' },
};

const mlcc: Constructor = (ctx, p) => {
  const tam = String(p.tamano ?? '0805');
  const { L, W, H, t } = MLCC[tam] ?? MLCC['0805']!;
  const diel = CERAMICA_MLCC[String(p.dielectrico)] ?? CERAMICA_MLCC.X7R!;
  const C = leerValor(p.valor as string | number, 100e-9);
  const n = Math.max(4, Math.min(40, Math.round(Number(p.capas) || 14)));
  const g = new Group();
  const cuerpo = malla(caja(ctx, L - 0.04, W, H, Math.min(0.06, W * 0.08)), material(ctx, { color: diel.c, rugosidad: 0.85, corte: diel.corte }));
  g.add(
    colocar(
      parte('dielectrico', { etiqueta: { texto: `Dieléctrico cerámico ${diel.nombre} (${textoValor(C, 'F')}; sin marcar)`, ref: 'sec-3.4.1', punto: [0, -W / 2, H * 0.8] } }, cuerpo),
      0,
      0,
      H / 2 + 0.02,
    ),
  );
  // Interleaved nickel electrodes: odd ones reach the left termination, even ones the right.
  if (!ctx.bajo) {
    const le = L * 0.78;
    const we = W * 0.78;
    const z0 = H * 0.14;
    const z1 = H * 0.86;
    const he = Math.min(0.03, ((z1 - z0) / n) * 0.35);
    const izq: Matrix4[] = [];
    const der: Matrix4[] = [];
    for (let i = 0; i < n; i++) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / n + 0.02;
      (i % 2 ? der : izq).push(mt((i % 2 ? 1 : -1) * (L - le) / 2, 0, z));
    }
    const geo = caja(ctx, le, we, he, 0);
    const matN = material(ctx, { color: '#9a9690', metal: 0.9, rugosidad: 0.35, corte: '#8a8680' });
    g.add(parte('electrodos-1', { etiqueta: { texto: 'Electrodos de níquel unidos a la terminación izquierda', ref: 'sec-3.4.1', punto: [-L * 0.25, 0, z0 + (z1 - z0) * 0.35] }, interior: true, explosion: [-L * 0.25, 0, 0] }, instancias(geo, matN, izq)));
    g.add(parte('electrodos-2', { etiqueta: { texto: '… y los alternos, a la derecha: capas en paralelo', ref: 'fig-3.7', punto: [L * 0.25, 0, z0 + (z1 - z0) * 0.7] }, interior: true, explosion: [L * 0.25, 0, 0] }, instancias(geo, matN, der)));
  }
  const matT = material(ctx, { ...ACABADOS.estanoMate, corte: '#9b9fa4' });
  for (const s of [-1, 1]) {
    const term = malla(caja(ctx, t, W + 0.04, H + 0.04, Math.min(0.08, t * 0.3)), matT);
    g.add(
      colocar(
        parte(s < 0 ? 'terminacion-1' : 'terminacion-2', {
          etiqueta: s < 0 ? { texto: 'Terminación: cobre, barrera de níquel y estaño', ref: 'sec-3.4.1', punto: [-L / 2, -W / 2, H * 0.5] } : undefined,
          explosion: [s * L * 0.55, 0, 0],
        }, term),
        s * (L / 2 - t / 2),
        0,
        (H + 0.04) / 2,
      ),
    );
  }
  return {
    g,
    datos: {
      huella: { pads: padsChip(L, W, t), ancho: L, fondo: W, alto: H, origenKicad: [0, 0], kicad: `Capacitor_SMD:C_${tam}` },
      cortes: [
        { nombre: 'Longitudinal', normal: [0, 1, 0], min: -W / 2 - 0.02, max: W / 2, inicial: 0 },
        { nombre: 'Transversal', normal: [1, 0, 0], min: -L / 2, max: L / 2, inicial: -L * 0.2 },
      ],
      explosionable: true,
    },
  };
};

// ------------------------------------------------------------------ film box

const CAJAS_PELICULA: Record<string, { W: number; T: number; H: number }> = {
  '5': { W: 7.2, T: 2.5, H: 6.5 },
  '7.5': { W: 10, T: 3, H: 8 },
  '10': { W: 13, T: 4, H: 9 },
  '15': { W: 18, T: 5, H: 11 },
};

/** Ring between two stadiums (flattened winding layer) in the YZ plane, extruded along X. */
function anilloEstadio(ctx: Ctx, a: number, b: number, g: number, largo: number, clave: string): BufferGeometry {
  return ctx.rec.geometria(`estadio:${clave}:${ctx.bajo}`, () => {
    const est = (sh: Path, w: number, h: number, inverso = false) => {
      // Stadium of total width w (along Y) and height h (along Z).
      const r = h / 2;
      const x = w / 2 - r;
      const n = ctx.bajo ? 6 : 12;
      const pts: Vector2[] = [];
      for (let i = 0; i <= n; i++) pts.push(new Vector2(x + r * Math.cos(-Math.PI / 2 + (Math.PI * i) / n), r * Math.sin(-Math.PI / 2 + (Math.PI * i) / n)));
      for (let i = 0; i <= n; i++) pts.push(new Vector2(-x + r * Math.cos(Math.PI / 2 + (Math.PI * i) / n), r * Math.sin(Math.PI / 2 + (Math.PI * i) / n)));
      if (inverso) pts.reverse();
      sh.setFromPoints(pts);
    };
    const s = new Shape();
    est(s, a, b);
    const hueco = new Path();
    est(hueco, a - 2 * g, b - 2 * g, true);
    s.holes.push(hueco);
    const geo = new ExtrudeGeometry(s, { depth: largo, bevelEnabled: false, curveSegments: 4 });
    // Shape (x, y) = (Y, Z) of the model, extrusion along +z_shape = model X.
    geo.rotateY(Math.PI / 2);
    geo.rotateX(Math.PI / 2);
    geo.translate(-largo / 2, 0, 0);
    return geo;
  });
}

const condensadorPelicula: Constructor = (ctx, p) => {
  const paso = Number(p.paso) || 5;
  const dim = CAJAS_PELICULA[String(paso)] ?? CAJAS_PELICULA['5']!;
  const { W, T, H } = dim;
  const C = leerValor(p.valor as string | number, 100e-9);
  const V = Number(p.tension) || 63;
  const pp = String(p.film) === 'pp';
  const g = new Group();
  const z0 = 0.4;
  const colorCaja = pp ? '#6d8aa3' : '#b4362c';
  const resina = '#d6c49a';
  const cajaM = malla(caja(ctx, W, T, H, Math.min(0.5, T * 0.15)), material(ctx, { color: colorCaja, rugosidad: 0.45, corte: resina }));
  const valorTxt = textoValor(C, 'F').replace(' ', '');
  const tx = rotulo(ctx, [pp ? 'MKP' : 'MKT', `${valorTxt} ${V}V`], W * 0.8, H * 0.38, { color: '#f4efe6', peso: 700 });
  tx.rotation.x = Math.PI / 2;
  tx.position.set(0, -T / 2 - 0.012, H * 0.08);
  g.add(
    colocar(
      parte('caja', {
        etiqueta: { texto: `Caja de plástico rellena de resina (${pp ? 'polipropileno' : 'poliéster'}, ${textoValor(C, 'F')})`, ref: 'sec-3.4.3', punto: [W * 0.3, -T / 2, H * 0.4] },
        explosion: [0, 0, H * 1.2],
      }, cajaM, tx),
      0,
      0,
      z0 + H / 2,
    ),
  );

  // Flattened winding: concentric layers of film (clear) and its metallization (silver).
  const largo = W * 0.82;
  const a = T * 0.82;
  const b = H * 0.62;
  if (!ctx.bajo) {
    const capas = 7;
    const paso2 = (Math.min(a, b) * 0.42) / capas;
    const matFilm = material(ctx, { color: pp ? '#e9eef0' : '#e8d9a8', rugosidad: 0.3, corte: pp ? '#dde4e7' : '#d9c58c' });
    const matMet = material(ctx, { color: '#a7abb0', metal: 0.9, rugosidad: 0.3, corte: '#8e9399' });
    const rollo = new Group();
    for (let i = 0; i < capas; i++) {
      const aa = a - 2 * paso2 * i;
      const bb = b - 2 * paso2 * i;
      if (bb <= paso2 * 1.2) break;
      rollo.add(malla(anilloEstadio(ctx, aa, bb, paso2 * 0.94, largo - 0.2, `${aa.toFixed(3)}:${bb.toFixed(3)}:${(paso2 * 0.94).toFixed(3)}:${largo}`), i % 2 ? matMet : matFilm));
    }
    g.add(
      colocar(
        parte('bobinado', {
          etiqueta: { texto: `Película de ${pp ? 'polipropileno' : 'poliéster'} metalizada, bobinada y aplastada`, ref: 'sec-3.4.3', punto: [0, a / 2, b * 0.3] },
          interior: true,
          explosion: [0, 0, H * 0.45],
        }, rollo),
        0,
        0,
        z0 + H * 0.52,
      ),
    );
  }
  // Sprayed metal end contacts and leads.
  const zFin = finPatilla(ctx, 20);
  const matSch = material(ctx, { color: '#9aa0a5', metal: 0.7, rugosidad: 0.75, corte: '#7f858b' });
  const matPat = material(ctx, ACABADOS.estano);
  for (const s of [-1, 1]) {
    const contacto = malla(caja(ctx, 0.35, a * 1.02, b * 1.02, 0.12), matSch);
    contacto.position.set(s * (largo / 2 + 0.05), 0, z0 + H * 0.52);
    const xs = s * Math.min(paso / 2, largo / 2 - 0.4);
    const pat = malla(
      hilo(ctx, [
        [s * (largo / 2 + 0.1), 0, z0 + H * 0.52 - b * 0.2],
        [xs, 0, z0 + H * 0.52 - b * 0.35],
        [xs, 0, zFin],
      ], 0.3, { curva: 0.4, clave: `film-pat:${paso}:${s}:${zFin}` }),
      matPat,
    );
    g.add(
      parte(s < 0 ? 'contacto-1' : 'contacto-2', {
        etiqueta: s < 0 ? { texto: 'Contacto de metal proyectado (schoopage) que une todas las espiras', ref: 'sec-3.4.3', punto: [s * (largo / 2 + 0.2), 0, z0 + H * 0.52 + b * 0.3] } : undefined,
        interior: true,
        explosion: [s * W * 0.3, 0, 0],
      }, contacto, pat),
    );
  }
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -paso / 2, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: 0.8 },
          { n: '2', x: paso / 2, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: 0.8 },
        ],
        ancho: W,
        fondo: T,
        alto: z0 + H,
        origenKicad: [-paso / 2, 0],
      },
      cortes: [
        { nombre: 'Transversal', normal: [1, 0, 0], min: -W / 2, max: W / 2, inicial: 0 },
        { nombre: 'Longitudinal', normal: [0, 1, 0], min: -T / 2, max: T / 2, inicial: 0 },
      ],
      explosionable: true,
      marcado: `${pp ? 'MKP' : 'MKT'} ${valorTxt} ${V}V`,
    },
  };
};

// ------------------------------------------------------------------ aluminium electrolytic (radial)

/** Standard can sizes (diameter × length, pitch, lead diameter). */
const LATAS: { D: number; L: number; P: number; d: number }[] = [
  { D: 5, L: 11, P: 2, d: 0.5 },
  { D: 6.3, L: 11, P: 2.5, d: 0.5 },
  { D: 8, L: 11.5, P: 3.5, d: 0.6 },
  { D: 10, L: 12.5, P: 5, d: 0.6 },
  { D: 10, L: 16, P: 5, d: 0.6 },
  { D: 10, L: 20, P: 5, d: 0.6 },
  { D: 12.5, L: 20, P: 5, d: 0.6 },
  { D: 12.5, L: 25, P: 5, d: 0.6 },
  { D: 16, L: 25, P: 7.5, d: 0.8 },
  { D: 16, L: 31.5, P: 7.5, d: 0.8 },
  { D: 18, L: 35.5, P: 7.5, d: 0.8 },
  { D: 18, L: 40, P: 7.5, d: 0.8 },
  { D: 22, L: 45, P: 10, d: 1.0 },
];

/** Smallest standard can that holds C·V (volume ≈ 0,08 mm³ per µF·V, a 105 °C general-purpose series). */
export function lataPara(C: number, V: number): { D: number; L: number; P: number; d: number } {
  const vol = Math.max(200, 0.08 * C * 1e6 * V);
  return LATAS.find((l) => (Math.PI * l.D * l.D * l.L) / 4 >= vol) ?? LATAS[LATAS.length - 1]!;
}

/** Archimedean spiral strip (a rolled foil seen from above), extruded along Z. */
function espiral(ctx: Ctx, r0: number, r1: number, vueltas: number, grosor: number, fase: number, alto: number, clave: string): BufferGeometry {
  return ctx.rec.geometria(`espiral:${clave}:${ctx.bajo}`, () => {
    const n = Math.round(vueltas * (ctx.bajo ? 24 : 56));
    const ext: Vector2[] = [];
    const int: Vector2[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = fase + u * vueltas * Math.PI * 2;
      const r = r0 + (r1 - r0) * u;
      ext.push(new Vector2((r + grosor / 2) * Math.cos(a), (r + grosor / 2) * Math.sin(a)));
      int.push(new Vector2((r - grosor / 2) * Math.cos(a), (r - grosor / 2) * Math.sin(a)));
    }
    const s = new Shape([...ext, ...int.reverse()]);
    return new ExtrudeGeometry(s, { depth: alto, bevelEnabled: false, curveSegments: 1 });
  });
}

interface OpcionesLata {
  D: number;
  L: number;
  P: number;
  d: number;
  funda: string;
  franja: string;
  texto: string[];
  colorTexto: string;
  super?: boolean;
  smd?: boolean;
}

function texturaFunda(ctx: Ctx, o: OpcionesLata) {
  return texturaPintada(ctx, `funda:${o.funda}:${o.franja}:${o.texto.join('|')}:${o.D}:${o.L}`, 1024, 512, (g, w, h) => {
    g.fillStyle = o.funda;
    g.fillRect(0, 0, w, h);
    // Negative stripe facing +X (u = 0,25), with its «−» signs.
    const x0 = w * 0.25 - w * 0.075;
    g.fillStyle = o.franja;
    g.fillRect(x0, 0, w * 0.15, h);
    g.fillStyle = o.funda;
    const signos = Math.max(3, Math.round((o.L / o.D) * 2.2));
    for (let i = 0; i < signos; i++) {
      const y = h * (0.12 + (0.76 * (i + 0.5)) / signos);
      g.fillRect(w * 0.25 - w * 0.03, y - h * 0.012, w * 0.06, h * 0.024);
    }
    // Text around the front (u = 0 and 1 wrap: draw at both ends), written along the height (radial cans;
    // a V-chip carries its marking on the top).
    if (o.smd) return;
    g.save();
    g.fillStyle = o.colorTexto;
    const lineas = o.texto;
    const alto = h * 0.78;
    const px = Math.min((w * 0.06) / Math.max(1, lineas.length) * 1.4, alto / Math.max(...lineas.map((l) => l.length)) * 1.7);
    g.font = `700 ${px}px 'Source Sans 3', Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const cx of [0, w]) {
      g.save();
      g.translate(cx, h / 2);
      g.rotate(-Math.PI / 2);
      lineas.forEach((l, i) => g.fillText(l, 0, (i - (lineas.length - 1) / 2) * px * 1.15));
      g.restore();
    }
    g.restore();
  });
}

function texturaTapa(ctx: Ctx, D: number) {
  return texturaPintada(ctx, `tapa-ventilada:${D >= 10}`, 256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w / 2);
    grad.addColorStop(0, '#d9dcdf');
    grad.addColorStop(1, '#b9bdc1');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6d7277';
    g.lineWidth = w * 0.022;
    g.lineCap = 'round';
    g.beginPath();
    if (D >= 10) {
      // «K»-type vent (three grooves).
      for (const a of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]) {
        g.moveTo(w / 2, h / 2);
        g.lineTo(w / 2 + Math.cos(a) * w * 0.32, h / 2 + Math.sin(a) * h * 0.32);
      }
    } else {
      g.moveTo(w * 0.22, h / 2);
      g.lineTo(w * 0.78, h / 2);
      g.moveTo(w / 2, h * 0.22);
      g.lineTo(w / 2, h * 0.78);
    }
    g.stroke();
  });
}

function lata(ctx: Ctx, o: OpcionesLata): Res {
  const { D, L, P, d } = o;
  const R = D / 2;
  const g = new Group();
  const z0 = o.smd ? 0.9 : 0.3;
  const hBung = Math.min(2, L * 0.16);

  // Sleeve (shrunk PVC) with its rolled top lip and the crimp groove of the can.
  const ranura = z0 + hBung + 0.4;
  const perfilFunda: [number, number][] = [
    [R - 0.45, z0 - 0.02],
    [R + 0.02, z0 + 0.15],
    [R + 0.04, ranura - 0.35],
    [R - 0.28, ranura],
    [R + 0.04, ranura + 0.35],
    [R + 0.04, z0 + L - 0.35],
    [R - 0.15, z0 + L - 0.05],
    [R - 0.55, z0 + L],
  ];
  const funda = malla(torno(ctx, perfilFunda, 64, `funda:${D}:${L}:${z0}`), materialTextura(ctx, texturaFunda(ctx, o), { rugosidad: 0.38, corte: o.funda }));
  g.add(
    parte('funda', {
      etiqueta: o.smd
        ? undefined
        : { texto: `Funda de plástico con la franja del negativo (−) y «${o.texto[0]}»`, ref: 'sec-3.4.2', punto: [R * Math.cos(-0.3), R * Math.sin(-0.3), z0 + L * 0.72] },
      explosion: [0, 0, L * 1.25],
      colorCorte: o.funda,
    }, funda),
  );

  // Aluminium can (closed top with the scored vent) and rubber bung.
  const perfilLata: [number, number][] = [
    [R - 0.12, z0 + hBung * 0.5],
    [R - 0.12, ranura - 0.3],
    [R - 0.38, ranura],
    [R - 0.12, ranura + 0.3],
    [R - 0.12, z0 + L - 0.25],
    [R - 0.42, z0 + L - 0.02],
    [0.001, z0 + L - 0.02],
  ];
  const lataM = malla(torno(ctx, perfilLata, 56, `lata:${D}:${L}:${z0}`), material(ctx, { ...ACABADOS.aluminio, corte: '#a3a8ad' }));
  const tapa = malla(ctx.rec.geometria(`tapa:${D}`, () => new CircleGeometry(R - 0.42, ctx.seg(48))), materialTextura(ctx, texturaTapa(ctx, D), { metal: 0.85, rugosidad: 0.35 }));
  tapa.position.z = z0 + L - 0.015;
  tapa.userData.decal = true;
  const grupoLata = parte('lata', {
    etiqueta: { texto: 'Lata de aluminio con la válvula de seguridad (ranuras de la tapa)', ref: 'sec-3.4.2', punto: [R * 0.35, -R * 0.2, z0 + L] },
    explosion: [0, 0, L * 0.75],
  }, lataM, tapa);
  if (o.smd) {
    // V-chip: the marking is printed on the top: black half-moon on the negative side and the value.
    const luna = malla(ctx.rec.geometria(`luna:${D}`, () => new CircleGeometry(R - 0.45, ctx.seg(40), -Math.PI / 2, Math.PI)), material(ctx, { color: '#16171a', rugosidad: 0.5 }));
    luna.position.z = z0 + L + 0.002;
    luna.userData.decal = true;
    const tx = rotulo(ctx, o.texto, D * 0.45, D * 0.5, { color: '#16171a' });
    tx.position.set(-D * 0.18, 0, z0 + L + 0.004);
    tx.rotation.z = Math.PI / 2;
    grupoLata.add(luna, tx);
  }
  g.add(grupoLata);
  const tapon = malla(cilindro(ctx, R - 0.18, hBung, 40), material(ctx, ACABADOS.goma));
  tapon.position.z = z0;
  g.add(parte('tapon', { etiqueta: { texto: 'Tapón de goma que sella la lata', ref: 'sec-3.8', punto: [-R * 0.9, -R * 0.3, z0 + hBung * 0.5] }, interior: true, explosion: [0, 0, -L * 0.35] }, tapon));

  // The rolled element: paper soaked in electrolyte (body) with the anode and cathode foils.
  const rEl = R - 0.4;
  const hEl = L - hBung - 1.4;
  const zEl = z0 + hBung + 0.3;
  const elemento = new Group();
  const papel = malla(cilindro(ctx, rEl, hEl, 48), material(ctx, o.super ? { color: '#2f3033', rugosidad: 0.9, corte: '#3a3b3f' } : { color: '#b49565', rugosidad: 0.85, corte: '#a5885a' }));
  elemento.add(papel);
  const etiquetas: { texto: string; ref?: string }[] = o.super
    ? [
        { texto: 'Electrodo de carbón activado sobre aluminio (+)', ref: 'sec-3.10' },
        { texto: 'Electrodo de carbón activado (−): la doble capa de iones', ref: 'sec-3.10' },
      ]
    : [
        { texto: 'Lámina de ánodo: aluminio grabado con su capa de óxido (el dieléctrico)', ref: 'sec-3.4.2' },
        { texto: 'Lámina de cátodo (aluminio)', ref: 'fig-3.7' },
      ];
  if (!ctx.bajo) {
    const vueltas = Math.max(3, Math.min(9, Math.round(rEl * 1.1)));
    const r0 = rEl * 0.18;
    const r1 = rEl * 0.96;
    const gros = Math.min(0.12, ((r1 - r0) / vueltas) * 0.18);
    const matA = material(ctx, o.super ? { color: '#151617', rugosidad: 0.95, corte: '#111' } : { color: '#d7dade', metal: 0.85, rugosidad: 0.4, corte: '#c3c7cc' });
    const matK = material(ctx, o.super ? { color: '#151617', rugosidad: 0.95, corte: '#1d1d1f' } : { color: '#9ea4aa', metal: 0.85, rugosidad: 0.45, corte: '#868c92' });
    for (const [i, mat] of [matA, matK].entries()) {
      const geo = espiral(ctx, r0, r1, vueltas, gros, i * Math.PI, hEl + 0.02, `${rEl}:${vueltas}:${gros.toFixed(3)}:${i}:${hEl}`);
      const lam = malla(geo, mat);
      lam.position.z = -0.01;
      const a = Math.PI * 0.7 + i * 0.6;
      elemento.add(parte(i ? 'catodo' : 'anodo', { etiqueta: { ...etiquetas[i]!, punto: [Math.cos(a) * rEl * 0.6, Math.sin(a) * rEl * 0.6, hEl] }, interior: true }, lam));
    }
  }
  g.add(
    colocar(
      parte('elemento', {
        etiqueta: o.super
          ? { texto: 'Separador empapado en electrolito orgánico', ref: 'sec-3.10', punto: [-rEl * 0.95, 0, hEl * 0.4] }
          : { texto: 'Separador de papel empapado en electrolito (el cátodo real)', ref: 'sec-3.4.2', punto: [-rEl * 0.95, 0, hEl * 0.4] },
        interior: true,
        explosion: [0, 0, L * 0.25],
      }, elemento),
      0,
      0,
      zEl,
    ),
  );

  // Tabs and leads (+ is pad 1 at −X and longer when loose).
  const matPat = material(ctx, ACABADOS.estano);
  const matTab = material(ctx, ACABADOS.aluminio);
  for (const s of [-1, 1]) {
    const x = s * (o.smd ? D * 0.3 : P / 2);
    const tab = malla(caja(ctx, 0.6, 0.12, hBung + 1.0, 0), matTab);
    tab.position.set(x * 0.9, 0, z0 + (hBung + 1.0) / 2);
    const piezas = [tab];
    if (o.smd) {
      // Flat terminal bent under the base.
      const term = malla(caja(ctx, D * 0.32, 0.65, 0.15, 0.02), matPat);
      term.position.set(s * (D / 2 + 0.1 - D * 0.16), 0, 0.075);
      piezas.push(term);
    } else {
      const largo = ctx.montaje === 'placa' ? ctx.placa + 1 : s < 0 ? 22 : 18;
      const pat = malla(hilo(ctx, [[x, 0, z0 + 0.4], [x, 0, -largo]], d / 2, { clave: `elec-pat:${x}:${largo}:${z0}` }), matPat);
      piezas.push(pat);
    }
    g.add(
      parte(s < 0 ? 'positivo' : 'negativo', {
        etiqueta:
          s < 0
            ? { texto: o.smd ? 'Terminal positivo (lado de la base achaflanada)' : ctx.montaje === 'placa' ? 'Terminal positivo' : 'Patilla positiva: la más larga', ref: 'sec-3.4.2', punto: [x, 0, o.smd ? 0 : -6] }
            : undefined,
        explosion: [0, 0, -L * 0.6],
      }, ...piezas),
    );
  }
  if (o.smd) {
    // Plastic seat with the two corners chamfered on the positive side.
    const s = D + 0.3;
    const sh = new Shape();
    const c = s * 0.18;
    sh.moveTo(-s / 2 + c, -s / 2);
    sh.lineTo(s / 2, -s / 2);
    sh.lineTo(s / 2, s / 2);
    sh.lineTo(-s / 2 + c, s / 2);
    sh.lineTo(-s / 2, s / 2 - c);
    sh.lineTo(-s / 2, -s / 2 + c);
    sh.closePath();
    const base = malla(ctx.rec.geometria(`base-vchip:${D}`, () => new ExtrudeGeometry(sh, { depth: z0 - 0.1, bevelEnabled: false })), material(ctx, ACABADOS.plasticoNegro));
    base.position.z = 0.1;
    g.add(parte('base', { etiqueta: { texto: 'Base de plástico: el chaflán marca el positivo', ref: 'sec-3.4.2', punto: [-s / 2, -s / 2 + c, z0] }, explosion: [0, 0, -L * 0.3] }, base));
  }
  const huella: Huella = o.smd
    ? {
        pads: [
          { n: '1', x: -D * 0.42, y: 0, forma: 'rect', w: D * 0.42, h: 1.6 },
          { n: '2', x: D * 0.42, y: 0, forma: 'rect', w: D * 0.42, h: 1.6 },
        ],
        ancho: D + 0.3,
        fondo: D + 0.3,
        alto: z0 + L,
        origenKicad: [0, 0],
        kicad: `Capacitor_SMD:CP_Elec_${D}x${L}`,
      }
    : {
        pads: [
          { n: '1', x: -P / 2, y: 0, forma: 'rect', w: 1.6, h: 1.6, taladro: d + 0.3 },
          { n: '2', x: P / 2, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: d + 0.3 },
        ],
        ancho: D,
        fondo: D,
        alto: z0 + L,
        origenKicad: [-P / 2, 0],
        kicad: `Capacitor_THT:CP_Radial_D${D.toFixed(1)}mm_P${P.toFixed(2)}mm`,
      };
  return {
    g,
    datos: {
      huella,
      cortes: [
        { nombre: 'Longitudinal', normal: [0, 1, 0], min: -R - 0.1, max: R, inicial: 0 },
        { nombre: 'Transversal', normal: [0, 0, -1], min: -(z0 + L + 0.1), max: -z0, inicial: -(zEl + hEl * 0.7) },
      ],
      explosionable: true,
      marcado: o.texto.join(' '),
    },
  };
}

const FUNDAS: Record<string, { funda: string; franja: string; texto: string }> = {
  azul: { funda: '#1f4f9a', franja: '#bcc9df', texto: '#e8eef8' },
  negro: { funda: '#1d1e21', franja: '#c9c3a8', texto: '#d9d2b4' },
  verde: { funda: '#1e5a3a', franja: '#c7d8c4', texto: '#e3eee1' },
};

function textoUF(C: number): string {
  const u = C * 1e6;
  return `${Number(u.toPrecision(3)).toString().replace('.', ',')}µF`;
}

const electrolitico: Constructor = (ctx, p) => {
  const C = leerValor(p.valor as string | number, 1000e-6);
  const V = Number(p.tension) || 16;
  // A footprint (board views) fixes the diameter and pitch; otherwise the size comes from C·V.
  const Df = Number(p.diametro);
  let l = lataPara(C, V);
  if (Df > 0) {
    const mismas = LATAS.filter((x) => Math.abs(x.D - Df) < 0.4);
    l = mismas.find((x) => (Math.PI * x.D * x.D * x.L) / 4 >= 0.08 * C * 1e6 * V) ?? mismas[mismas.length - 1] ?? { ...l, D: Df };
  }
  if (Number(p.paso) > 0) l = { ...l, P: Number(p.paso) };
  const f = FUNDAS[String(p.funda)] ?? FUNDAS.azul!;
  return lata(ctx, { ...l, funda: f.funda, franja: f.franja, colorTexto: f.texto, texto: [`${textoUF(C)} ${String(V).replace('.', ',')}V`, '105°C'] });
};

const VCHIP = [
  { D: 4, L: 5.4 },
  { D: 5, L: 5.4 },
  { D: 6.3, L: 5.4 },
  { D: 6.3, L: 7.7 },
  { D: 8, L: 10.2 },
  { D: 10, L: 10.2 },
];

const electroliticoSmd: Constructor = (ctx, p) => {
  const C = leerValor(p.valor as string | number, 100e-6);
  const V = Number(p.tension) || 16;
  const vol = Math.max(60, 0.12 * C * 1e6 * V);
  let l = VCHIP.find((x) => (Math.PI * x.D * x.D * x.L) / 4 >= vol) ?? VCHIP[VCHIP.length - 1]!;
  if (Number(p.diametro) > 0) l = { D: Number(p.diametro), L: Number(p.alto) > 0 ? Number(p.alto) : l.L };
  const u = Math.round(C * 1e6);
  return lata(ctx, { D: l.D, L: l.L, P: l.D * 0.6, d: 0.5, funda: '#c9ccd0', franja: '#c9ccd0', colorTexto: '#1d1e21', texto: [String(u), `${String(V).replace('.', ',')}V`], smd: true });
};

const SUPER = [
  { C: 0.47, D: 8, L: 13 },
  { C: 1, D: 8, L: 20 },
  { C: 4.7, D: 10, L: 20 },
  { C: 10, D: 10, L: 30 },
  { C: 22, D: 12.5, L: 35.5 },
];

const supercondensador: Constructor = (ctx, p) => {
  const C = Number(p.valor) || 1;
  const V = Number(p.tension) || 2.7;
  const l = SUPER.find((x) => x.C >= C - 1e-9) ?? SUPER[SUPER.length - 1]!;
  return lata(ctx, {
    D: l.D,
    L: l.L,
    P: l.D >= 10 ? 5 : 3.5,
    d: 0.6,
    funda: '#24262a',
    franja: '#8d97a1',
    colorTexto: '#e9c46a',
    texto: [`${String(C).replace('.', ',')}F ${String(V).replace('.', ',')}V`, 'EDLC'],
    super: true,
  });
};

// ------------------------------------------------------------------ tantalum chip

const CAJAS_TANTALO: Record<string, { L: number; W: number; H: number; eia: string }> = {
  A: { L: 3.2, W: 1.6, H: 1.6, eia: '3216-18' },
  B: { L: 3.5, W: 2.8, H: 1.9, eia: '3528-21' },
  C: { L: 6.0, W: 3.2, H: 2.6, eia: '6032-28' },
  D: { L: 7.3, W: 4.3, H: 2.9, eia: '7343-31' },
};

const tantalo: Constructor = (ctx, p) => {
  const k = String(p.caja ?? 'B');
  const { L, W, H, eia } = CAJAS_TANTALO[k] ?? CAJAS_TANTALO.B!;
  const C = leerValor(p.valor as string | number, 10e-6);
  const V = Number(p.tension) || 16;
  const cod = codigoCondensador(C);
  const g = new Group();
  const lc = L - 0.5;
  const ambar = '#d9a43a';
  const cuerpo = malla(caja(ctx, lc, W, H - 0.1, Math.min(0.15, H * 0.08)), material(ctx, { color: ambar, rugosidad: 0.55, corte: '#c79434' }));
  const banda = malla(caja(ctx, lc * 0.16, W * 0.96, 0.02, 0), material(ctx, { color: '#6b3a1f', rugosidad: 0.5 }));
  banda.position.set(-lc / 2 + lc * 0.12, 0, (H - 0.1) / 2 + 0.005);
  const tx = rotulo(ctx, [cod, `${String(V).replace('.', ',')}V`], lc * 0.55, W * 0.7, { color: '#3b2412' });
  tx.position.set(lc * 0.1, 0, (H - 0.1) / 2 + 0.012);
  g.add(
    colocar(
      parte('cuerpo', {
        etiqueta: { texto: `Epoxi moldeado: «${cod}» = ${textoValor(C, 'F')}; la banda marca el POSITIVO`, ref: 'fig-3.6', punto: [-lc / 2 + lc * 0.12, 0, (H - 0.1) / 2] },
        explosion: [0, 0, H * 1.8],
      }, cuerpo, banda, tx),
      0,
      0,
      0.05 + (H - 0.1) / 2,
    ),
  );
  // Inside: sintered tantalum pellet (anode) with its wire, coated with MnO₂, graphite and silver (cathode).
  const lp = lc * 0.55;
  const pastilla = malla(caja(ctx, lp, W * 0.62, H * 0.5, 0.08), material(ctx, { color: '#4a4c52', metal: 0.3, rugosidad: 0.85, corte: '#3d3f45' }));
  const capaPlata = malla(caja(ctx, lp + 0.06, W * 0.62 + 0.06, H * 0.5 + 0.06, 0.1), material(ctx, { color: '#c9c9c4', metal: 0.8, rugosidad: 0.45, corte: '#1c1c1c' }));
  capaPlata.scale.set(1, 1, 1);
  const hiloTa = malla(cilindro(ctx, 0.09, lc * 0.28, 12), material(ctx, { color: '#8b8e94', metal: 0.9, rugosidad: 0.35 }));
  hiloTa.rotation.y = -Math.PI / 2;
  hiloTa.position.x = -lp / 2;
  const zP = 0.05 + (H - 0.1) * 0.52;
  g.add(colocar(parte('pastilla', { etiqueta: { texto: 'Pastilla de tántalo sinterizado (ánodo), con su óxido Ta₂O₅', ref: 'sec-3.4.4', punto: [lp * 0.2, -W * 0.31, H * 0.25] }, interior: true, entero: false, explosion: [0, 0, H * 0.6] }, pastilla, hiloTa), lc * 0.1, 0, zP));
  g.add(colocar(parte('catodo', { etiqueta: { texto: 'Cátodo: MnO₂ o polímero, grafito y plata', ref: 'sec-3.4.4', punto: [lp * 0.5, W * 0.31, 0] }, interior: true, explosion: [0, 0, H * 0.3] }, capaPlata), lc * 0.1, 0, zP));
  // Terminations: folded J-leads (+ at −X).
  const matT = material(ctx, ACABADOS.estanoMate);
  for (const s of [-1, 1]) {
    const cara = malla(caja(ctx, 0.12, W * 0.55, H * 0.5, 0.02), matT);
    cara.position.set(s * (L / 2 - 0.06), 0, H * 0.25);
    const pie = malla(caja(ctx, 0.8, W * 0.55, 0.1, 0.02), matT);
    pie.position.set(s * (L / 2 - 0.4), 0, 0.05);
    const interno = malla(caja(ctx, lc * 0.18, W * 0.4, 0.1, 0), matT);
    interno.position.set(s * (lc / 2 - lc * 0.09), 0, zP - H * 0.28);
    g.add(parte(s < 0 ? 'anodo' : 'catodo-terminal', { etiqueta: s < 0 ? { texto: 'Terminal positivo, soldado al hilo de tántalo', ref: 'sec-3.4.4', punto: [-L / 2, -W * 0.27, H * 0.25] } : undefined, explosion: [s * L * 0.4, 0, 0] }, cara, pie, interno));
  }
  return {
    g,
    datos: {
      huella: { pads: padsChip(L, W, 0.8), ancho: L, fondo: W, alto: H, origenKicad: [0, 0], kicad: `Capacitor_Tantalum_SMD:CP_EIA-${eia}_Kemet-${k}` },
      cortes: [{ nombre: 'Longitudinal', normal: [0, 1, 0], min: -W / 2, max: W / 2, inicial: 0 }],
      explosionable: true,
      marcado: `${cod} ${V}V`,
    },
  };
};

export const CONSTRUCTORES_C: Record<string, Constructor> = {
  'condensador-disco': condensadorDisco,
  mlcc,
  'condensador-pelicula': condensadorPelicula,
  electrolitico,
  'electrolitico-smd': electroliticoSmd,
  supercondensador,
  tantalo,
};

