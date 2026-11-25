// The real FNIRSI: what the application adds without touching the instrument, second batch. The average of several
// acquisitions (lib/fnirsi-real/promedio.ts), the cursors on the trace (cursores.ts) and the multimeter's relative
// reading and limits (relativo.ts). No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-tanda2-unidad.spec.ts
import { test, expect } from '@playwright/test';
import type { PantallaReal } from '../src/lib/brymen-real/protocolo.ts';
import { espectro, medirAmpliado } from '../src/lib/fnirsi-real/analisis.ts';
import { leerCursores } from '../src/lib/fnirsi-real/cursores.ts';
import { leerAjustes, type Traza } from '../src/lib/fnirsi-real/osciloscopio.ts';
import { ANCHO_PROMEDIO, Promediador, alinear } from '../src/lib/fnirsi-real/promedio.ts';
import { alarma, leerLimite, relativo, tomarReferencia } from '../src/lib/fnirsi-real/relativo.ts';
import { MEMORIA } from './fnirsi-real-datos.ts';

const deHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

/**
 * A trace at 200 µs per division, zero volts and the trigger level on sample value 128; CH1 at 50 mV per division
 * unless told, CH2 at 500 mV.
 */
function traza(valor: (k: number) => number, canal: 0 | 1 = 0, escala = 2): Traza {
  const b = deHex(MEMORIA.osciloscopioEnMarcha);
  b[2] = escala;
  b[3] = 5;
  b[4] = 0;
  b[5] = 0;
  b[20] = 3;
  b[28] = 0;
  b[29] = 0;
  b[45] = 13;
  const muestras = new Uint8Array(1023);
  for (let k = 0; k < muestras.length; k++) muestras[k] = Math.max(0, Math.min(255, Math.round(valor(k))));
  return { canal, secuencia: 1, tick: 0, ajustes: leerAjustes(b)!, muestras, saturada: false };
}
/** Noise that is the same on every run: uniform in ±`a`. */
function ruido(semilla: number, a: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xffffffff - 0.5) * 2 * a;
  };
}
const eficaz = (v: ArrayLike<number>, ideal: (k: number) => number) => {
  let s = 0;
  for (let k = 0; k < v.length; k++) s += (v[k]! - ideal(k)) ** 2;
  return Math.sqrt(s / v.length);
};
/** The 1 kHz sine an average should come out as: its rising crossing of 128 in the middle of the samples. */
const senoAlineado = (k: number) => 128 + 50 * Math.sin((2 * Math.PI * (k - ANCHO_PROMEDIO / 2)) / 125);

test('alinear: el cruce de subida queda en el centro, a una fracción de muestra', () => {
  for (const fase of [0, 17.3, 61.8, 110.2]) {
    const v = alinear(traza((k) => 128 + 50 * Math.sin((2 * Math.PI * (k + fase)) / 125)))!;
    expect(v.length).toBe(ANCHO_PROMEDIO);
    // the steps of the converter (one count) are all that separates it from the ideal
    expect(eficaz(v, senoAlineado)).toBeLessThan(0.6);
    expect(v[ANCHO_PROMEDIO / 2 - 3]!).toBeLessThan(128);
    expect(v[ANCHO_PROMEDIO / 2 + 3]!).toBeGreaterThan(128);
  }
});

test('promediar 16 adquisiciones con ruido deja el ruido en torno a la cuarta parte', () => {
  const r = ruido(7, 6);
  const con = (fase: number) => traza((k) => 128 + 50 * Math.sin((2 * Math.PI * (k + fase)) / 125) + r());
  const una = alinear(con(11))!;
  const p = new Promediador(16);
  for (let i = 0; i < 16; i++) expect(p.anadir(con(i * 7.7))).toBe(true);
  const medio = p.resultado()!;
  expect(medio.adquisiciones).toBe(16);
  expect(medio.muestras.length).toBe(ANCHO_PROMEDIO);
  const antes = eficaz(una, senoAlineado);
  const despues = eficaz(medio.muestras, senoAlineado);
  // ±6 counts of uniform noise: 3,5 counts RMS in one record
  expect(antes).toBeGreaterThan(2.5);
  expect(despues).toBeLessThan(antes / 2.5);
  // and the measurements are those of the wave: 70,7 mV RMS, 1 kHz, a distortion the noise no longer hides
  const m = medirAmpliado(medio);
  expect(m.frecuencia! / 1000).toBeCloseTo(1, 2);
  expect(m.eficazAlterna / 0.0707).toBeGreaterThan(0.97);
  expect(m.eficazAlterna / 0.0707).toBeLessThan(1.03);
  const e = espectro(medio);
  expect(e.tonos[0]!.eficaz / 0.0707).toBeGreaterThan(0.97);
  expect(e.tonos[0]!.eficaz / 0.0707).toBeLessThan(1.03);
  expect(e.distorsion!).toBeLessThan(espectro(con(3)).distorsion!);
});

test('el promedio guarda las últimas N, se acorta al pedir menos y empieza de nuevo si cambia un ajuste', () => {
  const seno = (k: number) => 128 + 50 * Math.sin((2 * Math.PI * k) / 125);
  const p = new Promediador(4);
  expect(p.resultado()).toBeNull();
  for (let i = 0; i < 6; i++) p.anadir(traza(seno));
  expect(p.resultado()!.adquisiciones).toBe(4);
  p.fijar(2);
  expect(p.resultado()!.adquisiciones).toBe(2);
  // another scale: what was averaged is no longer the same wave on the screen
  p.anadir(traza(seno, 0, 3));
  expect(p.resultado()!.adquisiciones).toBe(1);
  expect(p.resultado()!.ajustes.canales[0].voltiosDiv).toBeCloseTo(0.1, 12);
  p.vaciar();
  expect(p.resultado()).toBeNull();
});

test('una onda sin un cruce con sitio a los dos lados no se puede alinear y no entra; una línea plana sí', () => {
  // 900 samples to a period, its rising crossings at samples 100 and 1000: none with 300 samples on each side
  const lenta = traza((k) => 128 + 50 * Math.sin((2 * Math.PI * (k - 100)) / 900));
  expect(alinear(lenta)).toBeNull();
  const p = new Promediador(8);
  expect(p.anadir(lenta)).toBe(false);
  expect(p.resultado()).toBeNull();
  // no wave at all: nothing to align, and its noise averages out
  const r = ruido(3, 2);
  for (let i = 0; i < 8; i++) expect(p.anadir(traza(() => 140 + r()))).toBe(true);
  const plano = p.resultado()!;
  expect(plano.adquisiciones).toBe(8);
  expect(eficaz(plano.muestras, () => 140)).toBeLessThan(0.6);
});

test('cursores: tiempo entre los dos, su inverso, tensión entre los dos en la escala de cada canal y la traza bajo cada uno', () => {
  // a 1 kHz square between 78 and 178, as the panel draws it: 300 samples at 8 µs
  const cuadrada = (k: number) => (k % 125 < 62 ? 178 : 78);
  const ch1 = traza(cuadrada, 0);
  const ch2 = traza(() => 128, 1);
  const ventanas = [ch1, ch2].map((t) => ({ canal: t.canal, ajustes: t.ajustes, muestras: t.muestras.subarray(0, 300) }));
  const l = leerCursores({ activo: true, t1: 10, t2: 135, v1: 78, v2: 178 }, ventanas);
  expect(l.dt * 1000).toBeCloseTo(1, 9);
  expect(l.frecuencia!).toBeCloseTo(1000, 6);
  // 100 counts: four divisions, 200 mV at 50 mV per division and 2 V at 500 mV per division
  expect(l.canales.map((c) => c.canal)).toEqual([0, 1]);
  expect(l.canales[0]!.dv).toBeCloseTo(0.2, 9);
  expect(l.canales[1]!.dv).toBeCloseTo(2, 9);
  expect(l.canales[0]!.enT1).toBeCloseTo(0.1, 9);
  expect(l.canales[0]!.enT2).toBeCloseTo(0.1, 9);
  expect(l.canales[1]!.enT1).toBeCloseTo(0, 9);
  // cursor 2 to the left of 1: a negative time, the same frequency; one on a low part of the wave
  const al = leerCursores({ activo: true, t1: 135, t2: 70, v1: 178, v2: 78 }, ventanas);
  expect(al.dt * 1e6).toBeCloseTo(-520, 6);
  expect(al.frecuencia!).toBeCloseTo(1 / 520e-6, 3);
  expect(al.canales[0]!.dv).toBeCloseTo(-0.2, 9);
  expect(al.canales[0]!.enT2).toBeCloseTo(-0.1, 9);
  // the two on the same sample: no frequency; a cursor off the window reads its edge
  const junto = leerCursores({ activo: true, t1: 400, t2: 400, v1: 128, v2: 128 }, ventanas);
  expect([junto.dt, junto.frecuencia]).toEqual([0, null]);
  expect(junto.canales[0]!.enT1).toBeCloseTo(al.canales[0]!.enT1 === 0.1 ? 0.1 : 0.1 * (cuadrada(299) === 178 ? 1 : -1), 9);
});

const pantalla = (valor: number | null, unidad: string, extra: Partial<PantallaReal> = {}): PantallaReal =>
  ({ texto: valor === null ? '0L' : String(valor), valor, unidad, prefijo: '', ac: false, dc: true, ol: false, decimales: 3, ...extra }) as PantallaReal;

test('relativo: la diferencia con la lectura tomada como cero, y cuándo no hay nada que restar', () => {
  const ref = tomarReferencia(pantalla(9.201, 'V'))!;
  expect(ref).toEqual({ valor: 9.201, unidad: 'V' });
  const r = relativo(pantalla(9.213, 'V'), ref);
  expect(r.estado).toBe('ok');
  if (r.estado === 'ok') {
    expect(r.diferencia).toBeCloseTo(0.012, 9);
    expect(r.porcentaje!).toBeCloseTo(0.1304, 3);
  }
  // the instrument changes range (the same volts, shown in mV): it is still the same unit
  expect(relativo(pantalla(0.25, 'V', { prefijo: 'm' }), ref).estado).toBe('ok');
  expect(relativo(pantalla(4700, 'Ω'), ref)).toEqual({ estado: 'otra-unidad' });
  expect(relativo(pantalla(null, 'V', { ol: true }), ref)).toEqual({ estado: 'sin-numero' });
  // nothing to take as zero in an overload; and against a zero there is no per cent
  expect(tomarReferencia(pantalla(null, 'V', { ol: true }))).toBeNull();
  const cero = relativo(pantalla(0.004, 'V'), tomarReferencia(pantalla(0, 'V'))!);
  expect(cero).toEqual({ estado: 'ok', diferencia: 0.004, porcentaje: null });
});

test('los límites se escriben con coma o punto y, si se quiere, con prefijo y unidad', () => {
  expect(leerLimite('4,5')).toBeCloseTo(4.5, 12);
  expect(leerLimite(' 1.5 V ')).toBeCloseTo(1.5, 12);
  expect(leerLimite('450 mV')).toBeCloseTo(0.45, 12);
  expect(leerLimite('450m')).toBeCloseTo(0.45, 12);
  expect(leerLimite('2,2 kΩ')).toBeCloseTo(2200, 9);
  expect(leerLimite('10 µA')).toBeCloseTo(1e-5, 15);
  expect(leerLimite('−3')).toBe(-3);
  expect(leerLimite('')).toBeUndefined();
  expect(leerLimite('   ')).toBeUndefined();
  expect(leerLimite('abc')).toBeNull();
  expect(leerLimite('4,5,6')).toBeNull();
});

test('alarma: por debajo, por encima, dentro; una sobrecarga cuenta como por encima si hay máximo', () => {
  const l = { minimo: 4.5, maximo: 5.5, unidad: 'V' };
  expect(alarma(pantalla(5, 'V'), l)).toBe('dentro');
  expect(alarma(pantalla(4.5, 'V'), l)).toBe('dentro');
  expect(alarma(pantalla(4.499, 'V'), l)).toBe('bajo');
  expect(alarma(pantalla(5.501, 'V'), l)).toBe('alto');
  expect(alarma(pantalla(null, 'V', { ol: true }), l)).toBe('alto');
  expect(alarma(pantalla(null, 'V', { ol: true }), { ...l, maximo: null })).toBe('sin-numero');
  expect(alarma(pantalla(null, 'V'), l)).toBe('sin-numero');
  expect(alarma(pantalla(5, 'Ω'), l)).toBe('otra-unidad');
  // one side only
  expect(alarma(pantalla(99, 'V'), { ...l, maximo: null })).toBe('dentro');
  expect(alarma(pantalla(-99, 'V'), { ...l, minimo: null })).toBe('dentro');
});
