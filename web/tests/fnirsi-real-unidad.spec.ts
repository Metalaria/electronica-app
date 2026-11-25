// The real FNIRSI 2C53T through its «stock-link» USB link: the decoders of its reports (web/src/lib/fnirsi-real/)
// against real captures of the instrument (fnirsi-real-datos.ts: a 10 kΩ resistor, a 9 V battery, every function of
// the key cycle, and its own generator's 1 kHz square wave on the oscilloscope). No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { textoCampo, textoPantalla } from '../src/lib/brymen-real/lectura.ts';
import { caracterFnirsi, decodificarMultimetro, esTramaMultimetro, textoTrama } from '../src/lib/fnirsi-real/multimetro.ts';
import {
  EnsambladorOsciloscopio,
  leerAjustes,
  medirTraza,
  segundosPorDivision,
  ventana,
  voltios,
  voltiosPorDivision,
  type Traza,
} from '../src/lib/fnirsi-real/osciloscopio.ts';
import {
  ESTADO_GENERADOR,
  ESTADO_MEDIDAS_CH1,
  ESTADO_MEDIDAS_CH2,
  EVT_ESTADO,
  EVT_OSC_CABECERA,
  EVT_OSC_DATOS,
  FLUJO_ESTADO,
  FLUJO_MULTIMETRO,
  FLUJO_OSCILOSCOPIO,
  INFORME,
  ORDEN_INFO,
  ORDEN_SUSCRIBIR,
  esEvento,
  leerEstado,
  leerInfo,
  partir,
  peticion,
  peticionLeer,
  respuestaA,
  respuestaLeer,
} from '../src/lib/fnirsi-real/protocolo.ts';
import {
  DIR_ESTADO_OSCILOSCOPIO,
  DIR_GENERADOR,
  DIR_MEDIDAS_CH1,
  LARGO_MEDIDAS,
  decodificarGenerador,
  decodificarMedidas,
  osciloscopioEnMarcha,
} from '../src/lib/fnirsi-real/estado.ts';
import { Falso, type EnlaceFalso } from '../src/lib/fnirsi-real/transporte.ts';
import { MEMORIA, MULTIMETRO, REGISTRO_CH1, REGISTRO_PAR_CH1, REGISTRO_PAR_CH2 } from './fnirsi-real-datos.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

const deHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const lectura = (caso: string) => decodificarMultimetro(deHex(MULTIMETRO[caso]!));

// ------------------------------------------------------------------ the multimeter

test('los segmentos del FNIRSI dan sus caracteres', () => {
  // a 0x80, f 0x40, e 0x20, b 0x08, g 0x04, c 0x02, d 0x01
  expect(caracterFnirsi(0xeb)).toBe('0');
  expect(caracterFnirsi(0x0a)).toBe('1');
  expect(caracterFnirsi(0xef)).toBe('8');
  expect(caracterFnirsi(0x61)).toBe('L');
  // the decimal point bit does not change the digit
  expect(caracterFnirsi(0xeb | 0x10)).toBe('0');
  expect(caracterFnirsi(0x00)).toBe(' ');
  expect(caracterFnirsi(0x81)).toBe('?');
});

test('una resistencia de 10 kΩ en Auto: 9,824 kΩ', () => {
  const l = lectura('resistenciaAuto');
  expect(l.pantalla.texto).toBe('9.824');
  expect(l.pantalla.unidad).toBe('Ω');
  expect(l.pantalla.prefijo).toBe('k');
  expect(l.pantalla.valor).toBeCloseTo(9824, 6);
  expect(l.pantalla.decimales).toBe(3);
  expect(l.pantalla.ol).toBe(false);
  expect(l.funcion).toBe('auto');
  expect(l.fiable).toBe(true);
  expect(l.motivo).toBe('');
  // the same helpers as the real Brymen's reading
  expect(textoPantalla(l.pantalla)).toBe('9,824 kΩ');
  expect(textoCampo(l.pantalla)).toBe('9,824 kΩ');
  // tick 89.140 s
  expect(l.tick).toBe(89140);
});

test('la misma resistencia en la función de resistencia, y en megaohmios con los dedos', () => {
  const r = lectura('ohm10k');
  expect(r.funcion).toBe('ohm');
  expect(r.pantalla.valor).toBeCloseTo(9831, 6);
  expect(r.fiable).toBe(true);
  // 4½ digits: the leading «1» is a bit of its own, and the lowest range has no point bit
  const m = lectura('megaohmios');
  expect(m.pantalla.texto).toBe('1.0255');
  expect(m.pantalla.prefijo).toBe('M');
  expect(m.pantalla.valor).toBeCloseTo(1.0255e6, 3);
  expect(m.pantalla.decimales).toBe(4);
  expect(m.fiable).toBe(true);
});

test('una pila de 9 V: 9,201 V en continua, y en Auto', () => {
  const l = lectura('pila9V');
  expect(l.funcion).toBe('vdc');
  expect(l.pantalla.texto).toBe('9.201');
  expect(l.pantalla.unidad).toBe('V');
  expect(l.pantalla.prefijo).toBe('');
  expect(l.pantalla.valor).toBeCloseTo(9.201, 9);
  expect(l.pantalla.dc).toBe(true);
  expect(l.pantalla.ac).toBe(false);
  expect(l.fiable).toBe(true);
  expect(textoPantalla(l.pantalla)).toBe('9,201 V ⎓');
  const a = lectura('autoPila');
  expect(a.funcion).toBe('auto');
  expect(a.pantalla.valor).toBeCloseTo(9.175, 9);
  expect(a.fiable).toBe(true);
});

test('cero voltios en la escala más baja: 0,0000 V', () => {
  const l = lectura('vdcCero');
  expect(l.pantalla.texto).toBe('0.0000');
  expect(l.pantalla.valor).toBe(0);
  expect(l.pantalla.decimales).toBe(4);
  expect(l.fiable).toBe(true);
});

test('fuera de escala: OL en continuidad y en resistencia', () => {
  const c = lectura('continuidadOL');
  expect(c.funcion).toBe('continuidad');
  expect(c.continuidad).toBe(true);
  expect(c.pantalla.ol).toBe(true);
  expect(c.pantalla.valor).toBeNull();
  expect(c.pantalla.unidad).toBe('Ω');
  expect(textoPantalla(c.pantalla)).toBe('OL');
  const r = lectura('ohmOL');
  expect(r.pantalla.ol).toBe(true);
  expect(r.pantalla.prefijo).toBe('M');
  expect(r.continuidad).toBe(false);
});

test('corriente con signo, temperatura y Auto sin nada en las puntas', () => {
  const ma = lectura('maNegativo');
  expect(ma.funcion).toBe('madc');
  expect(ma.pantalla.texto).toBe('-0.006');
  expect(ma.pantalla.unidad).toBe('A');
  expect(ma.pantalla.prefijo).toBe('m');
  expect(ma.pantalla.valor).toBeCloseTo(-6e-6, 12);
  expect(ma.fiable).toBe(true);
  const a = lectura('aNegativo');
  expect(a.funcion).toBe('adc');
  expect(a.pantalla.valor).toBeCloseTo(-0.0006, 12);
  expect(a.pantalla.prefijo).toBe('');
  const t = lectura('temperatura23');
  expect(t.funcion).toBe('temperatura');
  expect(t.pantalla.texto).toBe('23');
  expect(t.pantalla.unidad).toBe('°C');
  expect(t.pantalla.valor).toBe(23);
  expect(t.fiable).toBe(true);
  const e = lectura('autoEsperando');
  expect(e.esperando).toBe(true);
  expect(e.pantalla.texto).toBe('Auto');
  expect(e.pantalla.valor).toBeNull();
  expect(e.fiable).toBe(false);
});

test('lo que no está comprobado o está cambiando no se da por fiable', () => {
  // the screen blanks for a frame when the function changes
  const b = lectura('vdcEnBlanco');
  expect(b.pantalla.texto).toBe('');
  expect(b.fiable).toBe(false);
  // an old temperature frame while the firmware already says another unit
  const t = lectura('transicionTempAmA');
  expect(t.pantalla.unidad).toBe('°C');
  expect(t.fiable).toBe(false);
  expect(t.motivo).toContain('código 10');
  // the first frame with a voltage in Auto: the firmware has not named the unit yet
  const p = lectura('autoPilaTransicion');
  expect(p.pantalla.texto).toBe('9.175');
  expect(p.fiable).toBe(false);
  // a capacitor being measured: the display already says µF while the firmware still says nF
  const c = lectura('capacidadTransicion');
  expect(c.funcion).toBe('capacidad');
  expect([c.pantalla.texto, c.pantalla.unidad, c.pantalla.prefijo]).toEqual(['1.045', 'F', 'µ']);
  expect(c.fiable).toBe(false);
  expect(c.motivo).toContain('no dan la misma unidad');
  // the display with its decimal point alone, while the capacitance range changes: a blank display
  const punto = lectura('capacidadPunto');
  expect([punto.pantalla.texto, punto.pantalla.valor, punto.pantalla.unidad, punto.pantalla.prefijo]).toEqual(['.', null, 'F', 'n']);
  expect(punto.fiable).toBe(false);
  expect(punto.motivo).toContain('en blanco');
});

test('el diodo, comprobado en el aparato el 24-11-2026', () => {
  // the probes apart
  const d = lectura('diodoAbierto');
  expect([d.funcion, d.pantalla.texto, d.pantalla.ol, d.pantalla.unidad, d.pantalla.valor, d.fiable]).toEqual(['diodo', '.0L', true, 'V', null, true]);
  // a LED: its forward voltage, in volts
  const l = lectura('diodoLed');
  expect([l.funcion, l.pantalla.texto, l.pantalla.unidad, l.pantalla.prefijo, l.pantalla.decimales, l.pantalla.ol]).toEqual(['diodo', '1.811', 'V', '', 3, false]);
  expect(l.pantalla.valor).toBeCloseTo(1.811, 12);
  expect([l.pantalla.ac, l.pantalla.dc, l.fiable, l.motivo]).toEqual([false, true, true, '']);
  expect(textoPantalla(l.pantalla)).toBe('1,811 V ⎓');
});

test('alterna y capacidad, comprobadas en el aparato el 24-11-2026', () => {
  // alternating: nothing in the frame says so, the function does
  const v = lectura('acvCero');
  expect([v.funcion, v.pantalla.texto, v.pantalla.unidad, v.pantalla.prefijo, v.pantalla.decimales]).toEqual(['vac', '0.0000', 'V', '', 4]);
  expect([v.pantalla.ac, v.pantalla.dc, v.pantalla.valor, v.fiable]).toEqual([true, false, 0, true]);
  expect(textoPantalla(v.pantalla)).toBe('0,0000 V ∿');
  // the open probes held in the hand: a couple of volts of mains hum
  const h = lectura('acvMano');
  expect([h.funcion, h.pantalla.texto, h.pantalla.unidad, h.pantalla.decimales, h.pantalla.ac, h.fiable]).toEqual(['vac', '2.349', 'V', 3, true, true]);
  expect(h.pantalla.valor).toBeCloseTo(2.349, 12);
  const ma = lectura('acmACero');
  expect([ma.funcion, ma.pantalla.texto, ma.pantalla.unidad, ma.pantalla.prefijo, ma.pantalla.ac, ma.fiable]).toEqual(['maac', '0.008', 'A', 'm', true, true]);
  expect(ma.pantalla.valor).toBeCloseTo(8e-6, 12);
  const a = lectura('acACero');
  expect([a.funcion, a.pantalla.texto, a.pantalla.unidad, a.pantalla.prefijo, a.pantalla.ac, a.fiable]).toEqual(['aac', '0.0007', 'A', '', true, true]);
  expect(a.pantalla.valor).toBeCloseTo(0.0007, 12);
  // capacitance: nF with the probes apart, µF on a capacitor of about 1 µF
  const n = lectura('capacidadCero');
  expect([n.funcion, n.pantalla.texto, n.pantalla.unidad, n.pantalla.prefijo, n.pantalla.valor, n.fiable]).toEqual(['capacidad', '0.000', 'F', 'n', 0, true]);
  const u = lectura('capacidadMicro');
  expect([u.funcion, u.pantalla.texto, u.pantalla.unidad, u.pantalla.prefijo, u.pantalla.decimales, u.fiable]).toEqual(['capacidad', '1.028', 'F', 'µ', 3, true]);
  expect(u.pantalla.valor).toBeCloseTo(1.028e-6, 12);
  expect(textoPantalla(u.pantalla)).toBe('1,028 µF');
});

test('HOLD: la lectura es la pantalla congelada del aparato, no la trama que sigue en vivo', () => {
  // the frame says 0.0003 V; the instrument's screen stays at the -0.0005 V of the moment the key was pressed
  const h = lectura('holdActivo');
  expect(textoTrama(deHex(MULTIMETRO.holdActivo!).slice(8, 20))).toBe('0.0003');
  expect(h.pantalla).toEqual({ texto: '-0.0005', valor: -0.0005, unidad: 'V', prefijo: '', ac: false, dc: true, ol: false, decimales: 4 });
  expect(textoPantalla(h.pantalla)).toBe('−0,0005 V ⎓');
  expect([h.funcion, h.hold, h.fiable, h.motivo, h.esperando]).toEqual(['vdc', true, true, '', false]);
  // HOLD off again: the frame rules (the firmware's value is mid-update here, and does not matter)
  const q = lectura('holdQuitado');
  expect([q.pantalla.texto, q.hold, q.fiable]).toEqual(['-0.0009', false, true]);
  for (const caso of ['pila9V', 'ohm10k', 'capacidadMicro', 'diodoLed', 'acvMano']) expect([caso, lectura(caso).hold]).toEqual([caso, false]);
  // a frozen overload
  const informe = deHex(MULTIMETRO.holdActivo!);
  informe[24 + 13] = 2;
  const ol = decodificarMultimetro(informe);
  expect([ol.pantalla.ol, ol.pantalla.valor, ol.pantalla.unidad, ol.fiable, textoPantalla(ol.pantalla)]).toEqual([true, null, 'V', true, 'OL']);
  // a frozen state the app cannot read as the screen (a blank display; a value that does not fit it): said, no number
  informe[24 + 13] = 3;
  const blanco = decodificarMultimetro(informe);
  expect([blanco.hold, blanco.fiable, blanco.pantalla.valor, blanco.pantalla.texto]).toEqual([true, false, null, '']);
  expect(blanco.motivo).toContain('HOLD');
  informe[24 + 13] = 0;
  new DataView(informe.buffer).setFloat32(24 + 8, 3, true);
  expect([decodificarMultimetro(informe).fiable, decodificarMultimetro(informe).pantalla.valor]).toEqual([false, null]);
  new DataView(informe.buffer).setFloat32(24 + 8, 1.5, true);
  expect([decodificarMultimetro(informe).fiable, decodificarMultimetro(informe).pantalla.texto]).toEqual([true, '1.5000']);
});

test('la frecuencia que enseña la pantalla en tensión alterna', () => {
  expect(lectura('acvMano').frecuencia).toBe(49);
  expect(lectura('acvCero').frecuencia).toBe(0);
  // only there: in the other functions the firmware's number is stale
  for (const caso of ['pila9V', 'acmACero', 'acACero', 'capacidadMicro', 'diodoLed']) expect([caso, lectura(caso).frecuencia]).toEqual([caso, null]);
});

test('solo las tramas de pantalla se decodifican', () => {
  const r = deHex(MULTIMETRO.pila9V!);
  expect(esTramaMultimetro(r)).toBe(true);
  // the chip's echo of an order (sub-kind 2) and anything else are not display frames
  const eco = r.slice();
  eco[2] = 2;
  expect(esTramaMultimetro(eco)).toBe(false);
  expect(() => decodificarMultimetro(eco)).toThrow();
  const otro = r.slice();
  otro[8] = 0xaa;
  expect(esTramaMultimetro(otro)).toBe(false);
  expect(textoTrama(r.subarray(8, 20))).toBe('9.201');
});

// ------------------------------------------------------------------ the oscilloscope

function deBase64(b: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b, 'base64'));
}

/** A record (56 settings bytes + 1024 samples) as the link sends it: one header event and its data events. */
function informesDe(registro: Uint8Array, canal: 0 | 1, secuencia: number, tick = 1000): Uint8Array[] {
  expect(registro.length).toBe(56 + 1024);
  const v: Uint8Array[] = [];
  const cab = new Uint8Array(INFORME);
  cab.set([EVT_OSC_CABECERA, secuencia, canal, 56, tick & 0xff, (tick >> 8) & 0xff, (tick >> 16) & 0xff, (tick >> 24) & 0xff]);
  cab.set(registro.subarray(0, 56), 8);
  v.push(cab);
  for (let d = 0; d < 1024; d += 56) {
    const n = Math.min(56, 1024 - d);
    const r = new Uint8Array(INFORME);
    r.set([EVT_OSC_DATOS, secuencia, canal, n, d & 0xff, (d >> 8) & 0xff, 0, 0]);
    r.set(registro.subarray(56 + d, 56 + d + n), 8);
    v.push(r);
  }
  return v;
}

function ensamblar(e: EnsambladorOsciloscopio, informes: Uint8Array[]): Traza[] {
  const v: Traza[] = [];
  for (const r of informes) {
    const t = e.recibir(r);
    if (t) v.push(t);
  }
  return v;
}

test('las escaleras de voltios y de tiempo por división', () => {
  expect(voltiosPorDivision(0)).toBeCloseTo(0.01, 12);
  expect(voltiosPorDivision(2)).toBeCloseTo(0.05, 12);
  expect(voltiosPorDivision(5)).toBeCloseTo(0.5, 12);
  expect(voltiosPorDivision(9)).toBeCloseTo(10, 9);
  expect(voltiosPorDivision(10)).toBeNull();
  expect(voltiosPorDivision(-1)).toBeNull();
  expect(segundosPorDivision(0)).toBeCloseTo(10e-9, 15);
  expect(segundosPorDivision(11)).toBeCloseTo(50e-6, 12);
  expect(segundosPorDivision(13)).toBeCloseTo(200e-6, 12);
  expect(segundosPorDivision(16)).toBeCloseTo(2e-3, 12);
  expect(segundosPorDivision(255)).toBeNull();
});

test('la onda cuadrada del generador en CH1: 3,0 V de pico a pico y 1,00 kHz, como marca el FNIRSI', () => {
  const e = new EnsambladorOsciloscopio();
  const informes = informesDe(deBase64(REGISTRO_CH1), 0, 21, 1559328);
  // one header and nineteen data events
  expect(informes.length).toBe(20);
  const [t, ...resto] = ensamblar(e, informes);
  expect(resto.length).toBe(0);
  expect(t).toBeDefined();
  expect(t!.canal).toBe(0);
  expect(t!.secuencia).toBe(21);
  expect(t!.tick).toBe(1559328);
  // the filler sample is dropped
  expect(t!.muestras.length).toBe(1023);
  const a = t!.ajustes;
  expect(a.canales[0].activo).toBe(true);
  expect(a.canales[1].activo).toBe(false);
  // 50 mV per division at the input with the X10 setting: the screen says 500 mV
  expect(a.canales[0].sonda).toBe(10);
  expect(a.canales[0].voltiosDiv).toBeCloseTo(0.5, 9);
  expect(a.canales[0].cero).toBe(52);
  expect(a.tiempoDiv).toBeCloseTo(200e-6, 12);
  expect(a.periodoMuestra).toBeCloseTo(8e-6, 12);
  expect(a.tiempoComprobado).toBe(true);
  expect(t!.saturada).toBe(false);
  const m = medirTraza(t!);
  // the instrument's own measurement of this wave: Vp-p 3.01 V, 1.00 kHz
  expect(m.picoPico).toBeGreaterThan(2.9);
  expect(m.picoPico).toBeLessThan(3.1);
  expect(m.frecuencia).not.toBeNull();
  expect(Math.abs(m.frecuencia! - 1000)).toBeLessThan(5);
  // the wave sits on the zero line: about 0 V to about 3 V
  expect(Math.abs(m.minimo)).toBeLessThan(0.1);
  expect(voltios(t!, a.canales[0].cero)).toBe(0);
  expect(e.rotos).toBe(0);
});

test('la ventana que se dibuja: 300 muestras con el flanco de subida en el centro', () => {
  const [t] = ensamblar(new EnsambladorOsciloscopio(), informesDe(deBase64(REGISTRO_CH1), 0, 1));
  const v = ventana(t!);
  expect(v.muestras.length).toBe(300);
  expect(v.inicio).toBeGreaterThan(0);
  const medio = (202 + 52) / 2;
  // low just before the middle of the window, high just after
  expect(v.muestras[146]!).toBeLessThan(medio);
  expect(v.muestras[154]!).toBeGreaterThan(medio);
});

test('los dos canales a la vez: CH1 sin señal y CH2 saturado', () => {
  const e = new EnsambladorOsciloscopio();
  // the link sends one whole record after the other
  const trazas = ensamblar(e, [...informesDe(deBase64(REGISTRO_PAR_CH1), 0, 5), ...informesDe(deBase64(REGISTRO_PAR_CH2), 1, 5)]);
  expect(trazas.map((t) => t.canal)).toEqual([0, 1]);
  const [c1, c2] = trazas;
  expect(c1!.ajustes.canales[0].activo).toBe(true);
  expect(c1!.ajustes.canales[1].activo).toBe(true);
  expect(c1!.ajustes.tiempoDiv).toBeCloseTo(2e-3, 12);
  // CH1: a flat line (noise of a few counts): no frequency
  expect(c1!.saturada).toBe(false);
  expect(medirTraza(c1!).frecuencia).toBeNull();
  // CH2: the 1 kHz wave far off scale, clipped at both rails; its frequency can still be read
  expect(c2!.saturada).toBe(true);
  const f = medirTraza(c2!).frecuencia;
  expect(f).not.toBeNull();
  expect(Math.abs(f! - 1000)).toBeLessThan(10);
  expect(c2!.ajustes.canales[1].voltiosDiv).toBeCloseTo(0.01, 12);
  // CH2 with the probe setting at X1: checked on the unit on 2026-11-25
  expect(c2!.ajustes.canales[1].comprobado).toBe(true);
});

test('la escala de los dos canales está comprobada con la sonda en X1 y en X10', () => {
  const con = (sondaCh1: number, sondaCh2: number) => {
    const b = deHex(MEMORIA.osciloscopioEnMarcha);
    b[6] = sondaCh1;
    b[7] = sondaCh2;
    return leerAjustes(b)!.canales;
  };
  expect(con(0, 0).map((c) => [c.sonda, c.comprobado])).toEqual([[1, true], [1, true]]);
  // (CH2 at X10: 3,30 V from the record against 3,29 V by the instrument, 2026-11-25)
  expect(con(1, 1).map((c) => [c.sonda, c.comprobado])).toEqual([[10, true], [10, true]]);
  // the state of that capture: CH2 alone at 50 mV per division with the probe setting at X10
  const real = leerAjustes(deHex('01000202b4000001000000000000000000000000021201010000000001000000000000000000000000000000000801000001ff0000000000'))!;
  expect(real.canales.map((c) => c.activo)).toEqual([false, true]);
  expect([real.canales[1].sonda, real.canales[1].voltiosDiv]).toEqual([10, expect.closeTo(0.5, 12)]);
});

test('el acoplamiento de CH1 es el primer byte de los ajustes; el de CH2 no está localizado', () => {
  // two states of the unit, one key press apart (2026-11-25): CH1 direct, then alternating
  const cc = leerAjustes(deHex('01000203b40000000000000000000000000000000101000100000000ffff0000000000000000000000000000000801000001ff0000000000'))!;
  const ca = leerAjustes(deHex('00000203b40000000000000000000000000000000101000100000000ffff0000000000000000000000000000000801000001ff0000000000'))!;
  expect(cc.canales.map((c) => c.acoplamiento)).toEqual(['CC', null]);
  expect(ca.canales.map((c) => c.acoplamiento)).toEqual(['CA', null]);
  // nothing else changes between the two
  expect({ ...ca, canales: null }).toEqual({ ...cc, canales: null });
});

test('un registro al que le falta un informe se descarta entero', () => {
  const e = new EnsambladorOsciloscopio();
  const informes = informesDe(deBase64(REGISTRO_CH1), 0, 7);
  const cojo = informes.filter((_, k) => k !== 5);
  expect(ensamblar(e, cojo).length).toBe(0);
  expect(e.rotos).toBe(1);
  // the next whole record is fine
  expect(ensamblar(e, informesDe(deBase64(REGISTRO_CH1), 0, 8)).length).toBe(1);
  // data without its header, and a header cut short by the next one
  const f = new EnsambladorOsciloscopio();
  expect(ensamblar(f, informes.slice(1)).length).toBe(0);
  expect(ensamblar(f, [...informes.slice(0, 4), ...informesDe(deBase64(REGISTRO_CH1), 0, 9)]).length).toBe(1);
  expect(f.rotos).toBe(1);
});

test('unos ajustes imposibles no dan traza', () => {
  const r = deBase64(REGISTRO_CH1).slice();
  expect(leerAjustes(r.subarray(0, 56))).not.toBeNull();
  r[2] = 10; // volts per division: only 0…9 exist
  expect(leerAjustes(r.subarray(0, 56))).toBeNull();
  const e = new EnsambladorOsciloscopio();
  expect(ensamblar(e, informesDe(r, 0, 3)).length).toBe(0);
  expect(e.rotos).toBe(1);
});

// ------------------------------------------------------------------ the link's requests

test('peticiones, respuestas e identificación', () => {
  const p = peticion(ORDEN_SUSCRIBIR, 0x105, FLUJO_MULTIMETRO | FLUJO_OSCILOSCOPIO);
  expect(p.length).toBe(INFORME);
  expect(Array.from(p.subarray(0, 4))).toEqual([0x03, 0x05, 0x03, 0x00]);
  // the response to it, and not to another sequence or order
  const r = new Uint8Array(INFORME);
  r[0] = 0x83;
  r[1] = 0x05;
  expect(respuestaA(r, ORDEN_SUSCRIBIR, 0x05)).toEqual({ estado: 0 });
  expect(respuestaA(r, ORDEN_SUSCRIBIR, 0x06)).toBeNull();
  expect(respuestaA(r, ORDEN_INFO, 0x05)).toBeNull();
  expect(esEvento(r)).toBe(false);
  expect(esEvento(deHex(MULTIMETRO.pila9V!))).toBe(true);
  // whole reports only
  expect(partir(new Uint8Array(64 * 3 + 10)).length).toBe(3);
  expect(leerInfo(r)).toBeNull();
});

test('lectura de la memoria del aparato: la petición, su respuesta y la que el enlace rechaza', async () => {
  const p = peticionLeer(0x07, DIR_GENERADOR, 10);
  expect(Array.from(p.subarray(0, 8))).toEqual([0x02, 0x07, 10, 0, 0x50, 0x0f, 0x00, 0x20]);
  expect(() => peticionLeer(1, DIR_GENERADOR, 57)).toThrow();
  expect(() => peticionLeer(1, DIR_GENERADOR, 0)).toThrow();
  // the fake link answers from its memory, as the real one does from the instrument's
  const c: EnlaceFalso = { memoria: { [DIR_GENERADOR.toString(16)]: Array.from(deHex(MEMORIA.generadorCuadrada)) } };
  const t = new Falso(c);
  await t.abrir();
  await t.enviar(p);
  const r = partir((await t.leer(10, 8)).bytes)[0]!;
  expect(Array.from(respuestaLeer(r, 0x07, DIR_GENERADOR, 10) as Uint8Array)).toEqual(Array.from(deHex(MEMORIA.generadorCuadrada)));
  // not the answer to another sequence, address or order
  expect(respuestaLeer(r, 0x08, DIR_GENERADOR, 10)).toBeNull();
  expect(respuestaLeer(r, 0x07, DIR_MEDIDAS_CH1, 10)).toBeNull();
  expect(respuestaLeer(deHex(MULTIMETRO.pila9V!), 0x07, DIR_GENERADOR, 10)).toBeNull();
  // an address the link does not have, and an answer shorter than asked: refused
  await t.enviar(peticionLeer(0x09, DIR_MEDIDAS_CH1, 48));
  expect(respuestaLeer(partir((await t.leer(10, 8)).bytes)[0]!, 0x09, DIR_MEDIDAS_CH1, 48)).toBe('rechazada');
  expect(respuestaLeer(r, 0x07, DIR_GENERADOR, 9)).toBe('rechazada');
  expect(c.lecturas).toEqual([DIR_GENERADOR, DIR_MEDIDAS_CH1]);
});

test('los ajustes del generador, como los enseña su pantalla', () => {
  expect(decodificarGenerador(deHex(MEMORIA.generadorCuadrada))).toEqual({ forma: 1, nombre: 'Cuadrada', rotulo: 'Square Wave', frecuencia: 15000, ciclo: 50, amplitud: 3 });
  expect(decodificarGenerador(deHex(MEMORIA.generadorOndaCompleta))).toEqual({ forma: 4, nombre: 'Onda completa', rotulo: 'Full Wave', frecuencia: 35000, ciclo: 50, amplitud: 2 });
  expect(decodificarGenerador(deHex(MEMORIA.generadorSierra))).toMatchObject({ forma: 2, nombre: 'Diente de sierra', frecuencia: 50000, amplitud: 2 });
  // the last six entries, as the unit's menu names them (2026-11-25)
  const nombres = [7, 8, 9, 10, 11, 12].map((forma) => {
    const b = deHex(MEMORIA.generadorCuadrada);
    b[1] = forma;
    const g = decodificarGenerador(b)!;
    return `${g.nombre} (${g.rotulo})`;
  });
  expect(nombres).toEqual([
    'Exponencial creciente (Index Up)', 'Exponencial decreciente (Index Decrease)', 'Continua (Direct current)',
    'Multitono (Multi-audio)', 'Pulso sinc (Sink Pulse)', 'Lorentziana (Lorentz waves)',
  ]);
  // the first entry of the menu: the sine, named as the firmware's own table names it
  const otra = deHex(MEMORIA.generadorCuadrada);
  otra[1] = 0;
  expect(decodificarGenerador(otra)).toMatchObject({ forma: 0, nombre: 'Senoidal', rotulo: 'Sine Wave', frecuencia: 15000 });
  // the first byte is not understood and does not matter
  otra[0] = 0;
  expect(decodificarGenerador(otra)).toMatchObject({ forma: 0 });
  // what cannot be settings is not shown as settings
  // an entry a link with patch 5 added after the firmware's thirteen: settings, without a name
  otra[1] = 14;
  expect(decodificarGenerador(otra)).toMatchObject({ forma: 14, nombre: null, rotulo: null, frecuencia: 15000 });
  otra[1] = 21;
  expect(decodificarGenerador(otra)).toBeNull();
  expect(decodificarGenerador(new Uint8Array(10))).toBeNull();
  expect(decodificarGenerador(new Uint8Array(4))).toBeNull();
  const ciclo = deHex(MEMORIA.generadorCuadrada);
  ciclo[8] = 101;
  expect(decodificarGenerador(ciclo)).toBeNull();
});

test('las medidas propias del osciloscopio y RUN/STOP, contra dos fotos de su pantalla', () => {
  // 40.23KHz, 64.51%, 114.0mV
  const m = decodificarMedidas(deHex(MEMORIA.medidasParado))!;
  expect([m.frecuencia, m.ciclo]).toEqual([40232, 64.51]);
  expect(m.vpp).toBeCloseTo(0.114, 9);
  expect(m.periodo).toBeCloseTo(24855e-9, 12);
  expect(m.periodo).toBeCloseTo(1 / 40232, 8);
  expect(m.anchoPositivo + m.anchoNegativo).toBeCloseTo(m.periodo, 8);
  expect(m.vmax - m.vmin).toBeCloseTo(m.vpp, 9);
  // 50.18KHz, 50.50%, 220.0mV, on a wave that goes below zero: the voltages are signed
  const t = decodificarMedidas(deHex(MEMORIA.medidasTriangulo))!;
  expect([t.frecuencia, t.ciclo]).toEqual([50176, 50.5]);
  expect([t.vpp, t.vmax, t.vmin].map((x) => Math.round(x * 1e6))).toEqual([220000, 210000, -10000]);
  // outside the oscilloscope the block is all zeros: no measurements
  expect(decodificarMedidas(new Uint8Array(48))).toBeNull();
  expect(decodificarMedidas(new Uint8Array(20))).toBeNull();
  // RUN / STOP
  expect(osciloscopioEnMarcha(deHex(MEMORIA.osciloscopioEnMarcha))).toBe(true);
  expect(osciloscopioEnMarcha(deHex(MEMORIA.osciloscopioParado))).toBe(false);
  const raro = deHex(MEMORIA.osciloscopioParado);
  raro[46] = 7;
  expect(osciloscopioEnMarcha(raro)).toBeNull();
  // the state is the same block that heads every record
  expect(leerAjustes(deHex(MEMORIA.osciloscopioParado))!.tiempoDiv).toBeCloseTo(5e-6, 12);
  expect(DIR_ESTADO_OSCILOSCOPIO).toBe(0x200000f8);
});

test('el flujo de estado: lo que anuncia la identificación y lo que trae cada evento', async () => {
  // patch 2: 36 bytes of identification, no status stream, and its bit in a subscription is refused
  const viejo: EnlaceFalso = { modo: 3 };
  const t2 = new Falso(viejo);
  await t2.abrir();
  await t2.enviar(peticion(ORDEN_INFO, 1));
  expect(leerInfo(partir((await t2.leer(5, 64)).bytes)[0]!)).toMatchObject({ protocolo: 1, parche: 2, estadoEnFlujo: false });
  await t2.enviar(peticion(ORDEN_SUSCRIBIR, 2, FLUJO_MULTIMETRO | FLUJO_OSCILOSCOPIO | FLUJO_ESTADO));
  expect(respuestaA(partir((await t2.leer(5, 64)).bytes)[0]!, ORDEN_SUSCRIBIR, 2)).toEqual({ estado: 3 });
  // patch 3: the same protocol, one more byte that announces the stream
  const memoria = {
    '20000f50': Array.from(deHex(MEMORIA.generadorCuadrada)),
    '200000f8': Array.from(deHex(MEMORIA.osciloscopioParado)),
    '20000208': Array.from(deHex(MEMORIA.medidasParado)),
  };
  const nuevo: EnlaceFalso = { modo: 2, parche: 3, memoria };
  const t3 = new Falso(nuevo);
  await t3.abrir();
  await t3.enviar(peticion(ORDEN_INFO, 1));
  expect(leerInfo(partir((await t3.leer(5, 64)).bytes)[0]!)).toMatchObject({ protocolo: 1, parche: 3, estadoEnFlujo: true });
  await t3.enviar(peticion(ORDEN_SUSCRIBIR, 2, FLUJO_ESTADO));
  const vistos = new Map<number, Uint8Array>();
  for (let k = 0; k < 40 && vistos.size < 3; k++) {
    for (const r of partir((await t3.leer(30, 64)).bytes)) {
      const e = leerEstado(r);
      if (!e) continue;
      expect(esEvento(r)).toBe(true);
      vistos.set(e.bloque, e.bytes);
    }
  }
  expect([...vistos.keys()].sort()).toEqual([ESTADO_GENERADOR, ESTADO_MEDIDAS_CH1, ESTADO_MEDIDAS_CH2]);
  expect(decodificarGenerador(vistos.get(ESTADO_GENERADOR)!)).toMatchObject({ nombre: 'Cuadrada', frecuencia: 15000 });
  const ch1 = vistos.get(ESTADO_MEDIDAS_CH1)!;
  expect(ch1.length).toBe(LARGO_MEDIDAS + 1);
  expect(decodificarMedidas(ch1)!.frecuencia).toBe(40232);
  // the byte after the measurements: 0, stopped
  expect(ch1[LARGO_MEDIDAS]).toBe(0);
  expect(decodificarMedidas(vistos.get(ESTADO_MEDIDAS_CH2)!)).toBeNull();
  // what is not a status event, and one with an impossible length
  expect(leerEstado(deHex(MULTIMETRO.pila9V!))).toBeNull();
  const malo = new Uint8Array(64);
  malo[0] = EVT_ESTADO;
  malo[3] = 60;
  expect(leerEstado(malo)).toBeNull();
  // the generator's block as the real unit with patch 3 sent it (2026-11-24): 40 kHz, 40 %, 1.5 V
  const real = new Uint8Array(64);
  real.set([EVT_ESTADO, 0x21, ESTADO_GENERADOR, 10, 0, 0, 0, 0, ...deHex('01010000409c0000280f')]);
  expect(decodificarGenerador(leerEstado(real)!.bytes)).toEqual({ forma: 1, nombre: 'Cuadrada', rotulo: 'Square Wave', frecuencia: 40000, ciclo: 40, amplitud: 1.5 });
});

test('las bases de tiempos de 1 µs a 2 ms por división están comprobadas; las de fuera, no', () => {
  const con = (indice: number) => {
    const b = deHex(MEMORIA.osciloscopioEnMarcha);
    b[45] = indice;
    return leerAjustes(b)!;
  };
  expect([con(9).tiempoDiv, con(9).tiempoComprobado]).toEqual([expect.closeTo(10e-6, 12), true]);
  // (5 µs and 20 µs: checked on the unit on 2026-11-25 with the generator at 50 kHz)
  expect([con(8).tiempoDiv, con(8).tiempoComprobado]).toEqual([expect.closeTo(5e-6, 12), true]);
  expect([con(10).tiempoDiv, con(10).tiempoComprobado]).toEqual([expect.closeTo(20e-6, 12), true]);
  expect([11, 12, 13, 14, 15, 16].every((i) => con(i).tiempoComprobado)).toBe(true);
  // (2 µs: checked later the same day, 50 kHz from the record against 50 kHz by the instrument)
  expect([con(7).tiempoDiv, con(7).tiempoComprobado]).toEqual([expect.closeTo(2e-6, 12), true]);
  // (1 µs: the edges of a 50 kHz wave 500 and 499 samples apart in two records of the unit)
  expect([con(6).tiempoDiv, con(6).tiempoComprobado]).toEqual([expect.closeTo(1e-6, 12), true]);
  // (one step outside at each end: 500 ns and 5 ms per division)
  expect([con(5).tiempoDiv, con(5).tiempoComprobado]).toEqual([expect.closeTo(500e-9, 15), false]);
  expect([con(17).tiempoDiv, con(17).tiempoComprobado]).toEqual([expect.closeTo(5e-3, 12), false]);
});

test('el enlace simulado de las pruebas responde como el real', async () => {
  const c: EnlaceFalso = { modo: 2, eventos: [Array.from(deHex(MULTIMETRO.pila9V!))] };
  const t = new Falso(c);
  expect(await t.abrir()).toContain('2C53T stock-link');
  await t.enviar(peticion(ORDEN_INFO, 1));
  let r = partir((await t.leer(5, 64)).bytes);
  expect(r.length).toBe(1);
  const info = leerInfo(r[0]!);
  expect(info).not.toBeNull();
  expect(info!.protocolo).toBe(1);
  expect(info!.modo).toBe('osciloscopio');
  expect(info!.flujo).toBe(0);
  // nothing flows before subscribing
  expect((await t.leer(5, 64)).bytes.length).toBe(0);
  await t.enviar(peticion(ORDEN_SUSCRIBIR, 2, FLUJO_MULTIMETRO));
  r = partir((await t.leer(5, 64)).bytes);
  expect(respuestaA(r[0]!, ORDEN_SUSCRIBIR, 2)).toEqual({ estado: 0 });
  expect(esTramaMultimetro(r[1]!)).toBe(true);
  expect(c.suscripciones).toEqual([FLUJO_MULTIMETRO]);
  expect(c.aperturas).toBe(1);
  c.desenchufado = 'Se ha perdido la conexión con el FNIRSI.';
  await expect(t.leer(5, 64)).rejects.toThrow('Se ha perdido');
});
