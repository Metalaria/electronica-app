// The real FNIRSI's oscilloscope: what the application computes from a record beyond what the instrument's screen
// shows (lib/fnirsi-real/analisis.ts). No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-analisis-unidad.spec.ts
// Waves of known shape, built here sample by sample, and one record of the real unit.
import { test, expect } from '@playwright/test';
import { ARMONICOS, PUNTOS_ESPECTRO, csvTraza, espectro, medirAmpliado } from '../src/lib/fnirsi-real/analisis.ts';
import { leerAjustes, medirTraza, type Traza } from '../src/lib/fnirsi-real/osciloscopio.ts';
import { MEMORIA, REGISTRO_CH1 } from './fnirsi-real-datos.ts';

const deHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

/** A trace at 200 µs and 50 mV per division, zero volts on sample value 128: 8 µs and 2 mV per step. */
function traza(valor: (k: number) => number): Traza {
  const b = deHex(MEMORIA.osciloscopioEnMarcha);
  b[2] = 2;
  b[4] = 0;
  b[45] = 13;
  const muestras = new Uint8Array(1023);
  for (let k = 0; k < muestras.length; k++) muestras[k] = Math.max(0, Math.min(255, Math.round(valor(k))));
  return { canal: 0, secuencia: 1, tick: 0, ajustes: leerAjustes(b)!, muestras, saturada: false };
}
const PASO = 8e-6;
/** 1 kHz at 8 µs per sample: 125 samples to a period. */
const seno = (k: number) => 128 + 50 * Math.sin((2 * Math.PI * (k + 3)) / 125);
const cuadrada = (ciclo: number) => (k: number) => ((k + 3) % 125 < 125 * ciclo ? 178 : 78);

test('un seno de 1 kHz y 100 mV de pico: frecuencia, media, valor eficaz, ciclo y tiempo de subida', () => {
  const m = medirAmpliado(traza(seno));
  expect(m.frecuencia! / 1000).toBeCloseTo(1, 2);
  expect(m.periodo! * 1000).toBeCloseTo(1, 2);
  expect(Math.abs(m.media)).toBeLessThan(0.002);
  // 100 mV of peak: 70,7 mV RMS; the steps of the converter (2 mV) allow about 1 %
  expect(m.eficazAlterna / 0.0707).toBeGreaterThan(0.98);
  expect(m.eficazAlterna / 0.0707).toBeLessThan(1.02);
  expect(m.eficaz).toBeGreaterThanOrEqual(m.eficazAlterna);
  expect(Math.abs(m.ciclo! - 50)).toBeLessThan(1);
  // from 10 % to 90 % of a sine: 2·asin(0,8)/2π of its period, 295 µs here
  expect(m.subida! / 295e-6).toBeGreaterThan(0.94);
  expect(m.subida! / 295e-6).toBeLessThan(1.06);
  expect(m.bajada! / 295e-6).toBeGreaterThan(0.94);
  expect(m.bajada! / 295e-6).toBeLessThan(1.06);
  expect(m.flancoLimitado).toBe(false);
  expect(m.periodos).toBeGreaterThanOrEqual(7);
  // the same frequency the panel already shows
  expect(m.frecuencia).toBeCloseTo(medirTraza(traza(seno)).frecuencia!, 6);
});

test('el espectro de ese seno: un solo tono, con su valor eficaz, y una distorsión que es la de los 8 bits', () => {
  const e = espectro(traza(seno));
  expect(e.amplitudes.length).toBe(PUNTOS_ESPECTRO);
  // 1024 points of 8 µs: 122 Hz between one and the next
  expect(e.resolucion).toBeCloseTo(1 / (1024 * PASO), 6);
  expect(e.pocosPeriodos).toBe(false);
  expect(e.tonos.length).toBe(ARMONICOS);
  expect(e.tonos[0]!.orden).toBe(1);
  expect(e.tonos[0]!.frecuencia / 1000).toBeCloseTo(1, 2);
  expect(e.tonos[0]!.eficaz / 0.0707).toBeGreaterThan(0.98);
  expect(e.tonos[0]!.eficaz / 0.0707).toBeLessThan(1.02);
  expect(e.distorsion!).toBeLessThan(2);
  // the highest point of the spectrum is the one nearest to 1 kHz
  let mayor = 0;
  for (let k = 1; k < e.amplitudes.length; k++) if (e.amplitudes[k]! > e.amplitudes[mayor]!) mayor = k;
  expect(Math.abs(mayor * e.resolucion - 1000)).toBeLessThan(e.resolucion);
});

test('una cuadrada de ±100 mV: armónicos impares en 1/n, pares casi nulos y flancos que esta base no resuelve', () => {
  const t = traza(cuadrada(0.5));
  const m = medirAmpliado(t);
  expect(m.eficazAlterna / 0.1).toBeGreaterThan(0.98);
  expect(m.eficazAlterna / 0.1).toBeLessThan(1.02);
  expect(Math.abs(m.ciclo! - 50)).toBeLessThan(1);
  expect(m.subida).not.toBeNull();
  expect(m.subida!).toBeLessThan(2 * PASO);
  expect(m.flancoLimitado).toBe(true);
  const e = espectro(t);
  const [f1, f2, f3, f4, f5] = e.tonos.map((x) => x.eficaz) as [number, number, number, number, number];
  // the fundamental of a square of ±A is 4A/π of peak: 90,0 mV RMS
  expect(f1 / 0.09).toBeGreaterThan(0.97);
  expect(f1 / 0.09).toBeLessThan(1.03);
  expect((3 * f3) / f1).toBeGreaterThan(0.94);
  expect((3 * f3) / f1).toBeLessThan(1.06);
  expect((5 * f5) / f1).toBeGreaterThan(0.9);
  expect((5 * f5) / f1).toBeLessThan(1.1);
  expect(f2 / f1).toBeLessThan(0.03);
  expect(f4 / f1).toBeLessThan(0.03);
  // up to the tenth harmonic a square has √(1/9 + 1/25 + 1/49 + 1/81) = 42,9 %
  expect(e.distorsion!).toBeGreaterThan(40);
  expect(e.distorsion!).toBeLessThan(46);
});

test('una cuadrada con el 30 % de ciclo: el ciclo y la media lo dicen', () => {
  const m = medirAmpliado(traza(cuadrada(0.3)));
  expect(Math.abs(m.ciclo! - 30)).toBeLessThan(1);
  // 30 % at +100 mV and 70 % at −100 mV
  expect(m.media).toBeGreaterThan(-0.043);
  expect(m.media).toBeLessThan(-0.037);
});

test('flancos de 20 muestras: 16 muestras del 10 % al 90 %, y no se dan por limitados', () => {
  // a trapezoid: 20 samples up, 60 high, 20 down, 60 low
  const t = traza((k) => {
    const x = (k + 5) % 160;
    if (x < 20) return 78 + 5 * x;
    if (x < 80) return 178;
    if (x < 100) return 178 - 5 * (x - 80);
    return 78;
  });
  const m = medirAmpliado(t);
  expect(m.subida! / (16 * PASO)).toBeGreaterThan(0.95);
  expect(m.subida! / (16 * PASO)).toBeLessThan(1.05);
  expect(m.bajada! / (16 * PASO)).toBeGreaterThan(0.95);
  expect(m.bajada! / (16 * PASO)).toBeLessThan(1.05);
  expect(m.flancoLimitado).toBe(false);
});

test('pocos periodos en el registro: hay frecuencia, pero el espectro no da tonos y lo dice', () => {
  // 400 Hz: 312 samples to a period, three periods in the record and three points of the spectrum to the fundamental
  const t = traza((k) => 128 + 50 * Math.sin((2 * Math.PI * (k + 3)) / 312.5));
  expect(medirAmpliado(t).frecuencia! / 400).toBeCloseTo(1, 1);
  const e = espectro(t);
  expect(e.pocosPeriodos).toBe(true);
  expect(e.tonos).toEqual([]);
  expect(e.distorsion).toBeNull();
});

test('una traza plana: ni frecuencia, ni ciclo, ni flancos, ni tonos', () => {
  const t = traza(() => 140);
  const m = medirAmpliado(t);
  expect([m.frecuencia, m.periodo, m.ciclo, m.subida, m.bajada]).toEqual([null, null, null, null, null]);
  expect(m.flancoLimitado).toBe(false);
  expect(m.periodos).toBe(0);
  // 12 steps of 2 mV above zero, and nothing alternating
  expect(m.media).toBeCloseTo(0.024, 9);
  expect(m.eficaz).toBeCloseTo(0.024, 9);
  expect(m.eficazAlterna).toBeCloseTo(0, 9);
  const e = espectro(t);
  expect(e.tonos).toEqual([]);
  expect(e.distorsion).toBeNull();
  expect(e.pocosPeriodos).toBe(false);
});

test('un registro del aparato de verdad (la cuadrada de 1 kHz de su generador)', () => {
  const b = Uint8Array.from(Buffer.from(REGISTRO_CH1, 'base64'));
  const t: Traza = { canal: 0, secuencia: 1, tick: 0, ajustes: leerAjustes(b.subarray(0, 56))!, muestras: b.subarray(57, 56 + 1024), saturada: false };
  const m = medirAmpliado(t);
  expect(Math.abs(m.frecuencia! - 1000)).toBeLessThan(10);
  expect(Math.abs(m.ciclo! - 50)).toBeLessThan(2);
  expect(m.picoPico).toBeCloseTo(medirTraza(t).picoPico, 9);
  // a square: its RMS without the mean is half its peak to peak, within what its ringing and its edges add
  expect(m.eficazAlterna / (m.picoPico / 2)).toBeGreaterThan(0.93);
  expect(m.eficazAlterna / (m.picoPico / 2)).toBeLessThan(1.02);
  const e = espectro(t);
  expect(e.tonos.length).toBe(ARMONICOS);
  expect((3 * e.tonos[2]!.eficaz) / e.tonos[0]!.eficaz).toBeGreaterThan(0.85);
  expect((3 * e.tonos[2]!.eficaz) / e.tonos[0]!.eficaz).toBeLessThan(1.15);
  expect(e.distorsion!).toBeGreaterThan(35);
  expect(e.distorsion!).toBeLessThan(50);
});

test('la traza como fichero: una fila por muestra, segundos y voltios con coma decimal', () => {
  const texto = csvTraza(traza(seno));
  const filas = texto.replace(/^﻿/, '').trimEnd().split('\r\n');
  expect(texto.charCodeAt(0)).toBe(0xfeff);
  expect(filas[0]).toBe('segundos;voltios');
  expect(filas.length).toBe(1 + 1023);
  expect(filas[1]!.split(';')[0]).toBe('0');
  expect(filas[2]!.split(';')[0]).toBe('0,000008');
  // sample 0 of the sine: 128 + 50·sin(2π·3/125) = 135,5 → 136, eight steps of 2 mV above zero
  expect(filas[1]!.split(';')[1]).toBe('0,016');
});
