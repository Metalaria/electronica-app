// The recorder of the real instruments and the FNIRSI–Brymen comparison (web/src/lib/registro-real/): the series
// and their running figures, the thinning of a long record, the settled-reading rule, the CSV files, the FNIRSI's
// range and accuracy for real captures of the instrument (fnirsi-real-datos.ts) and the comparison's verdicts.
// No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-registro-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { construirPaquete, decodificar, type LecturaReal, type PantallaReal, type Simulacion } from '../src/lib/brymen-real/protocolo.ts';
import { decodificarMultimetro, type LecturaFnirsi } from '../src/lib/fnirsi-real/multimetro.ts';
import { comparar, csvComparaciones, exactitudFnirsi, medidaBrymen, medidaFnirsi, noComparables, porcentaje, seFalseanJuntos } from '../src/lib/registro-real/comparar.ts';
import { MAXIMO_FILAS, NucleoRegistro, type Fuentes } from '../src/lib/registro-real/nucleo.ts';
import {
  LECTURAS_ESTABLES,
  MAXIMO_MUESTRAS,
  Serie,
  campoCsv,
  cifra,
  csvRegistro,
  duracion,
  estable,
  horaLocal,
  magnitudDe,
  muestraDe,
  numeroCsv,
  type Muestra,
} from '../src/lib/registro-real/registro.ts';
import { MULTIMETRO } from './fnirsi-real-datos.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

const deHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const fnirsi = (caso: string): LecturaFnirsi => decodificarMultimetro(deHex(MULTIMETRO[caso]!));
const brymen = (s: Simulacion): LecturaReal => decodificar(construirPaquete(s));
const voltios = (v: string, t: number): Muestra => muestraDe(brymen({ principal: v, unidad: 'V', dc: true }).principal, t);

// ------------------------------------------------------------------ samples and series

test('una pantalla como muestra: valor en SI, texto como lo enseña el instrumento y magnitud', () => {
  const m = muestraDe(fnirsi('pila9V').pantalla, 1000);
  expect(m.valor).toBeCloseTo(9.201, 6);
  expect(m.texto).toBe('9,201 V ⎓');
  expect(m.magnitud).toBe('V ⎓');
  expect([m.unidad, m.prefijo, m.decimales]).toEqual(['V', '', 3]);
  const k = muestraDe(fnirsi('ohm10k').pantalla, 1000);
  expect(k.valor).toBeCloseTo(9831, 6);
  expect([k.magnitud, k.texto]).toEqual(['Ω', '9,831 kΩ']);
  // out of range: the text stays, the number does not
  const ol = muestraDe(fnirsi('ohmOL').pantalla, 1000);
  expect([ol.valor, ol.magnitud]).toEqual([null, 'Ω']);
  // a reading the app does not trust keeps its text only
  const cap = fnirsi('capacidadTransicion');
  expect(cap.fiable).toBe(false);
  expect(muestraDe(cap.pantalla, 1000, cap.fiable).valor).toBeNull();
  // «Auto» has no unit: no magnitude
  const auto = fnirsi('autoEsperando');
  expect(muestraDe(auto.pantalla, 1000, auto.fiable, 'Auto')).toMatchObject({ valor: null, magnitud: '', texto: 'Auto' });
  expect(magnitudDe(brymen({ principal: '230.1', unidad: 'V', ac: true }).principal)).toBe('V ∿');
  expect(magnitudDe(brymen({ principal: '3.197', unidad: 'kΩ' }).principal)).toBe('Ω');
});

test('la serie lleva mínimo, máximo, media y desviación del último tramo', () => {
  const s = new Serie();
  expect(s.estadisticas()).toBeNull();
  // (the figures run one reading behind the display: the fifth brings the fourth in)
  for (const [k, v] of ['9.000', '9.100', '9.200', '9.300', '9.150'].entries()) expect(s.anadir(voltios(v, 1000 + k * 300))).toBe(true);
  const e = s.estadisticas()!;
  expect(e.n).toBe(4);
  expect(e.min).toBeCloseTo(9.0, 9);
  expect(e.max).toBeCloseTo(9.3, 9);
  expect(e.media).toBeCloseTo(9.15, 9);
  expect(e.desviacion).toBeCloseTo(0.1290994, 6);
  expect(e.ultimo).toBeCloseTo(9.3, 9);
  expect([e.desde, e.hasta, e.magnitud]).toEqual([1000, 1900, 'V ⎓']);
  // the figures as the instrument writes its readings: its decimals, one more for the mean
  expect([cifra(e.min, e), cifra(e.max, e), cifra(e.media, e, 1)]).toEqual(['9,000 V', '9,300 V', '9,1500 V']);
  // a blank display belongs to the same «tramo» and does not count
  s.anadir(muestraDe(fnirsi('vdcEnBlanco').pantalla, 2500, false));
  expect(s.estadisticas()!.n).toBe(4);
  // another magnitude starts a new «tramo»: the figures start again, the samples stay for the file
  s.anadir(muestraDe(fnirsi('ohm10k').pantalla, 2800));
  s.anadir(muestraDe(fnirsi('ohm10k').pantalla, 2965));
  // (two numbers in a row are not yet a measurement)
  expect(s.estadisticas()).toBeNull();
  s.anadir(muestraDe(fnirsi('ohm10k').pantalla, 3130));
  const o = s.estadisticas()!;
  expect([o.n, o.magnitud]).toEqual([2, 'Ω']);
  expect(o.desviacion).toBe(0);
  expect([cifra(o.min, o), cifra(o.media, o, 1)]).toEqual(['9,831 kΩ', '9,8310 kΩ']);
  expect(cifra(-0.000006, { unidad: 'A', prefijo: 'm', decimales: 3 })).toBe('−0,006 mA');
  expect(cifra(-1e-9, { unidad: 'A', prefijo: 'm', decimales: 3 })).toBe('0,000 mA');
  expect(s.muestras.length).toBe(9);
  s.borrar();
  expect(s.muestras.length).toBe(0);
  expect(s.estadisticas()).toBeNull();
});

test('la media de muchas lecturas iguales con un valor grande no pierde cifras', () => {
  const s = new Serie();
  const p = brymen({ principal: '1.0255', unidad: 'MΩ' }).principal;
  for (let k = 0; k < 5000; k++) s.anadir(muestraDe(p, k));
  const e = s.estadisticas()!;
  expect(e.media).toBeCloseTo(1025500, 6);
  expect(e.desviacion).toBeCloseTo(0, 6);
});

test('el dibujo: una lectura sin número o una pausa cortan la línea, y un registro largo se adelgaza sin perder los picos', () => {
  const s = new Serie();
  let t = 0;
  for (const v of ['1.000', '2.000', '3.000', '3.500']) s.anadir(voltios(v, t++));
  s.anadir(muestraDe(brymen({ principal: '0L', unidad: 'V', dc: true }).principal, t++));
  for (const v of ['4.000', '5.000']) s.anadir(voltios(v, t++));
  s.cortar();
  for (const v of ['6.000', '7.000', '8.000']) s.anadir(voltios(v, t++));
  // 3,500 was the last number before OL (not drawn); 8,000 still waits for what comes after it
  expect(s.trazos().map((x) => x.map((p) => p.v))).toEqual([[1, 2, 3], [4, 5], [6, 7]]);

  const largo = new Serie();
  for (let k = 0; k < 20_000; k++) largo.anadir(voltios(k === 12_345 ? '9.999' : k === 3210 ? '-9.999' : '1.000', k));
  const tr = largo.trazos(600);
  expect(tr.length).toBe(1);
  expect(tr[0]!.length).toBeLessThanOrEqual(600);
  expect(tr[0]!.length).toBeGreaterThan(100);
  // a spike in the middle of a run of readings is a reading like the others: kept by the thinning
  const vs = tr[0]!.map((p) => p.v);
  expect(Math.max(...vs)).toBeCloseTo(9.999, 6);
  expect(Math.min(...vs)).toBeCloseTo(-9.999, 6);
  // in time order
  for (let k = 1; k < tr[0]!.length; k++) expect(tr[0]![k]!.t).toBeGreaterThan(tr[0]![k - 1]!.t);
});

/** A display built by hand (what the decoders hand over for displays the packets of the tests cannot make). */
function pantalla(texto: string, valor: number | null, prefijo: PantallaReal['prefijo'], unidad: PantallaReal['unidad'] = 'Ω', ol = false): PantallaReal {
  const decimales = texto.includes('.') ? texto.length - texto.indexOf('.') - 1 : 0;
  return { texto, valor, unidad, prefijo, ac: false, dc: false, ol, decimales };
}

test('las lecturas de paso (al poner o quitar las puntas, o buscando escala) quedan en el registro pero no en las cifras', () => {
  // what the real Brymen recorded on 24-11-2026 around a 5,07 kΩ resistor
  const s = new Serie();
  let t = 0;
  const dar = (p: PantallaReal, veces = 1) => {
    for (let k = 0; k < veces; k++) s.anadir(muestraDe(p, (t += 400)));
  };
  const OL = pantalla('0L', null, 'M', 'Ω', true);
  // the probes go on: one number on the way
  dar(OL, 2);
  dar(pantalla('29.252', 29_252_000, 'M'));
  dar(pantalla('.', null, 'k'));
  expect([s.estadisticas(), s.lecturasDePaso]).toEqual([null, 1]);
  // the measurement, and the probes come off: the last number is not of the resistor
  dar(pantalla('05.070', 5070, 'k'), 4);
  dar(pantalla('05.069', 5069, 'k'), 3);
  dar(pantalla('05.548', 5548, 'k'));
  dar(OL, 2);
  let e = s.estadisticas()!;
  expect([e.n, e.min, e.max, e.dePaso]).toEqual([7, 5069, 5070, 2]);
  // a probe not making good contact: pairs of numbers between blank displays, and single good ones
  dar(pantalla('06.091', 6_091_000, 'M'));
  dar(pantalla('24.744', 24_744_000, 'M'));
  dar(OL);
  dar(pantalla('--.---', null, 'M'), 2);
  dar(pantalla('05.069', 5069, 'k'));
  dar(pantalla('.', null, 'k'));
  e = s.estadisticas()!;
  expect([e.n, e.min, e.max, e.dePaso]).toEqual([7, 5069, 5070, 5]);
  // good contact again
  dar(pantalla('05.069', 5069, 'k'), 5);
  e = s.estadisticas()!;
  expect([e.n, e.min, e.max, e.dePaso]).toEqual([11, 5069, 5070, 5]);
  expect(e.media).toBeCloseTo((4 * 5070 + 7 * 5069) / 11, 9);
  expect(s.trazos().map((x) => x.map((p) => p.v))).toEqual([[5070, 5070, 5070, 5070, 5069, 5069, 5069], [5069, 5069, 5069, 5069]]);
  // nothing is thrown away: the file has every one of them, as a number
  expect(s.muestras.length).toBe(26);
  expect(csvRegistro({ brymen: s.muestras }, 0).split('\r\n')[3]).toBe(`Brymen BM869s;${horaLocal(1200)};1,2;29252000;Ω;;29,252 MΩ;sí`);

  // a signal that moves into another range is not a probe coming off: the last number of the old range counts
  const mueve = new Serie();
  for (const v of ['9.000', '9.100', '9.200', '9.20', '9.21', '9.22']) mueve.anadir(voltios(v, (t += 400)));
  const m = mueve.estadisticas()!;
  expect([m.n, m.dePaso]).toEqual([5, 0]);
  expect(m.max).toBeCloseTo(9.21, 9);
  // a range that lasts less than three readings, between two that last, is «de paso»
  const salto = new Serie();
  for (const v of ['9.000', '9.100', '9.200', '9.20', '9.21', '9.300', '9.400', '9.500', '9.600']) salto.anadir(voltios(v, (t += 400)));
  const z = salto.estadisticas()!;
  expect([z.n, z.dePaso]).toEqual([6, 2]);
});

test('una pantalla sin número se escribe con una raya y su unidad, no con sus signos sueltos', () => {
  expect(muestraDe(pantalla('.', null, 'k'), 0).texto).toBe('— kΩ');
  expect(muestraDe(pantalla('--.---', null, 'M'), 0).texto).toBe('— MΩ');
  expect(muestraDe(pantalla('', null, 'k'), 0).texto).toBe('— kΩ');
  expect(muestraDe(pantalla('', null, '', ''), 0).texto).toBe('—');
  expect(muestraDe(fnirsi('vdcEnBlanco').pantalla, 0, false).texto).toBe('— V');
  // what does say something stays as it is
  expect(muestraDe(pantalla('0L', null, 'M', 'Ω', true), 0).texto).toBe('OL');
  expect(muestraDe(pantalla('diod', null, '', 'V'), 0).texto).toBe('diod V');
  expect(muestraDe(pantalla('05.070', 5070, 'k'), 0).texto).toBe('05,070 kΩ');
});

test('reiniciar las cifras: cuentan desde ese momento y el registro lo conserva todo', () => {
  const s = new Serie();
  for (const [k, v] of ['9.000', '9.100', '9.200', '5.000', '5.010', '5.020', '5.030'].entries()) {
    if (k === 3) s.reiniciar();
    s.anadir(voltios(v, k * 300));
  }
  const e = s.estadisticas()!;
  expect([e.n, e.magnitud]).toEqual([3, 'V ⎓']);
  expect([e.min, e.max]).toEqual([5, 5.02]);
  expect(e.desde).toBe(900);
  expect(s.trazos().map((x) => x.map((p) => p.v))).toEqual([[5, 5.01, 5.02]]);
  expect(s.muestras.length).toBe(7);

  // through the bookkeeping, for both instruments at once
  const { x, f } = fuentes();
  const n = new NucleoRegistro();
  n.iniciar(0);
  for (let k = 1; k <= 5; k++) {
    x.fnirsi = { lectura: fnirsi('pila9V'), hora: k * 165 };
    x.brymen = { lectura: brymen({ principal: '9.213', unidad: 'V', dc: true }), hora: k * 165 };
    n.paso(f, k * 165);
  }
  expect([n.series.fnirsi.estadisticas()!.n, n.series.brymen.estadisticas()!.n]).toEqual([4, 4]);
  n.reiniciarCifras();
  expect([n.series.fnirsi.estadisticas(), n.series.brymen.estadisticas(), n.muestras]).toEqual([null, null, 10]);
  expect(n.grabando).toBe(true);
});

test('la serie se llena y no descarta nada para hacer sitio', () => {
  const s = new Serie();
  const m = voltios('1.000', 0);
  for (let k = 0; k < MAXIMO_MUESTRAS; k++) expect(s.anadir(m)).toBe(true);
  expect(s.llena).toBe(true);
  expect(s.anadir(m)).toBe(false);
  expect(s.muestras.length).toBe(MAXIMO_MUESTRAS);
});

test('lectura estable: las últimas coinciden dentro del 0,2 % más cuatro cuentas, en la misma escala', () => {
  expect(LECTURAS_ESTABLES).toBe(3);
  const v = (...xs: string[]) => xs.map((x, k) => voltios(x, k));
  expect(estable(v('9.201', '9.201'))).toBeNull();
  expect(estable(v('9.201', '9.203', '9.202'))!.valor).toBeCloseTo(9.202, 6);
  // 9,2 V: 0,2 % is 18 mV, plus 4 counts of 1 mV
  expect(estable(v('9.180', '9.190', '9.202'))).not.toBeNull();
  expect(estable(v('9.100', '9.190', '9.202'))).toBeNull();
  // only the last three count
  expect(estable(v('1.000', '9.201', '9.201', '9.201'))).not.toBeNull();
  // a change of range in between
  expect(estable([voltios('9.201', 0), voltios('9.20', 1), voltios('9.20', 2)])).toBeNull();
  // no number
  const ol = muestraDe(brymen({ principal: '0L', unidad: 'V', dc: true }).principal, 3);
  expect(estable([voltios('9.201', 0), voltios('9.201', 1), ol])).toBeNull();
  // another magnitude in between
  const ohm = muestraDe(brymen({ principal: '9.201', unidad: 'Ω' }).principal, 1);
  expect(estable([voltios('9.201', 0), ohm, voltios('9.201', 2)])).toBeNull();
});

// ------------------------------------------------------------------ files

test('CSV: punto y coma, coma decimal, marca UTF-8, valores en la unidad base y los dos instrumentos por orden de hora', () => {
  expect(numeroCsv(9.201)).toBe('9,201');
  expect(numeroCsv(0.1 + 0.2)).toBe('0,3');
  expect(numeroCsv(-0.000006)).toBe('-0,000006');
  expect(numeroCsv(9827)).toBe('9827');
  expect(campoCsv('9,201 V ⎓')).toBe('9,201 V ⎓');
  expect(campoCsv('a;b')).toBe('"a;b"');
  expect(campoCsv('dice "hola"')).toBe('"dice ""hola"""');
  const t0 = new Date(2026, 10, 23, 13, 57, 2, 0).getTime();
  expect(horaLocal(t0)).toBe('2026-11-23 13:57:02');
  const f = fnirsi('ohm10k');
  const texto = csvRegistro(
    {
      fnirsi: [muestraDe(f.pantalla, t0 + 330, f.fiable), muestraDe(fnirsi('ohmOL').pantalla, t0 + 1500)],
      brymen: [muestraDe(brymen({ principal: '9.8312', unidad: 'kΩ' }).principal, t0 + 1000)],
    },
    t0,
  );
  expect(texto.startsWith('﻿')).toBe(true);
  expect(texto.endsWith('\r\n')).toBe(true);
  const lineas = texto.slice(1).trimEnd().split('\r\n');
  expect(lineas).toEqual([
    'instrumento;hora;segundos;valor;unidad;tipo;lectura;usable',
    'FNIRSI 2C53T;2026-11-23 13:57:02;0,33;9831;Ω;;9,831 kΩ;sí',
    'Brymen BM869s;2026-11-23 13:57:03;1;9831,2;Ω;;9,8312 kΩ;sí',
    'FNIRSI 2C53T;2026-11-23 13:57:03;1,5;;Ω;;OL;no',
  ]);
  const v = csvRegistro({ brymen: [muestraDe(brymen({ principal: '-12.53', unidad: 'mV', ac: true }).principal, t0)] }, t0).split('\r\n')[1]!;
  expect(v).toBe('Brymen BM869s;2026-11-23 13:57:02;0;-0,01253;V;CA;−12,53 mV ∿;sí');
});

test('duraciones legibles', () => {
  expect(duracion(0)).toBe('0 s');
  expect(duracion(42_400)).toBe('42 s');
  expect(duracion(185_000)).toBe('3 min 05 s');
  expect(duracion(3_725_000)).toBe('1 h 02 min');
});

// ------------------------------------------------------------------ the FNIRSI's range and accuracy

test('escala y exactitud del FNIRSI para capturas reales del instrumento', () => {
  // 9,201 V: the 20 V range, ± (0,5 % + 3 counts of 1 mV)
  const v = exactitudFnirsi(fnirsi('pila9V'));
  expect(v.escala).toBe('20 V');
  expect(v.incertidumbre).toBeCloseTo(0.005 * 9.201 + 0.003, 9);
  // 9,831 kΩ: the 20 kΩ range, ± (0,5 % + 3 counts of 1 Ω)
  const r = exactitudFnirsi(fnirsi('ohm10k'));
  expect(r.escala).toBe('20 kΩ');
  expect(r.incertidumbre).toBeCloseTo(0.005 * 9831 + 3, 6);
  // 1,0255 MΩ in Auto: the 2 MΩ range
  const m = exactitudFnirsi(fnirsi('megaohmios'));
  expect(m.escala).toBe('2 MΩ');
  expect(m.incertidumbre).toBeCloseTo(0.005 * 1025500 + 300, 3);
  // −0,006 mA: the 20 mA range
  const i = exactitudFnirsi(fnirsi('maNegativo'));
  expect(i.escala).toBe('20 mA');
  expect(i.incertidumbre).toBeCloseTo(0.012 * 6e-6 + 3e-6, 12);
  // temperature: the table has no accuracy for it
  expect(exactitudFnirsi(fnirsi('temperatura23'))).toEqual({ incertidumbre: null, escala: '°C' });
  // nothing on the display
  expect(exactitudFnirsi(fnirsi('ohmOL')).incertidumbre).toBeNull();
});

// ------------------------------------------------------------------ the comparison

function par(casoFnirsi: string, b: Simulacion) {
  const lf = fnirsi(casoFnirsi);
  const lb = brymen(b);
  return { fn: medidaFnirsi(lf, muestraDe(lf.pantalla, 1000, lf.fiable)), br: medidaBrymen(lb, muestraDe(lb.principal, 1000)) };
}

test('FNIRSI frente a Brymen: diferencia, porcentaje y si cabe en la exactitud de los dos', () => {
  expect(porcentaje(-0.0013)).toBe('−0,13 %');
  expect(porcentaje(0.021)).toBe('+2,10 %');
  expect(porcentaje(0)).toBe('0,00 %');

  // 9,201 V against 9,213 V: 12 mV less, well inside ± 49 mV
  let { fn, br } = par('pila9V', { principal: '9.213', unidad: 'V', dc: true });
  expect(noComparables(fn, br)).toBe('');
  let c = comparar(fn, br);
  expect(c.diferencia).toBeCloseTo(-0.012, 9);
  expect(c.relativa).toBeCloseTo(-0.012 / 9.213, 9);
  expect(c.veredicto).toBe('dentro');
  expect(br.incertidumbre).not.toBeNull();
  expect(c.margen).toBeCloseTo(fn.incertidumbre! + br.incertidumbre!, 12);
  expect(c.texto).toContain('El FNIRSI marca 9,201 V ⎓ y el Brymen, 9,213 V ⎓: 12,00 mV menos (−0,13 %).');
  expect(c.texto).toContain('Cabe en lo que los dos pueden equivocarse');

  // the same FNIRSI reading against 9,500 V: 299 mV less, outside
  ({ fn, br } = par('pila9V', { principal: '9.500', unidad: 'V', dc: true }));
  c = comparar(fn, br);
  expect(c.veredicto).toBe('fuera');
  expect(c.texto).toContain('299,0 mV menos');
  expect(c.texto).toContain('el FNIRSI se desvía en esta escala');

  // resistance: 9,831 kΩ against 9,8312 kΩ
  ({ fn, br } = par('ohm10k', { principal: '9.8312', unidad: 'kΩ' }));
  c = comparar(fn, br);
  expect(c.diferencia).toBeCloseTo(-0.2, 6);
  expect(c.veredicto).toBe('dentro');
  expect(fn.escala).toBe('20 kΩ');

  // equal readings
  ({ fn, br } = par('pila9V', { principal: '9.201', unidad: 'V', dc: true }));
  c = comparar(fn, br);
  expect([c.diferencia, c.veredicto]).toEqual([0, 'dentro']);
  expect(c.texto).toContain('coinciden.');

  // no accuracy for the FNIRSI's range: the difference is given, the verdict is not
  ({ fn, br } = par('temperatura23', { principal: '23.4', unidad: '°C' }));
  c = comparar(fn, br);
  expect([c.veredicto, c.margen]).toEqual(['sin-exactitud', null]);
  expect(c.texto).toContain('no tiene la exactitud del FNIRSI');

  // different things
  ({ fn, br } = par('pila9V', { principal: '9.8312', unidad: 'kΩ' }));
  expect(noComparables(fn, br)).toBe('El FNIRSI mide en V ⎓ y el Brymen, en Ω: ponga los dos en la misma función para compararlos.');
  ({ fn, br } = par('pila9V', { principal: '9.213', unidad: 'V', ac: true }));
  expect(noComparables(fn, br)).toContain('V ∿');

  expect([seFalseanJuntos('Ω'), seFalseanJuntos('F'), seFalseanJuntos('V'), seFalseanJuntos('A')]).toEqual([true, true, false, false]);
});

// ------------------------------------------------------------------ the bookkeeping

/** Stand-in connections: each hands over what the test put, with the time the test gave it. */
function fuentes() {
  const x: { brymen: { lectura: LecturaReal; hora: number } | null; fnirsi: { lectura: LecturaFnirsi; hora: number } | null } = { brymen: null, fnirsi: null };
  const f: Fuentes = { brymen: () => x.brymen, fnirsi: () => x.fnirsi };
  return { x, f };
}

test('el registro toma cada lectura una sola vez y solo mientras se registra', () => {
  const { x, f } = fuentes();
  const n = new NucleoRegistro();
  expect(n.paso(f, 0)).toBe(false);
  x.fnirsi = { lectura: fnirsi('pila9V'), hora: 100 };
  expect(n.paso(f, 100)).toBe(true);
  // the same reading again: nothing new
  expect(n.paso(f, 150)).toBe(false);
  expect(n.conLectura('fnirsi')).toBe(true);
  expect(n.ultima('fnirsi')).toBe('9,201 V ⎓');
  // not recording yet: nothing kept
  expect(n.muestras).toBe(0);
  expect(n.iniciar(1000)).toBe(true);
  expect(n.inicio).toBe(1000);
  // a reading that arrived just before the start, looked at just after it, is not of this record (its time would
  // be negative in the file)
  x.fnirsi = { lectura: fnirsi('pila9V'), hora: 974 };
  expect(n.paso(f, 1010)).toBe(true);
  expect(n.muestras).toBe(0);
  for (let k = 0; k < 5; k++) {
    x.fnirsi = { lectura: fnirsi('pila9V'), hora: 1100 + k * 165 };
    n.paso(f, 1100 + k * 165);
    n.paso(f, 1150 + k * 165);
  }
  x.brymen = { lectura: brymen({ principal: '9.213', unidad: 'V', dc: true }), hora: 1900 };
  n.paso(f, 1900);
  expect(n.series.fnirsi.muestras.length).toBe(5);
  expect(n.series.brymen.muestras.length).toBe(1);
  n.detener();
  x.fnirsi = { lectura: fnirsi('pila9V'), hora: 5000 };
  n.paso(f, 5000);
  expect(n.series.fnirsi.muestras.length).toBe(5);
  // going on keeps the record and its start, and does not draw a line across the pause
  expect(n.iniciar(9000)).toBe(true);
  expect(n.inicio).toBe(1000);
  x.fnirsi = { lectura: fnirsi('pila9V'), hora: 8990 };
  n.paso(f, 9020);
  expect(n.series.fnirsi.muestras.length).toBe(5);
  for (const hora of [9100, 9265]) {
    x.fnirsi = { lectura: fnirsi('pila9V'), hora };
    n.paso(f, hora);
  }
  expect(n.series.fnirsi.muestras.length).toBe(7);
  expect(n.series.fnirsi.trazos().length).toBe(2);
  n.borrar();
  expect([n.muestras, n.grabando]).toEqual([0, false]);
});

test('el Brymen en HOLD o REL se registra con su marca y no entra en la comparación', () => {
  const { x, f } = fuentes();
  const n = new NucleoRegistro();
  n.iniciar(0);
  for (let k = 1; k <= 3; k++) {
    x.brymen = { lectura: brymen({ principal: '9.213', unidad: 'V', dc: true, hold: true }), hora: k * 300 };
    n.paso(f, k * 300);
  }
  expect(n.series.brymen.muestras[0]!.texto).toBe('9,213 V ⎓ (HOLD)');
  expect(n.enVivo('brymen')).toBeNull();
  expect(n.motivo('brymen')).toContain('El Brymen está en HOLD');
  for (let k = 4; k <= 6; k++) {
    x.brymen = { lectura: brymen({ principal: '9.213', unidad: 'V', dc: true }), hora: k * 300 };
    n.paso(f, k * 300);
  }
  expect(n.enVivo('brymen')!.muestra.valor).toBeCloseTo(9.213, 9);
  expect(n.motivo('brymen')).toBe('');
});

test('el FNIRSI en HOLD se registra con su marca y no entra en la comparación', () => {
  const { x, f } = fuentes();
  const n = new NucleoRegistro();
  n.iniciar(0);
  for (let k = 1; k <= 3; k++) {
    x.fnirsi = { lectura: fnirsi('holdActivo'), hora: k * 170 };
    n.paso(f, k * 170);
  }
  // the instrument's frozen screen, not the frame that goes on behind it
  expect(n.series.fnirsi.muestras[0]!.texto).toBe('−0,0005 V ⎓ (HOLD)');
  expect(n.series.fnirsi.muestras[0]!.valor).toBeCloseTo(-0.0005, 9);
  expect(n.enVivo('fnirsi')).toBeNull();
  expect(n.motivo('fnirsi')).toContain('El FNIRSI está en HOLD');
  for (let k = 4; k <= 6; k++) {
    x.fnirsi = { lectura: fnirsi('holdQuitado'), hora: k * 170 };
    n.paso(f, k * 170);
  }
  expect(n.enVivo('fnirsi')!.muestra.valor).toBeCloseTo(-0.0009, 9);
  expect(n.motivo('fnirsi')).toBe('');
});

test('comparación en vivo, retenida (resistencia, un instrumento después del otro) y anotada en la tabla', () => {
  const { x, f } = fuentes();
  const n = new NucleoRegistro();
  let t = 0;
  const dar = (b: Simulacion | null, casoFnirsi: string | null, veces = 3) => {
    for (let k = 0; k < veces; k++) {
      t += 300;
      x.brymen = b ? { lectura: brymen(b), hora: t } : null;
      x.fnirsi = casoFnirsi ? { lectura: fnirsi(casoFnirsi), hora: t } : null;
      n.paso(f, t);
    }
  };
  expect(n.comparacion()).toBeNull();
  expect(n.motivo('fnirsi')).toContain('Sin lectura');
  // two readings are not enough to call it settled
  dar({ principal: '9.213', unidad: 'V', dc: true }, 'pila9V', 2);
  expect(n.comparacion()).toBeNull();
  expect(n.motivo('fnirsi')).toContain('todavía se mueve');
  dar({ principal: '9.213', unidad: 'V', dc: true }, 'pila9V', 1);
  const c = n.comparacion();
  expect(typeof c).toBe('object');
  expect((c as { veredicto: string }).veredicto).toBe('dentro');
  const fila = n.anotar(t)!;
  expect(fila).toMatchObject({ magnitud: 'V ⎓', escala: '20 V', veredicto: 'dentro', textoFnirsi: '9,201 V ⎓', textoBrymen: '9,213 V ⎓' });
  expect(n.filas.length).toBe(1);

  // resistance, one after the other: the Brymen measures and is held, then the FNIRSI measures alone
  dar({ principal: '9.8312', unidad: 'kΩ' }, null);
  expect(n.retener('brymen')).toBe(true);
  expect(n.medida('brymen')!.retenida).toBe(true);
  dar(null, 'ohm10k');
  expect(n.enVivo('brymen')).toBeNull();
  const r = n.comparacion();
  expect((r as { veredicto: string; diferencia: number }).veredicto).toBe('dentro');
  expect((r as { diferencia: number }).diferencia).toBeCloseTo(-0.2, 6);
  expect(n.anotar(t)).toMatchObject({ magnitud: 'Ω', escala: '20 kΩ' });
  // writing it down lets the held reading go
  expect(n.retenidas.brymen).toBeNull();
  expect(n.comparacion()).toBeNull();

  // nothing to hold while there is no settled reading
  expect(n.retener('brymen')).toBe(false);
  // different functions: a sentence, and nothing to write down
  dar({ principal: '9.213', unidad: 'V', dc: true }, 'ohm10k');
  expect(n.comparacion()).toContain('ponga los dos en la misma función');
  expect(n.anotar(t)).toBeNull();
  // the FNIRSI on a reading the app does not trust: no comparison, and the reason
  dar({ principal: '1.0300', unidad: 'µF' }, 'capacidadTransicion');
  expect(n.comparacion()).toBeNull();
  expect(n.motivo('fnirsi')).toContain('no dan la misma unidad');
  // capacitance, once the display and the firmware agree: compared like anything else (a capacitor of about 1 µF)
  dar({ principal: '1.0300', unidad: 'µF' }, 'capacidadMicro');
  const cap = n.comparacion() as { diferencia: number; veredicto: string; margen: number | null };
  expect(cap.diferencia).toBeCloseTo(-2e-9, 15);
  expect(n.medida('fnirsi')!.escala).toBe('10 µF');
  expect(['dentro', 'fuera']).toContain(cap.veredicto);
  // out of range
  dar({ principal: '9.8312', unidad: 'kΩ' }, 'ohmOL');
  expect(n.motivo('fnirsi')).toContain('no muestra un número');

  const texto = csvComparaciones(n.filas).slice(1).trimEnd().split('\r\n');
  expect(texto[0]).toBe('hora;magnitud;escala del FNIRSI;FNIRSI;Brymen;unidad;diferencia;diferencia %;margen ±;resultado');
  expect(texto.length).toBe(3);
  expect(texto[1]).toMatch(/;V ⎓;20 V;9,201;9,213;V;-0,012;-0,130250733;0,0\d+;Dentro$/);
  expect(texto[2]).toMatch(/;Ω;20 kΩ;9831;9831,2;Ω;-0,2;-0,00203\d+;\d+,\d+;Dentro$/);
  n.vaciarTabla();
  expect(n.filas.length).toBe(0);
  expect(MAXIMO_FILAS).toBeGreaterThanOrEqual(100);
});

test('el registro se detiene solo al llenarse y lo dice', () => {
  const { x, f } = fuentes();
  const n = new NucleoRegistro();
  n.iniciar(0);
  const l = fnirsi('pila9V');
  for (let k = 1; k <= MAXIMO_MUESTRAS + 1; k++) {
    x.fnirsi = { lectura: l, hora: k };
    n.paso(f, k);
  }
  expect([n.grabando, n.lleno, n.series.fnirsi.muestras.length]).toEqual([false, true, MAXIMO_MUESTRAS]);
  expect(n.iniciar(MAXIMO_MUESTRAS + 10)).toBe(false);
});
