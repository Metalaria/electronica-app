// Resistors (book 2.2, 2.4, 2.5, 2.11): axial film/wirewound resistor with its IEC 60062 bands (also the
// colour-coded axial inductor), SMD thick-film chip with its code, rotary potentiometer and trimmer.

import { CylinderGeometry, DoubleSide, Group, MeshStandardMaterial } from 'three';
import { bandas, codigoSmd, COLORES, leerValor, normalizar, textoValor, rkm } from './codigos';
import {
  ACABADOS,
  caja,
  cilindro,
  colocar,
  finPatilla,
  hilo,
  malla,
  material,
  materialTextura,
  parte,
  rotulo,
  texturaPintada,
  torno,
  tubo,
  type Ctx,
} from './comun';
import type { DatosModelo, Huella, Parametros } from './tipos';

// ------------------------------------------------------------------ axial bodies

export const CUERPOS_AXIALES: Record<string, { L: number; D: number; d: number; P: number }> = {
  '0204': { L: 3.6, D: 1.6, d: 0.5, P: 7.62 },
  '0207': { L: 6.3, D: 2.5, d: 0.6, P: 10.16 },
  '0309': { L: 9, D: 3.2, d: 0.6, P: 12.7 },
  '0411': { L: 9.9, D: 3.6, d: 0.8, P: 15.24 },
  '0414': { L: 11.9, D: 4.5, d: 0.8, P: 15.24 },
  '0617': { L: 17, D: 6, d: 0.8, P: 20.32 },
  // Colour-coded axial inductor (Fastron SMCC-like): fatter body.
  bobina: { L: 9.5, D: 4, d: 0.6, P: 15.24 },
};

/** Dog-bone profile of an axial body (radius, z), z from −L/2 to L/2. */
function perfilHueso(L: number, R: number, cintura: number): [number, number][] {
  const p: [number, number][] = [[0, -L / 2]];
  const rc = R * 0.42;
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (i / 4);
    p.push([R - rc + rc * Math.sin(a), -L / 2 + rc - rc * Math.cos(a)]);
  }
  const hombro = L * 0.17;
  p.push([R, -L / 2 + hombro], [R * (cintura + (1 - cintura) * 0.35), -L / 2 + hombro + L * 0.04], [R * cintura, -L / 2 + hombro + L * 0.09]);
  p.push([R * cintura, L / 2 - hombro - L * 0.09], [R * (cintura + (1 - cintura) * 0.35), L / 2 - hombro - L * 0.04], [R, L / 2 - hombro]);
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (i / 4);
    p.push([R - rc + rc * Math.cos(a), L / 2 - rc + rc * Math.sin(a)]);
  }
  p.push([0, L / 2]);
  return p;
}

/** Positions (fraction of the body length from pin 1) and width of each band. */
function posicionesBandas(n: number): { f: number[]; w: number } {
  if (n === 5) return { f: [0.15, 0.27, 0.39, 0.51, 0.82], w: 0.075 };
  if (n === 4) return { f: [0.17, 0.31, 0.45, 0.8], w: 0.09 };
  return { f: [0.2, 0.37, 0.54, 0.8], w: 0.1 };
}

function pintarBandas(ctx: Ctx, fondo: string, claves: string[]) {
  const H = 512;
  return texturaPintada(ctx, `bandas:${fondo}:${claves.join(',')}`, 8, H, (g, w, h) => {
    g.fillStyle = fondo;
    g.fillRect(0, 0, w, h);
    const { f, w: bw } = posicionesBandas(claves.length);
    claves.forEach((k, i) => {
      g.fillStyle = COLORES[k]?.hex ?? '#000';
      const c = f[i]!;
      g.fillRect(0, h * (1 - c - bw / 2), w, h * bw);
    });
  });
}

/** Helical groove of the film: a cut-out stripe winding `vueltas` times along the cylinder. */
function texturaHelice(ctx: Ctx, color: string, vueltas: number) {
  return texturaPintada(ctx, `helice:${color}:${vueltas}`, 256, 512, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const ancho = w * 0.07;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      const x = (((v * vueltas) % 1) + 1) % 1;
      for (const dx of [-1, 0, 1]) g.fillRect((x + dx) * w - ancho / 2, y, ancho, 1);
    }
  });
}

export function resistenciaAxial(ctx: Ctx, p: Parametros, opc: { bobina?: boolean } = {}): { g: Group; datos: Partial<DatosModelo> } {
  const bob = !!opc.bobina;
  const cuerpo = CUERPOS_AXIALES[bob ? 'bobina' : String(p.cuerpo ?? '0207')] ?? CUERPOS_AXIALES['0207']!;
  const { L, D, d } = cuerpo;
  const P = Number(p.paso) > 0 ? Number(p.paso) : cuerpo.P;
  const R = D / 2;
  const tec = bob ? 'bobina' : String(p.tecnologia ?? 'carbon');
  const valor = leerValor(p.valor as string | number, bob ? 100e-6 : 4700);
  const nb = bob ? 4 : Number(p.bandas) === 5 ? 5 : 4;
  // Inductors are colour-coded in µH (book 4.2).
  // Five bands are the 1 % (or better) series: a 4-band tolerance (5 %, 10 %) does not carry over.
  const tolP = Number(p.tolerancia) || undefined;
  const tol = nb === 5 && tolP != null && tolP >= 5 ? 1 : nb === 4 && tolP != null && tolP < 2 ? 5 : tolP;
  const b = bob ? bandas(valor * 1e6, 4, 10) : bandas(valor, nb as 4 | 5, tol);
  const fondo = bob ? '#86b98a' : tec === 'metalica' ? '#79aed6' : tec === 'bobinada' ? '#5f8c62' : '#d9c18e';

  const zc = R; // axis height: the body lies on the board
  const g = new Group();

  // Outer coating with the bands (axis along X after rotation).
  const geoCuerpo = torno(ctx, perfilHueso(L, R, bob ? 0.93 : 0.86), 48, `hueso:${L}:${R}:${bob}`);
  const matCuerpo = materialTextura(ctx, pintarBandas(ctx, fondo, b.claves), { rugosidad: 0.55, corte: bob ? '#6e9c72' : tec === 'metalica' ? '#5e8db2' : '#c2a874' });
  const recubrimiento = malla(geoCuerpo, matCuerpo);
  recubrimiento.rotation.y = Math.PI / 2;
  const nombres = b.claves.map((k) => COLORES[k]?.nombre ?? k).join(', ');
  const valorTxt = bob ? textoValor(b.valor * 1e-6, 'H') : textoValor(b.valor, 'Ω');
  g.add(
    colocar(
      parte('recubrimiento', {
        etiqueta: {
          texto: `${bob ? 'Recubrimiento' : 'Laca'} con las bandas: ${nombres} → ${valorTxt} ±${String(b.tol).replace('.', ',')} %`,
          ref: 'sec-2.4',
          punto: [-L * 0.17, 0, R],
        },
        explosion: [0, 0, D * 1.8],
        colorCorte: bob ? '#6e9c72' : tec === 'metalica' ? '#5e8db2' : '#c2a874',
      }, recubrimiento),
      0,
      0,
      zc,
    ),
  );

  // Ceramic core (or ferrite core of the inductor).
  const rNucleo = R * 0.6;
  const largoNucleo = L * 0.9;
  const nucleo = malla(cilindro(ctx, rNucleo, largoNucleo, 24), material(ctx, bob ? { color: '#3b3b3e', rugosidad: 0.7, corte: '#4a4a4e' } : ACABADOS.ceramica));
  nucleo.rotation.y = Math.PI / 2;
  nucleo.position.x = -largoNucleo / 2;
  g.add(
    colocar(
      parte('nucleo', {
        etiqueta: { texto: bob ? 'Núcleo de ferrita' : 'Cilindro cerámico (núcleo)', ref: bob ? 'sec-4.4' : 'sec-2.2.2', punto: [L * 0.05, 0, rNucleo] },
        interior: true,
        entero: true,
      }, nucleo),
      0,
      0,
      zc,
    ),
  );

  // Resistive element: film with its helical cut, or wound wire.
  const largoPelicula = L * 0.62;
  if (tec === 'bobinada' || bob) {
    const vueltas = bob ? 26 : 16;
    const rh = rNucleo + (bob ? 0.09 : 0.05);
    const geo = tubo(
      ctx,
      (t, out) => {
        const a = t * vueltas * Math.PI * 2;
        return out.set(-largoPelicula / 2 + t * largoPelicula, rh * Math.cos(a), rh * Math.sin(a));
      },
      vueltas * 16,
      bob ? 0.09 : 0.05,
      6,
    );
    const m = malla(geo, material(ctx, bob ? ACABADOS.cobreEsmaltado : { color: '#b8b4aa', metal: 1, rugosidad: 0.35 }));
    g.add(
      colocar(
        parte('hilo', {
          etiqueta: { texto: bob ? 'Hilo de cobre esmaltado bobinado' : 'Hilo resistivo bobinado', ref: bob ? 'sec-4.2' : 'sec-2.2.4', punto: [0, 0, rh] },
          interior: true,
          entero: true,
          explosion: [0, 0, D * 0.9],
        }, m),
        0,
        0,
        zc,
      ),
    );
  } else {
    const met = tec === 'metalica';
    const vueltas = Math.max(3, Math.min(14, Math.round(2 + Math.log10(Math.max(b.valor, 1)) * 1.6)));
    const tex = texturaHelice(ctx, met ? '#8f897c' : '#26272a', vueltas);
    const matP = ctx.rec.material(`pelicula:${tex.uuid}`, () => {
      const m = new MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: DoubleSide, metalness: met ? 0.85 : 0.1, roughness: met ? 0.3 : 0.55 });
      m.userData.corte = met ? '#6f6a60' : '#1b1b1d';
      return m;
    });
    const geo = ctx.rec.geometria(`pelicula:${rNucleo}:${largoPelicula}:${ctx.bajo}`, () => {
      const c = new CylinderGeometry(rNucleo + 0.02, rNucleo + 0.02, largoPelicula, ctx.seg(40), 1, true);
      c.rotateZ(Math.PI / 2);
      return c;
    });
    const m = malla(geo, matP);
    g.add(
      colocar(
        parte('pelicula', {
          etiqueta: {
            texto: met ? 'Película metálica (níquel-cromo) con su corte helicoidal' : 'Película de carbón con su corte helicoidal',
            ref: met ? 'sec-2.2.3' : 'sec-2.2.2',
            punto: [largoPelicula * 0.18, 0, rNucleo],
          },
          interior: true,
          entero: true,
          explosion: [0, 0, D * 0.9],
        }, m),
        0,
        0,
        zc,
      ),
    );
  }

  // End caps and leads (one part per side, so that they slide out together).
  const largoCasquillo = L * 0.2;
  const rCasquillo = rNucleo + 0.1;
  const matCasq = material(ctx, ACABADOS.estanoMate);
  const matPat = material(ctx, ACABADOS.estano);
  const zFin = finPatilla(ctx, 26);
  for (const s of [-1, 1]) {
    const casq = malla(cilindro(ctx, rCasquillo, largoCasquillo, 24), matCasq);
    casq.rotation.y = Math.PI / 2;
    casq.position.x = s < 0 ? -L / 2 + 0.06 : L / 2 - 0.06 - largoCasquillo;
    const xs = s * (L / 2 - 0.1);
    const pts: [number, number, number][] =
      ctx.montaje === 'placa'
        ? [
            [xs, 0, 0],
            [s * (P / 2), 0, 0],
            [s * (P / 2), 0, zFin - zc],
          ]
        : [
            [xs, 0, 0],
            [s * (L / 2 + 26), 0, 0],
          ];
    const pat = malla(hilo(ctx, pts, d / 2, { curva: d * 1.2, clave: `axial:${L}:${P}:${d}:${ctx.montaje}:${zFin}:${s}` }), matPat);
    g.add(
      colocar(
        parte(s < 0 ? 'terminal-1' : 'terminal-2', {
          etiqueta:
            s < 0
              ? { texto: 'Casquillo del terminal', ref: 'fig-2.3', punto: [-L / 2 + largoCasquillo / 2, 0, rCasquillo] }
              : { texto: 'Patilla de cobre estañado', punto: [ctx.montaje === 'placa' ? P / 2 : L / 2 + 6, 0, ctx.montaje === 'placa' ? -zc / 2 : 0] },
          interior: s < 0,
          explosion: [s * L * 0.38, 0, 0],
        }, casq, pat),
        0,
        0,
        zc,
      ),
    );
  }

  const huella: Huella = {
    pads: [
      { n: '1', x: -P / 2, y: 0, forma: 'rect', w: 1.6, h: 1.6, taladro: d + 0.2 },
      { n: '2', x: P / 2, y: 0, forma: 'circulo', w: 1.6, h: 1.6, taladro: d + 0.2 },
    ],
    ancho: P + 1.6,
    fondo: D,
    alto: D,
    origenKicad: [-P / 2, 0],
    kicad: bob ? 'Inductor_THT:L_Axial_L9.5mm_D4.0mm_P15.24mm_Horizontal_Fastron_SMCC' : `Resistor_THT:R_Axial_DIN${p.cuerpo ?? '0207'}_L${L}mm_D${D}mm_P${P.toFixed(2)}mm_Horizontal`,
  };
  return {
    g,
    datos: {
      huella,
      marcado: nombres,
      cortes: [
        { nombre: 'Longitudinal', normal: [0, 1, 0], min: -R * 1.05, max: R * 1.05, inicial: 0 },
        { nombre: 'Transversal', normal: [1, 0, 0], min: -L / 2, max: L / 2, inicial: 0 },
      ],
      explosionable: true,
    },
  };
}

// ------------------------------------------------------------------ SMD chip resistor

export const CHIPS: Record<string, { L: number; W: number; H: number; t: number }> = {
  '0201': { L: 0.6, W: 0.3, H: 0.23, t: 0.15 },
  '0402': { L: 1.0, W: 0.5, H: 0.35, t: 0.25 },
  '0603': { L: 1.6, W: 0.8, H: 0.45, t: 0.3 },
  '0805': { L: 2.0, W: 1.25, H: 0.5, t: 0.4 },
  '1206': { L: 3.2, W: 1.6, H: 0.55, t: 0.5 },
  '1210': { L: 3.2, W: 2.5, H: 0.55, t: 0.5 },
  '2010': { L: 5.0, W: 2.5, H: 0.55, t: 0.6 },
  '2512': { L: 6.3, W: 3.2, H: 0.55, t: 0.6 },
};

/** IPC-like pads of a two-terminal chip (mm). */
export function padsChip(L: number, W: number, t: number): Huella['pads'] {
  const pw = t + Math.max(0.25, L * 0.18);
  const ph = W + 0.2;
  const x = L / 2 - t / 2 + Math.max(0.1, L * 0.06);
  return [
    { n: '1', x: -x, y: 0, forma: 'rect', w: pw, h: ph },
    { n: '2', x, y: 0, forma: 'rect', w: pw, h: ph },
  ];
}

export function resistenciaSmd(ctx: Ctx, p: Parametros): { g: Group; datos: Partial<DatosModelo> } {
  const tam = String(p.tamano ?? '0805');
  const c = CHIPS[tam] ?? CHIPS['0805']!;
  const { L, W, H, t } = c;
  const valor = leerValor(p.valor as string | number, 4700);
  const sistema = (['tres', 'cuatro', 'eia96'].includes(String(p.codigo)) ? p.codigo : 'tres') as 'tres' | 'cuatro' | 'eia96';
  const codigo = tam === '0402' || tam === '0201' ? '' : codigoSmd(valor, sistema);
  const valorCodigo = normalizar(valor, sistema === 'tres' ? 'E24' : sistema === 'cuatro' ? 'E96+E24' : 'E96');
  const g = new Group();
  const hSus = H * 0.62;
  const hRes = H * 0.08;
  const hCapa = H - hSus - hRes;
  const largoInt = L - 2 * t;

  // Alumina substrate.
  const sus = malla(caja(ctx, L - 0.02, W, hSus, Math.min(0.03, hSus * 0.2)), material(ctx, ACABADOS.alumina));
  g.add(colocar(parte('sustrato', { etiqueta: { texto: 'Sustrato de alúmina (cerámica)', ref: 'sec-2.2.5', punto: [0, -W / 2, hSus / 2] }, interior: true }, sus), 0, 0, hSus / 2));

  // Resistive thick film with its laser trim.
  const res = malla(caja(ctx, largoInt + t * 0.6, W * 0.84, hRes, 0), material(ctx, { color: '#1f2a3a', rugosidad: 0.6, corte: '#2b3a52' }));
  const corteLaser = malla(caja(ctx, Math.max(0.05, L * 0.05), W * 0.45, hRes * 1.2, 0), material(ctx, { color: '#f0eee8', rugosidad: 0.8 }));
  corteLaser.position.set(L * 0.08, -W * 0.2, 0);
  g.add(
    colocar(
      parte('capa-resistiva', {
        etiqueta: { texto: 'Capa resistiva (película gruesa), con el corte láser que ajusta el valor', ref: 'sec-2.2.5', punto: [L * 0.08, -W * 0.3, hRes / 2] },
        interior: true,
        explosion: [0, 0, H * 1.6],
      }, res, corteLaser),
      0,
      0,
      hSus + hRes / 2,
    ),
  );

  // Protective overglaze (black) with the marking.
  const capa = malla(caja(ctx, largoInt, W * 0.92, hCapa, Math.min(0.04, hCapa * 0.45)), material(ctx, { color: '#16171a', rugosidad: 0.45, corte: '#2a2b30' }));
  const grupoCapa = parte('recubrimiento', {
    etiqueta: { texto: codigo ? `Recubrimiento protector con el código «${codigo}» → ${textoValor(valorCodigo, 'Ω')}` : 'Recubrimiento protector (sin marcar: 0402)', ref: 'sec-2.5', punto: [0, W * 0.3, hCapa / 2] },
    explosion: [0, 0, H * 3],
  }, capa);
  if (codigo) {
    const tx = rotulo(ctx, [codigo], largoInt * 0.86, W * 0.62, { color: '#f4f4f0', peso: 600 });
    tx.position.z = hCapa / 2 + 0.002;
    grupoCapa.add(tx);
  }
  g.add(colocar(grupoCapa, 0, 0, hSus + hRes + hCapa / 2));

  // Wrap-around terminations: tin over nickel over the silver base.
  const matTerm = material(ctx, { ...ACABADOS.estanoMate, corte: '#8d9095' });
  for (const s of [-1, 1]) {
    const term = malla(caja(ctx, t, W + 0.02, H + 0.03, Math.min(0.05, t * 0.25)), matTerm);
    g.add(
      colocar(
        parte(s < 0 ? 'terminacion-1' : 'terminacion-2', {
          etiqueta: s < 0 ? { texto: 'Terminación envolvente: plata, barrera de níquel y estaño', ref: 'sec-2.2.5', punto: [-L / 2 + t / 2, -W / 2, H * 0.6] } : undefined,
          explosion: [s * L * 0.55, 0, 0],
        }, term),
        s * (L / 2 - t / 2),
        0,
        (H + 0.03) / 2,
      ),
    );
  }

  return {
    g,
    datos: {
      huella: { pads: padsChip(L, W, t), ancho: L, fondo: W, alto: H, origenKicad: [0, 0], kicad: `Resistor_SMD:R_${tam}` },
      marcado: codigo,
      cortes: [{ nombre: 'Longitudinal', normal: [0, 1, 0], min: -W / 2, max: W / 2, inicial: 0 }],
      explosionable: true,
    },
  };
}

// ------------------------------------------------------------------ rotary potentiometer (16 mm)

function texturaPista(ctx: Ctx) {
  // Horseshoe carbon track (270°) on the phenolic wafer, seen from above; UV of a disc.
  return texturaPintada(ctx, 'pista-pot', 512, 512, (g, w, h) => {
    g.fillStyle = '#b8823e';
    g.fillRect(0, 0, w, h);
    g.lineWidth = w * 0.14;
    g.strokeStyle = '#1d1d1f';
    g.beginPath();
    // −135° … +135° measured from +Y (the terminals are at −Y).
    g.arc(w / 2, h / 2, w * 0.33, Math.PI / 2 + Math.PI / 4, Math.PI / 2 - Math.PI / 4 + 2 * Math.PI);
    g.stroke();
    g.fillStyle = '#c9cdd1';
    for (const a of [Math.PI / 2 + Math.PI / 4, Math.PI / 2 - Math.PI / 4]) g.fillRect(w / 2 + Math.cos(a) * w * 0.33 - w * 0.06, h / 2 + Math.sin(a) * h * 0.33 - w * 0.06, w * 0.12, w * 0.12);
  });
}

export function potenciometro(ctx: Ctx, p: Parametros): { g: Group; datos: Partial<DatosModelo> } {
  const pos = Math.max(0, Math.min(1, Number(p.posicion ?? 0.5)));
  const valor = leerValor(p.valor as string | number, 10000);
  const ley = String(p.ley ?? 'B');
  const R = 8;
  const hCuerpo = 6.5;
  const z0 = 0.6;
  const g = new Group();
  const ang = (-135 + 270 * pos) * (Math.PI / 180);

  // Phenolic wafer with the carbon track (bottom of the body).
  const tex = texturaPista(ctx);
  const oblea = malla(cilindro(ctx, R - 0.3, 1.2, 48), material(ctx, { color: '#a87436', rugosidad: 0.7, corte: '#8d5f2a' }));
  const pista = malla(ctx.rec.geometria('disco-pista', () => {
    const c = new CylinderGeometry(R - 0.5, R - 0.5, 0.02, ctx.seg(48));
    c.rotateX(Math.PI / 2);
    return c;
  }), materialTextura(ctx, tex, { rugosidad: 0.6 }));
  pista.position.z = 1.21;
  g.add(
    colocar(
      parte('pista', {
        etiqueta: { texto: `Pista de carbón en herradura (${textoValor(valor, 'Ω')}, ley ${ley})`, ref: 'sec-2.11', punto: [0, R * 0.42, 1.25] },
        interior: true,
      }, oblea, pista),
      0,
      0,
      z0,
    ),
  );

  // Wiper: a spring blade on the rotor, at the shaft angle.
  const cursor = new Group();
  const brazo = malla(caja(ctx, 1.4, R * 0.62, 0.25, 0.05), material(ctx, ACABADOS.laton));
  brazo.position.set(0, R * 0.31 - 0.1, 0);
  const contacto = malla(caja(ctx, 1.1, 0.9, 0.5, 0.1), material(ctx, ACABADOS.plata));
  contacto.position.set(0, R * 0.62 * 0.5 + 0.9, -0.2);
  const rotor = malla(cilindro(ctx, 3.2, 1.0, 32), material(ctx, ACABADOS.plasticoNegro));
  rotor.position.z = -0.5;
  cursor.add(brazo, contacto, rotor);
  cursor.rotation.z = -ang;
  g.add(
    colocar(
      parte('cursor', {
        etiqueta: { texto: 'Cursor: escobilla que recorre la pista (patilla central)', ref: 'sec-2.11', punto: [Math.sin(-ang) * -R * 0.45, Math.cos(ang) * R * 0.45, 0.3] },
        interior: true,
        explosion: [0, 0, 5],
      }, cursor),
      0,
      0,
      z0 + 2.0,
    ),
  );

  // Steel housing (cover) and the threaded bushing with the shaft.
  const perfilTapa: [number, number][] = [
    [R - 0.25, 0],
    [R, 0.3],
    [R, hCuerpo - 2.4],
    [R - 0.4, hCuerpo - 2],
    [0.01, hCuerpo - 2],
  ];
  const tapa = malla(torno(ctx, perfilTapa, 56, 'pot-tapa'), material(ctx, { ...ACABADOS.acero, corte: '#6f7479' }));
  tapa.position.z = 2.2;
  const casquillo = malla(cilindro(ctx, 3.5, 7, 32), material(ctx, { ...ACABADOS.laton, color: '#c6b27a', rugosidad: 0.45 }));
  casquillo.position.z = hCuerpo;
  g.add(
    colocar(
      parte('carcasa', {
        etiqueta: { texto: 'Carcasa metálica', punto: [R * 0.7, -R * 0.7, hCuerpo] },
        explosion: [0, 0, 12],
      }, tapa, casquillo),
      0,
      0,
      z0,
    ),
  );

  // Shaft (6 mm, knurled look) with a flat, turned with the wiper.
  const eje = new Group();
  const varilla = malla(cilindro(ctx, 3, 15, 28), material(ctx, ACABADOS.aluminioCepillado));
  const marca = malla(caja(ctx, 0.6, 2.6, 0.2, 0), material(ctx, { color: '#2a2a2a', rugosidad: 0.5 }));
  marca.position.set(0, 1.2, 15.01);
  eje.add(varilla, marca);
  eje.rotation.z = -ang;
  g.add(
    colocar(
      parte('eje', {
        etiqueta: { texto: `Eje de 6 mm (giro al ${Math.round(pos * 100)} %)`, ref: 'sec-2.11', punto: [0, 0, 15] },
        explosion: [0, 0, 22],
      }, eje),
      0,
      0,
      z0 + hCuerpo,
    ),
  );

  // Three lugs bent down into the board (pitch 5 mm) and two mounting tabs.
  const zFin = finPatilla(ctx, 5);
  const matT = material(ctx, ACABADOS.estano);
  const lugs = new Group();
  for (const i of [-1, 0, 1]) {
    const pts: [number, number, number][] = [
      [i * 5, -R + 0.5, z0 + 1.2],
      [i * 5, -R - 1.6, z0 + 1.2],
      [i * 5, -R - 1.6, zFin],
    ];
    lugs.add(malla(hilo(ctx, pts, 0.45, { cuadrado: true, curva: 0.6, clave: `pot-lug:${i}:${zFin}` }), matT));
  }
  g.add(parte('terminales', { etiqueta: { texto: 'Terminales: extremos de la pista y cursor (centro)', ref: 'sec-2.11', punto: [5, -R - 1.6, z0] } }, lugs));

  return {
    g,
    datos: {
      huella: {
        pads: [-1, 0, 1].map((i, k) => ({ n: String(k + 1), x: i * 5, y: -R - 1.6, forma: k === 0 ? 'rect' : 'circulo', w: 1.8, h: 1.8, taladro: 1.1 })),
        ancho: 2 * R,
        fondo: 2 * R + 2,
        alto: z0 + hCuerpo + 15,
        origenKicad: [-5, -R - 1.6],
      },
      marcado: rkm(valor),
      cortes: [{ nombre: 'Vertical', normal: [0, 1, 0], min: -R, max: R, inicial: -1 }],
      explosionable: true,
    },
  };
}

// ------------------------------------------------------------------ trimmer (3362P)

export function trimmer(ctx: Ctx, p: Parametros): { g: Group; datos: Partial<DatosModelo> } {
  const pos = Math.max(0, Math.min(1, Number(p.posicion ?? 0.5)));
  const valor = leerValor(p.valor as string | number, 10000);
  const A = 6.6;
  const B = 7.0;
  const H = 4.8;
  const z0 = 0.5;
  const ang = (-130 + 260 * pos) * (Math.PI / 180);
  const g = new Group();

  const cuerpo = malla(caja(ctx, A, B, H - 1.0, 0.25), material(ctx, { color: '#2f5fa8', rugosidad: 0.5, corte: '#264d88' }));
  const txt = rotulo(ctx, [codigoSmd(valor, 'tres')], 3.0, 1.0, { color: '#f2f2f2' });
  txt.position.set(0, -B / 2 - 0.002, -0.6);
  txt.rotation.x = Math.PI / 2;
  g.add(colocar(parte('cuerpo', { etiqueta: { texto: `Cuerpo con el valor «${codigoSmd(valor, 'tres')}» = ${textoValor(valor, 'Ω')}`, ref: 'sec-2.5', punto: [A / 2, -B / 2, 0] }, explosion: [0, 0, 0] }, cuerpo, txt), 0, 0, z0 + (H - 1) / 2));

  // Cermet track ring under the rotor.
  const pista = malla(ctx.rec.geometria('trim-pista', () => torno(ctx, [[1.6, 0], [2.6, 0], [2.6, 0.15], [1.6, 0.15]], 40, 'trim-pista')), material(ctx, { color: '#3a2a22', rugosidad: 0.6 }));
  g.add(colocar(parte('pista', { etiqueta: { texto: 'Pista de cermet', ref: 'sec-2.11', punto: [2.1, 0, 0.15] }, interior: true, explosion: [0, 0, 2.5] }, pista), 0, 0, z0 + H - 1.0 - 0.6));

  const rotor = new Group();
  const disco = malla(cilindro(ctx, 2.9, 1.2, 36), material(ctx, { color: '#efe6cf', rugosidad: 0.45 }));
  const ranura = malla(caja(ctx, 4.2, 0.55, 0.6, 0.05), material(ctx, { color: '#5a5040', rugosidad: 0.7 }));
  ranura.position.z = 1.0;
  const flecha = malla(caja(ctx, 0.5, 1.0, 0.62, 0.05), material(ctx, { color: '#5a5040', rugosidad: 0.7 }));
  flecha.position.set(0, 1.6, 1.0);
  rotor.add(disco, ranura, flecha);
  rotor.rotation.z = -ang;
  g.add(colocar(parte('rotor', { etiqueta: { texto: 'Rotor con ranura para el destornillador', ref: 'sec-2.11', punto: [0, 0, 1.3] }, explosion: [0, 0, 5] }, rotor), 0, 0, z0 + H - 1.0 - 0.1));

  const zFin = finPatilla(ctx, 4);
  const pats = new Group();
  for (const i of [-1, 0, 1]) pats.add(colocar(malla(caja(ctx, 0.5, 0.5, z0 + 1 - zFin, 0.05), material(ctx, ACABADOS.estano)), i * 2.54, 0, (z0 + 1 + zFin) / 2));
  g.add(parte('patillas', {}, pats));

  return {
    g,
    datos: {
      huella: {
        pads: [-1, 0, 1].map((i, k) => ({ n: String(k + 1), x: i * 2.54, y: 0, forma: k === 0 ? 'rect' : 'circulo', w: 1.5, h: 1.5, taladro: 0.9 })),
        ancho: A,
        fondo: B,
        alto: z0 + H,
        origenKicad: [-2.54, 0],
      },
      marcado: codigoSmd(valor, 'tres'),
      cortes: [{ nombre: 'Vertical', normal: [0, 1, 0], min: -B / 2, max: B / 2, inicial: -0.5 }],
      explosionable: true,
    },
  };
}
