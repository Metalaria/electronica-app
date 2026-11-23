// 1.3 (averias13) «Busque la avería» on a console's board, in Node (no browser): the reading of the hidden fault on the
// board's nets (lib/averias-placa/modelo.ts) with the lesson's own model and faults (public/libro/lecciones11/…json),
// the board's nets of each definition (definiciones.ts) checked against the board's data, the diagnosis, the cited
// sources, and the pads placed on the photo by the affine fit of the console's `posiciones`.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c <config> tests/averias13-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ajusteAfin,
  ajusteProyectivo,
  aplicarProyectivo,
  aplicarAfin,
  citasDe,
  describirPad,
  diagnosticar,
  evaluarModelo,
  lectura,
  padsDe,
  redDePad,
  type LeccionJson,
  type PlacaMinima,
  type Resultado,
} from '../src/lib/averias-placa/modelo.ts';
import { AVERIAS_PLACA, averiaPorId, averiasDe } from '../src/lib/averias-placa/definiciones.ts';

const publico = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const json = <T>(r: string): T => JSON.parse(fs.readFileSync(path.join(publico, r), 'utf8')) as T;

const valor = (r: Resultado) => (r.tipo === 'valor' ? r.valor : r.tipo);

test('cada definición: su lección tiene la tarjeta de avería con números, y sus redes y pads están en la placa', () => {
  expect(AVERIAS_PLACA.length).toBeGreaterThan(0);
  for (const def of AVERIAS_PLACA) {
    const l = json<LeccionJson>(`libro/lecciones11/${def.leccion.parte}/${def.leccion.seccion}.json`);
    const t = l.tarjetas.find((x) => x.id === def.leccion.tarjeta)!;
    expect(t, def.id).toBeTruthy();
    expect(t.actividad?.tipo).toBe('averia');
    // every measurement of the definition is one of the lesson's, every suspect of the lesson has parts on the board
    for (const id of Object.keys(def.sondas)) expect(t.actividad!.sondas.map((s) => s.id), `${def.id}: ${id}`).toContain(id);
    for (const s of t.actividad!.sospechosos) expect(def.piezas[s.id], `${def.id}: ${s.id}`).toBeTruthy();
    const placa = json<PlacaMinima>(`consolas/placas/${def.placa}.json`);
    const redes = new Set(placa.redes.map((r) => r.n));
    const refs = new Set(placa.huellas.map((h) => h.r));
    for (const s of Object.values(def.sondas)) for (const r of s.redes) expect(redes.has(r), `${def.id}: red ${r}`).toBe(true);
    for (const r of Object.keys(def.tensiones ?? {})) expect(redes.has(r), `${def.id}: red ${r}`).toBe(true);
    for (const r of [...Object.values(def.piezas).flat(), ...def.encuadre]) expect(refs.has(r), `${def.id}: pieza ${r}`).toBe(true);
    const pads = padsDe(placa);
    for (const p of def.puntos) expect(redDePad(pads, p.pad), `${def.id}: pad ${p.pad}`).not.toBeNull();
    // every fault of the card changes something a measurement on the board sees
    for (const f of t.actividad!.fallos) {
      const v = evaluarModelo(l.modelo, f.con);
      const sano = evaluarModelo(l.modelo, t.actividad!.sano ?? {});
      const distinta = t.actividad!.sondas.some((s) => def.sondas[s.id] && v[s.valor] !== sano[s.valor]);
      expect(distinta, `${def.id}: ${f.id}`).toBe(true);
    }
  }
  expect(averiasDe('snes').map((d) => d.id)).toEqual(['snes-no-enciende']);
  expect(averiasDe('xbox')).toEqual([]);
});

test('Super Nintendo: lo que marca el polímetro en la placa sana y con cada avería de la lección', () => {
  const def = averiaPorId('snes-no-enciende')!;
  const l = json<LeccionJson>('libro/lecciones11/consola-snes/snes-averias.json');
  const t = l.tarjetas.find((x) => x.id === 'averia-no-enciende')!;
  const placa = json<PlacaMinima>('consolas/placas/snes.json');
  const pads = padsDe(placa);
  const red = (id: string) => redDePad(pads, id)!;
  const fallo = (id: string) => t.actividad!.fallos.find((f) => f.id === id)!;
  const leer = (con: Record<string, number>, roja: string, negra: string, modo: 'V' | 'Ω', encendida = modo === 'V') =>
    lectura(def, l, evaluarModelo(l.modelo, con), red(roja), red(negra), modo, encendida);

  // healthy: 10 V at the jack (SNS-002), 0 Ω across the fuse, 5 V out of the 7805 and at the CPU
  const sano = t.actividad!.sano!;
  expect(valor(leer(sano, 'J1.1', 'J1.2', 'V'))).toBe(10);
  expect(valor(leer(sano, 'J1.2', 'J1.1', 'V'))).toBe(10); // (no polarity in the sources: no sign)
  expect(valor(leer(sano, 'F1.1', 'F1.2', 'Ω'))).toBe(0);
  expect(valor(leer(sano, 'U12.3', 'U12.2', 'V'))).toBe(5);
  expect(valor(leer(sano, 'U1.1', 'U1.18', 'V'))).toBe(5);
  expect(valor(leer(sano, 'U12.2', 'U12.3', 'V'))).toBe(-5);
  expect(valor(leer(sano, 'U12.1', 'U12.2', 'V'))).toBe(10);
  // the measurement it is
  const r = leer(sano, 'U12.3', 'C67.2', 'V');
  expect(r.tipo === 'valor' && r.sonda).toBe('salida');

  // the fuse open: no continuity, nothing after it
  const f = fallo('fusible-abierto').con;
  expect(valor(leer(f, 'F1.1', 'F1.2', 'Ω'))).toBe(Infinity);
  expect(valor(leer(f, 'F1.1', 'U12.2', 'V'))).toBe(10);
  expect(valor(leer(f, 'F1.2', 'U12.2', 'V'))).toBe(0);
  expect(valor(leer(f, 'U12.3', 'U12.2', 'V'))).toBe(0);
  expect(valor(leer(f, 'J1.1', 'J1.2', 'V'))).toBe(10);
  // the 7805 dead: its input there, its output not
  const re = fallo('regulador-muerto').con;
  expect(valor(leer(re, 'U12.1', 'U12.2', 'V'))).toBe(10);
  expect(valor(leer(re, 'U12.3', 'U12.2', 'V'))).toBe(0);
  expect(valor(leer(re, 'F1.1', 'F1.2', 'Ω'))).toBe(0);
  // the adapter dead: nothing at the jack
  const ad = fallo('adaptador-muerto').con;
  expect(valor(leer(ad, 'J1.1', 'J1.2', 'V'))).toBe(0);
  expect(valor(leer(ad, 'U12.3', 'U12.2', 'V'))).toBe(0);

  // the rules: Ω with the console on is refused; unplugged, 0 V everywhere; the same net 0; a net the lesson does
  // not cover has no reading (never a made-up number)
  expect(leer(sano, 'F1.1', 'F1.2', 'Ω', true).tipo).toBe('aviso');
  expect(valor(leer(sano, 'U12.3', 'U12.2', 'V', false))).toBe(0);
  expect(valor(leer(sano, 'U12.2', 'C67.2', 'V'))).toBe(0);
  expect(valor(leer(sano, 'U12.2', 'U12.3', 'Ω', false))).toBe('sin-dato');
  const otro = pads.find((p) => p.red === '/VAA5')!;
  const sinDato = lectura(def, l, evaluarModelo(l.modelo, sano), otro.red, 'GND', 'V', true);
  expect(sinDato.tipo).toBe('sin-dato');
  // a lead not placed: 0 V, or OL on Ω
  expect(valor(lectura(def, l, evaluarModelo(l.modelo, sano), red('U12.3'), null, 'V', true))).toBe(0);
  expect(valor(lectura(def, l, evaluarModelo(l.modelo, sano), null, null, 'Ω', false))).toBe(Infinity);

  // one test point per pin (a repeated pad number is not two points)
  expect(new Set(pads.map((p) => p.id)).size).toBe(pads.length);
  expect(describirPad(def, pads.find((p) => p.id === 'F1.2')!)).toBe('F1, pata 2 (entre el fusible F1 y el interruptor)');
});

test('Master System II y NES: las averías de sus lecciones sobre sus placas', () => {
  for (const [id, leccion, tarjeta, placa, casos] of [
    [
      'sms-no-enciende',
      'consola-sms/sms-averias',
      'averia-no-enciende',
      'sms',
      [
        // [fault, red, black, function, reading]
        ['interruptor-abierto', 'SW1.1', 'SW1.2', 'Ω', Infinity],
        ['interruptor-abierto', 'CN4.1', 'CN4.2', 'V', 9],
        ['interruptor-abierto', 'IC8.1', 'IC8.2', 'V', 0],
        ['regulador-muerto', 'IC8.1', 'IC8.2', 'V', 9],
        ['regulador-muerto', 'IC8.3', 'IC8.2', 'V', 0],
        ['regulador-muerto', 'SW1.1', 'SW1.2', 'Ω', 0],
        ['adaptador-muerto', 'CN4.1', 'CN4.2', 'V', 0],
      ],
    ],
    [
      'nes-condensador-corto',
      'consola-nes/nes-alimentacion',
      'averia-vias',
      'nes',
      [
        ['c15-corto', 'P3.4', 'P3.6', 'V', 0],
        ['c15-corto', 'U6.40', 'U6.20', 'V', 5],
        ['c16-corto', 'P3.4', 'P3.6', 'V', 9],
        ['c16-corto', 'U6.40', 'U6.20', 'V', 0],
        ['c16-corto', 'C16.2', 'C16.1', 'Ω', 'sin-dato'],
      ],
    ],
  ] as const) {
    const def = averiaPorId(id)!;
    const l = json<LeccionJson>(`libro/lecciones11/${leccion}.json`);
    const t = l.tarjetas.find((x) => x.id === tarjeta)!;
    const pads = padsDe(json<PlacaMinima>(`consolas/placas/${placa}.json`));
    for (const [f, roja, negra, modo, esperado] of casos) {
      const v = evaluarModelo(l.modelo, t.actividad!.fallos.find((x) => x.id === f)!.con);
      const r = lectura(def, l, v, redDePad(pads, roja), redDePad(pads, negra), modo, modo === 'V');
      expect(valor(r), `${id} ${f} ${roja}/${negra} ${modo}`).toBe(esperado);
    }
  }
});

test('el diagnóstico: el acierto con el texto de la avería, el error con la medida que lo distingue, y las fuentes', () => {
  const def = averiaPorId('snes-no-enciende')!;
  const l = json<LeccionJson>('libro/lecciones11/consola-snes/snes-averias.json');
  const t = l.tarjetas.find((x) => x.id === 'averia-no-enciende')!;
  const fallo = t.actividad!.fallos.find((f) => f.id === 'fusible-abierto')!;
  const fmt = (x: number, u: string) => (x >= 1e8 ? 'OL' : `${String(x).replace('.', ',')} ${u}`);
  const bien = diagnosticar(def, l, t, fallo, 'fusible', new Set(), fmt);
  expect(bien.bien).toBe(true);
  expect(bien.texto).toContain('F1 abierto');
  const sinMedir = diagnosticar(def, l, t, fallo, 'regulador', new Set(), fmt);
  expect(sinMedir.bien).toBe(false);
  expect(sinMedir.texto).toMatch(/^Todavía no lo sabe: mida «/);
  const medido = diagnosticar(def, l, t, fallo, 'adaptador', new Set(['clavija']), fmt);
  expect(medido.texto).toBe('No es «Adaptador SNS-002»: «Clavija del adaptador» marcaría 0 V si lo fuera, y marca 10 V.');
  const citas = citasDe(l, t);
  expect(citas.map((c) => c.titulo)).toContain('ConsoleMods, «SNES:Power Supply Fuse»');
  expect(citas.find((c) => c.titulo.startsWith('Chromagi'))?.url).toBe('https://chromagi.com/nintendo/sfc-snes/sns-002/');
  expect(citas.some((c) => c.titulo.startsWith('Del libro: sección'))).toBe(true);
});

test('el ajuste proyectivo devuelve una homografía conocida y no sale de pocos puntos', () => {
  const h = [0.09, 0.004, 15, -0.003, 0.088, 40, 2e-6, -1.5e-6, 1] as const;
  const ap = (x: number, y: number): [number, number] => {
    const w = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
  };
  const pares = [[100, 200], [15000, 300], [7000, 12000], [14000, 15000], [700, 14000], [9000, 4000]].map(([x, y]) => [[x, y], ap(x!, y!)] as [[number, number], [number, number]]);
  const pr = ajusteProyectivo(pares)!;
  for (const [x, y] of [[5000, 5000], [12000, 1000], [300, 15500]] as const) {
    const [u, v] = aplicarProyectivo(pr, x, y);
    const [u0, v0] = ap(x, y);
    expect(Math.hypot(u - u0, v - v0)).toBeLessThan(1e-6);
  }
  expect(ajusteProyectivo(pares.slice(0, 3))).toBeNull();
});

test('los pads sobre la foto: el ajuste afín de las posiciones de las huellas', () => {
  // a known map comes back from five points
  const m = [0.085, 0.001, 12, -0.002, 0.084, 30] as const;
  const pares = [
    [100, 200],
    [5000, 300],
    [2500, 9000],
    [12000, 15000],
    [700, 14000],
  ].map(([x, y]) => [[x, y], [m[0] * x! + m[1] * y! + m[2], m[3] * x! + m[4] * y! + m[5]]] as [[number, number], [number, number]]);
  const a = ajusteAfin(pares)!;
  for (let i = 0; i < 6; i++) expect(a[i]).toBeCloseTo(m[i]!, 6);
  expect(ajusteAfin(pares.slice(0, 2))).toBeNull();
  // 1.4: the SNES's PAL component face is iFixit's photo (a populated board, taken at a slight angle): an affine map
  // leaves footprints several pixels off, the projective map fits the 43 within a pixel and a half; F1's pads beside
  // its place on the photo (the power corner, bottom left of the component side)
  const datos = json<{ fotos: { id: string; posiciones?: Record<string, [number, number]> }[] }>('consolas/snes.json');
  const placa = json<PlacaMinima>('consolas/placas/snes.json');
  const foto = datos.fotos.find((f) => f.id === 'cara-a')!;
  const ps = Object.entries(foto.posiciones!).map(([r, q]) => {
    const h = placa.huellas.find((x) => x.r === r)!;
    return [[h.x, h.y], q] as [[number, number], [number, number]];
  });
  expect(ps.length).toBe(43);
  const pr = ajusteProyectivo(ps)!;
  for (const [b, q] of ps) {
    const p = aplicarProyectivo(pr, b[0], b[1]);
    expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThan(1.5);
  }
  const f1 = padsDe(placa).filter((p) => p.ref === 'F1').map((p) => aplicarProyectivo(pr, p.x, p.y));
  expect(f1.length).toBeGreaterThan(0);
  for (const [x, y] of f1) {
    expect(x).toBeGreaterThan(470);
    expect(x).toBeLessThan(610);
    expect(y).toBeGreaterThan(1000);
    expect(y).toBeLessThan(1060);
  }
});
