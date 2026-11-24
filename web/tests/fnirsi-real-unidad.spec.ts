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
  EVT_OSC_CABECERA,
  EVT_OSC_DATOS,
  FLUJO_MULTIMETRO,
  FLUJO_OSCILOSCOPIO,
  INFORME,
  ORDEN_INFO,
  ORDEN_SUSCRIBIR,
  esEvento,
  leerInfo,
  partir,
  peticion,
  respuestaA,
} from '../src/lib/fnirsi-real/protocolo.ts';
import { Falso, type EnlaceFalso } from '../src/lib/fnirsi-real/transporte.ts';
import { MULTIMETRO, REGISTRO_CH1, REGISTRO_PAR_CH1, REGISTRO_PAR_CH2 } from './fnirsi-real-datos.ts';

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
  // the diode function: only its «.0L» has been seen on the real unit
  const d = lectura('diodoAbierto');
  expect([d.funcion, d.pantalla.ol, d.pantalla.unidad]).toEqual(['diodo', true, 'V']);
  expect(d.fiable).toBe(false);
  expect(d.motivo).toContain('diodo');
});

test('alterna y capacidad, comprobadas en el aparato el 24-11-2026', () => {
  // alternating: nothing in the frame says so, the function does
  const v = lectura('acvCero');
  expect([v.funcion, v.pantalla.texto, v.pantalla.unidad, v.pantalla.prefijo, v.pantalla.decimales]).toEqual(['vac', '0.0000', 'V', '', 4]);
  expect([v.pantalla.ac, v.pantalla.dc, v.pantalla.valor, v.fiable]).toEqual([true, false, 0, true]);
  expect(textoPantalla(v.pantalla)).toBe('0,0000 V ∿');
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
  expect(c2!.ajustes.canales[1].comprobado).toBe(false);
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
