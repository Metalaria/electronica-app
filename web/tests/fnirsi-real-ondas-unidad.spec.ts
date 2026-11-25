// The real FNIRSI: a waveform for its own signal generator (link with patch 4). The shapes and the scaling
// (lib/fnirsi-real/ondas.ts), the request and its response (protocolo.ts) and the send with its read-back through
// the fake link (conexion.svelte.ts is exercised in the browser tests). No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-ondas-unidad.spec.ts
import { test, expect } from '@playwright/test';
import {
  FONDO_ONDA, FORMAS_ONDA, PUNTOS_ONDA, formaOnda, guardadas, invertir, leerArmonicos, leerNumeros, muestrasValidas, normalizar, remuestrear,
} from '../src/lib/fnirsi-real/ondas.ts';
import { ORDEN_INFO, ORDEN_LEER, leerInfo, peticion, peticionLeer, peticionOnda, respuestaLeer, respuestaOnda, u32 } from '../src/lib/fnirsi-real/protocolo.ts';
import { Falso, type EnlaceFalso } from '../src/lib/fnirsi-real/transporte.ts';

test('cada forma es un periodo de 100 muestras enteras de 0 a 4094', () => {
  for (const f of FORMAS_ONDA) {
    const m = formaOnda(f.id, 25, [{ orden: 1, nivel: 1, fase: 0 }, { orden: 3, nivel: 0.33, fase: 0 }]);
    expect(m.length, f.id).toBe(PUNTOS_ONDA);
    expect(Math.min(...m), f.id).toBe(0);
    expect(Math.max(...m), f.id).toBe(FONDO_ONDA);
    expect(muestrasValidas(m), f.id).toBe(true);
  }
  const seno = formaOnda('senoidal');
  expect(seno[25]).toBe(4094);
  expect(seno[75]).toBe(0);
  expect(Math.abs(seno[0]! - 2047)).toBeLessThanOrEqual(1);
  // the duty: the high part of the pulse and where the triangle peaks
  expect(formaOnda('pulso', 25).filter((x) => x === 4094).length).toBe(25);
  expect(formaOnda('triangular', 25).indexOf(4094)).toBe(25);
  expect(formaOnda('triangular', 50).indexOf(4094)).toBe(50);
  // out of range, the duty is held between 1 and 99
  expect(formaOnda('pulso', 0).filter((x) => x === 4094).length).toBe(1);
  expect(formaOnda('pulso', 150).filter((x) => x === 4094).length).toBe(99);
  expect(invertir(formaOnda('rampa'))).toEqual(formaOnda('rampa-descendente'));
  expect(() => formaOnda('armonicos')).toThrow(/al menos un armónico/);
});

test('lo que guarda el aparato: la escala de su propio firmware, nunca por encima de su tope', () => {
  expect(guardadas([0, 4094, 9999, 2047], 30)).toEqual([20, 3741, 3741, 1880]);
  expect(guardadas([4094], 10)).toEqual([1260]);
  expect(guardadas([4094], 0)).toEqual([20]);
  expect(guardadas([4094], 255)).toEqual([3741]);
});

test('números cualesquiera: del más bajo al más alto, y de cualquier cantidad de puntos a cien', () => {
  expect(normalizar([...Array(50).fill(-1.5), ...Array(50).fill(3)])).toEqual([...Array(50).fill(0), ...Array(50).fill(4094)]);
  expect(normalizar(Array(100).fill(7))).toEqual(Array(100).fill(2047));
  expect(() => normalizar(Array(99).fill(1))).toThrow(/100 puntos y hay 99/);
  expect(() => normalizar(Array(100).fill(NaN))).toThrow(/no son números/);
  const cuatro = remuestrear([0, 1, 0, -1]);
  expect(cuatro.length).toBe(100);
  expect(cuatro[0]).toBe(0);
  expect(cuatro[25]).toBe(1);
  expect(cuatro[75]).toBe(-1);
  expect(cuatro[99]).toBeCloseTo(-0.04, 9);
  expect(() => remuestrear([1])).toThrow(/al menos dos puntos/);
  expect(muestrasValidas([...Array(99).fill(0), 4095])).toBe(false);
  expect(muestrasValidas(Array(100).fill(0.5))).toBe(false);
});

test('un fichero con un periodo: comentarios, títulos, coma decimal y varios separadores', () => {
  expect(leerNumeros('# un periodo\ntensión;x\n0; 1,5\n-2e-1\t3\n\n4 5\n')).toEqual([0, 1.5, -0.2, 3, 4, 5]);
  expect(leerNumeros('1,2,3\r\n4.5,6,7')).toEqual([1, 2, 3, 4.5, 6, 7]);
  expect(() => leerNumeros('1\n2\n3 x')).toThrow(/no es un número: «x»/);
});

test('los armónicos se escriben «orden:nivel» y, si hace falta, la fase', () => {
  expect(leerArmonicos('1:1; 3:0,33:90')).toEqual([{ orden: 1, nivel: 1, fase: 0 }, { orden: 3, nivel: 0.33, fase: 90 }]);
  for (const mal of ['', '3', '0:1', '26:1', '1:x', '1:1:2:3', '1,5:1']) expect(() => leerArmonicos(mal), mal).toThrow();
});

test('la petición de onda y su respuesta', () => {
  const r = peticionOnda(0x42, 84, [0, 1, 4094]);
  expect(Array.from(r.subarray(0, 14))).toEqual([0x04, 0x42, 3, 0, 84, 0, 0, 0, 0, 0, 1, 0, 0xfe, 0x0f]);
  expect(r.length).toBe(64);
  for (const [primera, muestras] of [[0, []], [0, Array(29).fill(0)], [100, [0]], [99, [0, 0]], [-1, [0]], [0, [4095]], [0, [1.5]]] as [number, number[]][])
    expect(() => peticionOnda(1, primera, muestras), `${primera}/${muestras.length}`).toThrow();
  const bien = Uint8Array.from([0x84, 0x42, 0, 2, 84, 0, 0, 0, 30, 1]);
  expect(respuestaOnda(bien, 0x42, 84)).toEqual({ amplitud: 30, forma: 1 });
  expect(respuestaOnda(bien, 0x43, 84)).toBeNull();
  expect(respuestaOnda(bien, 0x42, 56)).toBeNull();
  expect(respuestaOnda(Uint8Array.from([0x84, 0x42, 2, 0, 84, 0, 0, 0]), 0x42, 84)).toBe('rechazada');
});

/** Sends one request to the fake link and returns its response. */
async function pedir(f: Falso, informe: Uint8Array): Promise<Uint8Array> {
  await f.enviar(informe);
  return (await f.leer(1, 1)).bytes;
}

test('el enlace del parche 4 lo anuncia, guarda la onda con la amplitud del aparato y deja leerla; el del 3, no', async () => {
  const c: EnlaceFalso = { modo: 3, parche: 4, memoria: { '20000f50': [1, 2, 0, 0, 0xe8, 3, 0, 0, 50, 20] } };
  const f = new Falso(c);
  await f.abrir();
  expect(leerInfo(await pedir(f, peticion(ORDEN_INFO, 1)))).toMatchObject({ parche: 4, estadoEnFlujo: true, ondasAMedida: true });
  const onda = formaOnda('sinc');
  for (let primera = 0, sec = 2; primera < 100; primera += 28, sec++)
    expect(respuestaOnda(await pedir(f, peticionOnda(sec, primera, onda.slice(primera, primera + 28))), sec, primera)).toEqual({ amplitud: 20, forma: 2 });
  expect(c.ondas).toEqual([[0, 28], [28, 28], [56, 28], [84, 16]]);
  expect(c.tabla).toEqual(guardadas(onda, 20));
  // read back as the application does: 56, 56, 56 and 32 bytes
  const leida: number[] = [];
  for (let desde = 0, sec = 9; desde < 200; desde += 56, sec++) {
    const largo = Math.min(56, 200 - desde);
    leida.push(...(respuestaLeer(await pedir(f, peticionLeer(sec, 0x20000f5a + desde, largo)), sec, 0x20000f5a + desde, largo) as Uint8Array));
  }
  expect(Array.from({ length: 100 }, (_, k) => leida[2 * k]! | (leida[2 * k + 1]! << 8))).toEqual(guardadas(onda, 20));
  // refused: past the table, no samples
  const fuera = peticion(0x04, 20, 2);
  fuera[4] = 99;
  expect((await pedir(f, fuera))[2]).toBe(2);
  expect((await pedir(f, peticion(0x04, 21, 0)))[2]).toBe(3);
  expect(c.tabla).toEqual(guardadas(onda, 20));

  const viejo = new Falso({ modo: 3, parche: 3 });
  await viejo.abrir();
  expect(leerInfo(await pedir(viejo, peticion(ORDEN_INFO, 1)))).toMatchObject({ parche: 3, estadoEnFlujo: true, ondasAMedida: false });
  const r = await pedir(viejo, peticionOnda(2, 0, [1]));
  expect([r[0], r[2]]).toEqual([0x84, 1]);
  expect(u32(await pedir(viejo, peticionLeer(3, 0x20000f5a, 4)), 4)).toBe(0x20000f5a);
  expect(ORDEN_LEER).toBe(0x02);
});
