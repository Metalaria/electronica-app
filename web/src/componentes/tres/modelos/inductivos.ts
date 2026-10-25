// Inductors, transformers and relays (book 4.2, 4.4, 4.5, 4.6; figures 4.1, 4.3, 4.5, 4.11, 20.6): ferrite
// drum (radial), toroid with its counted turns, shielded SMD power inductor, EI transformer with interleaved
// laminations, primary/secondary and tape, and a clapper relay with coil, core, yoke, armature and contacts.

import { BufferGeometry, ExtrudeGeometry, Group, Matrix4, Path, Shape, Vector3 } from 'three';
import { leerValor, textoValor } from './codigos';
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
  tubo,
  type Constructor,
  type Ctx,
} from './comun';

/** Inductance code in µH like the resistor SMD code: 10 mH → «103». */
function codigoL(h: number): string {
  const uh = h * 1e6;
  if (uh < 10) return uh.toFixed(1).replace('.', 'R').replace(/R0$/, 'R0');
  const e = Math.floor(Math.log10(uh) + 1e-9) - 1;
  return `${Math.round(uh / 10 ** e)}${e}`;
}

/** Copper winding texture: fine turns around a cylinder (v along the height). */
function texturaEspiras(ctx: Ctx, n: number) {
  return texturaPintada(ctx, `espiras:${n}`, 16, 512, (g, w, h) => {
    g.fillStyle = '#b5652c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const y = (h * (i + 0.5)) / n;
      g.fillStyle = 'rgba(70,30,10,0.55)';
      g.fillRect(0, y - h / n / 2, w, (h / n) * 0.22);
      g.fillStyle = 'rgba(255,210,170,0.35)';
      g.fillRect(0, y - h / n / 8, w, (h / n) * 0.18);
    }
  });
}

const FERRITA = { color: '#2d2e31', rugosidad: 0.72, corte: '#3b3c40' };

// ------------------------------------------------------------------ radial drum inductor

const bobinaRadial: Constructor = (ctx, p) => {
  const L = leerValor(p.valor as string | number, 10e-3);
  const D = Number(p.diametro) || 8;
  const funda = p.funda !== false;
  const R = D / 2;
  const H = D * 1.15;
  const P = D >= 10 ? 5 : D >= 8 ? 5 : 3.5;
  const z0 = 0.4;
  const g = new Group();
  const rN = R * 0.42;
  const fl = Math.max(0.8, H * 0.1);
  const tambor = malla(
    torno(ctx, [
      [0.001, 0],
      [R * 0.98, 0],
      [R, 0.15],
      [R, fl - 0.15],
      [R * 0.98, fl],
      [rN, fl],
      [rN, H - fl],
      [R * 0.95, H - fl],
      [R * 0.97, H - fl + 0.15],
      [R * 0.97, H - 0.15],
      [R * 0.95, H],
      [0.001, H],
    ], 48, `tambor:${D}`),
    material(ctx, FERRITA),
  );
  g.add(colocar(parte('nucleo', { etiqueta: { texto: 'Núcleo de ferrita en carrete (tambor): el flujo se cierra por el aire', ref: 'sec-4.2', punto: [R * 0.7, -R * 0.7, H] }, interior: funda, explosion: [0, 0, 0] }, tambor), 0, 0, z0));
  const vueltas = 26;
  const bob = malla(
    torno(ctx, [
      [rN, fl + 0.05],
      [R * 0.86, fl + 0.05],
      [R * 0.9, H / 2],
      [R * 0.86, H - fl - 0.05],
      [rN, H - fl - 0.05],
    ], 48, `bob-radial:${D}`),
    materialTextura(ctx, texturaEspiras(ctx, vueltas), { metal: 0.7, rugosidad: 0.35, corte: '#a85a26' }),
  );
  g.add(colocar(parte('bobinado', { etiqueta: { texto: 'Bobinado de cobre esmaltado', ref: 'sec-4.1', punto: [-R * 0.9, -0.1, H * 0.5] }, interior: funda, explosion: [0, 0, 0] }, bob), 0, 0, z0));
  if (funda) {
    const cod = codigoL(L);
    const sh = malla(
      torno(ctx, [
        [R * 0.7, -0.05],
        [R + 0.15, 0.1],
        [R + 0.15, H - 0.1],
        [R * 0.75, H + 0.05],
      ], 48, `funda-bob:${D}`),
      material(ctx, { color: '#2b4f7c', rugosidad: 0.35, corte: '#244368' }),
    );
    const tx = rotulo(ctx, [cod], D * 0.7, H * 0.32, { color: '#f2f2f2' });
    tx.rotation.x = Math.PI / 2;
    tx.position.set(0, -R - 0.17, H * 0.55);
    g.add(colocar(parte('funda', { etiqueta: { texto: `Funda termorretráctil con «${cod}» = ${textoValor(L, 'H')} (código en µH)`, ref: 'fig-4.5', punto: [0, -R - 0.15, H * 0.75] }, explosion: [0, 0, H * 1.3] }, sh, tx), 0, 0, z0));
  }
  const zFin = finPatilla(ctx, 16);
  const matP = material(ctx, ACABADOS.estano);
  for (const s of [-1, 1]) g.add(parte(s < 0 ? 'patilla-1' : 'patilla-2', {}, malla(hilo(ctx, [[s * P / 2, 0, z0 + 0.6], [s * P / 2, 0, zFin]], 0.35, { clave: `bobr:${P}:${s}:${zFin}` }), matP)));
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -P / 2, y: 0, forma: 'rect', w: 1.8, h: 1.8, taladro: 1 },
          { n: '2', x: P / 2, y: 0, forma: 'circulo', w: 1.8, h: 1.8, taladro: 1 },
        ],
        ancho: D,
        fondo: D,
        alto: z0 + H,
        origenKicad: [-P / 2, 0],
      },
      cortes: [{ nombre: 'Vertical', normal: [0, 1, 0], min: -R - 0.2, max: R, inicial: 0 }],
      explosionable: funda,
      marcado: codigoL(L),
    },
  };
};

// ------------------------------------------------------------------ toroid

const toroide: Constructor = (ctx, p) => {
  const N = Math.max(4, Math.min(60, Math.round(Number(p.espiras) || 18)));
  const dev = Number(p.devanados) === 2 ? 2 : 1;
  const ferr = String(p.nucleo) === 'ferrita';
  const OD = Number(p.diametro) || 16;
  const ID = OD * 0.58;
  const h = OD * 0.38;
  const rw = Math.max(0.25, OD * 0.022);
  const Rm = (OD + ID) / 4;
  const a = (OD - ID) / 4;
  const zc = h / 2 + rw * 2 + 0.3;
  const g = new Group();
  const rc = Math.min(a, h / 2) * 0.35;
  const perfil: [number, number][] = [];
  // Rounded-rectangle cross-section revolved around Z.
  const esquinas: [number, number, number][] = [
    [ID / 2 + rc, -h / 2 + rc, Math.PI],
    [OD / 2 - rc, -h / 2 + rc, -Math.PI / 2],
    [OD / 2 - rc, h / 2 - rc, 0],
    [ID / 2 + rc, h / 2 - rc, Math.PI / 2],
  ];
  for (const [cx, cy, a0] of esquinas) for (let i = 0; i <= 4; i++) {
    const t = a0 + (Math.PI / 2) * (i / 4);
    perfil.push([cx + rc * Math.cos(t), cy + rc * Math.sin(t)]);
  }
  perfil.push(perfil[0]!);
  const ordenado = perfil.map(([r, z]) => [r, z] as [number, number]);
  const geoN = ctx.rec.geometria(`toro:${OD}:${ctx.bajo}`, () => {
    // LatheGeometry needs a profile; a closed one gives a solid ring.
    return torno(ctx, ordenado, 64, undefined);
  });
  const colorN = ferr ? { color: '#2f5f45', rugosidad: 0.45, corte: '#2a2b2e' } : { color: '#d2ab3c', rugosidad: 0.6, corte: '#4b4b4f' };
  const nucleo = malla(geoN, material(ctx, colorN));
  g.add(
    colocar(
      parte('nucleo', {
        etiqueta: { texto: ferr ? 'Núcleo toroidal de ferrita (recubierto): el flujo queda dentro del anillo' : 'Núcleo toroidal de polvo de hierro: el flujo queda dentro del anillo', ref: 'sec-4.4', punto: [0, -OD / 2, 0] },
        explosion: [0, 0, 0],
      }, nucleo),
      0,
      0,
      zc,
    ),
  );
  // Windings: N turns hugging the rounded cross-section, over an arc of the ring.
  const zFin = finPatilla(ctx, 14);
  const matCu = material(ctx, ACABADOS.cobreEsmaltado);
  const arcos: [number, number][] = dev === 2 ? [[-Math.PI * 0.95, -Math.PI * 0.08], [Math.PI * 0.05, Math.PI * 0.92]] : [[-Math.PI * 0.85, Math.PI * 0.85]];
  const pads: { n: string; x: number; y: number; forma: 'rect' | 'circulo'; w: number; h: number; taladro: number }[] = [];
  arcos.forEach(([f0, f1], k) => {
    const A = a + rw * 1.1;
    const B = h / 2 + rw * 1.1;
    const sup = (t: number) => Math.sign(t) * Math.abs(t) ** 0.4;
    const pt = (u: number, out: Vector3): Vector3 => {
      const phi = f0 + (f1 - f0) * u;
      const th = u * N * Math.PI * 2;
      const rr = Rm + A * sup(Math.cos(th));
      return out.set(rr * Math.cos(phi), rr * Math.sin(phi), zc + B * sup(Math.sin(th)));
    };
    const geo = tubo(ctx, pt, N * 28, rw, 6);
    const espiras = malla(geo, matCu);
    // Leads: from the ends of the winding down to the board.
    const extremos = [f0, f1].map((phi) => [(Rm + A) * Math.cos(phi), (Rm + A) * Math.sin(phi)] as [number, number]);
    const pats = extremos.map(([x, y], i) =>
      malla(hilo(ctx, [[x, y, zc], [x * 1.08, y * 1.08, zc - h * 0.3], [x * 1.08, y * 1.08, zFin]], rw, { curva: rw * 2, clave: `toro-pat:${OD}:${k}:${i}:${zFin}:${N}` }), matCu),
    );
    extremos.forEach(([x, y], i) => pads.push({ n: String(k * 2 + i + 1), x: x * 1.08, y: y * 1.08, forma: k * 2 + i === 0 ? 'rect' : 'circulo', w: 1.6, h: 1.6, taladro: 2 * rw + 0.3 }));
    const fm = (f0 + f1) / 2;
    g.add(
      parte(`devanado-${k + 1}`, {
        etiqueta: { texto: dev === 2 ? `Devanado ${k + 1}: ${N} espiras` : `${N} espiras de cobre esmaltado: L ∝ N²`, ref: 'sec-4.1', punto: [(Rm + A) * Math.cos(fm), (Rm + A) * Math.sin(fm), zc + B] },
        explosion: [Math.cos(fm) * OD * 0.25, Math.sin(fm) * OD * 0.25, h * 0.8],
      }, espiras, ...pats),
    );
  });
  return {
    g,
    datos: {
      huella: { pads, ancho: OD + 2 * rw, fondo: OD + 2 * rw, alto: zc + h / 2 + rw * 2, origenKicad: [pads[0]!.x, pads[0]!.y] },
      cortes: [
        { nombre: 'Vertical', normal: [0, 1, 0], min: -OD / 2 - 1, max: OD / 2, inicial: 0 },
        { nombre: 'Horizontal', normal: [0, 0, -1], min: -(zc + h / 2 + 1), max: 0, inicial: -zc },
      ],
      explosionable: true,
      marcado: `${N}`,
    },
  };
};

// ------------------------------------------------------------------ shielded SMD power inductor

const bobinaSmd: Constructor = (ctx, p) => {
  const Lh = leerValor(p.valor as string | number, 10e-6);
  const A = Number(p.tamano) || 6;
  const H = A >= 10 ? 4.5 : A >= 6 ? 3 : 2;
  const R = A * 0.43;
  const g = new Group();
  const z0 = 0.05;
  const fl = H * 0.16;
  const rN = R * 0.45;
  const tambor = malla(
    torno(ctx, [
      [0.001, 0],
      [R * 0.92, 0],
      [R * 0.92, fl],
      [rN, fl],
      [rN, H - fl],
      [R * 0.98, H - fl],
      [R * 0.98, H],
      [0.001, H],
    ], 48, `tambor-smd:${A}`),
    material(ctx, FERRITA),
  );
  const cod = codigoL(Lh);
  const tx = rotulo(ctx, [cod], R * 1.1, R * 0.7, { color: '#e9e9e9' });
  tx.position.z = H + 0.003;
  g.add(colocar(parte('tambor', { etiqueta: { texto: `Tambor de ferrita, marcado «${cod}» = ${textoValor(Lh, 'H')}`, ref: 'sec-4.2', punto: [R * 0.5, -R * 0.4, H] }, explosion: [0, 0, H * 1.2] }, tambor, tx), 0, 0, z0));
  const bob = malla(torno(ctx, [[rN, fl + 0.03], [R * 0.86, fl + 0.03], [R * 0.86, H - fl - 0.03], [rN, H - fl - 0.03]], 48, `bob-smd:${A}`), materialTextura(ctx, texturaEspiras(ctx, 10), { metal: 0.7, rugosidad: 0.35, corte: '#a85a26' }));
  g.add(colocar(parte('bobinado', { etiqueta: { texto: 'Bobinado de hilo grueso: poca resistencia, mucha corriente', ref: 'sec-4.4', punto: [R * 0.86, 0, H * 0.5] }, interior: true, explosion: [0, 0, H * 0.6] }, bob), 0, 0, z0));
  // Square ferrite ring (shield) with a round bore.
  const anillo = ctx.rec.geometria(`anillo-smd:${A}:${ctx.bajo}`, () => {
    const s = new Shape();
    const c = A * 0.08;
    s.moveTo(-A / 2 + c, -A / 2);
    s.lineTo(A / 2 - c, -A / 2);
    s.lineTo(A / 2, -A / 2 + c);
    s.lineTo(A / 2, A / 2 - c);
    s.lineTo(A / 2 - c, A / 2);
    s.lineTo(-A / 2 + c, A / 2);
    s.lineTo(-A / 2, A / 2 - c);
    s.lineTo(-A / 2, -A / 2 + c);
    s.closePath();
    s.holes.push(new Path().absarc(0, 0, R + 0.05, 0, Math.PI * 2, true));
    return new ExtrudeGeometry(s, { depth: H - fl * 0.6, bevelEnabled: false, curveSegments: ctx.bajo ? 16 : 40 });
  });
  const blindaje = malla(anillo, material(ctx, { ...FERRITA, color: '#38393d' }));
  g.add(colocar(parte('blindaje', { etiqueta: { texto: 'Anillo de ferrita: cierra el flujo y apantalla', ref: 'sec-4.2', punto: [A / 2, -A / 2, H * 0.6] }, explosion: [0, 0, -H * 0.2] }, blindaje), 0, 0, z0));
  const matT = material(ctx, ACABADOS.estanoMate);
  for (const s of [-1, 1]) {
    const t = malla(caja(ctx, A * 0.22, A * 0.7, 0.2, 0.03), matT);
    g.add(colocar(parte(s < 0 ? 'terminal-1' : 'terminal-2', { explosion: [s * A * 0.3, 0, -H * 0.4] }, t), s * (A / 2 - A * 0.11), 0, 0.1));
  }
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -A * 0.38, y: 0, forma: 'rect', w: A * 0.3, h: A * 0.75 },
          { n: '2', x: A * 0.38, y: 0, forma: 'rect', w: A * 0.3, h: A * 0.75 },
        ],
        ancho: A,
        fondo: A,
        alto: H + z0,
        origenKicad: [0, 0],
      },
      cortes: [{ nombre: 'Vertical', normal: [0, 1, 0], min: -A / 2, max: A / 2, inicial: 0 }],
      explosionable: true,
      marcado: cod,
    },
  };
};

// ------------------------------------------------------------------ EI transformer

const NUCLEOS_EI: Record<string, { a: number; pila: number; va: number }> = {
  EI30: { a: 10, pila: 10.5, va: 1.5 },
  EI38: { a: 12.7, pila: 13.6, va: 3 },
  EI48: { a: 16, pila: 16, va: 10 },
};

function chapaE(a: number): Shape {
  // E lamination in the XZ plane (legs pointing down), centre leg a, outer legs a/2, window a/2 × 1,5a.
  const s = new Shape();
  const W = 3 * a;
  const Hh = 2 * a;
  s.moveTo(-W / 2, 0);
  s.lineTo(-W / 2 + a / 2, 0);
  s.lineTo(-W / 2 + a / 2, 1.5 * a);
  s.lineTo(-a / 2, 1.5 * a);
  s.lineTo(-a / 2, 0);
  s.lineTo(a / 2, 0);
  s.lineTo(a / 2, 1.5 * a);
  s.lineTo(W / 2 - a / 2, 1.5 * a);
  s.lineTo(W / 2 - a / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, Hh);
  s.lineTo(-W / 2, Hh);
  s.closePath();
  return s;
}

const transformador: Constructor = (ctx, p) => {
  const n = NUCLEOS_EI[String(p.nucleo)] ?? NUCLEOS_EI.EI38!;
  const { a, pila } = n;
  const Vs = Number(p.secundario) || 12;
  const Vp = Number(p.primario) || 230;
  const W = 3 * a;
  const g = new Group();
  const zBase = 3.2; // bobbin base with the pins
  const zI = zBase; // the I bar sits at the bottom, the E above with its legs down
  const t = 0.5;
  const nChapas = Math.max(6, Math.round(pila / t));
  const geoE = ctx.rec.geometria(`chapaE:${a}`, () => {
    const gg = new ExtrudeGeometry(chapaE(a), { depth: t * 0.9, bevelEnabled: false });
    gg.rotateX(Math.PI / 2);
    gg.translate(0, t * 0.45, 0);
    return gg;
  });
  const geoI = caja(ctx, W, t * 0.9, a / 2, 0);
  const matFe = material(ctx, { color: '#7d8186', metal: 0.75, rugosidad: 0.55, corte: '#62666b' });
  const es: Matrix4[] = [];
  const is: Matrix4[] = [];
  for (let i = 0; i < nChapas; i++) {
    const y = -pila / 2 + t * (i + 0.5);
    // Interleaved: every other plate is turned over (E at the bottom, I on top), as stacked by hand.
    if (i % 2 === 0) {
      es.push(mt(0, y, zI + a / 2));
      is.push(mt(0, y, zI + a / 4));
    } else {
      const m = new Matrix4().makeRotationY(Math.PI);
      m.setPosition(0, y, zI + 2 * a);
      es.push(m);
      is.push(mt(0, y, zI + 2.5 * a - a / 4));
    }
  }
  if (ctx.bajo) {
    const bloque = malla(caja(ctx, W, pila, 2.5 * a, 0.2), matFe);
    g.add(colocar(parte('nucleo', {}, bloque), 0, 0, zI + 1.25 * a));
  } else {
    g.add(parte('chapas-e', { etiqueta: { texto: 'Chapas E de hierro al silicio, alternadas: laminadas contra las corrientes de Foucault', ref: 'sec-4.4', punto: [-W / 2, -pila / 2, zI + 2.2 * a] }, explosion: [0, 0, a * 1.6] }, instancias(geoE, matFe, es)));
    g.add(parte('chapas-i', { etiqueta: { texto: 'Chapas I que cierran el circuito magnético', ref: 'sec-4.6', punto: [W / 2, -pila / 2, zI + a * 0.25] }, explosion: [0, 0, -a * 0.9] }, instancias(geoI, matFe, is)));
  }
  // Bobbin with the windings around the centre leg: they stick out in front of and behind the stack.
  const hVentana = 1.5 * a;
  const zV = zI + a / 2;
  const anilloRect = (wi: number, di: number, wo: number, dod: number, clave: string): BufferGeometry =>
    ctx.rec.geometria(`anillo-rect:${clave}:${ctx.bajo}`, () => {
      const rr = (w: number, d: number, r: number, inv = false) => {
        const sh = inv ? new Path() : new Shape();
        const pts: [number, number][] = [];
        const k = ctx.bajo ? 2 : 5;
        for (const [cx, cy, a0] of [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, Math.PI / 2], [-w / 2 + r, -d / 2 + r, Math.PI], [w / 2 - r, -d / 2 + r, -Math.PI / 2]] as [number, number, number][])
          for (let i = 0; i <= k; i++) pts.push([cx + r * Math.cos(a0 + (Math.PI / 2) * (i / k)), cy + r * Math.sin(a0 + (Math.PI / 2) * (i / k))]);
        if (inv) pts.reverse();
        pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
        sh.closePath();
        return sh;
      };
      const s = rr(wo, dod, Math.min(wo, dod) * 0.18) as Shape;
      s.holes.push(rr(wi, di, Math.min(wi, di) * 0.12, true) as Path);
      return new ExtrudeGeometry(s, { depth: hVentana - 0.8, bevelEnabled: false });
    });
  const pared = 0.8;
  const wi = a + 2 * pared;
  const di = pila + 2 * pared;
  const ancho = a / 2 - 0.6;
  const prim = malla(anilloRect(wi, di, wi + ancho * 1.1, di + ancho * 1.1, `p:${a}:${pila}`), materialTextura(ctx, texturaEspiras(ctx, 60), { metal: 0.7, rugosidad: 0.35, corte: '#a5562a' }));
  const sec = malla(anilloRect(wi + ancho * 1.1, di + ancho * 1.1, wi + ancho * 1.85, di + ancho * 1.85, `s:${a}:${pila}`), materialTextura(ctx, texturaEspiras(ctx, 24), { metal: 0.7, rugosidad: 0.3, corte: '#c06a33' }));
  const cinta = malla(anilloRect(wi + ancho * 1.85, di + ancho * 1.85, wi + ancho * 1.95, di + ancho * 1.95, `c:${a}:${pila}`), material(ctx, { color: '#e6c04a', rugosidad: 0.4, corte: '#d4ad3a' }));
  const txt = rotulo(ctx, [`${Vp}V / ${Vs}V`, `${n.va}VA`], (wi + ancho * 1.9) * 0.8, hVentana * 0.4, { color: '#3b3320' });
  txt.rotation.x = Math.PI / 2;
  txt.position.set(0, -(di + ancho * 1.95) / 2 - 0.01, (hVentana - 0.8) / 2);
  g.add(colocar(parte('primario', { etiqueta: { texto: `Primario (${Vp} V): hilo fino, muchas espiras, en el interior`, ref: 'sec-4.6', punto: [0, -(di + ancho * 1.1) / 2, hVentana * 0.85] }, interior: true, explosion: [0, -pila * 0.8, 0] }, prim), 0, 0, zV + 0.4));
  g.add(colocar(parte('secundario', { etiqueta: { texto: `Secundario (${Vs} V): hilo grueso, pocas espiras`, ref: 'sec-4.6', punto: [W * 0.18, -(di + ancho * 1.85) / 2, hVentana * 0.3] }, interior: true, explosion: [0, -pila * 1.6, 0] }, sec), 0, 0, zV + 0.4));
  g.add(colocar(parte('cinta', { etiqueta: { texto: 'Cinta aislante con la relación de tensiones', ref: 'sec-4.6.1', punto: [-wi * 0.4, -(di + ancho * 1.95) / 2, hVentana * 0.7] }, explosion: [0, -pila * 2.4, 0] }, cinta, txt), 0, 0, zV + 0.4));
  // Bobbin: base with the pins and the two flanges.
  const matCarrete = material(ctx, { color: '#2a2b2e', rugosidad: 0.6, corte: '#3a3b3f' });
  const base = malla(caja(ctx, W * 0.92, di + ancho * 2.4 + 3, zBase - 0.4, 0.3), matCarrete);
  const brida = malla(caja(ctx, wi + ancho * 2.1, di + ancho * 2.3, 0.6, 0.2), matCarrete);
  const brida2 = brida.clone();
  brida.position.z = zV + 0.1 - (zBase - 0.4) / 2 - 0.4;
  brida2.position.z = zV + hVentana - 0.1 - (zBase - 0.4) / 2 - 0.4;
  g.add(colocar(parte('carrete', { etiqueta: { texto: 'Carrete con las patillas', punto: [W * 0.46, (di + ancho * 2.4 + 3) / 2, 0] }, explosion: [0, 0, 0] }, base, brida, brida2), 0, 0, (zBase - 0.4) / 2 + 0.4));
  // Pins: two rows (primary on −Y, secondary on +Y).
  const zFin = finPatilla(ctx, 4);
  const matP = material(ctx, ACABADOS.estano);
  const yPin = (di + ancho * 2.4 + 3) / 2 - 1.4;
  const xs = [-W * 0.3, 0, W * 0.3];
  const pads: { n: string; x: number; y: number; forma: 'rect' | 'circulo'; w: number; h: number; taladro: number }[] = [];
  const pines = new Group();
  let k = 1;
  for (const y of [-yPin, yPin])
    for (const x of xs) {
      if (x === 0 && y < 0) continue;
      pines.add(colocar(malla(caja(ctx, 0.8, 0.8, 0.4 - zFin, 0.1), matP), x, y, (0.4 + zFin) / 2));
      pads.push({ n: String(k), x, y, forma: k === 1 ? 'rect' : 'circulo', w: 2, h: 2, taladro: 1.2 });
      k++;
    }
  g.add(parte('patillas', {}, pines));
  return {
    g,
    datos: {
      huella: { pads, ancho: W, fondo: di + ancho * 2.4 + 3, alto: zI + 2.5 * a, origenKicad: [pads[0]!.x, pads[0]!.y] },
      cortes: [
        { nombre: 'Vertical', normal: [0, 1, 0], min: -(di + ancho * 2) / 2, max: pila / 2, inicial: 0 },
        { nombre: 'Lateral', normal: [1, 0, 0], min: -W / 2, max: W / 2, inicial: 0 },
      ],
      explosionable: true,
      marcado: `${Vp}V/${Vs}V`,
    },
  };
};

// ------------------------------------------------------------------ relay (SRD-type clapper relay)

const rele: Constructor = (ctx, p) => {
  const on = p.activado === true;
  const Vb = Number(p.bobina) || 5;
  const L = 19;
  const W = 15.5;
  const H = 15.3;
  const g = new Group();
  // Cover.
  const tapa = malla(caja(ctx, L, W, H - 1.2, 0.6), material(ctx, { color: '#2a5fae', rugosidad: 0.35, corte: '#244f91' }));
  const tx = rotulo(ctx, [`SRD-${String(Vb).padStart(2, '0')}VDC-SL-C`, '10A 250VAC  10A 30VDC'], L * 0.82, H * 0.32, { color: '#f4f6fa', peso: 600 });
  tx.position.z = (H - 1.2) / 2 + 0.003;
  g.add(colocar(parte('tapa', { etiqueta: { texto: `Tapa con el marcado: bobina de ${Vb} V`, ref: 'sec-4.5', punto: [L * 0.3, -W / 2, H * 0.5] }, explosion: [0, 0, H * 1.2] }, tapa, tx), 0, 0, 1.2 + (H - 1.2) / 2));
  const base = malla(caja(ctx, L - 0.2, W - 0.2, 1.4, 0.3), material(ctx, ACABADOS.plasticoNegro));
  g.add(colocar(parte('base', {}, base), 0, 0, 0.9));

  // Coil (vertical axis) with the iron core, at −X.
  const xc = -L * 0.2;
  const rB = 4.2;
  const hB = 9.5;
  const z0 = 1.8;
  const carrete = malla(torno(ctx, [[1.6, 0], [rB + 0.6, 0], [rB + 0.6, 0.6], [2.0, 0.6], [2.0, hB - 0.6], [rB + 0.6, hB - 0.6], [rB + 0.6, hB], [1.6, hB]], 40, 'rele-carrete'), material(ctx, { color: '#e8e2d2', rugosidad: 0.6, corte: '#d8d0bc' }));
  const bob = malla(torno(ctx, [[2.05, 0.65], [rB, 0.65], [rB, hB - 0.65], [2.05, hB - 0.65]], 40, 'rele-bob'), materialTextura(ctx, texturaEspiras(ctx, 40), { metal: 0.7, rugosidad: 0.35, corte: '#a5562a' }));
  const nucleo = malla(cilindro(ctx, 1.55, hB + 0.6, 24), material(ctx, { ...ACABADOS.acero, corte: '#5b6066' }));
  g.add(colocar(parte('bobina', { etiqueta: { texto: 'Bobina: miles de espiras sobre su carrete', ref: 'sec-4.5', punto: [-rB, 0, hB * 0.5] }, interior: true, explosion: [0, -W * 0.5, 0] }, carrete, bob), xc, 0, z0));
  g.add(colocar(parte('nucleo', { etiqueta: { texto: 'Núcleo de hierro: se imanta y atrae la armadura', ref: 'sec-4.5', punto: [0, 0, hB + 0.6] }, interior: true, explosion: [0, -W * 0.5, H * 0.35] }, nucleo), xc, 0, z0));
  // L-shaped yoke: from under the coil up the far side.
  const matFe = material(ctx, { color: '#8a8f95', metal: 0.85, rugosidad: 0.45, corte: '#6c7177' });
  const yugoBase = malla(caja(ctx, rB * 2 + 2.5, 6, 0.9, 0.1), matFe);
  yugoBase.position.set(xc - 0.8, 0, z0 - 0.45);
  const yugoSube = malla(caja(ctx, 0.9, 6, hB + 1.4, 0.1), matFe);
  yugoSube.position.set(xc - rB - 1.6, 0, z0 + (hB + 1.4) / 2 - 0.9);
  g.add(parte('culata', { etiqueta: { texto: 'Culata (yugo) que cierra el circuito magnético', ref: 'sec-4.4', punto: [xc - rB - 1.6, -3, z0 + hB * 0.7] }, interior: true, explosion: [-L * 0.25, 0, 0] }, yugoBase, yugoSube));

  // Armature: hinged at the top of the yoke, over the core; pulled down when the coil is on.
  const ang = on ? -0.05 : 0.07;
  const arm = new Group();
  const placaArm = malla(caja(ctx, rB * 2 + 6, 5.5, 0.8, 0.1), matFe);
  placaArm.position.set((rB * 2 + 6) / 2, 0, 0);
  const empuje = malla(caja(ctx, 1.2, 2.6, 2.4, 0.2), material(ctx, { color: '#efe9da', rugosidad: 0.6 }));
  empuje.position.set(rB * 2 + 5.4, 0, -1.4);
  arm.add(placaArm, empuje);
  arm.rotation.y = -ang;
  g.add(colocar(parte('armadura', { etiqueta: { texto: on ? 'Armadura atraída: empuja el contacto móvil' : 'Armadura en reposo, levantada por su muelle', ref: 'sec-4.5', punto: [rB + 3, -2.7, 0.4] }, interior: true, explosion: [0, 0, H * 0.6] }, arm), xc - rB - 1.6, 0, z0 + hB + 1.1));
  const muelle = malla(
    tubo(ctx, (t, out) => out.set(xc - rB - 2.1 + 0.4 * Math.cos(t * 16 * Math.PI), 2.4 + 0.4 * Math.sin(t * 16 * Math.PI), z0 + hB - 3 + t * 4), 96, 0.08, 5),
    material(ctx, ACABADOS.acero),
  );
  g.add(parte('muelle', { etiqueta: { texto: 'Muelle de retorno', ref: 'sec-4.5', punto: [xc - rB - 2.1, 2.8, z0 + hB - 1] }, interior: true, explosion: [-L * 0.3, W * 0.3, 0] }, muelle));

  // Contacts at +X: fixed NC (top) and NO (bottom), the moving COM blade between them.
  const xk = L * 0.3;
  const matAg = material(ctx, ACABADOS.plata);
  const matLat = material(ctx, ACABADOS.laton);
  const zNC = z0 + hB - 0.5;
  const zNO = z0 + hB - 4.2;
  const fijo = (z: number, nombre: string, et: string) => {
    const brazo = malla(caja(ctx, 4.5, 3.4, 0.6, 0.1), matLat);
    brazo.position.set(xk + 2.2, 0, z);
    const pastilla = malla(cilindro(ctx, 0.9, 0.5, 16), matAg);
    pastilla.position.set(xk, 0, z + (nombre === 'nc' ? -0.8 : 0.3));
    // The NC and NO pins stand side by side (they used to occupy the same place).
    const pata = malla(caja(ctx, 0.6, 1.4, z - 1, 0.05), matLat);
    pata.position.set(xk + 4.2, nombre === 'nc' ? 0.9 : -0.9, (z + 1) / 2);
    return parte(`contacto-${nombre}`, { etiqueta: { texto: et, ref: 'sec-4.5', punto: [xk + 2.2, -1.7, z] }, interior: true, explosion: [L * 0.3, 0, nombre === 'nc' ? 3 : -1] }, brazo, pastilla, pata);
  };
  g.add(fijo(zNC, 'nc', 'Contacto NC (normalmente cerrado)'), fijo(zNO, 'na', 'Contacto NA (normalmente abierto)'));
  const zMovil = on ? zNO + 0.9 : zNC - 1.6;
  const lamina = malla(caja(ctx, xk - xc + 1, 2.6, 0.25, 0.05), matLat);
  lamina.position.set((xk + xc) / 2 + 1.5, 0, zMovil);
  const contM = malla(cilindro(ctx, 0.85, 0.7, 16), matAg);
  contM.position.set(xk, 0, zMovil - 0.35);
  g.add(parte('contacto-com', { etiqueta: { texto: 'Contacto común (lámina móvil)', ref: 'sec-4.5', punto: [(xk + xc) / 2 + 3, 1.3, zMovil] }, interior: true, explosion: [L * 0.15, 0, 1.5] }, lamina, contM));

  // Pins: coil 1 and 2, COM, NC, NO (Sanyou SRD footprint, approx.).
  const zFin = finPatilla(ctx, 3.5);
  const matP = material(ctx, ACABADOS.estano);
  const pads: { n: string; x: number; y: number; forma: 'rect' | 'circulo'; w: number; h: number; taladro: number }[] = [
    { n: '1', x: -7.6, y: 0, forma: 'rect', w: 2.5, h: 2.5, taladro: 1.3 },
    { n: '2', x: -5.65, y: 6, forma: 'circulo', w: 2.5, h: 2.5, taladro: 1.3 },
    { n: '5', x: -5.65, y: -6, forma: 'circulo', w: 2.5, h: 2.5, taladro: 1.3 },
    { n: '3', x: 6.55, y: 6, forma: 'circulo', w: 2.5, h: 2.5, taladro: 1.3 },
    { n: '4', x: 6.6, y: -6, forma: 'circulo', w: 2.5, h: 2.5, taladro: 1.3 },
  ];
  const pines = new Group();
  for (const pd of pads) pines.add(colocar(malla(caja(ctx, 0.5, 1.2, 0.3 - zFin, 0.05), matP), pd.x, pd.y, (0.3 + zFin) / 2));
  g.add(parte('patillas', {}, pines));
  return {
    g,
    datos: {
      huella: { pads, ancho: L, fondo: W, alto: H, origenKicad: [-7.6, 0] },
      cortes: [{ nombre: 'Vertical', normal: [0, 1, 0], min: -W / 2, max: W / 2, inicial: -3.2 }],
      explosionable: true,
      marcado: `SRD-${String(Vb).padStart(2, '0')}VDC-SL-C`,
    },
  };
};

export const CONSTRUCTORES_L: Record<string, Constructor> = {
  'bobina-radial': bobinaRadial,
  toroide,
  'bobina-smd': bobinaSmd,
  transformador,
  rele,
};
