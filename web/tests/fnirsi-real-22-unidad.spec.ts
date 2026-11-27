// 2.2 (owner's answers, 26-11 15:23, checked on his unit): the decoders of the real FNIRSI 2C53T against the single
// values he gave. Words 3, 9, 10 and 11 of a channel's own measurements (negative duty; Amp, Vrms and Avg in signed µV,
// the X10 factor already in); the oscilloscope state's byte 20 (channels on) and 47 (the AUTO key's step); the record
// header's byte 1 (CH2's coupling), 22 (trigger channel) and 23 (trigger mode); the 10 ms time base checked; the
// generator's added entries only as many as the identification says. Single frames built from those values only.
// No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-22-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { leerAjustes } from '../src/lib/fnirsi-real/osciloscopio.ts';
import { decodificarMedidas, leerEstadoMedidas, nombreForma, LARGO_MEDIDAS } from '../src/lib/fnirsi-real/estado.ts';
import { MEMORIA } from './fnirsi-real-datos.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

const deHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

/** One channel's twelve words (48 bytes, little-endian, signed where the value is negative). */
function palabras(w: Record<number, number>): Uint8Array {
  const v = new DataView(new ArrayBuffer(LARGO_MEDIDAS));
  for (const [k, x] of Object.entries(w)) v.setInt32(4 * Number(k), x, true);
  return new Uint8Array(v.buffer);
}

test('palabras 9, 10 y 11: amplitud, valor eficaz y media en µV con signo, con el ×10 ya incluido', () => {
  // X1 (the screen: Amp 316.0mV, Vrms 208.0mV, Avg 148.0mV)
  const x1 = decodificarMedidas(palabras({ 0: 1000, 9: 316000, 10: 208000, 11: 148000 }))!;
  expect([x1.amplitud, x1.valorEficaz, x1.media].map((x) => Math.round(x * 1e6))).toEqual([316000, 208000, 148000]);
  expect(x1.amplitud).toBeCloseTo(0.316, 12);
  // X10: the same signal, the instrument's own factor already in the words; the app does not multiply them again
  const x10 = decodificarMedidas(palabras({ 0: 1000, 9: 3040000, 10: 2108800, 11: 1490400 }))!;
  expect(x10.amplitud).toBeCloseTo(3.04, 12);
  expect(x10.valorEficaz).toBeCloseTo(2.1088, 12);
  expect(x10.media).toBeCloseTo(1.4904, 12);
  // signed, like Vmax, Vmin and Vpp: a mean below zero
  expect(decodificarMedidas(palabras({ 0: 1000, 11: -148000 }))!.media).toBeCloseTo(-0.148, 12);
});

test('palabra 3: el ciclo de trabajo negativo en centésimas de %', () => {
  const m = decodificarMedidas(palabras({ 0: 1000, 2: 5040, 3: 4960 }))!;
  expect([m.ciclo, m.cicloNegativo]).toEqual([50.4, 49.6]);
  expect(m.ciclo + m.cicloNegativo).toBe(100);
  // (the owner's other case: the two add up to 9999)
  const n = decodificarMedidas(palabras({ 0: 1000, 2: 5040, 3: 4959 }))!;
  expect(Math.round((n.ciclo + n.cicloNegativo) * 100)).toBe(9999);
});

test('byte 20 del estado: bit 0 CH1, bit 1 CH2 (1, 2 y 3); byte 47: la tecla AUTO ajustando mientras no es 0', () => {
  const con = (b20: number, b47 = 0) => {
    const b = deHex(MEMORIA.osciloscopioEnMarcha);
    b[20] = b20;
    b[47] = b47;
    return leerEstadoMedidas(b);
  };
  expect(con(1)).toEqual({ canales: [true, false], ajustando: false });
  expect(con(2)).toEqual({ canales: [false, true], ajustando: false });
  expect(con(3)).toEqual({ canales: [true, true], ajustando: false });
  expect(con(0)).toEqual({ canales: [false, false], ajustando: false });
  expect(con(3, 1)!.ajustando).toBe(true);
  expect(con(3, 4)!.ajustando).toBe(true);
  // the state read from the unit (CH1 on, no AUTO under way)
  expect(leerEstadoMedidas(deHex(MEMORIA.osciloscopioEnMarcha))).toEqual({ canales: [true, false], ajustando: false });
  expect(leerEstadoMedidas(new Uint8Array(20))).toBeNull();
  // the record header is the same block at the acquisition: the same bytes, the same reading
  const h = deHex(MEMORIA.osciloscopioEnMarcha);
  h[20] = 2;
  h[47] = 3;
  const a = leerAjustes(h)!;
  expect([a.canales[0].activo, a.canales[1].activo, a.ajustando]).toEqual([false, true, true]);
});

test('bytes 1, 22 y 23 de los ajustes: acoplamiento de CH2, canal y modo de disparo', () => {
  const con = (cambios: Record<number, number>) => {
    const b = deHex(MEMORIA.osciloscopioEnMarcha);
    for (const [k, v] of Object.entries(cambios)) b[Number(k)] = v;
    return leerAjustes(b)!;
  };
  // byte 1: 1 direct (CC), 0 alternating (CA); CH1's byte 0 is left as it was
  expect(con({ 1: 1 }).canales[1].acoplamiento).toBe('CC');
  expect(con({ 1: 0 }).canales[1].acoplamiento).toBe('CA');
  expect(con({ 1: 0 }).canales[0].acoplamiento).toBe('CC');
  expect(con({ 0: 0, 1: 1 }).canales.map((c) => c.acoplamiento)).toEqual(['CA', 'CC']);
  // byte 22: 0 CH1, 1 CH2
  expect(con({ 22: 0 }).canalDisparo).toBe('CH1');
  expect(con({ 22: 1 }).canalDisparo).toBe('CH2');
  expect(con({ 22: 5 }).canalDisparo).toBeNull();
  // byte 23: 0 Normal, 1 Auto, 2 Single
  expect(con({ 23: 0 }).modoDisparo).toBe('Normal');
  expect(con({ 23: 1 }).modoDisparo).toBe('Auto');
  expect(con({ 23: 2 }).modoDisparo).toBe('Único');
  expect(con({ 23: 3 }).modoDisparo).toBeNull();
  // the state read from the unit: CH1, Auto
  const a = leerAjustes(deHex(MEMORIA.osciloscopioEnMarcha))!;
  expect([a.canalDisparo, a.modoDisparo]).toEqual(['CH1', 'Auto']);
});

test('la base de 10 ms por división (índice 18) está comprobada, como las de 5 ms y 20 ms', () => {
  const con = (i: number) => {
    const b = deHex(MEMORIA.osciloscopioEnMarcha);
    b[45] = i;
    return leerAjustes(b)!;
  };
  expect([17, 18, 19].map((i) => con(i).tiempoComprobado)).toEqual([true, true, true]);
  expect(con(18).tiempoDiv).toBeCloseTo(10e-3, 12);
});

test('el generador: con la identificación leída, solo las entradas añadidas que dice su byte 37', () => {
  // the owner's unit: five added entries (13 to 17), 17 plays what is sent
  expect(nombreForma(13, 17, 5)).toBe('Triangular 25/75 (entrada n.º 14 de su menú, añadida por el enlace)');
  expect(nombreForma(17, 17, 5)).toBe('Onda USB (entrada n.º 18 de su menú, añadida por el enlace, la que reproduce la onda que se le envía)');
  expect(nombreForma(18, 17, 5)).toBe('la forma n.º 19 de su menú');
  expect(nombreForma(20, 17, 5)).toBe('la forma n.º 21 de su menú');
  // a link that adds none
  expect(nombreForma(13, 0, 0)).toBe('la forma n.º 14 de su menú');
  // the firmware's own thirteen, whatever the count
  expect(nombreForma(12, 17, 5)).toBe('Lorentziana (Lorentz waves)');
  // without the identification: as before, up to eight
  expect(nombreForma(20)).toBe('la entrada n.º 21 de su menú, añadida por el enlace');
});
