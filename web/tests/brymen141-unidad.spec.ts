// 1.4.1 (brymen141): the two fixes of the real Brymen found on a real record (24-11-2026).
// - A display with no figures (blank with the decimal point; the dashes of a range change) reads «— kΩ».
// - The pause between requests runs on a worker's clock (reloj.ts), which the browser does not slow down when the
//   window is covered; without a worker, or with one that fails or never answers, the page's own timer does it.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.brymen13.config.ts tests/brymen141-unidad.spec.ts
import { test, expect } from '@playwright/test';
import { textoPantalla } from '../src/lib/brymen-real/lectura.ts';
import type { PantallaReal } from '../src/lib/brymen-real/protocolo.ts';
import { MARGEN_MS, Reloj, type Mensajero } from '../src/lib/brymen-real/reloj.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

const pantalla = (texto: string, extra: Partial<PantallaReal> = {}): PantallaReal =>
  ({ texto, valor: null, unidad: 'Ω', prefijo: 'k', ol: false, ac: false, dc: false, ...extra }) as PantallaReal;

test('una pantalla sin cifras se escribe «— kΩ»; las cifras y las palabras, como siempre', () => {
  // the two cases of the real record: blank with the decimal point, and the dashes of a range change
  expect(textoPantalla(pantalla('.'))).toBe('— kΩ');
  expect(textoPantalla(pantalla('--.---'))).toBe('— kΩ');
  expect(textoPantalla(pantalla(''))).toBe('— kΩ');
  expect(textoPantalla(pantalla(' . '))).toBe('— kΩ');
  expect(textoPantalla(pantalla('-.---', { unidad: 'V', prefijo: '', dc: true }))).toBe('— V ⎓');
  expect(textoPantalla(pantalla('.', { unidad: '', prefijo: '' }))).toBe('—');
  // what was right stays as it was
  expect(textoPantalla(pantalla('05.070', { valor: 5070 }))).toBe('05,070 kΩ');
  expect(textoPantalla(pantalla('-12.53', { valor: -12.53e-3, unidad: 'V', prefijo: 'm', ac: true }))).toBe('−12,53 mV ∿');
  expect(textoPantalla(pantalla('.', { ol: true }))).toBe('OL');
  // a word on the display is not a blank one
  expect(textoPantalla(pantalla('OPEn', { unidad: '', prefijo: '' }))).toBe('OPEn');
});

/** A fake worker: answers each message after `ms` with the page's timer, or never, or fails. */
class Falso implements Mensajero {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  mensajes = 0;
  cerrado = false;
  constructor(private modo: 'responde' | 'calla' | 'falla') {}
  postMessage(m: { id: number; ms: number }): void {
    this.mensajes++;
    if (this.modo === 'responde') setTimeout(() => this.onmessage?.({ data: m.id }), m.ms);
    if (this.modo === 'falla') setTimeout(() => this.onerror?.(new Error('no se pudo cargar')), 5);
  }
  terminate(): void {
    this.cerrado = true;
  }
}

test('el reloj espera con el worker cuando lo hay', async () => {
  const w = new Falso('responde');
  const r = new Reloj(() => w);
  expect(r.tipo).toBe('sin-abrir');
  const t0 = Date.now();
  await r.esperar(60);
  await r.esperar(60);
  const dt = Date.now() - t0;
  expect(r.tipo).toBe('worker');
  expect(w.mensajes).toBe(2);
  expect(dt).toBeGreaterThanOrEqual(110);
  expect(dt).toBeLessThan(MARGEN_MS);
});

test('sin worker (Node), con uno que falla o con uno que no contesta, la espera termina igual', async () => {
  // Node has no Worker: the page's timer, as before 1.4.1
  const sin = new Reloj();
  await sin.esperar(20);
  expect(sin.tipo).toBe('pagina');

  // a worker that fails (e.g. a page not allowed to load it): the wait under way ends, the next ones go to the page
  const roto = new Falso('falla');
  const r = new Reloj(() => roto);
  const t0 = Date.now();
  await r.esperar(400);
  expect(Date.now() - t0).toBeLessThan(300);
  expect(r.tipo).toBe('pagina');
  expect(roto.cerrado).toBe(true);
  await r.esperar(20);
  expect(roto.mensajes).toBe(1);

  // a worker that never answers slows the loop down, never stops it
  const mudo = new Reloj(() => new Falso('calla'));
  const t1 = Date.now();
  await mudo.esperar(50);
  const dt = Date.now() - t1;
  expect(dt).toBeGreaterThanOrEqual(50 + MARGEN_MS - 20);
  expect(dt).toBeLessThan(50 + MARGEN_MS + 1000);
});
