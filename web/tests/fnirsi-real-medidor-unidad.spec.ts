// 1.4 «instrumentos14»: the real FNIRSI 2C53T as a meter (its multimeter in place of the real Brymen in the checks of
// the practices, the guided lab and the lessons' «En el banco») and next to the simulated FNIRSI (lib/fnirsi-real/
// comparar.ts), on real captures (fnirsi-real-datos.ts). No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-medidor-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { decodificarMultimetro, type LecturaFnirsi } from '../src/lib/fnirsi-real/multimetro.ts';
import { compararTraza, explicarDiferenciaFnirsi, pantallaFnirsiPara, porQueNoFnirsi, resolucion, tomarFnirsi, type EstadoFnirsiReal } from '../src/lib/fnirsi-real/comparar.ts';
import { EnsambladorOsciloscopio, type Traza } from '../src/lib/fnirsi-real/osciloscopio.ts';
import { MULTIMETRO, REGISTRO_CH1, REGISTRO_PAR_CH1, REGISTRO_PAR_CH2 } from './fnirsi-real-datos.ts';
import { exactitudFnirsi } from '../src/lib/registro-real/comparar.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

const deHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const lectura = (caso: string) => decodificarMultimetro(deHex(MULTIMETRO[caso]!));
const conectado = (l: LecturaFnirsi | null, modo: EstadoFnirsiReal['modo'] = 'multimetro'): EstadoFnirsiReal => ({ estado: 'conectado', modo, multimetroVigente: () => l });

function traza(registro: string, canal: 0 | 1): Traza {
  const b = Array.from(Buffer.from(registro, 'base64'));
  const e = new EnsambladorOsciloscopio();
  const informe = (cab: number[], datos: number[]) => {
    const r = new Array<number>(64).fill(0);
    cab.forEach((x, k) => (r[k] = x));
    datos.forEach((x, k) => (r[8 + k] = x));
    return Uint8Array.from(r);
  };
  let t: Traza | null = e.recibir(informe([0xa0, 1, canal, 56, 0, 0, 0, 0], b.slice(0, 56)));
  for (let d = 0; d < 1024; d += 56) {
    const n = Math.min(56, 1024 - d);
    t = e.recibir(informe([0xa1, 1, canal, n, d & 0xff, d >> 8, 0, 0], b.slice(56 + d, 56 + d + n))) ?? t;
  }
  return t!;
}

test('una lectura que no es fiable lleva aviso y no sirve de medida; la del diodo ya sirve', () => {
  // the 9 V battery's frame with a firmware unit code the app does not know
  const f = deHex(MULTIMETRO.pila9V!);
  expect(f[24 + 16]).toBe(1);
  f[24 + 16] = 0x7f;
  const l = decodificarMultimetro(f);
  expect(l.pantalla.unidad).toBe('V');
  expect(l.fiable).toBe(false);
  expect(l.motivo).toContain('todavía no conoce');
  // and so it never stands in for a measurement
  expect(pantallaFnirsiPara(l, 'V')).toBeNull();
  expect(porQueNoFnirsi(conectado(l), 'V')).toContain('no se usa para comprobar');
  // the diode function (a LED on the real unit, 2026-11-24): a forward voltage, in volts
  const d = lectura('diodoLed');
  expect([d.funcion, d.fiable]).toEqual(['diodo', true]);
  expect(pantallaFnirsiPara(d, 'V')?.valor).toBeCloseTo(1.811, 12);
});

test('como medidor: solo una lectura fiable, en la unidad que pide la medida', () => {
  const pila = lectura('pila9V');
  expect(pila.fiable).toBe(true);
  const t = tomarFnirsi(conectado(pila), 'V');
  expect('pantalla' in t && t.pantalla.valor).toBeCloseTo(9.201, 6);
  // another unit, OL, Auto with nothing at the probes, a reading that is not reliable, the oscilloscope, disconnected
  expect(tomarFnirsi(conectado(pila), 'Ω')).toEqual({ aviso: expect.stringContaining('en V y esta medida va en Ω') });
  expect(tomarFnirsi(conectado(lectura('ohmOL')), 'Ω')).toEqual({ aviso: expect.stringContaining('OL') });
  expect(tomarFnirsi(conectado(lectura('autoEsperando')), 'V')).toEqual({ aviso: expect.stringContaining('Auto') });
  expect(tomarFnirsi(conectado(lectura('capacidadTransicion')), 'F')).toEqual({ aviso: expect.stringContaining('no dan la misma unidad') });
  expect(tomarFnirsi(conectado(pila, 'osciloscopio'), 'V')).toEqual({ aviso: expect.stringContaining('póngalo en multímetro') });
  expect(tomarFnirsi({ ...conectado(pila), estado: 'reconectando' }, 'V')).toEqual({ aviso: 'Su FNIRSI no está conectado.' });
  expect(tomarFnirsi(conectado(null), 'V')).toEqual({ aviso: expect.stringContaining('todavía no ha enviado') });
  // 10 kΩ in the resistance function
  const r = tomarFnirsi(conectado(lectura('ohm10k')), 'Ω');
  expect('pantalla' in r && r.pantalla.unidad).toBe('Ω');
});

test('la diferencia con el simulado: sin inventar la exactitud del FNIRSI', () => {
  const p = lectura('pila9V').pantalla;
  expect(resolucion(p)).toBeCloseTo(0.001, 12);
  const igual = explicarDiferenciaFnirsi(p, p.valor!, 'el simulado', 'V');
  expect(igual).toMatch(/^Su circuito da 9,201\sV en el FNIRSI; el simulado, 9,201\sV: coinciden\.$/);
  // one unit of the last digit: the display's resolution
  const uno = explicarDiferenciaFnirsi(p, 9.2, 'el simulado', 'V');
  expect(uno).toContain('una unidad de la última cifra');
  // a larger one: no claim about how much is the instrument's
  const otra = explicarDiferenciaFnirsi(p, 9.0, 'lo esperado (libro)', 'V');
  expect(otra).toContain('lo esperado (libro), 9,000');
  expect(otra).toContain('(2,2 %)');
  expect(otra).toContain('no tiene la exactitud del multímetro del FNIRSI');
  expect(otra).not.toMatch(/es del circuito real|las dos medidas son la misma/);
});

test('1.4.2: con la lectura, la diferencia se mide contra la exactitud de la escala, la misma del registrador', () => {
  const l = lectura('pila9V');
  const p = l.pantalla;
  const { incertidumbre, escala } = exactitudFnirsi(l);
  expect(incertidumbre).not.toBeNull();
  const u = incertidumbre!;
  // inside what the instrument may be off on that range (but more than the last digit)
  const dentro = explicarDiferenciaFnirsi(p, p.valor! - u * 0.8, 'el simulado', 'V', l);
  expect(dentro).toContain(`Cabe en lo que el propio FNIRSI puede equivocarse en la escala de ${escala}`);
  expect(dentro).toContain('según su fabricante');
  expect(dentro).toContain('las dos medidas son la misma');
  // outside it: the difference is the real circuit's
  const fuera = explicarDiferenciaFnirsi(p, 9.0, 'lo esperado (libro)', 'V', l);
  expect(fuera).toContain(`Es mayor que lo que el FNIRSI puede equivocarse en la escala de ${escala}`);
  expect(fuera).toContain('es del circuito real');
  expect(fuera).not.toContain('no tiene la exactitud');
  // the last digit still comes first
  expect(explicarDiferenciaFnirsi(p, 9.2, 'el simulado', 'V', l)).toContain('una unidad de la última cifra');
});

test('las trazas del FNIRSI real frente a las medidas del FNIRSI simulado', () => {
  const t = traza(REGISTRO_CH1, 0);
  // the generator's 1 kHz square wave, about 3 V peak to peak: against a simulated 3,00 V and 1 kHz
  const s = compararTraza(t, { vpp: 3.0, f: 1000 });
  expect(s).toMatch(/^CH1: Vpp de 3,\d\d\sV en el FNIRSI; el simulado, 3,00\sV/);
  expect(s).toContain('Frecuencia de ');
  expect(s).toMatch(/el simulado, 1,000\skHz: coinciden\./);
  // 500 mV/div: one sample is 20 mV, and a difference of up to two samples is the screen's resolution
  expect(s).toMatch(/1\/25 de división \(20,0\smV en esta escala\)|vale 20,0\smV en esta escala/);
  expect(s).not.toContain('sin comprobar');
  // CH2 clipped at both rails: its Vpp is not compared; its scale is not checked
  const c2 = compararTraza(traza(REGISTRO_PAR_CH2, 1), { vpp: 3.0, f: 1000 });
  expect(c2).toContain('se sale de la escala');
  expect(c2).not.toContain('Vpp de');
  // CH1 flat: no frequency to compare
  const c1 = compararTraza(traza(REGISTRO_PAR_CH1, 0), { vpp: 0, f: null });
  expect(c1).toMatch(/^CH1: Vpp de /);
  expect(c1).not.toContain('Frecuencia');
});
