// Discrete semiconductors (book 5.4, 5.5, 6.1, 6.4, 7.3, 45.2; figures 5.2, 6.9, 6.10, 7.5): DO-41, DO-35 glass
// with the die visible between the slugs, SOD-123, LED 5 mm (reflector cup = cathode, gold bond wire,
// chamfer and short lead on the cathode side) and SMD LED, bridge rectifier, TO-92, TO-220, SOT-23 and
// D-PAK with the die on the lead frame and its bond wires.

import { AdditiveBlending, Color, DoubleSide, ExtrudeGeometry, Group, MeshStandardMaterial, Path, Shape, Sprite, SpriteMaterial } from 'three';
import {
  ACABADOS,
  alaGaviota,
  caja,
  cilindro,
  colocar,
  finPatilla,
  hilo,
  hilos,
  malla,
  material,
  lineasMarcado,
  materialTextura,
  parte,
  rotulo,
  texturaDado,
  texturaPintada,
  torno,
  type Constructor,
  type Ctx,
} from './comun';
import { dipGenerico } from './integrados';
import type { Pad } from './tipos';

type V3 = [number, number, number];

const ORO = ACABADOS.oro;
const ALUMINIO_HILO = { color: '#cfd3d8', metal: 1, rugosidad: 0.35 };

/** Body texture of an axial diode: base colour, cathode band and the type printed along the axis. */
function texturaAxial(ctx: Ctx, fondo: string, banda: string, bandaV: [number, number], texto: string, colorTexto: string) {
  return texturaPintada(ctx, `axialtxt:${fondo}:${banda}:${bandaV}:${texto}:${colorTexto}`, 512, 512, (g, w, h) => {
    g.fillStyle = fondo;
    g.fillRect(0, 0, w, h);
    g.fillStyle = banda;
    g.fillRect(0, h * (1 - bandaV[1]), w, h * (bandaV[1] - bandaV[0]));
    if (texto) {
      g.fillStyle = colorTexto;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const px = w * 0.14;
      g.font = `700 ${px}px 'Source Sans 3', Arial, sans-serif`;
      for (const cx of [0, w]) {
        g.save();
        g.translate(cx, h * (1 - (bandaV[1] + 1) / 2));
        g.rotate(-Math.PI / 2);
        g.fillText(texto, 0, 0, h * 0.62);
        g.restore();
      }
    }
  });
}

function padsAxiales(P: number, d: number): Pad[] {
  return [
    { n: '1', x: -P / 2, y: 0, forma: 'rect', w: 1.8, h: 1.8, taladro: d + 0.3 },
    { n: '2', x: P / 2, y: 0, forma: 'circulo', w: 1.8, h: 1.8, taladro: d + 0.3 },
  ];
}

/** Leads of an axial part lying on the board (or straight when loose), from the body ends at axis height zc. */
function patillasAxiales(ctx: Ctx, g: Group, xFin: number, P: number, d: number, zc: number, clave: string): void {
  const zFin = finPatilla(ctx, 26);
  const mat = material(ctx, ACABADOS.estano);
  for (const s of [-1, 1]) {
    const pts: V3[] =
      ctx.montaje === 'placa'
        ? [
            [s * xFin, 0, zc],
            [s * (P / 2), 0, zc],
            [s * (P / 2), 0, zFin],
          ]
        : [
            [s * xFin, 0, zc],
            [s * (xFin + 26), 0, zc],
          ];
    g.add(parte(s < 0 ? 'patilla-1' : 'patilla-2', { explosion: [s * 3, 0, 0] }, malla(hilo(ctx, pts, d / 2, { curva: d * 1.2, clave: `${clave}:${s}:${ctx.montaje}:${zFin}` }), mat)));
  }
}

// ------------------------------------------------------------------ DO-41 / DO-15

const DIODOS_DO41: Record<string, { texto: string; clase: string; do15?: boolean }> = {
  '1N4007': { texto: '1N4007', clase: 'Rectificador de unión PN' },
  '1N5819': { texto: '1N5819', clase: 'Schottky: metal sobre silicio N' },
  UF4007: { texto: 'UF4007', clase: 'Rectificador rápido' },
  '1N4742A': { texto: '1N4742A', clase: 'Zener de 12 V, 1 W' },
  P6KE15A: { texto: 'P6KE15A', clase: 'TVS de 600 W (DO-15)', do15: true },
};

const diodoDo41: Constructor = (ctx, p) => {
  const ref = String(p.referencia ?? '1N4007');
  const info0 = DIODOS_DO41[ref] ?? DIODOS_DO41['1N4007']!;
  const info = { ...info0, texto: lineasMarcado(p, [info0.texto], 99).join(' ') };
  const L = info.do15 ? 7.6 : 5.2;
  const D = info.do15 ? 3.6 : 2.7;
  const d = info.do15 ? 0.85 : 0.8;
  const P = info.do15 ? 12.7 : 10.16;
  const R = D / 2;
  const zc = R;
  const g = new Group();
  const rc = R * 0.35;
  const perfil: [number, number][] = [[0.001, -L / 2]];
  for (let i = 0; i <= 4; i++) perfil.push([R - rc + rc * Math.sin((Math.PI / 2) * (i / 4)), -L / 2 + rc - rc * Math.cos((Math.PI / 2) * (i / 4))]);
  for (let i = 0; i <= 4; i++) perfil.push([R - rc + rc * Math.cos((Math.PI / 2) * (i / 4)), L / 2 - rc + rc * Math.sin((Math.PI / 2) * (i / 4))]);
  perfil.push([0.001, L / 2]);
  const geo = torno(ctx, perfil, 40, `do41:${L}:${R}`);
  const tex = texturaAxial(ctx, '#1d1e21', '#c3c6ca', [0.06, 0.22], info.texto, '#c3c6ca');
  const cuerpo = malla(geo, materialTextura(ctx, tex, { rugosidad: 0.55, corte: '#3a3b40' }));
  cuerpo.rotation.y = Math.PI / 2;
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `Epoxi negro con «${info.texto}»; la banda gris marca el cátodo`, ref: 'sec-5.4', punto: [-L * 0.36, 0, R] }, explosion: [0, 0, D * 1.8] }, cuerpo), 0, 0, zc));
  // Inside: the die soldered between the nail heads of the two leads.
  const dado = malla(caja(ctx, 0.25, 1.1, 1.1, 0.02), materialTextura(ctx, texturaDado(ctx, 7, 0, '#5a6378'), { metal: 0.4, rugosidad: 0.3 }));
  g.add(colocar(parte('dado', { etiqueta: { texto: `Dado de silicio: ${info.clase.toLowerCase()}`, ref: info.clase.startsWith('Schottky') ? 'sec-5.5' : 'sec-5.2', punto: [0, 0, 0.55] }, interior: true, entero: true, explosion: [0, 0, D * 0.6] }, dado), 0, 0, zc));
  const matCu = material(ctx, ACABADOS.cobre);
  for (const s of [-1, 1]) {
    const cabeza = malla(cilindro(ctx, 0.75, 0.35, 20), matCu);
    cabeza.rotation.y = Math.PI / 2;
    cabeza.position.x = s < 0 ? -0.48 : 0.13;
    const varilla = malla(cilindro(ctx, d / 2, L / 2 - 0.4, 14), matCu);
    varilla.rotation.y = Math.PI / 2;
    // The rod starts inside the head (no face shared with it).
    varilla.position.x = s < 0 ? -L / 2 : 0.4;
    g.add(
      colocar(
        parte(s < 0 ? 'cabeza-catodo' : 'cabeza-anodo', {
          etiqueta: { texto: s < 0 ? 'Cabeza de la patilla del cátodo' : 'Cabeza de la patilla del ánodo', ref: 'sec-5.4', punto: [s * 0.6, 0, 0.75] },
          interior: true,
          entero: true,
          explosion: [s * L * 0.3, 0, 0],
        }, cabeza, varilla),
        0,
        0,
        zc,
      ),
    );
  }
  patillasAxiales(ctx, g, L / 2 - 0.05, P, d, zc, `do41:${L}:${P}`);
  return {
    g,
    datos: {
      huella: { pads: padsAxiales(P, d), ancho: P + 1.8, fondo: D, alto: D, origenKicad: [-P / 2, 0], kicad: info.do15 ? 'Diode_THT:D_DO-15_P12.70mm_Horizontal' : 'Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal' },
      cortes: [{ nombre: 'Longitudinal', normal: [0, 1, 0], min: -R, max: R, inicial: 0 }],
      explosionable: true,
      marcado: info.texto,
    },
  };
};

// ------------------------------------------------------------------ DO-35 glass

const DIODOS_DO35: Record<string, { texto: string; vidrio: string; et: string; ref: string }> = {
  '1N4148': { texto: '4148', vidrio: '#f0b88a', et: '1N4148, diodo de señal', ref: 'sec-5.4' },
  '5V6': { texto: '5V6', vidrio: '#f2a46a', et: 'Zener de 5,6 V', ref: 'sec-5.5' },
  '3V3': { texto: '3V3', vidrio: '#f2a46a', et: 'Zener de 3,3 V', ref: 'sec-5.5' },
  '12V': { texto: 'C12', vidrio: '#f2a46a', et: 'Zener de 12 V', ref: 'sec-5.5' },
  BAT85: { texto: 'BAT85', vidrio: '#d9e8e4', et: 'Schottky BAT85', ref: 'sec-5.5' },
};

const diodoDo35: Constructor = (ctx, p) => {
  const ref = String(p.referencia ?? '1N4148');
  const info0 = DIODOS_DO35[ref] ?? DIODOS_DO35['1N4148']!;
  const info = { ...info0, texto: lineasMarcado(p, [info0.texto], 99).join(' ') };
  const L = 3.9;
  const D = 1.9;
  const R = D / 2;
  const d = 0.5;
  const P = 7.62;
  const zc = R;
  const g = new Group();
  const perfil: [number, number][] = [[0.001, -L / 2]];
  const rc = R * 0.55;
  for (let i = 0; i <= 5; i++) perfil.push([R - rc + rc * Math.sin((Math.PI / 2) * (i / 5)), -L / 2 + rc - rc * Math.cos((Math.PI / 2) * (i / 5))]);
  for (let i = 0; i <= 5; i++) perfil.push([R - rc + rc * Math.cos((Math.PI / 2) * (i / 5)), L / 2 - rc + rc * Math.sin((Math.PI / 2) * (i / 5))]);
  perfil.push([0.001, L / 2]);
  const vidrio = malla(torno(ctx, perfil, 36, `do35:${L}`), material(ctx, { color: info.vidrio, rugosidad: 0.05, transparente: 0.32 }));
  vidrio.rotation.y = Math.PI / 2;
  const banda = malla(cilindro(ctx, R + 0.02, 0.45, 32, R + 0.02, true), material(ctx, { color: '#141414', rugosidad: 0.4 }));
  banda.rotation.y = Math.PI / 2;
  banda.position.x = -L / 2 + 0.35;
  banda.material = ctx.rec.material('banda-do35', () => new MeshStandardMaterial({ color: new Color('#141414'), roughness: 0.4, side: DoubleSide }));
  const tx = rotulo(ctx, [info.texto], L * 0.42, D * 0.42, { color: '#151515', peso: 700 });
  tx.position.set(L * 0.12, -R - 0.01, 0);
  tx.rotation.x = Math.PI / 2;
  g.add(colocar(parte('vidrio', { etiqueta: { texto: `Cápsula de vidrio: ${info.et}; banda negra en el cátodo`, ref: info.ref, punto: [-L / 2 + 0.35, 0, R] }, explosion: [0, 0, D * 2.4] }, vidrio, banda, tx), 0, 0, zc));
  // Two dumet slugs (copper-clad) with the die pressed between them, visible through the glass.
  const matDumet = material(ctx, { color: '#b5583a', metal: 0.9, rugosidad: 0.3 });
  for (const s of [-1, 1]) {
    const slug = malla(cilindro(ctx, 0.55, 1.45, 18), matDumet);
    slug.rotation.y = Math.PI / 2;
    slug.position.x = s < 0 ? -1.6 : 0.15;
    const pat = malla(cilindro(ctx, d / 2, 0.6, 12), material(ctx, ACABADOS.estano));
    pat.rotation.y = Math.PI / 2;
    pat.position.x = s < 0 ? -L / 2 - 0.2 : L / 2 - 0.4;
    g.add(colocar(parte(s < 0 ? 'tetón-1' : 'tetón-2', { etiqueta: s < 0 ? { texto: 'Tetón de dumet (cobre sobre hierro-níquel)', ref: 'sec-5.4', punto: [-1.0, 0, 0.55] } : undefined, interior: false, entero: true, explosion: [s * L * 0.35, 0, 0] }, slug, pat), 0, 0, zc));
  }
  const dado = malla(caja(ctx, 0.3, 0.42, 0.42, 0.02), materialTextura(ctx, texturaDado(ctx, 11, 0, '#5a6378'), { metal: 0.4, rugosidad: 0.3 }));
  g.add(colocar(parte('dado', { etiqueta: { texto: 'Dado (unión PN) entre los tetones, a la vista', ref: 'sec-5.2', punto: [0, 0, 0.22] }, entero: true, explosion: [0, 0, D] }, dado), 0, 0, zc));
  patillasAxiales(ctx, g, L / 2 + 0.05, P, d, zc, `do35:${P}`);
  return {
    g,
    datos: {
      huella: { pads: padsAxiales(P, d), ancho: P + 1.8, fondo: D, alto: D, origenKicad: [-P / 2, 0], kicad: 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal' },
      explosionable: true,
      marcado: info.texto,
    },
  };
};

// ------------------------------------------------------------------ SOD-123

const SOD123: Record<string, { texto: string; et: string }> = {
  '1N4148W': { texto: 'T4', et: '1N4148W' },
  B5819W: { texto: 'SL', et: 'Schottky B5819W' },
  MMSZ5V6: { texto: 'C2', et: 'Zener MMSZ5V6' },
};

const diodoSod123: Constructor = (ctx, p) => {
  const info0 = SOD123[String(p.referencia)] ?? SOD123['1N4148W']!;
  const info = { ...info0, texto: lineasMarcado(p, [info0.texto], 99).join(' ') };
  const L = 2.7;
  const W = 1.6;
  const H = 1.05;
  const g = new Group();
  const cuerpo = malla(caja(ctx, L, W, H, 0.1), material(ctx, ACABADOS.epoxiNegro));
  const banda = malla(caja(ctx, 0.3, W * 0.9, 0.01, 0), material(ctx, { color: '#d9d9d6', rugosidad: 0.5 }));
  banda.position.set(-L / 2 + 0.35, 0, H / 2 + 0.003);
  const tx = rotulo(ctx, [info.texto], L * 0.5, W * 0.6, { color: '#d9d9d6' });
  tx.position.set(L * 0.1, 0, H / 2 + 0.004);
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `${info.et}: marcado «${info.texto}»; la franja es el cátodo`, ref: 'sec-5.4', punto: [-L / 2 + 0.35, 0, H / 2] }, explosion: [0, 0, H * 2.2] }, cuerpo, banda, tx), 0, 0, 0.1 + H / 2));
  const matT = material(ctx, ACABADOS.estano);
  for (const s of [-1, 1]) {
    const t = malla(caja(ctx, 1.0, 0.6, 0.12, 0.03), matT);
    t.position.set(s * (L / 2 + 0.05), 0, 0.06);
    const interno = malla(caja(ctx, 0.9, 0.6, 0.12, 0), matT);
    interno.position.set(s * (L / 2 - 0.55), 0, 0.12 + H * 0.35);
    g.add(parte(s < 0 ? 'catodo' : 'anodo', { explosion: [s * 1.2, 0, 0] }, t, interno));
  }
  const dado = malla(caja(ctx, 0.45, 0.45, 0.2, 0.01), materialTextura(ctx, texturaDado(ctx, 21, 0), { metal: 0.4, rugosidad: 0.3 }));
  g.add(colocar(parte('dado', { etiqueta: { texto: 'Dado sobre la patilla del cátodo', ref: 'sec-5.4', punto: [0, 0, 0.1] }, interior: true, entero: true, explosion: [0, 0, H * 1.2] }, dado), -0.35, 0, 0.12 + H * 0.35 + 0.16));
  g.add(parte('hilo', { interior: true, entero: true, explosion: [0, 0, H * 1.2] }, malla(hilos(ctx, [{ a: [-0.35, 0, 0.12 + H * 0.35 + 0.26], b: [L / 2 - 0.7, 0, 0.12 + H * 0.35 + 0.07], alto: 0.25 }], 0.018), material(ctx, ORO))));
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -1.65, y: 0, forma: 'rect', w: 0.9, h: 1.2 },
          { n: '2', x: 1.65, y: 0, forma: 'rect', w: 0.9, h: 1.2 },
        ],
        ancho: 3.7,
        fondo: W,
        alto: H + 0.1,
        origenKicad: [0, 0],
        kicad: 'Diode_SMD:D_SOD-123',
      },
      cortes: [{ nombre: 'Longitudinal', normal: [0, 1, 0], min: -W / 2, max: W / 2, inicial: 0 }],
      explosionable: true,
      marcado: info.texto,
    },
  };
};

// ------------------------------------------------------------------ LEDs

const COLORES_LED: Record<string, { lente: string; dado: string; luz: string; material: string }> = {
  rojo: { lente: '#e3271e', dado: '#ff4a3a', luz: '#ff3b2a', material: 'AlGaInP, rojo' },
  verde: { lente: '#23b14d', dado: '#3cff75', luz: '#4dff7c', material: 'InGaN, verde' },
  azul: { lente: '#2e62e6', dado: '#5f8bff', luz: '#4c7dff', material: 'InGaN, azul' },
  amarillo: { lente: '#f1bf13', dado: '#ffd84a', luz: '#ffd23a', material: 'AlGaInP, amarillo' },
  blanco: { lente: '#eef3f7', dado: '#f4f0b0', luz: '#fffbe8', material: 'InGaN azul con fósforo amarillo' },
  infrarrojo: { lente: '#8a96b8', dado: '#552222', luz: '#5a1e1e', material: 'GaAs, infrarrojo' },
  fotodiodo: { lente: '#eaf1f2', dado: '#3b4258', luz: '#000000', material: 'silicio (fotodiodo)' },
};

/** Soft additive glow over a lit die (texture and material owned by the model's resources). */
function brillo(ctx: Ctx, color: string, tam: number): Sprite {
  const tex = texturaPintada(ctx, 'brillo', 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
  const mat = ctx.rec.material(`brillo:${color}`, () => new SpriteMaterial({ map: tex, color: new Color(color), blending: AdditiveBlending, depthWrite: false, transparent: true }));
  const s = new Sprite(mat as SpriteMaterial);
  s.scale.set(tam, tam, 1);
  s.userData.decal = true;
  return s;
}

const led5mm: Constructor = (ctx, p) => {
  const colorK = String(p.color ?? 'rojo');
  const c = COLORES_LED[colorK] ?? COLORES_LED.rojo!;
  const foto = colorK === 'fotodiodo';
  const on = p.encendido === true && !foto;
  const difuso = p.difuso !== false && !foto && colorK !== 'blanco';
  const g = new Group();
  const z0 = ctx.montaje === 'placa' ? 1.0 : 0;
  const Rl = 2.5;
  const Hc = 8.6 - 1.0;
  // Flange with the flat on the cathode side (−X).
  const brida = ctx.rec.geometria('led-brida', () => {
    const s = new Shape();
    const r = 2.9;
    const xf = -2.45;
    const a0 = Math.acos(xf / r);
    s.absarc(0, 0, r, -Math.PI + (Math.PI - a0), Math.PI - (Math.PI - a0), false);
    s.lineTo(xf, -Math.sqrt(r * r - xf * xf));
    s.closePath();
    return new ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false, curveSegments: 24 });
  });
  const opac = difuso ? 0.72 : foto ? 0.22 : 0.42;
  const matLente = ctx.rec.material(`lente:${colorK}:${difuso}:${on}`, () => {
    const m = new MeshStandardMaterial({
      color: new Color(c.lente),
      roughness: difuso ? 0.55 : 0.08,
      metalness: 0,
      transparent: true,
      opacity: opac,
      depthWrite: false,
      emissive: new Color(on ? c.luz : '#000000'),
      emissiveIntensity: on ? (difuso ? 0.9 : 0.45) : 0,
    });
    return m;
  });
  const bridaM = malla(brida, matLente);
  const cupula = malla(
    torno(ctx, (() => {
      const pts: [number, number][] = [[Rl, 1.0], [Rl, Hc - Rl + 1.0]];
      for (let i = 1; i <= 10; i++) pts.push([Rl * Math.cos((Math.PI / 2) * (i / 10)), Hc - Rl + 1.0 + Rl * Math.sin((Math.PI / 2) * (i / 10))]);
      pts[pts.length - 1]![0] = 0.001;
      return pts;
    })(), 48, 'led-cupula'),
    matLente,
  );
  const lente = parte('lente', {
    etiqueta: { texto: foto ? 'Lente transparente: deja llegar la luz al dado' : difuso ? 'Lente de epoxi coloreada y difusa' : 'Lente de epoxi transparente', ref: foto ? 'sec-45.3' : 'sec-45.2', punto: [Rl * 0.5, -Rl * 0.6, Hc * 0.8] },
    explosion: [0, 0, 9],
  }, bridaM, cupula);
  const plano = malla(caja(ctx, 0.05, 2.0, 0.9, 0), material(ctx, { color: c.lente, rugosidad: 0.5, transparente: 0.5 }));
  plano.position.set(-2.45, 0, 0.5);
  lente.add(plano);
  g.add(colocar(lente, 0, 0, z0));
  lente.userData.etiqueta = lente.userData.etiqueta;
  lente.children.forEach((m) => (m.renderOrder = 2));
  // Add a hint label for the chamfer.
  g.add(colocar(parte('chaflan', { etiqueta: { texto: 'Chaflán del reborde: lado del cátodo', ref: 'sec-5.4', punto: [-2.45, 0, 0.5] }, explosion: [0, 0, 9] }), 0, 0, z0));

  // Lead frames: cathode anvil with the reflector cup, anode post, die and gold wire.
  const matMarco = material(ctx, { color: '#c8ccd1', metal: 1, rugosidad: 0.3 });
  const zCup = z0 + 4.4;
  const yunque = new Group();
  const placaK = malla(caja(ctx, 1.9, 0.5, 2.6, 0.05), matMarco);
  placaK.position.set(-0.55, 0, zCup - 1.6);
  const copa = malla(foto ? caja(ctx, 1.4, 1.4, 0.3, 0.02) : torno(ctx, [[0.42, 0], [0.5, 0], [0.95, 0.55], [0.82, 0.55], [0.38, 0.12], [0.001, 0.12]], 32, 'copa'), matMarco);
  copa.position.set(0, 0, zCup - 0.3);
  const postK = malla(caja(ctx, 0.5, 0.5, zCup - z0 - 2.7, 0.03), matMarco);
  postK.position.set(-1.27, 0, z0 + (zCup - z0 - 2.7) / 2);
  yunque.add(placaK, copa, postK);
  g.add(parte('catodo', { etiqueta: { texto: foto ? 'Marco del cátodo con el dado' : 'Cátodo: la cazoleta reflectora (el electrodo grande)', ref: 'sec-5.4', punto: [0.9, 0, zCup + 0.2] }, interior: true, entero: true, explosion: [-2.2, 0, 0] }, yunque));
  const postA = malla(caja(ctx, 0.5, 0.5, zCup + 0.2 - z0, 0.03), matMarco);
  postA.position.set(1.27, 0, z0 + (zCup + 0.2 - z0) / 2);
  const bandera = malla(caja(ctx, 0.9, 0.5, 0.5, 0.03), matMarco);
  bandera.position.set(1.0, 0, zCup + 0.05);
  g.add(parte('anodo', { etiqueta: { texto: 'Ánodo (poste pequeño)', ref: 'sec-5.4', punto: [1.27, 0, zCup - 1.5] }, interior: true, entero: true, explosion: [2.2, 0, 0] }, postA, bandera));
  const tamDado = foto ? 1.1 : 0.28;
  const matDado = ctx.rec.material(`dado-led:${colorK}:${on}`, () => {
    const m = new MeshStandardMaterial({ color: new Color(foto ? '#3b4258' : c.dado), roughness: 0.3, metalness: 0.2, emissive: new Color(on ? c.luz : '#000'), emissiveIntensity: on ? 2.2 : 0 });
    return m;
  });
  const dado = malla(caja(ctx, tamDado, tamDado, 0.18, 0.01), foto ? materialTextura(ctx, texturaDado(ctx, 5, 4, '#3b4258'), { metal: 0.3, rugosidad: 0.3 }) : matDado);
  // The die stands a hair above the cup's floor (no shared face).
  const zDado = foto ? zCup + 0.1 : zCup - 0.07;
  dado.position.z = zDado;
  const grupoDado = parte('dado', { etiqueta: { texto: foto ? 'Dado de silicio grande: más área, más fotocorriente' : `Dado semiconductor (${c.material}): su banda prohibida da el color`, ref: foto ? 'sec-45.3' : 'sec-5.5', punto: [0, 0, zDado + 0.1] }, interior: true, entero: true, explosion: [0, 0, 3] }, dado);
  if (on) grupoDado.add(colocar(brillo(ctx, c.luz, 5), 0, 0, zDado + 0.3));
  g.add(grupoDado);
  g.add(parte('hilo-oro', { etiqueta: { texto: 'Hilo de oro del dado al ánodo', ref: 'sec-45.2', punto: [0.6, 0, zCup + 0.9] }, interior: true, entero: true, explosion: [0, 0, 3] }, malla(hilos(ctx, [{ a: [0, 0, zDado + 0.09], b: [0.95, 0, zCup + 0.3], alto: 0.7 }], 0.025), material(ctx, ORO))));

  // Leads: square 0,5 mm, anode longer (when loose).
  const matP = material(ctx, ACABADOS.estano);
  const zFinK = ctx.montaje === 'placa' ? -(ctx.placa + 1) : -25;
  const zFinA = ctx.montaje === 'placa' ? -(ctx.placa + 1) : -27;
  const pk = malla(caja(ctx, 0.5, 0.5, z0 - zFinK, 0.03), matP);
  pk.position.set(-1.27, 0, (z0 + zFinK) / 2);
  const pa = malla(caja(ctx, 0.5, 0.5, z0 - zFinA, 0.03), matP);
  pa.position.set(1.27, 0, (z0 + zFinA) / 2);
  g.add(parte('patilla-k', { etiqueta: ctx.montaje === 'placa' ? undefined : { texto: 'Patilla corta: cátodo', ref: 'sec-5.4', punto: [-1.27, 0, -20] }, explosion: [0, 0, -2] }, pk));
  g.add(parte('patilla-a', { etiqueta: ctx.montaje === 'placa' ? undefined : { texto: 'Patilla larga: ánodo', ref: 'sec-5.4', punto: [1.27, 0, -24] }, explosion: [0, 0, -2] }, pa));
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -1.27, y: 0, forma: 'rect', w: 1.8, h: 1.8, taladro: 0.9 },
          { n: '2', x: 1.27, y: 0, forma: 'circulo', w: 1.8, h: 1.8, taladro: 0.9 },
        ],
        ancho: 5.8,
        fondo: 5.8,
        alto: z0 + 8.6,
        origenKicad: [-1.27, 0],
        kicad: 'LED_THT:LED_D5.0mm',
      },
      cortes: [{ nombre: 'Vertical', normal: [0, 1, 0], min: -3, max: 3, inicial: 0 }],
      explosionable: true,
      marcado: colorK,
    },
  };
};

const ledSmd: Constructor = (ctx, p) => {
  const colorK = String(p.color ?? 'blanco');
  const c = COLORES_LED[colorK] ?? COLORES_LED.blanco!;
  const on = p.encendido === true;
  const chip = String(p.tamano) === '0805';
  const L = chip ? 2.0 : 3.5;
  const W = chip ? 1.25 : 2.8;
  const H = chip ? 0.8 : 1.9;
  const g = new Group();
  const blanco = colorK === 'blanco';
  const resina = ctx.rec.material(`resina:${colorK}:${on}`, () =>
    new MeshStandardMaterial({
      color: new Color(blanco ? '#f2df73' : '#eef4f2'),
      roughness: 0.15,
      transparent: true,
      opacity: blanco ? 0.82 : 0.35,
      depthWrite: false,
      emissive: new Color(on ? c.luz : '#000'),
      emissiveIntensity: on ? 0.8 : 0,
    }),
  );
  const zDado = chip ? 0.32 : 0.62;
  if (chip) {
    const sustrato = malla(caja(ctx, L, W, 0.3, 0.02), material(ctx, { color: '#e9e6dc', rugosidad: 0.6 }));
    g.add(colocar(parte('sustrato', { etiqueta: { texto: 'Sustrato con las metalizaciones', ref: 'sec-45.2', punto: [L * 0.4, -W / 2, 0.15] } }, sustrato), 0, 0, 0.15));
    const dome = malla(caja(ctx, L * 0.7, W * 0.92, H - 0.3, 0.08), resina);
    g.add(colocar(parte('resina', { etiqueta: { texto: 'Resina transparente', ref: 'sec-45.2', punto: [0, -W * 0.46, (H - 0.3) / 2] }, explosion: [0, 0, 1.5] }, dome), 0, 0, 0.3 + (H - 0.3) / 2));
    const matT = material(ctx, ACABADOS.estanoMate);
    for (const s of [-1, 1]) g.add(colocar(parte(`term-${s}`, {}, malla(caja(ctx, 0.35, W + 0.02, 0.33, 0.02), matT)), s * (L / 2 - 0.17), 0, 0.165));
  } else {
    // PLCC-2: white housing with a round cavity (reflector), lead frame folded under.
    const carcasa = ctx.rec.geometria('plcc2', () => {
      const s = new Shape();
      const c0 = 0.35;
      s.moveTo(-L / 2 + c0, -W / 2);
      s.lineTo(L / 2, -W / 2);
      s.lineTo(L / 2, W / 2);
      s.lineTo(-L / 2, W / 2);
      s.lineTo(-L / 2, -W / 2 + c0);
      s.closePath();
      s.holes.push(new Path().absellipse(0, 0, 1.2, 1.0, 0, Math.PI * 2, true, 0));
      return new ExtrudeGeometry(s, { depth: H - 0.5, bevelEnabled: false, curveSegments: 32 });
    });
    const base = malla(caja(ctx, L, W, 0.5, 0.02), material(ctx, ACABADOS.plasticoBlanco));
    const pared = malla(carcasa, material(ctx, ACABADOS.plasticoBlanco));
    pared.position.z = 0.25;
    g.add(colocar(parte('carcasa', { etiqueta: { texto: 'Carcasa blanca reflectora; la esquina achaflanada marca el cátodo', ref: 'sec-45.2', punto: [-L / 2, -W / 2 + 0.35, H - 0.6] } }, base, pared), 0, 0, 0.25));
    const relleno = malla(ctx.rec.geometria('plcc2-resina', () => {
      const s = new Shape();
      s.absellipse(0, 0, 1.2, 1.0, 0, Math.PI * 2, false, 0);
      return new ExtrudeGeometry(s, { depth: H - 0.52, bevelEnabled: false, curveSegments: 32 });
    }), resina);
    relleno.position.z = 0.5;
    g.add(parte('resina', { etiqueta: { texto: blanco ? 'Resina con fósforo: convierte parte del azul en amarillo' : 'Resina transparente', ref: 'sec-5.5', punto: [0.6, -0.6, H] }, explosion: [0, 0, 2.2] }, relleno));
    const matT = material(ctx, ACABADOS.estano);
    for (const s of [-1, 1]) {
      const pie = malla(caja(ctx, 0.9, 2.2, 0.12, 0.02), matT);
      pie.position.set(s * (L / 2 - 0.3), 0, 0.06);
      const cara = malla(caja(ctx, 0.12, 2.2, 0.6, 0.02), matT);
      cara.position.set(s * (L / 2 + 0.03), 0, 0.3);
      g.add(parte(s < 0 ? 'catodo' : 'anodo', { explosion: [s * 1.5, 0, -0.5] }, pie, cara));
    }
  }
  const matDado = ctx.rec.material(`dado-smd:${colorK}:${on}`, () => new MeshStandardMaterial({ color: new Color(c.dado), roughness: 0.3, emissive: new Color(on ? c.luz : '#000'), emissiveIntensity: on ? 2.2 : 0 }));
  const dado = malla(caja(ctx, 0.3, 0.3, 0.12, 0.01), matDado);
  const grupoDado = parte('dado', { etiqueta: { texto: `Dado (${c.material})`, ref: 'sec-5.5', punto: [-0.2, 0, zDado + 0.06] }, interior: true, entero: true, explosion: [0, 0, 1.4] }, dado);
  dado.position.set(-0.2, 0, zDado + 0.06);
  if (on) grupoDado.add(colocar(brillo(ctx, c.luz, chip ? 2.5 : 4), -0.2, 0, zDado + 0.3));
  g.add(grupoDado);
  g.add(parte('hilo', { interior: true, entero: true, explosion: [0, 0, 1.4] }, malla(hilos(ctx, [{ a: [-0.2, 0, zDado + 0.12], b: [chip ? 0.6 : 0.85, 0, zDado], alto: chip ? 0.2 : 0.4 }], 0.02), material(ctx, ORO))));
  return {
    g,
    datos: {
      huella: {
        pads: chip
          ? [
              { n: '1', x: -0.95, y: 0, forma: 'rect', w: 0.9, h: 1.4 },
              { n: '2', x: 0.95, y: 0, forma: 'rect', w: 0.9, h: 1.4 },
            ]
          : [
              { n: '1', x: -1.5, y: 0, forma: 'rect', w: 1.3, h: 2.4 },
              { n: '2', x: 1.5, y: 0, forma: 'rect', w: 1.3, h: 2.4 },
            ],
        ancho: L,
        fondo: W,
        alto: H,
        origenKicad: [0, 0],
        kicad: chip ? 'LED_SMD:LED_0805_2012Metric' : 'LED_SMD:LED_PLCC-2',
      },
      cortes: [{ nombre: 'Longitudinal', normal: [0, 1, 0], min: -W / 2, max: W / 2, inicial: 0.05 }],
      explosionable: true,
    },
  };
};

// ------------------------------------------------------------------ bridge rectifier (DIP-4)

const puente: Constructor = (ctx, p) => dipGenerico(ctx, { pines: 4, referencia: String(p.referencia ?? 'DB107'), interior: 'puente' });

// ------------------------------------------------------------------ TO-92

interface InfoTO92 {
  lineas: string[];
  pines: [string, string, string];
  pala: 0 | 1 | 2;
  tipo: string;
  ref: string;
}

const TO92: Record<string, InfoTO92> = {
  BC547B: { lineas: ['BC', '547B'], pines: ['C', 'B', 'E'], pala: 0, tipo: 'BJT NPN', ref: 'sec-6.1' },
  BC557B: { lineas: ['BC', '557B'], pines: ['C', 'B', 'E'], pala: 0, tipo: 'BJT PNP', ref: 'sec-6.1' },
  '2N7000': { lineas: ['2N', '7000'], pines: ['S', 'G', 'D'], pala: 2, tipo: 'MOSFET de canal N', ref: 'sec-7.3' },
  J201: { lineas: ['J201'], pines: ['D', 'S', 'G'], pala: 2, tipo: 'JFET de canal N', ref: 'sec-7.3' },
  '78L05': { lineas: ['78L05'], pines: ['OUT', 'GND', 'IN'], pala: 1, tipo: 'regulador de 5 V', ref: 'sec-8.4' },
  A3144: { lineas: ['3144'], pines: ['VCC', 'GND', 'OUT'], pala: 1, tipo: 'sensor Hall', ref: 'sec-35.5' },
};

const to92: Constructor = (ctx, p) => {
  const info0 = TO92[String(p.referencia)] ?? TO92.BC547B!;
  const info = { ...info0, lineas: lineasMarcado(p, info0.lineas, 5) };
  const plano = String(p.cuerpo) === 'TO-92S';
  const g = new Group();
  const zb = ctx.montaje === 'placa' ? 3 : 13;
  const H = plano ? 3.0 : 4.6;
  const geo = ctx.rec.geometria(`to92:${plano}`, () => {
    const s = new Shape();
    if (plano) {
      const w = 4.0;
      const t = 1.52;
      const c = 0.45;
      s.moveTo(-w / 2 + c, -t / 2);
      s.lineTo(w / 2 - c, -t / 2);
      s.lineTo(w / 2, -t / 2 + c);
      s.lineTo(w / 2, t / 2);
      s.lineTo(-w / 2, t / 2);
      s.lineTo(-w / 2, -t / 2 + c);
      s.closePath();
    } else {
      // Half-moon: circle Ø 4,8 cut by the flat face at y = −1,3 (depth 3,7 mm).
      const r = 2.4;
      const yf = -1.3;
      const a = Math.asin(yf / r);
      s.moveTo(r * Math.cos(a), yf);
      s.absarc(0, 0, r, a, Math.PI - a, false);
      s.lineTo(r * Math.cos(a), yf);
    }
    const e = new ExtrudeGeometry(s, { depth: H, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 2, curveSegments: 32 });
    e.translate(0, 0, 0.15);
    return e;
  });
  const cuerpo = malla(geo, material(ctx, ACABADOS.epoxiNegro));
  const yCara = plano ? -0.76 : -1.3;
  const tx = rotulo(ctx, info.lineas, plano ? 3.0 : 3.4, plano ? 1.0 : 2.2, { color: '#cfd2d6', peso: 600 });
  tx.rotation.x = Math.PI / 2;
  tx.position.set(0, yCara - 0.135, H * 0.62);
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `Cara plana con el marcado: ${info.tipo}; patillas ${info.pines.join('-')}`, ref: 'sec-6.4', punto: [1.4, yCara, H * 0.85] }, explosion: [0, -6, 0] }, cuerpo, tx), 0, 0, zb));

  // Lead frame inside the body: the die sits on one lead (the collector is the substrate in a BJT).
  const matMarco = material(ctx, { color: '#c3c6ca', metal: 1, rugosidad: 0.3 });
  const xs = [-1.27, 0, 1.27];
  const marco = new Group();
  const ySup = 0.15;
  xs.forEach((x, i) => {
    const alto = i === info.pala ? 2.2 : 1.6;
    const tira = malla(caja(ctx, 0.45, 0.3, alto, 0.03), matMarco);
    tira.position.set(x, ySup, zb + alto / 2 + 0.2);
    marco.add(tira);
  });
  const xp = xs[info.pala]!;
  const pala = malla(caja(ctx, 1.4, 0.3, 1.1, 0.04), matMarco);
  pala.position.set(xp * 0.4, ySup, zb + 2.55);
  marco.add(pala);
  g.add(parte('marco', { etiqueta: { texto: `Marco de patillas: el dado va sobre la de ${info.pines[info.pala]}`, ref: 'sec-6.1', punto: [xs[(info.pala + 2) % 3]!, ySup - 0.15, zb + 1.6] }, interior: true, entero: true, explosion: [0, 2, 0] }, marco));
  const zd = zb + 2.6;
  const dado = malla(caja(ctx, 0.55, 0.12, 0.55, 0.01), materialTextura(ctx, texturaDado(ctx, 31, 3), { metal: 0.4, rugosidad: 0.3 }));
  dado.position.set(xp * 0.4, ySup - 0.21, zd);
  dado.rotation.x = Math.PI / 2;
  g.add(parte('dado', { etiqueta: { texto: info.tipo.startsWith('BJT') ? 'Dado de silicio: emisor y base difundidos arriba, el colector es el sustrato' : 'Dado de silicio', ref: info.ref, punto: [xp * 0.4, ySup - 0.27, zd + 0.3] }, interior: true, entero: true, explosion: [0, -2, 0] }, dado));
  const otros = [0, 1, 2].filter((i) => i !== info.pala);
  g.add(
    parte('hilos', { etiqueta: { texto: 'Hilos de oro a las otras patillas', ref: 'sec-6.4', punto: [xs[otros[1]!]! * 0.8, ySup - 0.4, zb + 2.2] }, interior: true, entero: true, explosion: [0, -2, 0] }, malla(
      hilos(ctx, otros.map((i, k) => ({ a: [xp * 0.4 + (k ? 0.12 : -0.12), ySup - 0.3, zd + 0.1] as V3, b: [xs[i]!, ySup - 0.16, zb + 1.75] as V3, alto: 0.4 })), 0.025),
      material(ctx, ORO),
    )),
  );
  // External leads.
  const zFin = finPatilla(ctx, 0);
  const matP = material(ctx, ACABADOS.estano);
  const pats = new Group();
  for (const x of xs) pats.add(colocar(malla(caja(ctx, 0.45, 0.4, zb + 0.3 - (ctx.montaje === 'placa' ? zFin : 0), 0.03), matP), x, ySup, (zb + 0.3 + (ctx.montaje === 'placa' ? zFin : 0)) / 2));
  g.add(parte('patillas', {}, pats));
  return {
    g,
    datos: {
      huella: {
        pads: xs.map((x, i) => ({ n: String(i + 1), x, y: 0, forma: i === 0 ? 'rect' : 'ovalo', w: 1.05, h: 1.5, taladro: 0.75 })),
        ancho: 5,
        fondo: 4,
        alto: zb + H + 0.3,
        origenKicad: [-1.27, 0],
        kicad: 'Package_TO_SOT_THT:TO-92_Inline',
      },
      cortes: [{ nombre: 'Frontal', normal: [0, 1, 0], min: yCara - 0.3, max: 2.4, inicial: ySup - 0.45 }],
      explosionable: true,
      marcado: info.lineas.join(''),
    },
  };
};

// ------------------------------------------------------------------ TO-220

const TO220: Record<string, { lineas: string[]; pines: [string, string, string]; tipo: string; ref: string; dado: number }> = {
  IRF540N: { lineas: ['IRF540N', 'IR 2309'], pines: ['G', 'D', 'S'], tipo: 'MOSFET de potencia de canal N', ref: 'sec-7.3', dado: 3.2 },
  IRF9540N: { lineas: ['IRF9540N', 'IR 2309'], pines: ['G', 'D', 'S'], tipo: 'MOSFET de potencia de canal P', ref: 'sec-7.3', dado: 3.0 },
  TIP31C: { lineas: ['TIP31C', 'ST 2310'], pines: ['B', 'C', 'E'], tipo: 'BJT de potencia NPN', ref: 'sec-6.4', dado: 2.4 },
  BT136: { lineas: ['BT136', '-600E'], pines: ['T1', 'T2', 'G'], tipo: 'TRIAC', ref: 'sec-10.1', dado: 2.6 },
  TYN612: { lineas: ['TYN612', 'ST 2311'], pines: ['K', 'A', 'G'], tipo: 'SCR (tiristor)', ref: 'sec-10.1', dado: 2.6 },
  L7805CV: { lineas: ['L7805CV', 'ST 2312'], pines: ['IN', 'GND', 'OUT'], tipo: 'regulador de 5 V', ref: 'sec-8.4', dado: 2.2 },
};

const to220: Constructor = (ctx, p) => {
  const info0 = TO220[String(p.referencia)] ?? TO220.IRF540N!;
  const info = { ...info0, lineas: lineasMarcado(p, info0.lineas, 10) };
  const g = new Group();
  const zb = ctx.montaje === 'placa' ? 3 : 13;
  const W = 10.0;
  const Hp = 9.0;
  const yT0 = 0.9;
  const tT = 1.3;
  const Ht = 15.6;
  // Plastic body in front of the tab.
  const plastico = malla(caja(ctx, W, 3.1, Hp, 0.25), material(ctx, ACABADOS.epoxiNegro));
  const tx = rotulo(ctx, info.lineas, W * 0.78, Hp * 0.36, { color: '#d6d9dd', peso: 600 });
  tx.rotation.x = Math.PI / 2;
  tx.position.set(0, -1.55 - 0.012, Hp * 0.12);
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `${info.tipo}: ${info.pines.join('-')} mirando la cara marcada`, ref: info.ref, punto: [W * 0.35, -1.55, Hp * 0.35] }, explosion: [0, -8, 0] }, plastico, tx), 0, yT0 - 1.55, zb + Hp / 2));
  // Metal tab with its mounting hole.
  const geoTab = ctx.rec.geometria('to220-tab', () => {
    const s = new Shape();
    s.moveTo(-W / 2, 0);
    s.lineTo(W / 2, 0);
    s.lineTo(W / 2, Ht);
    s.lineTo(-W / 2, Ht);
    s.closePath();
    s.holes.push(new Path().absarc(0, Ht - 2.8, 1.85, 0, Math.PI * 2, true));
    const e = new ExtrudeGeometry(s, { depth: tT, bevelEnabled: false, curveSegments: 32 });
    e.rotateX(Math.PI / 2);
    e.translate(0, tT, 0);
    return e;
  });
  const tab = malla(geoTab, material(ctx, { ...ACABADOS.estanoMate, color: '#cdd1d5', corte: '#b06a43' }));
  g.add(colocar(parte('lengueta', { etiqueta: { texto: `Lengüeta metálica = ${info.pines[1]} (está viva) con el taladro para el disipador`, ref: info.ref, punto: [W * 0.3, yT0 + tT, Ht - 1] } }, tab), 0, yT0, zb));
  // Die soldered on the tab, wires to the outer leads; the middle lead is part of the tab.
  const D = info.dado;
  const zd = zb + 4.6;
  const dado = malla(caja(ctx, D, 0.25, D * 0.85, 0.02), materialTextura(ctx, texturaDado(ctx, 47, 6, '#4f5b77'), { metal: 0.4, rugosidad: 0.3 }));
  dado.position.set(0, yT0 - 0.13, zd);
  dado.rotation.x = Math.PI / 2;
  dado.rotation.y = 0;
  g.add(parte('dado', { etiqueta: { texto: 'Dado de potencia soldado sobre la lengüeta (camino del calor)', ref: 'sec-10.5', punto: [D * 0.4, yT0 - 0.26, zd + D * 0.3] }, interior: true, entero: true, explosion: [0, -3, 2] }, dado));
  const matMarco = material(ctx, { color: '#c98a5c', metal: 1, rugosidad: 0.3 });
  const internos = new Group();
  for (const [i, x] of [-2.54, 0, 2.54].entries()) {
    const alto = i === 1 ? 2.2 : 2.6;
    const t = malla(caja(ctx, 1.4, 0.5, alto, 0.05), matMarco);
    t.position.set(x, yT0 - 0.3, zb + alto / 2 - 0.2);
    internos.add(t);
  }
  g.add(parte('marco', { etiqueta: { texto: `Patilla central unida a la lengüeta (${info.pines[1]})`, ref: 'sec-6.4', punto: [0, yT0 - 0.55, zb + 1.5] }, interior: true, entero: true }, internos));
  g.add(
    parte('hilos', { etiqueta: { texto: 'Hilos de aluminio gruesos (corriente de amperios)', ref: 'sec-7.3', punto: [-1.6, yT0 - 1.0, zb + 3.2] }, interior: true, entero: true, explosion: [0, -3, 2] }, malla(
      hilos(ctx, [-2.54, 2.54].map((x, k) => ({ a: [k ? D * 0.25 : -D * 0.25, yT0 - 0.28, zd - D * 0.2] as V3, b: [x, yT0 - 0.58, zb + 2.2] as V3, alto: 0.9 })), 0.15),
      material(ctx, ALUMINIO_HILO),
    )),
  );
  // Leads: wide shoulder, then 0,8 mm wide.
  const zFin = finPatilla(ctx, 0);
  const matP = material(ctx, ACABADOS.estano);
  const pats = new Group();
  for (const x of [-2.54, 0, 2.54]) {
    const hombro = malla(caja(ctx, 1.5, 0.5, 2.2, 0.05), matP);
    hombro.position.set(x, yT0 - 0.3, zb - 1.0);
    const zf = ctx.montaje === 'placa' ? zFin : 0;
    const resto = malla(caja(ctx, 0.8, 0.5, zb - 2.0 - zf, 0.05), matP);
    resto.position.set(x, yT0 - 0.3, (zb - 2.0 + zf) / 2);
    pats.add(hombro, resto);
  }
  g.add(parte('patillas', {}, pats));
  return {
    g,
    datos: {
      huella: {
        pads: [-2.54, 0, 2.54].map((x, i) => ({ n: String(i + 1), x, y: 0, forma: i === 0 ? 'rect' : 'ovalo', w: 1.9, h: 2.4, taladro: 1.1 })),
        ancho: W,
        fondo: 4.4,
        alto: zb + Ht,
        origenKicad: [-2.54, 0],
        kicad: 'Package_TO_SOT_THT:TO-220-3_Vertical',
      },
      cortes: [{ nombre: 'Frontal', normal: [0, 1, 0], min: yT0 - 3.2, max: yT0 + tT, inicial: yT0 - 0.75 }],
      explosionable: true,
      marcado: info.lineas.join(' '),
    },
  };
};

// ------------------------------------------------------------------ SOT-23

const SOT23: Record<string, { marca: string; tipo: string; pines: [string, string, string] }> = {
  MMBT3904: { marca: '1AM', tipo: 'NPN MMBT3904', pines: ['B', 'E', 'C'] },
  MMBT3906: { marca: '2A', tipo: 'PNP MMBT3906', pines: ['B', 'E', 'C'] },
  '2N7002': { marca: '702', tipo: 'MOSFET 2N7002', pines: ['G', 'S', 'D'] },
  BAT54S: { marca: 'KL4', tipo: 'dos Schottky en serie BAT54S', pines: ['A', 'K', 'K/A'] },
};

const sot23: Constructor = (ctx, p) => {
  const info0 = SOT23[String(p.referencia)] ?? SOT23.MMBT3904!;
  const info = { ...info0, marca: lineasMarcado(p, [info0.marca], 99).join(' ') };
  const g = new Group();
  const Lb = 2.9;
  const Wb = 1.3;
  const H = 0.95;
  const z0 = 0.06;
  const cuerpo = malla(caja(ctx, Wb, Lb, H, 0.08), material(ctx, ACABADOS.epoxiNegro));
  const tx = rotulo(ctx, [info.marca], Lb * 0.55, Wb * 0.55, { color: '#d6d9dd' });
  tx.rotation.z = Math.PI / 2;
  tx.position.z = H / 2 + 0.003;
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `${info.tipo}: marcaje «${info.marca}», no deducible`, ref: 'sec-6.4', punto: [0, Lb * 0.3, H / 2] }, explosion: [0, 0, 2] }, cuerpo, tx), 0, 0, z0 + H / 2));
  const matP = material(ctx, ACABADOS.estano);
  const geoL = alaGaviota(ctx, 0.6, H * 0.45 + z0, 0.13, 0.42, 0.35);
  const pines: [number, number, number][] = [
    [-1, 0.95, 0],
    [-1, -0.95, 1],
    [1, 0, 2],
  ];
  const pats = new Group();
  for (const [s, y] of pines) {
    const m = malla(geoL, matP);
    m.position.set(s * (Wb / 2 - 0.05), y, 0);
    m.rotation.z = s < 0 ? Math.PI : 0;
    pats.add(m);
  }
  g.add(parte('patillas', { etiqueta: { texto: `Patillas ${info.pines.join(', ')} (1, 2 y 3)`, ref: 'sec-6.4', punto: [-1.15, 0.95, 0.1] } }, pats));
  const dado = malla(caja(ctx, 0.42, 0.42, 0.15, 0.01), materialTextura(ctx, texturaDado(ctx, 61, 3), { metal: 0.4, rugosidad: 0.3 }));
  const zPad = z0 + H * 0.45;
  const pala = malla(caja(ctx, 0.9, 0.9, 0.12, 0.01), material(ctx, { color: '#c3c6ca', metal: 1, rugosidad: 0.3 }));
  pala.position.set(0.25, 0, zPad);
  dado.position.set(0.15, 0, zPad + 0.13);
  g.add(parte('dado', { etiqueta: { texto: `Dado sobre la patilla 3 (${info.pines[2]})`, ref: 'sec-6.1', punto: [0.15, 0, zPad + 0.2] }, interior: true, entero: true, explosion: [0, 0, 1.2] }, pala, dado));
  g.add(parte('hilos', { interior: true, entero: true, explosion: [0, 0, 1.2] }, malla(hilos(ctx, [{ a: [0.05, 0.08, zPad + 0.2], b: [-0.45, 0.95, zPad], alto: 0.25 }, { a: [0.05, -0.08, zPad + 0.2], b: [-0.45, -0.95, zPad], alto: 0.25 }], 0.018), material(ctx, ORO))));
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -1.1375, y: 0.95, forma: 'rect', w: 1.325, h: 0.6 },
          { n: '2', x: -1.1375, y: -0.95, forma: 'rect', w: 1.325, h: 0.6 },
          { n: '3', x: 1.1375, y: 0, forma: 'rect', w: 1.325, h: 0.6 },
        ],
        ancho: 2.4,
        fondo: Lb,
        alto: z0 + H,
        origenKicad: [0, 0],
        kicad: 'Package_TO_SOT_SMD:SOT-23',
      },
      cortes: [{ nombre: 'Desde arriba', normal: [0, 0, -1], min: -(z0 + H + 0.05), max: -zPad, inicial: -(zPad + 0.45) }],
      explosionable: true,
      marcado: info.marca,
    },
  };
};

// ------------------------------------------------------------------ D-PAK (TO-252)

const dpak: Constructor = (ctx, p) => {
  const ref = String(p.referencia ?? 'IRLR024N');
  const g = new Group();
  const Lb = 6.1;
  const Wb = 6.6;
  const H = 2.3;
  const cuerpo = malla(caja(ctx, Lb, Wb, H - 0.5, 0.15), material(ctx, ACABADOS.epoxiNegro));
  const lineasD = lineasMarcado(p, [ref.replace('IRLR', 'LR'), 'IR 2309'], 9);
  const tx = rotulo(ctx, lineasD, Lb * 0.75, Wb * 0.35, { color: '#d6d9dd' });
  tx.position.z = (H - 0.5) / 2 + 0.003;
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `MOSFET ${ref} en D-PAK`, ref: 'sec-7.3', punto: [-Lb * 0.2, -Wb / 2, H * 0.4] }, explosion: [0, 0, 4] }, cuerpo, tx), -0.4, 0, 0.5 + (H - 0.5) / 2));
  // Tab: the drain soldered to the board, which is the heatsink.
  const tab = malla(caja(ctx, Lb + 0.4, 5.3, 0.5, 0.05), material(ctx, { ...ACABADOS.estanoMate, corte: '#b06a43' }));
  g.add(colocar(parte('lengueta', { etiqueta: { texto: 'Pestaña del drenador soldada a la placa: la placa es el disipador', ref: 'sec-7.3', punto: [Lb / 2 + 0.2, 0, 0.5] } }, tab), 0.8, 0, 0.25));
  const geoL = alaGaviota(ctx, 2.6, 1.0, 0.5, 0.75, 1.3);
  const matP = material(ctx, ACABADOS.estano);
  const pats = new Group();
  for (const y of [-2.28, 2.28]) {
    const m = malla(geoL, matP);
    m.rotation.z = Math.PI;
    m.position.set(-Lb / 2 - 0.4, y, 0);
    pats.add(m);
  }
  const stub = malla(caja(ctx, 0.6, 0.75, 0.5, 0.05), matP);
  stub.position.set(-Lb / 2 - 0.7, 0, 1.0);
  pats.add(stub);
  g.add(parte('patillas', { etiqueta: { texto: 'Puerta (1) y fuente (3); la central va cortada', ref: 'sec-7.3', punto: [-Lb / 2 - 2.6, 2.28, 0] } }, pats));
  const zd = 0.5 + 0.13;
  const dado = malla(caja(ctx, 3.0, 2.6, 0.25, 0.02), materialTextura(ctx, texturaDado(ctx, 73, 4), { metal: 0.4, rugosidad: 0.3 }));
  dado.position.set(0.4, 0, zd);
  g.add(parte('dado', { etiqueta: { texto: 'Dado de potencia sobre la pestaña', ref: 'sec-7.4', punto: [0.4, 0, zd + 0.13] }, interior: true, entero: true, explosion: [0, 0, 2.5] }, dado));
  g.add(parte('hilos', { interior: true, entero: true, explosion: [0, 0, 2.5] }, malla(hilos(ctx, [-2.28, 2.28].map((y) => ({ a: [-0.6, y * 0.35, zd + 0.13] as V3, b: [-Lb / 2 + 0.2, y, 1.1] as V3, alto: 0.6 })), 0.12), material(ctx, ALUMINIO_HILO))));
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -4.2, y: 2.28, forma: 'rect', w: 2.2, h: 1.2 },
          { n: '3', x: -4.2, y: -2.28, forma: 'rect', w: 2.2, h: 1.2 },
          { n: '2', x: 2.1, y: 0, forma: 'rect', w: 6.4, h: 5.8 },
        ],
        ancho: 10,
        fondo: Wb,
        alto: H,
        origenKicad: [0, 0],
        kicad: 'Package_TO_SOT_SMD:TO-252-2',
      },
      cortes: [{ nombre: 'Desde arriba', normal: [0, 0, -1], min: -(H + 0.1), max: -0.5, inicial: -1.15 }],
      explosionable: true,
      marcado: lineasD.join(' '),
    },
  };
};

export const CONSTRUCTORES_S: Record<string, Constructor> = {
  'diodo-do41': diodoDo41,
  'diodo-do35': diodoDo35,
  'diodo-sod123': diodoSod123,
  'led-5mm': led5mm,
  'led-smd': ledSmd,
  puente,
  to92,
  to220,
  sot23,
  dpak,
};

