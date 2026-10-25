// Crystals, protection and connectors (book 2.6, 10.3, 10.4, 20.12, 45.3; figures 10.5, 10.7, 10.14, 20.8,
// 20.15, 45.6): HC-49 quartz crystal with its blank and electrodes, 5 × 20 fuse in board clips, resettable
// PTC, NTC/PTC/varistor discs, LDR with its serpentine track, pin header and screw terminal block.

import { ExtrudeGeometry, Group, Matrix4, Shape, CylinderGeometry, BoxGeometry } from 'three';
import { discoRadial } from './condensadores';
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
  lineasMarcado,
  materialTextura,
  mt,
  parte,
  rotulo,
  texturaPintada,
  tubo,
  unir,
  type Constructor,
} from './comun';
import type { Pad } from './tipos';

// ------------------------------------------------------------------ HC-49 crystal

const cristal: Constructor = (ctx, p) => {
  const f = Number(p.frecuencia) || 16e6;
  const alto = String(p.cuerpo) === 'U';
  const L = 11.05;
  const T = 4.65;
  const H = alto ? 13.46 : 3.5;
  const z0 = 0.5;
  const P = 4.88;
  const g = new Group();
  const geoCap = ctx.rec.geometria(`hc49:${alto}`, () => {
    const s = new Shape();
    const r = T / 2;
    s.absarc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.absarc(-L / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    s.closePath();
    const e = new ExtrudeGeometry(s, { depth: H - 0.3, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 3, curveSegments: 20 });
    return e;
  });
  const capsula = malla(geoCap, material(ctx, { ...ACABADOS.niquel, color: '#c4c7c9', rugosidad: 0.3, corte: '#9fa4a8' }));
  const mhz = Number((f / 1e6).toFixed(3)).toFixed(3).replace('.', ',');
  const lineasC = lineasMarcado(p, alto ? [mhz, 'MHz'] : [mhz], 10);
  const tx = rotulo(ctx, lineasC, L * 0.6, alto ? H * 0.32 : T * 0.55 * Math.min(2, lineasC.length), { color: '#262729', peso: 700 });
  if (alto) {
    tx.rotation.x = Math.PI / 2;
    tx.position.set(0, -T / 2 - 0.3 - 0.01, H * 0.55);
  } else tx.position.z = H + 0.01;
  g.add(colocar(parte('capsula', { etiqueta: { texto: `Cápsula metálica sellada: ${mhz} MHz`, ref: 'sec-20.12', punto: [L * 0.3, -T / 2, H * 0.8] }, explosion: [0, 0, H + 6] }, capsula, tx), 0, 0, z0 + 0.3));
  const base = malla(caja(ctx, L, T, 0.6, 0.25), material(ctx, { color: '#3c3f44', rugosidad: 0.6 }));
  g.add(colocar(parte('base', { etiqueta: { texto: 'Base con el sellado vidrio-metal', ref: 'fig-20.8', punto: [-L / 2, 0, 0.3] }, interior: true }, base), 0, 0, z0));
  // Quartz blank (disc in the U, strip in the S) with its silver electrodes, on two spring clips.
  const zc = z0 + 0.6 + (alto ? 6.2 : 1.45);
  const rb = alto ? 4.0 : 1.3;
  const blanco = malla(alto ? cilindro(ctx, rb, 0.18, 48) : caja(ctx, L * 0.72, 0.18, 2.3, 0.3), material(ctx, { color: '#e9eef0', rugosidad: 0.12, transparente: 0.55 }));
  if (alto) blanco.rotation.x = Math.PI / 2;
  if (alto) blanco.position.y = 0.09;
  const matAg = material(ctx, ACABADOS.plata);
  const elec = (s: number) => {
    const e = malla(alto ? cilindro(ctx, rb * 0.55, 0.03, 40) : caja(ctx, L * 0.36, 0.03, 1.4, 0.2), matAg);
    if (alto) e.rotation.x = Math.PI / 2;
    e.position.y = s < 0 ? -0.1 : alto ? 0.21 : 0.1;
    return e;
  };
  g.add(colocar(parte('cuarzo', { etiqueta: { texto: alto ? 'Disco de cuarzo: vibra en espesor (efecto piezoeléctrico)' : 'Lámina de cuarzo', ref: 'sec-20.12', punto: [-rb * 0.75, 0, alto ? rb * 0.5 : 0.9] }, interior: true, entero: true, explosion: [0, -4, 0] }, blanco), 0, 0, zc));
  g.add(colocar(parte('electrodos', { etiqueta: { texto: 'Electrodos de plata en las dos caras', ref: 'fig-20.8', punto: [0, -0.12, 0] }, interior: true, entero: true, explosion: [0, -6, 0] }, elec(-1), elec(1)), 0, 0, zc));
  const matPin = material(ctx, ACABADOS.niquel);
  const zFin = finPatilla(ctx, 13);
  for (const s of [-1, 1]) {
    const xc = s * (alto ? rb + 0.2 : L * 0.36);
    const pinza = malla(caja(ctx, 0.35, 0.8, alto ? rb * 1.1 : 1.6, 0.05), matPin);
    pinza.position.set(xc, 0, zc - (alto ? rb * 0.35 : 0.4));
    const sub = malla(hilo(ctx, [[s * (P / 2), 0, z0 + 0.6], [s * (P / 2), 0, zc - (alto ? rb * 0.9 : 1.2)], [xc, 0, zc - (alto ? rb * 0.9 : 1.2) + 0.5]], 0.22, { curva: 0.5, clave: `hc49-sub:${alto}:${s}` }), matPin);
    const pat = malla(hilo(ctx, [[s * (P / 2), 0, z0 + 0.6], [s * (P / 2), 0, zFin]], 0.22, { clave: `hc49-pat:${s}:${zFin}` }), material(ctx, ACABADOS.estano));
    g.add(parte(s < 0 ? 'pinza-1' : 'pinza-2', { etiqueta: s < 0 ? { texto: 'Pinza de sujeción y contacto', ref: 'fig-20.8', punto: [xc, 0, zc - (alto ? rb * 0.6 : 0.8)] } : undefined, interior: true, entero: true }, pinza, sub, pat));
  }
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -P / 2, y: 0, forma: 'circulo', w: 1.5, h: 1.5, taladro: 0.8 },
          { n: '2', x: P / 2, y: 0, forma: 'circulo', w: 1.5, h: 1.5, taladro: 0.8 },
        ],
        ancho: L,
        fondo: T,
        alto: z0 + H + 0.6,
        origenKicad: [-P / 2, 0],
        kicad: alto ? 'Crystal:Crystal_HC49-U_Vertical' : 'Crystal:Crystal_HC49-4H_Vertical',
      },
      cortes: [{ nombre: 'Frontal', normal: [0, 1, 0], min: -T / 2 - 0.4, max: T / 2, inicial: -0.35 }],
      explosionable: true,
      marcado: lineasC.join(' '),
    },
  };
};

// ------------------------------------------------------------------ fuse 5 × 20 in clips

const fusible: Constructor = (ctx, p) => {
  const I = Number(p.corriente) || 1;
  const lento = String(p.curva) === 'T';
  const fundido = p.fundido === true;
  const L = 20;
  const D = 5.2;
  const R = D / 2;
  const lc = 4.4;
  const g = new Group();
  const zc = R + 3.2;
  const txtI = I < 1 ? `${Math.round(I * 1000)}mA` : `${I}A`;
  const vidrio = malla(cilindro(ctx, R - 0.12, L - 2 * lc + 0.4, 40, R - 0.12, true), ctx.rec.material('vidrio-fusible', () => material(ctx, ACABADOS.vidrio)));
  vidrio.rotation.y = Math.PI / 2;
  vidrio.position.x = -(L - 2 * lc + 0.4) / 2;
  g.add(colocar(parte('tubo', { etiqueta: { texto: 'Tubo de vidrio: deja ver el hilo', ref: 'sec-10.3', punto: [L * 0.1, -R, R * 0.4] }, explosion: [0, 0, 6] }, vidrio), 0, 0, zc));
  const matCas = material(ctx, { ...ACABADOS.niquel, color: '#d0d2d3', rugosidad: 0.25 });
  for (const s of [-1, 1]) {
    const cas = malla(cilindro(ctx, R, lc, 40), matCas);
    cas.rotation.y = Math.PI / 2;
    cas.position.x = s < 0 ? -L / 2 : L / 2 - lc;
    const tx = rotulo(ctx, s < 0 ? [`${lento ? 'T' : 'F'} ${txtI}`] : ['250V'], lc * 0.86, R * 0.7, { color: '#2a2b2d' });
    tx.rotation.x = Math.PI / 2;
    tx.position.set(s * (L / 2 - lc / 2), -R - 0.01, 0);
    g.add(colocar(parte(s < 0 ? 'casquillo-1' : 'casquillo-2', { etiqueta: s < 0 ? { texto: `Casquillo: «${lento ? 'T' : 'F'} ${txtI} 250V» (${lento ? 'lento' : 'rápido'})`, ref: 'sec-10.3.1', punto: [-L / 2 + lc / 2, -R, R * 0.5] } : undefined, explosion: [s * 6, 0, 6] }, cas, tx), 0, 0, zc));
  }
  // The calibrated wire (a spiral on a core in the slow-blow), broken when blown.
  const matHilo = material(ctx, { color: '#d8d8d4', metal: 1, rugosidad: 0.3 });
  const lh = L - 2 * lc + 1;
  const hiloG = new Group();
  if (lento) {
    hiloG.add(malla(tubo(ctx, (t, out) => out.set(-lh / 2 + t * lh, 0.45 * Math.cos(t * 40 * Math.PI), 0.45 * Math.sin(t * 40 * Math.PI)), 400, 0.05, 5), matHilo));
    hiloG.add(colocar(malla(cilindro(ctx, 0.3, lh, 12), material(ctx, { color: '#efe7d4', rugosidad: 0.8 })), -lh / 2, 0, 0, 0, Math.PI / 2, 0));
  } else if (fundido) {
    hiloG.add(colocar(malla(cilindro(ctx, 0.06, lh * 0.42, 8), matHilo), -lh / 2, 0, -0.1, 0, Math.PI / 2, 0));
    hiloG.add(colocar(malla(cilindro(ctx, 0.06, lh * 0.42, 8), matHilo), lh * 0.08, 0, 0.1, 0, Math.PI / 2, 0));
    const hollin = malla(cilindro(ctx, R - 0.2, 2.5, 24, R - 0.2, true), material(ctx, { color: '#3a3330', rugosidad: 0.9, transparente: 0.35 }));
    hollin.rotation.y = Math.PI / 2;
    hollin.position.x = -1.2;
    hiloG.add(hollin);
  } else {
    const r = Math.min(0.12, 0.03 + I * 0.025);
    const h1 = malla(cilindro(ctx, r, lh, 8), matHilo);
    h1.rotation.y = Math.PI / 2;
    h1.position.x = -lh / 2;
    hiloG.add(h1);
  }
  g.add(colocar(parte('hilo', { etiqueta: { texto: fundido ? 'Hilo fundido: I²t superó su límite' : lento ? 'Hilo en espiral sobre un núcleo: aguanta los picos (lento)' : 'Hilo calibrado que se funde', ref: 'sec-10.3', punto: [0, 0, 0.2] }, entero: true, explosion: [0, 0, 6] }, hiloG), 0, 0, zc));
  // Board clips.
  const matClip = material(ctx, { ...ACABADOS.laton, color: '#d4c6a0' });
  const zFin = finPatilla(ctx, 3.5);
  const pads: Pad[] = [];
  for (const s of [-1, 1]) {
    const clip = new Group();
    const x = s * (L / 2 - lc / 2);
    for (const k of [-1, 1]) {
      const lamina = malla(caja(ctx, 2.8, 0.3, R + 1.2, 0.05), matClip);
      lamina.position.set(0, k * (R + 0.15), -R * 0.4);
      clip.add(lamina);
    }
    const pie = malla(caja(ctx, 3.0, 2 * R + 1.2, 0.3, 0.05), matClip);
    pie.position.set(0, 0, -zc + 0.3 + 0.15);
    const pat = malla(caja(ctx, 0.8, 0.5, 0.6 - zFin, 0.05), matClip);
    pat.position.set(0, 0, -zc + (0.6 + zFin) / 2);
    clip.add(pie, pat);
    g.add(colocar(parte(s < 0 ? 'pinza-1' : 'pinza-2', { etiqueta: s < 0 ? { texto: 'Portafusibles de placa (pinzas)', ref: 'fig-10.5', punto: [0, R + 0.15, -R] } : undefined }, clip), x, 0, zc));
    pads.push({ n: s < 0 ? '1' : '2', x, y: 0, forma: 'circulo', w: 2.4, h: 2.4, taladro: 1.3 });
  }
  return {
    g,
    datos: {
      huella: { pads, ancho: L, fondo: D + 1.2, alto: zc + R, origenKicad: [pads[0]!.x, 0], kicad: 'Fuse:Fuseholder_Clip-5x20mm_Littelfuse_111_Inline_P20.00x5.00mm_D1.3mm_Horizontal' },
      explosionable: true,
      marcado: `${lento ? 'T' : 'F'} ${txtI} 250V`,
    },
  };
};

// ------------------------------------------------------------------ resettable PTC

const ptc: Constructor = (ctx, p) => {
  const I = Number(p.corriente) || 0.5;
  const W = I >= 2 ? 11 : I >= 1 ? 8.5 : 7.4;
  const T = 3;
  const H = W * 1.05;
  const P = 5.1;
  const g = new Group();
  const zKink = 2.4;
  const zc = zKink + 1.3 + H / 2;
  const codigo = `X${String(Math.round(I * 100)).padStart(3, '0')}`;
  const cuerpo = malla(caja(ctx, W, T, H, T * 0.45), material(ctx, { color: '#e2b02a', rugosidad: 0.5, corte: '#c9982a' }));
  const tx = rotulo(ctx, [codigo, 'LF'], W * 0.62, H * 0.38, { color: '#2a2214' });
  tx.rotation.x = Math.PI / 2;
  tx.position.y = -T / 2 - 0.01;
  g.add(colocar(parte('recubrimiento', { etiqueta: { texto: `Recubrimiento de epoxi: «${codigo}» = ${String(I).replace('.', ',')} A de mantenimiento`, ref: 'sec-10.3', punto: [W * 0.3, -T / 2, H * 0.3] }, explosion: [0, -6, 0] }, cuerpo, tx), 0, 0, zc));
  const chip = malla(caja(ctx, W * 0.75, 0.6, H * 0.72, 0.05), material(ctx, { color: '#1b1b1d', rugosidad: 0.85, corte: '#2a2a2c' }));
  g.add(colocar(parte('polimero', { etiqueta: { texto: 'Polímero cargado de carbón: al calentarse se dilata y corta', ref: 'sec-10.3', punto: [-W * 0.2, -0.3, H * 0.2] }, interior: true }, chip), 0, 0, zc));
  const matNi = material(ctx, ACABADOS.niquel);
  for (const s of [-1, 1]) {
    const lam = malla(caja(ctx, W * 0.75, 0.08, H * 0.72, 0.02), matNi);
    lam.position.y = s * 0.34;
    g.add(colocar(parte(`lamina-${s}`, { etiqueta: s < 0 ? { texto: 'Láminas de níquel (electrodos)', ref: 'sec-10.3', punto: [W * 0.2, -0.38, -H * 0.2] } : undefined, interior: true, explosion: [0, s * 3, 0] }, lam), 0, 0, zc));
  }
  const zFin = finPatilla(ctx, 18);
  const matP = material(ctx, ACABADOS.estano);
  for (const s of [-1, 1]) {
    const y = s * 0.42;
    const pts: [number, number, number][] = [
      [s * W * 0.15, y, zc],
      [s * W * 0.15, y, zc - H / 2 - 0.4],
      [s * P / 2, 0, zKink + 0.8],
      [s * P / 2, 0, zKink + 0.3],
      [s * P / 2 + 0.5, 0, zKink],
      [s * P / 2, 0, zKink - 0.3],
      [s * P / 2, 0, zFin],
    ];
    g.add(parte(`patilla-${s}`, {}, malla(hilo(ctx, pts, 0.3, { curva: 0.5, clave: `ptc:${W}:${s}:${zFin}` }), matP)));
  }
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -P / 2, y: 0, forma: 'circulo', w: 1.8, h: 1.8, taladro: 0.9 },
          { n: '2', x: P / 2, y: 0, forma: 'circulo', w: 1.8, h: 1.8, taladro: 0.9 },
        ],
        ancho: W,
        fondo: T,
        alto: zc + H / 2,
        origenKicad: [-P / 2, 0],
      },
      cortes: [{ nombre: 'Lateral', normal: [1, 0, 0], min: -W / 2, max: W / 2, inicial: 0 }],
      explosionable: true,
      marcado: codigo,
    },
  };
};

// ------------------------------------------------------------------ NTC, PTC, varistor discs

const termistor: Constructor = (ctx, p) => {
  const clase = String(p.clase ?? 'ntc');
  const D = Number(p.diametro) || 7;
  const mov = clase === 'varistor';
  const cod = mov ? (D >= 14 ? 'S14K385' : `${D}D471K`) : clase === 'ptc' ? 'PTC 60°' : D >= 10 ? '5D-11' : '10K';
  const d = discoRadial(ctx, {
    D,
    t: mov ? Math.max(3.2, D * 0.28) : Math.max(2.4, D * 0.33),
    paso: D >= 10 ? 7.5 : 5,
    d: D >= 10 ? 0.8 : 0.6,
    color: mov ? '#2b5ea8' : clase === 'ptc' ? '#c9a33a' : '#2c2d30',
    colorCorte: mov ? '#244f8f' : '#3a3b3f',
    colorTexto: mov || clase === 'ntc' ? '#f1f1ef' : '#2a2a2a',
    marcado: cod.split(' '),
    interior: mov
      ? { color: '#6d6a63', corte: '#5d5a54', etiqueta: 'Disco de óxido de zinc: conduce por encima de su tensión', ref: 'sec-10.4' }
      : { color: clase === 'ptc' ? '#4a4a48' : '#5d5754', corte: '#4a4644', etiqueta: clase === 'ptc' ? 'Cerámica de titanato de bario (PTC)' : 'Cerámica de óxidos metálicos: su resistencia cae con la temperatura', ref: 'sec-2.6' },
    electrodo: { etiqueta: 'Electrodo de plata en cada cara', ref: 'sec-2.6' },
    recubrimiento: { etiqueta: mov ? `Varistor «${cod}»` : clase === 'ptc' ? 'PTC: recubrimiento de epoxi' : `NTC «${cod}»`, ref: mov ? 'fig-10.7' : 'fig-10.14' },
  });
  return d;
};

// ------------------------------------------------------------------ LDR

const ldr: Constructor = (ctx, p) => {
  const D = Number(p.diametro) || 5;
  const R = D / 2;
  const g = new Group();
  const h = 2.0;
  const z0 = ctx.montaje === 'placa' ? 2 : 22;
  const tex = texturaPintada(ctx, `ldr:${D}`, 512, 512, (c, w, hh) => {
    c.fillStyle = '#efe9db';
    c.fillRect(0, 0, w, hh);
    c.save();
    c.beginPath();
    c.arc(w / 2, hh / 2, w * 0.47, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#d9a52c';
    c.fillRect(0, 0, w, hh);
    // Two interdigitated electrodes leave a serpentine CdS track between them.
    c.fillStyle = '#c7cacd';
    const n = D >= 10 ? 9 : 6;
    const pasoY = hh / (n + 1);
    for (let i = 0; i < n; i++) {
      const y = pasoY * (i + 0.5) + pasoY / 2;
      const izq = i % 2 === 0;
      c.fillRect(izq ? 0 : w * 0.12, y - pasoY * 0.18, w * 0.88, pasoY * 0.36);
    }
    c.fillRect(0, 0, w * 0.1, hh);
    c.fillRect(w * 0.9, 0, w * 0.1, hh);
    c.restore();
  });
  const disco = malla(cilindro(ctx, R, h, 48), material(ctx, { ...ACABADOS.plasticoBlanco, color: '#efe9db' }));
  const cara = malla(ctx.rec.geometria(`ldr-cara:${R}`, () => {
    const c = new CylinderGeometry(R - 0.05, R - 0.05, 0.02, 48);
    c.rotateX(Math.PI / 2);
    return c;
  }), materialTextura(ctx, tex, { rugosidad: 0.4 }));
  cara.position.z = h + 0.011;
  // Rotate the face so the serpentine runs across the leads.
  const capa = malla(cilindro(ctx, R + 0.05, 0.25, 48), material(ctx, { color: '#f4f8f7', rugosidad: 0.05, transparente: 0.3 }));
  capa.position.z = h;
  g.add(colocar(parte('ldr', { etiqueta: { texto: 'Pista de sulfuro de cadmio en serpentina entre los dos electrodos', ref: 'sec-45.3', punto: [R * 0.35, 0, h + 0.02] } }, disco, cara, capa), 0, 0, z0));
  const matP = material(ctx, ACABADOS.estano);
  const zFin = finPatilla(ctx, 0);
  for (const s of [-1, 1]) g.add(parte(`patilla-${s}`, {}, malla(hilo(ctx, [[s * 1.7, 0, z0 + 0.3], [s * 1.7, 0, ctx.montaje === 'placa' ? zFin : 0]], 0.25, { clave: `ldr:${s}:${z0}:${zFin}` }), matP)));
  return {
    g,
    datos: {
      huella: {
        pads: [
          { n: '1', x: -1.7, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: 0.8 },
          { n: '2', x: 1.7, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: 0.8 },
        ],
        ancho: D,
        fondo: D,
        alto: z0 + h,
        origenKicad: [-1.7, 0],
        kicad: 'OptoDevice:R_LDR_5.1x4.3mm_P3.4mm_Vertical',
      },
    },
  };
};

// ------------------------------------------------------------------ pin header

const tiraPines: Constructor = (ctx, p) => {
  const n = Math.max(1, Math.min(40, Math.round(Number(p.pines) || 6)));
  const filas = Number(p.filas) === 2 ? 2 : 1;
  const e = 2.54;
  const g = new Group();
  const hp = 2.5;
  const largo = n * e;
  const ancho = filas * e;
  const plastico = malla(caja(ctx, ancho, largo, hp, 0.15), material(ctx, ACABADOS.plasticoNegro));
  g.add(colocar(parte('soporte', { etiqueta: { texto: 'Soporte de plástico', ref: 'fig-20.15', punto: [ancho / 2, -largo / 2 + 1, hp * 0.5] }, explosion: [0, 0, -4] }, plastico), (filas - 1) * e * 0.5 - (filas - 1) * e * 0.5, 0, hp / 2));
  const zFin = finPatilla(ctx, 3);
  const geoPin = ctx.rec.geometria(`pin:${zFin}`, () => {
    const cuerpo = new BoxGeometry(0.64, 0.64, hp + 6 - 0.4 - zFin);
    cuerpo.translate(0, 0, (hp + 6 - 0.4 + zFin) / 2);
    const punta = new CylinderGeometry(0.2, 0.42, 0.4, 4);
    punta.rotateX(Math.PI / 2);
    punta.rotateZ(Math.PI / 4);
    punta.translate(0, 0, hp + 6 - 0.2);
    return unir(ctx, [cuerpo, punta]);
  });
  const ms: Matrix4[] = [];
  const pads: Pad[] = [];
  let k = 1;
  for (let i = 0; i < n; i++)
    for (let f = 0; f < filas; f++) {
      const x = (f - (filas - 1) / 2) * e;
      const y = ((n - 1) / 2 - i) * e;
      ms.push(mt(x, y, 0));
      pads.push({ n: String(k), x, y, forma: k === 1 ? 'rect' : 'ovalo', w: 1.7, h: 1.7, taladro: 1.0 });
      k++;
    }
  g.add(parte('pines', { etiqueta: { texto: `${n * filas} pines cuadrados de 0,64 mm, estañados o dorados`, ref: 'fig-20.15', punto: [pads[0]!.x, pads[0]!.y, hp + 6] } }, instancias(geoPin, material(ctx, { ...ACABADOS.oro, rugosidad: 0.3 }), ms)));
  return {
    g,
    datos: {
      huella: { pads, ancho, fondo: largo, alto: hp + 6, origenKicad: [pads[0]!.x, pads[0]!.y], kicad: `Connector_PinHeader_2.54mm:PinHeader_${filas}x${String(n).padStart(2, '0')}_P2.54mm_Vertical` },
      explosionable: true,
      marcado: `${filas}x${n}`,
    },
  };
};

// ------------------------------------------------------------------ screw terminal block

const borna: Constructor = (ctx, p) => {
  const n = Math.max(2, Math.min(6, Math.round(Number(p.polos) || 2)));
  const verde = String(p.color ?? 'verde') !== 'azul';
  const e = 5.08;
  const W = n * e;
  const D = 7.6;
  const H = 10;
  const g = new Group();
  const color = verde ? '#2f8f4e' : '#2f62b4';
  const cuerpo = malla(caja(ctx, W, D, H, 0.4), material(ctx, { color, rugosidad: 0.5, corte: verde ? '#277a42' : '#28539a' }));
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `Bloque de ${n} bornas a 5,08 mm`, ref: 'fig-20.15', punto: [W / 2, 0, H * 0.6] }, explosion: [0, 0, 0] }, cuerpo), 0, 0, H / 2));
  const matT = material(ctx, { ...ACABADOS.acero, color: '#c9ccd0', corte: '#8f949a' });
  const matCaja = material(ctx, { ...ACABADOS.estanoMate, corte: '#8f949a' });
  const oscuro = material(ctx, { color: '#0f1011', rugosidad: 0.9 });
  const zFin = finPatilla(ctx, 3.5);
  const pads: Pad[] = [];
  for (let i = 0; i < n; i++) {
    const x = ((n - 1) / 2 - i) * -e;
    const tornillo = new Group();
    const cabeza = malla(cilindro(ctx, 1.5, 0.8, 24), matT);
    const ranura = malla(caja(ctx, 2.8, 0.45, 0.3, 0.02), oscuro);
    ranura.position.z = 0.7;
    const rosca = malla(cilindro(ctx, 1.25, 3.4, 16), matT);
    rosca.position.z = -3.4;
    tornillo.add(cabeza, ranura, rosca);
    const hueco = malla(cilindro(ctx, 1.7, 0.05, 24), oscuro);
    hueco.position.z = 0.02;
    g.add(colocar(parte(`tornillo-${i}`, { etiqueta: i === 0 ? { texto: 'Tornillo M3 que aprieta la pinza', ref: 'fig-20.15', punto: [1.5, 0, 0.8] } : undefined, explosion: [0, 0, 6] }, tornillo), x, 0.6, H - 0.6));
    const boca = malla(caja(ctx, 3.4, 0.05, 3.0, 0.1), oscuro);
    const pinza = malla(caja(ctx, 3.2, 4.2, 3.2, 0.1), matCaja);
    pinza.position.set(0, 2.2, 0);
    g.add(colocar(parte(`boca-${i}`, { etiqueta: i === 0 ? { texto: 'Entrada del cable y pinza de latón', ref: 'fig-20.15', punto: [0, 0, 1.5] } : undefined, interior: true, explosion: [0, -5, 0] }, boca, pinza), x, -D / 2 - 0.01, 3.4));
    const pat = malla(caja(ctx, 1.0, 0.5, 0.6 - zFin, 0.05), material(ctx, ACABADOS.estano));
    pat.position.set(x, 0.6, (0.6 + zFin) / 2);
    g.add(parte(`patilla-${i}`, {}, pat));
    pads.push({ n: String(i + 1), x, y: 0.6, forma: i === 0 ? 'rect' : 'circulo', w: 2.6, h: 2.6, taladro: 1.3 });
  }
  return {
    g,
    datos: {
      huella: { pads, ancho: W, fondo: D, alto: H + 0.8, origenKicad: [pads[0]!.x, pads[0]!.y], kicad: `TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-${n}-5.08_1x${String(n).padStart(2, '0')}_P5.08mm_Horizontal` },
      cortes: [{ nombre: 'Lateral', normal: [1, 0, 0], min: -W / 2, max: W / 2, inicial: pads[0]!.x }],
      explosionable: true,
      marcado: `${n} polos`,
    },
  };
};

export const CONSTRUCTORES_V: Record<string, Constructor> = {
  cristal,
  fusible,
  ptc,
  termistor,
  ldr,
  'tira-pines': tiraPines,
  borna,
};

