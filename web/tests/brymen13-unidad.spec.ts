// 1.3 (brymen13): the decoder of the real Brymen BM869s's packets (web/src/lib/brymen-real/protocolo.ts) and the
// comparison with the simulated meter (comparar.ts). No real capture exists in sigrok-dumps, so the packets are built
// from the byte layout of libsigrok's src/dmm/bm86x.c: the first one by hand, bit by bit; the rest with
// construirPaquete, which the first test checks against the hand-made one.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c <config> tests/brymen13-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { buscarPaquete, caracter, construirPaquete, decodificar, paqueteValido, segmentosDe } from '../src/lib/brymen-real/protocolo.ts';
import { explicarDiferencia, incertidumbre, pantallaPara, porQueNo, textoCampo, textoPantalla } from '../src/lib/brymen-real/comparar.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

const paquete = (bytes: Record<number, number>) => {
  const p = new Uint8Array(24);
  p[16] = p[17] = p[18] = p[19] = 0x86;
  for (const [k, v] of Object.entries(bytes)) p[Number(k)] = v;
  return p;
};

test('cada código de segmentos de sigrok da su carácter', () => {
  // brymen_bm86x_parse_digit: (byte >> 1) → character
  const tabla: [number, string][] = [
    [0x20, '-'], [0x5f, '0'], [0x50, '1'], [0x6d, '2'], [0x7c, '3'], [0x72, '4'], [0x3e, '5'], [0x3f, '6'], [0x54, '7'],
    [0x7f, '8'], [0x7e, '9'], [0x0f, 'C'], [0x27, 'F'], [0x0b, 'L'], [0x79, 'd'], [0x10, 'i'], [0x39, 'o'], [0x00, ''],
  ];
  for (const [codigo, ch] of tabla) {
    expect(caracter(codigo << 1), `0x${codigo.toString(16)}`).toBe(ch);
    // bit 0 (decimal point or annunciator) does not change the digit
    expect(caracter((codigo << 1) | 1)).toBe(ch);
  }
  // bit 7 is segment b, bit 1 is segment e (order bgcdafe)
  expect(segmentosDe(0x80)).toBe('b');
  expect(segmentosDe(0x02)).toBe('e');
  expect(caracter(0x02 | 0x04)).toBe('?');
});

test('un paquete hecho a mano: 4,8712 V en continua, AUTO', () => {
  // main cells 3…8: blank, 4, .8, 7, 1, 2 (+ bit 0 of cell 8 = V); byte 1: AUTO (0x01) and DC (0x10)
  const p = paquete({ 1: 0x11, 3: 0x00, 4: 0x72 << 1, 5: (0x7f << 1) | 1, 6: 0x54 << 1, 7: 0x50 << 1, 8: (0x6d << 1) | 1 });
  expect(paqueteValido(p)).toBe(true);
  const l = decodificar(p);
  expect(l.principal.texto).toBe('4.8712');
  expect(l.principal.valor).toBeCloseTo(4.8712, 10);
  expect(l.principal.unidad).toBe('V');
  expect(l.principal.prefijo).toBe('');
  expect(l.principal.dc).toBe(true);
  expect(l.principal.ac).toBe(false);
  expect(l.principal.decimales).toBe(4);
  expect(l.auto).toBe(true);
  expect(l.hold).toBe(false);
  expect(l.secundaria).toBeNull();
  // the encoder used by the other tests and the fake cable makes the same bytes
  expect(Array.from(construirPaquete({ principal: '4.8712', unidad: 'V', dc: true, auto: true }))).toEqual(Array.from(p));
  expect(textoPantalla(l.principal)).toBe('4,8712 V ⎓');
  expect(textoCampo(l.principal)).toBe('4,8712 V');
});

test('signo, prefijos, alterna y la pantalla secundaria', () => {
  let l = decodificar(construirPaquete({ principal: '-12.53', unidad: 'mV', ac: true, secundaria: '50.00', unidadSecundaria: 'Hz' }));
  expect(l.principal.valor).toBeCloseTo(-12.53e-3, 12);
  expect(l.principal.prefijo).toBe('m');
  expect(l.principal.ac).toBe(true);
  expect(l.secundaria?.unidad).toBe('Hz');
  expect(l.secundaria?.valor).toBeCloseTo(50, 10);
  expect(textoPantalla(l.principal)).toBe('−12,53 mV ∿');

  l = decodificar(construirPaquete({ principal: '3.1970', unidad: 'kΩ' }));
  expect(l.principal.unidad).toBe('Ω');
  expect(l.principal.valor).toBeCloseTo(3197, 6);

  l = decodificar(construirPaquete({ principal: '100.32', unidad: 'µF' }));
  expect(l.principal.unidad).toBe('F');
  expect(l.principal.valor).toBeCloseTo(100.32e-6, 15);

  l = decodificar(construirPaquete({ principal: '0.6125', unidad: 'mA', dc: true, secundaria: '-1.2', unidadSecundaria: 'mA' }));
  expect(l.principal.unidad).toBe('A');
  expect(l.principal.valor).toBeCloseTo(0.6125e-3, 15);
  expect(l.secundaria?.valor).toBeCloseTo(-1.2e-3, 15);

  l = decodificar(construirPaquete({ principal: '1.2340', unidad: 'MΩ', hold: true, rel: true, bateriaBaja: true }));
  expect(l.principal.valor).toBeCloseTo(1.234e6, 3);
  expect(l.hold && l.rel && l.bateriaBaja).toBe(true);
});

test('OL, la prueba de diodos y los dBm', () => {
  let l = decodificar(construirPaquete({ principal: '0.L', unidad: 'MΩ' }));
  expect(l.principal.ol).toBe(true);
  expect(l.principal.valor).toBeNull();
  expect(textoPantalla(l.principal)).toBe('OL');
  expect(porQueNo(l, 'Ω')).toContain('OL');

  // diode test: the secondary display spells «diod»; the main one is in V and counts as DC
  l = decodificar(construirPaquete({ principal: '0.5312', unidad: 'V', secundaria: 'diod' }));
  expect(l.diodo).toBe(true);
  expect(l.principal.dc).toBe(true);
  expect(l.secundaria?.valor).toBeNull();

  // dBm: byte 15 0x02, and its «m» (0x04) is not the milli prefix
  l = decodificar(paquete({ 5: 0x5f << 1, 6: (0x7f << 1) | 1, 7: 0x50 << 1, 8: 0x6d << 1, 15: 0x02 | 0x04 }));
  expect(l.principal.unidad).toBe('dBm');
  expect(l.principal.prefijo).toBe('');
  expect(l.principal.valor).toBeCloseTo(0.812, 10);
});

test('MIN, MAX y AVG a la vez no cuentan; la temperatura lleva su unidad en la última celda', () => {
  const l = decodificar(paquete({ 1: 0xe0, 4: 0x50 << 1, 5: 0x6d << 1, 6: (0x7c << 1) | 1, 7: 0x72 << 1, 8: 0x0f << 1, 2: 0x0a }));
  expect(l.max || l.min || l.media).toBe(false);
  expect(l.principal.unidad).toBe('°C');
  expect(l.principal.valor).toBeCloseTo(12.34, 10);
  const m = decodificar(paquete({ 1: 0x20 }));
  expect(m.max).toBe(true);
});

test('el paquete se encuentra aunque llegue desplazado o a trozos, y uno roto no se decodifica', () => {
  const p = construirPaquete({ principal: '2.8800', unidad: 'V', dc: true });
  const flujo = Uint8Array.from([0x01, 0x02, 0x03, ...p, 0x09]);
  const r = buscarPaquete(flujo);
  expect(Array.from(r.paquete!)).toEqual(Array.from(p));
  expect(Array.from(r.resto)).toEqual([0x09]);
  // half a packet: none yet, and the bytes are kept to be completed
  const a = buscarPaquete(p.slice(0, 16));
  expect(a.paquete).toBeNull();
  const b = buscarPaquete(Uint8Array.from([...a.resto, ...p.slice(16)]));
  expect(b.paquete).not.toBeNull();
  const roto = p.slice();
  roto[17] = 0x00;
  expect(paqueteValido(roto)).toBe(false);
  expect(() => decodificar(roto)).toThrow();
  expect(buscarPaquete(roto).paquete).toBeNull();
});

test('qué pantalla responde a cada unidad', () => {
  const l = decodificar(construirPaquete({ principal: '1.2345', unidad: 'V', ac: true, secundaria: '13.9', unidadSecundaria: 'Hz' }));
  expect(pantallaPara(l, 'V')?.valor).toBeCloseTo(1.2345, 10);
  expect(pantallaPara(l, 'Hz')?.valor).toBeCloseTo(13.9, 10);
  expect(pantallaPara(l, 'A')).toBeNull();
  expect(porQueNo(l, 'A')).toContain('en V');
  expect(pantallaPara(null, 'V')).toBeNull();
});

test('la incertidumbre del Brymen y la explicación de la diferencia', () => {
  // DCV, 5 V range: ± (0,02 % + 2 counts), a count = 0,1 mV (manual, as the simulated meter in dmm.ts)
  const l = decodificar(construirPaquete({ principal: '4.8712', unidad: 'V', dc: true }));
  const u = incertidumbre(l.principal, l)!;
  expect(u).toBeCloseTo(0.0002 * 4.8712 + 2e-4, 12);
  // 500 000-count mode (one more digit): no accuracy known, said so
  const alta = decodificar(construirPaquete({ principal: '4.87123', unidad: 'V', dc: true }));
  expect(incertidumbre(alta.principal, alta)).toBeNull();
  // resistance, 5 kΩ range: ± (0,07 % + 2), a count = 0,1 Ω
  const r = decodificar(construirPaquete({ principal: '3.1970', unidad: 'kΩ' }));
  expect(incertidumbre(r.principal, r)!).toBeCloseTo(0.0007 * 3197 + 0.2, 9);

  const lejos = explicarDiferencia(4.87, u, 5, 'el simulado', 'V');
  expect(lejos).toContain('Su circuito da 4,870 V; el simulado, 5,000 V');
  expect(lejos).toContain('2,6 %');
  expect(lejos).toContain('no del instrumento');
  const cerca = explicarDiferencia(4.8712, u, 4.8705, 'el simulado', 'V');
  expect(cerca).toContain('las dos medidas son la misma');
  expect(explicarDiferencia(4.87123, null, 5, 'lo esperado', 'V')).toContain('no se puede decir');
});
