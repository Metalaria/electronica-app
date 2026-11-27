// 2.1 (owner's request of 25-11): the drawn Brymen's selector follows the real BM869s. brymen/sigueReal.ts infers the
// selector position and SELECT's sub-function from a decoded frame (unit, prefix, AC/DC, the secondary display, the
// diode and continuity flags). Every position and sub-function of motor/dmm.ts (BM_POSICIONES) is checked here with a
// frame built from the documented layout (protocolo.ts construirPaquete, as in tests/brymen13-unidad.spec.ts), the
// ones the frame cannot tell apart (VFD V∿ / V∿, dBm of V∿ / mV∿) included, and «no reading» leaves the dial alone.
// The Brymen model's `seguir` puts the dial there as a hand would.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.taller21.config.ts tests/taller21-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { construirPaquete, decodificar, type Simulacion } from '../src/lib/brymen-real/protocolo.ts';
import { inferirPosicion, claveInferida } from '../src/componentes/instrumentos/brymen/sigueReal.ts';
import { BM_POSICIONES } from '../src/componentes/instrumentos/motor/dmm.ts';
import { funcionQueSigue, modoQueSigue, SIN_FLUJO } from '../src/componentes/instrumentos/fnirsi/sigueReal.ts';
import { FN_DMM_LISTA } from '../src/componentes/instrumentos/fnirsi/logica.svelte.ts';
import { decodificarMultimetro } from '../src/lib/fnirsi-real/multimetro.ts';
import { MULTIMETRO } from './fnirsi-real-datos.ts';
import { Falso } from '../src/lib/fnirsi-real/transporte.ts';
import { ORDEN_INFO, ORDEN_LEER, ORDEN_ONDA, ORDEN_SUSCRIBIR, RECHAZO_NATIVO, peticion, peticionLeer, peticionOnda, permitidaEnLaAplicacion } from '../src/lib/fnirsi-real/protocolo.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

/**
 * A decoded frame of what is given, with extra bytes OR-ed in (flags construirPaquete does not write). (The last cell of
 * the main display has no decimal point — its bit 0 is the V annunciator — so no value here has a point before its
 * last digit.)
 */
function lectura(s: Simulacion, extra: Record<number, number> = {}) {
  const p = construirPaquete(s);
  for (const [k, v] of Object.entries(extra)) p[Number(k)]! |= v;
  return decodificar(p);
}

/** «posición/sub-función» of the inference, by ids («vac/0»), and its ambiguity line. */
function donde(s: Simulacion, extra: Record<number, number> = {}) {
  const x = inferirPosicion(lectura(s, extra));
  if (!x) return null;
  const pos = BM_POSICIONES[x.pos]!;
  return { id: `${pos.id}/${x.sub}`, sub: pos.subs[x.sub], dudosa: x.dudosa };
}

test('cada posición y subfunción del selector se reconoce en la trama del Brymen real', () => {
  // [what the real display shows, extra flag bytes, expected position/sub, its [primary, secondary] in BM_POSICIONES]
  const casos: [Simulacion, Record<number, number>, string, [string, string | null]][] = [
    // V⎓: plain, with V∿ under it, AC+DC with V∿ under it
    [{ principal: '4.8712', unidad: 'V', dc: true, auto: true }, {}, 'vdc/0', ['vdc', null]],
    [{ principal: '4.8712', unidad: 'V', dc: true, secundaria: '0.012', unidadSecundaria: 'V', acSecundaria: true }, {}, 'vdc/1', ['vdc', 'vac']],
    [{ principal: '4.8800', unidad: 'V', ac: true, dc: true, secundaria: '0.012', unidadSecundaria: 'V', acSecundaria: true }, {}, 'vdc/2', ['vacdc', 'vac']],
    // mV⎓: plain, with mV∿, AC+DC, the line-level counter (Hz alone), duty cycle (%)
    [{ principal: '12.345', unidad: 'mV', dc: true }, {}, 'mvdc/0', ['mvdc', null]],
    [{ principal: '12.345', unidad: 'mV', dc: true, secundaria: '1.23', unidadSecundaria: 'mV', acSecundaria: true }, {}, 'mvdc/1', ['mvdc', 'mvac']],
    [{ principal: '12.400', unidad: 'mV', ac: true, dc: true, secundaria: '1.23', unidadSecundaria: 'mV', acSecundaria: true }, {}, 'mvdc/2', ['mvacdc', 'mvac']],
    [{ principal: '50.00', unidad: 'Hz' }, {}, 'mvdc/3', ['hzlog', null]],
    [{ principal: '55.00', unidad: '%' }, {}, 'mvdc/4', ['ciclo', null]],
    // V∿ (VFD V∿ sends the same): plain with Hz, dBm with Hz, Hz with V∿
    [{ principal: '230.00', unidad: 'V', ac: true, secundaria: '50.0', unidadSecundaria: 'Hz' }, {}, 'vac/0', ['vac', 'hz']],
    [{ principal: '-2.21', unidad: 'dBm', secundaria: '1000', unidadSecundaria: 'Hz' }, {}, 'vac/1', ['dbm', 'hz']],
    [{ principal: '50.00', unidad: 'Hz', secundaria: '230', unidadSecundaria: 'V', acSecundaria: true }, {}, 'vac/2', ['hz', 'vac']],
    // mV∿: plain with Hz, Hz with mV∿
    [{ principal: '35.20', unidad: 'mV', ac: true, secundaria: '1000', unidadSecundaria: 'Hz' }, {}, 'mvac/0', ['mvac', 'hz']],
    [{ principal: '1000.00', unidad: 'Hz', secundaria: '35.2', unidadSecundaria: 'mV', acSecundaria: true }, {}, 'mvac/2', ['hz', 'mvac']],
    // temperature: «23.4C» with the temperature bits of byte 2
    [{ principal: '23.4C' }, { 2: 0x0a }, 'temp/0', ['temp', null]],
    // capacitance, and the diode test («diod» on the secondary display)
    [{ principal: '10.05', unidad: 'nF' }, {}, 'cap/0', ['cap', null]],
    [{ principal: '4.700', unidad: 'µF' }, {}, 'cap/0', ['cap', null]],
    [{ principal: '0.6012', unidad: 'V', dc: true, secundaria: 'diod' }, {}, 'cap/1', ['diodo', null]],
    // resistance, continuity (bit 0 of byte 10), conductance (nS)
    [{ principal: '150.02', unidad: 'Ω', auto: true }, {}, 'ohm/0', ['ohm', null]],
    [{ principal: '4.7012', unidad: 'kΩ', auto: true }, {}, 'ohm/0', ['ohm', null]],
    [{ principal: '0L', unidad: 'MΩ' }, {}, 'ohm/0', ['ohm', null]],
    [{ principal: '12.30', unidad: 'Ω' }, { 10: 0x01 }, 'ohm/1', ['cont', null]],
    [{ principal: '12.34', unidad: 'nS' }, {}, 'ohm/2', ['ns', null]],
    // A mA (mA and A jacks): DC, DC with AC under it, AC+DC, AC with Hz, the 4–20 mA loop (% on the secondary)
    [{ principal: '12.530', unidad: 'mA', dc: true }, {}, 'amA/0', ['idc', null]],
    [{ principal: '2.5301', unidad: 'A', dc: true }, {}, 'amA/0', ['idc', null]],
    [{ principal: '12.530', unidad: 'mA', dc: true, secundaria: '0.10', unidadSecundaria: 'mA', acSecundaria: true }, {}, 'amA/1', ['idc', 'iac']],
    [{ principal: '12.600', unidad: 'mA', ac: true, dc: true, secundaria: '0.10', unidadSecundaria: 'mA', acSecundaria: true }, {}, 'amA/2', ['iacdc', 'iac']],
    [{ principal: '3.200', unidad: 'mA', ac: true, secundaria: '50.0', unidadSecundaria: 'Hz' }, {}, 'amA/3', ['iac', 'hz']],
    [{ principal: '12.000', unidad: 'mA', dc: true, secundaria: '50.0', unidadSecundaria: '%' }, {}, 'amA/4', ['lazo', 'idc']],
    // µA: the same four
    [{ principal: '123.45', unidad: 'µA', dc: true }, {}, 'ua/0', ['idc', null]],
    [{ principal: '123.45', unidad: 'µA', dc: true, secundaria: '1.2', unidadSecundaria: 'µA', acSecundaria: true }, {}, 'ua/1', ['idc', 'iac']],
    [{ principal: '123.50', unidad: 'µA', ac: true, dc: true, secundaria: '1.2', unidadSecundaria: 'µA', acSecundaria: true }, {}, 'ua/2', ['iacdc', 'iac']],
    [{ principal: '45.00', unidad: 'µA', ac: true, secundaria: '50.0', unidadSecundaria: 'Hz' }, {}, 'ua/3', ['iac', 'hz']],
  ];
  const vistas = new Set<string>();
  for (const [s, extra, esperado, funciones] of casos) {
    const d = donde(s, extra);
    expect(d?.id, JSON.stringify(s)).toBe(esperado);
    expect(d?.sub, esperado).toEqual(funciones);
    vistas.add(esperado);
  }
  // every position and sub-function is reached, except OFF (no frame) and the ones the frame cannot tell apart
  const todas = BM_POSICIONES.flatMap((p) => p.subs.map((_, i) => `${p.id}/${i}`));
  const imposibles = ['vfd/0', 'vfd/1', 'mvac/1'];
  expect(todas.filter((x) => !vistas.has(x) && !imposibles.includes(x))).toEqual([]);
});

test('lo que la trama no distingue se dice: VFD V∿ frente a V∿, y los dBm de V∿ frente a los de mV∿', () => {
  // VFD V∿ sends «V, AC» with Hz under it, as V∿ does: the plain V∿, said in one line
  const v = donde({ principal: '230.00', unidad: 'V', ac: true, secundaria: '50.0', unidadSecundaria: 'Hz' });
  expect(v?.id).toBe('vac/0');
  expect(v?.dudosa).toContain('VFD V∿ y V∿');
  const hz = donde({ principal: '50.00', unidad: 'Hz', secundaria: '230', unidadSecundaria: 'V', acSecundaria: true });
  expect(hz?.id).toBe('vac/2');
  expect(hz?.dudosa).toContain('VFD');
  // V∿ without the secondary display (too small a signal to count): still V∿
  expect(donde({ principal: '0.0012', unidad: 'V', ac: true })?.id).toBe('vac/0');
  // dBm: V∿ and mV∿ send the same
  const dbm = donde({ principal: '-2.21', unidad: 'dBm', secundaria: '1000', unidadSecundaria: 'Hz' });
  expect(dbm?.id).toBe('vac/1');
  expect(dbm?.dudosa).toContain('dBm');
  // what the frame does tell apart carries no line: mV∿ (the m prefix), and every other function
  expect(donde({ principal: '35.20', unidad: 'mV', ac: true, secundaria: '1000', unidadSecundaria: 'Hz' })?.dudosa).toBeNull();
  expect(donde({ principal: '4.8712', unidad: 'V', dc: true })?.dudosa).toBeNull();
});

test('sin lectura, sin unidad o con una combinación que el selector no tiene, el selector dibujado no se mueve', () => {
  expect(inferirPosicion(null)).toBeNull();
  // a blank display with no unit (a menu word, a setup screen)
  expect(donde({ principal: '' })).toBeNull();
  expect(donde({ principal: '----' })).toBeNull();
  // V with neither AC nor DC lit
  expect(donde({ principal: '1.0000', unidad: 'V' })).toBeNull();
  // Hz over a current: no such sub-function
  expect(donde({ principal: '50.00', unidad: 'Hz', secundaria: '1.2', unidadSecundaria: 'mA' })).toBeNull();
  expect(claveInferida(null)).toBe('');
  // OL keeps the function (the unit is still lit)
  expect(donde({ principal: '0L', unidad: 'V', dc: true })?.id).toBe('vdc/0');
  // HOLD, REL, AUTO do not change it
  expect(donde({ principal: '4.8712', unidad: 'V', dc: true, hold: true, rel: true, auto: true })?.id).toBe('vdc/0');
});

test('la clave cambia solo cuando cambia la función: el selector no pelea con una mano en el dial', () => {
  const a = inferirPosicion(lectura({ principal: '4.8712', unidad: 'V', dc: true }));
  const b = inferirPosicion(lectura({ principal: '1.2345', unidad: 'V', dc: true, auto: true }));
  const c = inferirPosicion(lectura({ principal: '150.02', unidad: 'Ω' }));
  expect(claveInferida(a)).toBe(claveInferida(b));
  expect(claveInferida(a)).not.toBe(claveInferida(c));
});

// ------------------------------------------------------------------ 2.1 (25-11): the drawn FNIRSI follows the real one

const trama = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

test('FNIRSI: el modo del real solo se sigue con el flujo de estado (parche 3); sin él, una línea dice por qué', () => {
  expect(modoQueSigue('conectado', true, 'multimetro')).toEqual({ modo: 'dmm', texto: 'Modo como el de su FNIRSI.' });
  expect(modoQueSigue('conectado', true, 'osciloscopio').modo).toBe('osc');
  expect(modoQueSigue('conectado', true, 'generador').modo).toBe('gen');
  expect(modoQueSigue('conectado', true, 'otro').modo).toBeNull();
  expect(modoQueSigue('conectado', true, null)).toEqual({ modo: null, texto: '' });
  expect(modoQueSigue('conectado', false, 'multimetro')).toEqual({ modo: null, texto: SIN_FLUJO });
  expect(modoQueSigue('reconectando', true, 'multimetro').modo).toBeNull();
  expect(modoQueSigue('conectado', null, null).texto).toBe('');
});

test('FNIRSI: el estado del multimetro trae entrada del menú, función y variante (bytes 5, 6 y 14 de los 40), en las tramas reales', () => {
  // single frames captured on the owner's unit (fnirsi-real-datos.ts), one per function of the key cycle
  const casos: [string, number, number, number][] = [
    ['autoEsperando', 0, 0, 0],
    ['resistenciaAuto', 0, 5, 0],
    ['pila9V', 1, 1, 1],
    ['acvCero', 1, 2, 2],
    ['diodoAbierto', 2, 4, 1],
    ['continuidadOL', 2, 3, 2],
    ['ohm10k', 3, 5, 1],
    ['capacidadCero', 4, 6, 1],
    ['temperatura23', 5, 7, 1],
    ['maNegativo', 6, 8, 1],
    ['acmACero', 6, 9, 2],
    ['aNegativo', 7, 10, 1],
    ['acACero', 7, 11, 2],
  ];
  for (const [nombre, entrada, funcion, variante] of casos) expect(decodificarMultimetro(trama(MULTIMETRO[nombre]!)).menu, nombre).toEqual({ entrada, funcion, variante });
});

test('FNIRSI: cada código de función del real lleva el multímetro dibujado a la suya, temperatura incluida (2.2); «nada aún» y lo desconocido no lo mueven', () => {
  const ids = new Set(FN_DMM_LISTA.map((f) => f.id));
  const esperado: Record<number, string> = { 1: 'vdc', 2: 'vac', 3: 'cont', 4: 'diodo', 5: 'ohm', 6: 'cap', 7: 'temp', 8: 'idc', 9: 'iac', 10: 'idc', 11: 'iac' };
  for (const [codigo, id] of Object.entries(esperado)) {
    const r = funcionQueSigue({ entrada: 1, funcion: Number(codigo), variante: 1 });
    expect(r, `código ${codigo}`).toEqual({ id, texto: '' });
    expect(ids.has(id), id).toBe(true);
  }
  // Auto follows Auto, whatever it has found at the probes
  expect(funcionQueSigue({ entrada: 0, funcion: 0, variante: 0 })).toEqual({ id: 'auto', texto: '' });
  expect(funcionQueSigue({ entrada: 0, funcion: 5, variante: 0 })).toEqual({ id: 'auto', texto: '' });
  // «none yet» outside Auto: nothing to follow, nothing said
  expect(funcionQueSigue({ entrada: 3, funcion: 0, variante: 1 })).toEqual({ id: null, texto: '' });
  // codes not documented
  for (const c of [12, 99, 255]) {
    const u = funcionQueSigue({ entrada: 1, funcion: c, variante: 1 });
    expect(u.id).toBeNull();
    expect(u.texto).toContain(`código ${c}`);
  }
  expect(funcionQueSigue(null)).toEqual({ id: null, texto: '' });
});

// ------------------------------------------------------------------ 2.1: the installed app's USB filter (patch 4)

test('filtro de la aplicación instalada: la onda a medida y la lectura de su tabla pasan; todo lo demás, no (los mismos bordes que en Rust)', () => {
  const p = (orden: number, argumento: number, x: number) => {
    const r = peticion(orden, 1, argumento);
    for (let k = 0; k < 4; k++) r[4 + k] = (x >>> (8 * k)) & 0xff;
    return r;
  };
  const inicio = 0x20000f5a;
  const fin = inicio + 200;
  expect(permitidaEnLaAplicacion(peticion(ORDEN_INFO, 1))).toBe(true);
  expect(permitidaEnLaAplicacion(peticion(ORDEN_SUSCRIBIR, 1, 3))).toBe(true);
  // the wave: 1 to 28 samples, position + samples <= 100
  for (const [n, x, si] of [[0, 0, false], [1, 0, true], [28, 0, true], [29, 0, false], [28, 72, true], [28, 73, false], [1, 99, true], [1, 100, false], [28, 0xffffffff, false]] as const)
    expect(permitidaEnLaAplicacion(p(ORDEN_ONDA, n, x)), `onda ${n} en ${x}`).toBe(si);
  // the read: 1 to 56 bytes, only inside the table
  for (const [n, x, si] of [[0, inicio, false], [1, inicio, true], [56, inicio, true], [57, inicio, false], [1, inicio - 1, false], [56, fin - 56, true], [56, fin - 55, false], [1, fin, false], [10, 0x20000f50, false], [16, 0x20000208, false], [56, 0xffffffff, false]] as const)
    expect(permitidaEnLaAplicacion(p(ORDEN_LEER, n, x)), `lectura ${n} en ${x.toString(16)}`).toBe(si);
  // any other order, even with arguments a wave or a read would take
  for (let o = 0; o < 256; o++) {
    if ([ORDEN_INFO, ORDEN_LEER, ORDEN_SUSCRIBIR, ORDEN_ONDA].includes(o)) continue;
    expect(permitidaEnLaAplicacion(p(o, 1, 0)), `orden ${o}`).toBe(false);
    expect(permitidaEnLaAplicacion(p(o, 1, inicio)), `orden ${o}`).toBe(false);
  }
});

test('el enlace falso «como la aplicación instalada» deja pasar la onda y la lectura de su tabla, y rechaza una lectura fuera de ella con la frase del conector', async () => {
  const f = new Falso({ comoNativo: true, parche: 4, modo: 3 });
  expect(f.tipo).toBe('nativo');
  await f.abrir();
  await expect(f.enviar(peticionOnda(1, 0, Array.from({ length: 28 }, () => 2047)))).resolves.toBeUndefined();
  await expect(f.enviar(peticionLeer(2, 0x20000f5a, 56))).resolves.toBeUndefined();
  // reads outside the wave table: the generator's settings, the oscilloscope's measurements, across the table's end
  await expect(f.enviar(peticionLeer(3, 0x20000f50, 10))).rejects.toThrow(RECHAZO_NATIVO);
  await expect(f.enviar(peticionLeer(4, 0x20000208, 48))).rejects.toThrow(RECHAZO_NATIVO);
  await expect(f.enviar(peticionLeer(5, 0x20000f5a + 150, 56))).rejects.toThrow(RECHAZO_NATIVO);
  await expect(f.enviar(peticion(0x05, 6, 1))).rejects.toThrow(RECHAZO_NATIVO);
  // the same reads through the browser's link (not the installed app) are not filtered
  const navegador = new Falso({ parche: 4, modo: 3 });
  await navegador.abrir();
  await expect(navegador.enviar(peticionLeer(7, 0x20000f50, 10))).resolves.toBeUndefined();
});
