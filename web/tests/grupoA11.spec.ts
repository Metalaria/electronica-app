// 0.11 «group A»: learning feedback and motivation.
//   - sound and vibration on answers, lessons, levels and achievements, each switchable in «Aa» (persisted; the
//     AudioContext and navigator.vibrate are stubbed to count what is played);
//   - XP rules and level math (pure, in Node), XP awarded by a lesson (answers and completion), the end-of-lesson
//     celebration and the toasts; achievements unlocked from seeded data and live;
//   - migration of 0.10 data (nothing rewritten, the earlier work credited once), synchronisation round-trip of the
//     XP ledger, achievements and passed lessons between two «devices» (GitHub mocked);
//   - thematic courses: every listed chapter exists, none missing, the duplicates reported; the «Cursos» pages;
//   - the placement test: skip, answer, recommendation, «superada por la prueba» (no XP) and «Deshacer», repeat;
//   - the daily reminder in «Aa» («Solo en Android» on desktop; on an Android user agent with the Tauri bridge
//     stubbed: permission, the plugin's notify with a daily schedule, another time, denial, off);
//   - a guided breadboard circuit gives its XP and achievements; reduced motion turns the animations off;
//   - screenshots of the new screens (tablet 800 × 1280 and phone 412 px, light and dark) in tests/capturas/grupoA11/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.grupoA.config.ts tests/grupoA11.spec.ts
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { XP, nivelDe, nombreNivel, umbralNivel, xpEjercicio, xpObjetivo, xpRespuesta, NOMBRES_NIVEL } from '../src/lib/aprendizaje/niveles.ts';
import { CURSOS, leccionesDeCurso, preguntasPrueba, repartoPrueba, verificarCursos } from '../src/lib/aprendizaje/cursos.ts';
import { LOGROS } from '../src/lib/aprendizaje/logros.ts';
import { grupoDe, totalDia, type DiaProgreso } from '../src/lib/progreso-dias.ts';
import type { Indice, InfoParte } from '../src/lib/tipos.ts';
import { mezclarPartes } from '../src/lib/partes-extra.ts';

const LIBRO = new URL('../public/libro/', import.meta.url);
const leerJson = <T>(ruta: string): T => JSON.parse(readFileSync(new URL(ruta, LIBRO), 'utf8')) as T;
const INDICE = leerJson<Indice>('indice.json');
const CAPTURAS = new URL('./capturas/grupoA11/', import.meta.url).pathname;
mkdirSync(CAPTURAS, { recursive: true });

const TABLETA = { width: 800, height: 1280 };
const MOVIL = { width: 412, height: 915 };

interface PreguntaJson {
  id: string;
  tipo: 'opcion' | 'numero';
  opciones?: string[];
  correcta?: number;
  valor?: number;
  ref: string;
}
const cuestionarios = new Map<string, PreguntaJson[]>();
const cuestionario = (p: string) => cuestionarios.get(p) ?? cuestionarios.set(p, leerJson<{ preguntas: PreguntaJson[] }>(`repaso/${p}.json`).preguntas).get(p)!;
const plano = (h: string) =>
  h
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Review day key (the day starts at 04:00), k days ago. */
function dia(k: number): string {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  d.setDate(d.getDate() - k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Stubs Web Audio and navigator.vibrate to count what is played; seeds localStorage once per context. */
async function preparar(ctx: BrowserContext | Page, datos: Record<string, unknown> = {}): Promise<void> {
  await ctx.addInitScript((d) => {
    const w = window as unknown as Record<string, unknown>;
    w.__notas = [] as number[];
    w.__vibraciones = [] as unknown[];
    w.__epaEventos = [];
    class Param {
      value = 0;
      setValueAtTime(v: number) {
        this.value = v;
        return this;
      }
      exponentialRampToValueAtTime() {
        return this;
      }
      setTargetAtTime() {
        return this;
      }
    }
    class Nodo {
      connect(n: unknown) {
        return n;
      }
      disconnect() {}
    }
    class Oscilador extends Nodo {
      type = 'sine';
      frequency = new Param();
      onended: null | (() => void) = null;
      start() {
        (w.__notas as number[]).push(this.frequency.value);
      }
      stop() {}
    }
    class Ganancia extends Nodo {
      gain = new Param();
    }
    class Contexto {
      state = 'running';
      currentTime = 0;
      destination = new Nodo();
      createOscillator() {
        return new Oscilador();
      }
      createGain() {
        return new Ganancia();
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }
    }
    w.AudioContext = Contexto;
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (p: unknown) => {
        (w.__vibraciones as unknown[]).push(p);
        return true;
      },
    });
    if (sessionStorage.getItem('grupoA-sembrado')) return;
    sessionStorage.setItem('grupoA-sembrado', '1');
    for (const [k, v] of Object.entries(d)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
  }, datos);
}

const leer = <T>(page: Page, clave: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(`epa:${k}`) ?? 'null'), clave) as Promise<T>;
const notas = (page: Page) => page.evaluate(() => (window as unknown as { __notas: number[] }).__notas.length);
const vibraciones = (page: Page) => page.evaluate(() => (window as unknown as { __vibraciones: unknown[] }).__vibraciones.length);

interface Libro {
  version: number;
  xp: Record<string, { x: number; t: number }>;
  logros: Record<string, number>;
}
const totalXp = (l: Libro | null) => Object.values(l?.xp ?? {}).reduce((n, p) => n + p.x, 0);

async function abrirAjustes(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Tema y tamaño de letra' })).toBeVisible();
}

/** Answers the Repaso question on screen, right or wrong, from the book's quiz data. */
async function responderPregunta(page: Page, bien: boolean): Promise<void> {
  const caja = page.locator('[data-pregunta]').first();
  const id = (await caja.getAttribute('data-pregunta'))!;
  const q = cuestionario(id.split('-')[0]!).find((x) => x.id === id)!;
  if (q.tipo === 'opcion') {
    const objetivo = plano(q.opciones![q.correcta!]!);
    const botones = caja.locator('button.opcion');
    const n = await botones.count();
    const textos: string[] = [];
    for (let i = 0; i < n; i++) textos.push(plano((await botones.nth(i).locator('.txt').textContent()) ?? ''));
    let k = textos.findIndex((t) => t === objetivo);
    if (k < 0) k = textos.findIndex((t) => t.includes(objetivo.slice(0, 25)) || objetivo.includes(t.slice(0, 25)));
    expect(k, `opción correcta de ${id}`).toBeGreaterThanOrEqual(0);
    await botones.nth(bien ? k : (k + 1) % n).click();
  } else {
    await caja.locator('[data-numero]').fill(bien ? String(q.valor).replace('.', ',') : '987654321');
    await caja.locator('[data-comprobar]').click();
  }
  await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', bien ? 'bien' : 'mal');
}

// ------------------------------------------------------------------ pure rules (Node)

test.describe('reglas de XP, niveles y cursos (sin navegador)', () => {
  test('XP por respuesta, ejercicio y objetivo', () => {
    expect(xpRespuesta(1, 0)).toBe(XP.acierto);
    expect(xpRespuesta(2, 0)).toBe(XP.aciertoConAyuda);
    expect(xpRespuesta(1, 1)).toBe(XP.aciertoConAyuda);
    expect(XP.aciertoConAyuda).toBeLessThan(XP.acierto);
    expect(xpEjercicio({ fallos: 0, pistas: 0, solucion: false })).toBe(XP.ejercicio);
    expect(xpEjercicio({ fallos: 1, pistas: 0, solucion: false })).toBe(XP.ejercicioConAyuda);
    expect(xpEjercicio({ fallos: 0, pistas: 2, solucion: false })).toBe(XP.ejercicioConAyuda);
    expect(xpEjercicio({ fallos: 0, pistas: 0, solucion: true })).toBe(0);
    expect(xpObjetivo(1)).toBe(XP.objetivo);
    expect(xpObjetivo(4)).toBe(XP.objetivo + 3 * XP.rachaExtra);
    expect(xpObjetivo(100)).toBe(XP.objetivo + XP.rachaTope * XP.rachaExtra);
  });

  test('umbrales y nombres de nivel', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(umbralNivel)).toEqual([0, 100, 250, 450, 700, 1000, 1350]);
    // each level is 50 XP longer than the previous one
    for (let n = 2; n < 60; n++) expect(umbralNivel(n + 1) - umbralNivel(n) - (umbralNivel(n) - umbralNivel(n - 1))).toBe(50);
    expect(nivelDe(0)).toMatchObject({ nivel: 1, nombre: 'Chispa', desde: 0, hasta: 100, falta: 100 });
    expect(nivelDe(99).nivel).toBe(1);
    expect(nivelDe(100)).toMatchObject({ nivel: 2, nombre: 'Corriente continua', desde: 100, hasta: 250 });
    expect(nivelDe(449).nivel).toBe(3);
    expect(nivelDe(450).nivel).toBe(4);
    expect(nivelDe(175).fraccion).toBeCloseTo(0.5, 5);
    for (let xp = 0; xp < 60000; xp += 37) {
      const n = nivelDe(xp);
      expect(xp).toBeGreaterThanOrEqual(n.desde);
      expect(xp).toBeLessThan(n.hasta);
      expect(n.fraccion).toBeGreaterThanOrEqual(0);
      expect(n.fraccion).toBeLessThan(1);
    }
    expect(nivelDe(-5).nivel).toBe(1);
    expect(nivelDe(Number.NaN).nivel).toBe(1);
    expect(nombreNivel(NOMBRES_NIVEL.length + 7)).toBe(NOMBRES_NIVEL[NOMBRES_NIVEL.length - 1]);
    expect(new Set(NOMBRES_NIVEL).size).toBe(NOMBRES_NIVEL.length);
  });

  test('logros: unos 25, ids únicos y textos en castellano', () => {
    expect(LOGROS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(LOGROS.map((l) => l.id)).size).toBe(LOGROS.length);
    for (const l of LOGROS) expect(l.como).toMatch(/\.$/);
  });

  test('cursos: todos los capítulos de la tabla existen, ninguno falta y se informan los repetidos', () => {
    const v = verificarCursos(INDICE);
    expect(v.inexistentes).toEqual([]);
    expect(v.sinCurso).toEqual([]);
    // the four detailed projects are also in their topic course (owner's decision in 0.11)
    expect(v.repetidos).toEqual({
      cap49: ['sensores', 'proyectos'],
      cap50: ['potencia', 'proyectos'],
      cap51: ['analogica', 'proyectos'],
      cap52: ['senales', 'proyectos'],
    });
    // (1.2, consolas-A: the 11th course, «Consolas por dentro», one part per console of the explorer)
    expect(CURSOS.map((c) => c.partes.length)).toEqual([7, 4, 8, 8, 5, 5, 6, 8, 3, 8, 7]);
    // 1.1: the expansions' two new chapters, where the book places them (1.2: book 4.1's ids, cap55 and cap56, and
    // appendix K closing the digital course)
    expect(CURSOS.find((c) => c.id === 'digital')!.partes).toEqual(['cap09', 'cap29', 'cap55', 'cap34', 'cap37', 'cap38', 'cap44', 'apK']);
    expect(CURSOS.find((c) => c.id === 'potencia')!.partes).toEqual(['cap10', 'cap33', 'cap56', 'cap39', 'cap50']);
    expect(CURSOS[0]!.partes).toEqual(['cap00', 'cap01', 'cap02', 'cap03', 'cap04', 'cap05', 'cap06']);
    expect(CURSOS.find((c) => c.id === 'taller')!.partes).toEqual(['cap11', 'cap12', 'cap13', 'cap15', 'cap21', 'cap22', 'cap47', 'cap53']);
    expect(CURSOS.find((c) => c.id === 'proyectos')!.partes).toEqual(['cap16', 'cap48', 'cap49', 'cap50', 'cap51', 'cap52', 'cap57', 'cap54']);
    for (const c of CURSOS) if (!c.unidades) expect(leccionesDeCurso(c, INDICE).length, c.id).toBeGreaterThan(20);
    // its parts are not in the book: they come from lecciones11/partes.json (lib/partes-extra.ts), each section with its
    // published lesson, in the explorer's order
    const consolas = CURSOS.find((c) => c.id === 'consolas')!;
    expect(consolas.partes).toEqual(['consola-nes', 'consola-neogeo', 'consola-sms', 'consola-megadrive', 'consola-gb', 'consola-gbc', 'consola-snes']);
    const extra = leerJson<{ partes: Record<string, InfoParte> }>('lecciones11/partes.json').partes;
    const conConsolas = mezclarPartes(INDICE, extra);
    expect(leccionesDeCurso(consolas, INDICE)).toEqual([]);
    const ls = leccionesDeCurso(consolas, conConsolas);
    expect(ls.length).toBeGreaterThanOrEqual(14);
    for (const l of ls) expect(readFileSync(new URL(`lecciones11/${l.parte}/${l.label}.json`, LIBRO), 'utf8'), `${l.parte}/${l.label}`).toContain('"consola":');
    expect(conConsolas.partes['consola-snes']!.tipo).toBe('consola');
    // (a book part is never replaced, and the book's volumes do not list the console parts)
    expect(mezclarPartes(INDICE, { cap00: { tipo: 'consola', titulo: 'x', secciones: [] } }).partes.cap00).toBe(INDICE.partes.cap00);
    expect(INDICE.tomos.flatMap((t) => t.partes).some((p) => p.startsWith('consola-'))).toBe(false);
    // placement test sizes: 6–10 questions, spread over the chapters
    for (const c of CURSOS) {
      const r = repartoPrueba(c.partes.length);
      const n = r.reduce((a, b) => a + b, 0);
      expect(n).toBe(preguntasPrueba(c.partes.length));
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(10);
      expect(Math.min(...r)).toBeGreaterThanOrEqual(1);
    }
  });

  test('los circuitos guiados de la protoboard son los que cuenta el logro', () => {
    const fuente = readFileSync(new URL('../src/componentes/protoboard/guiados.ts', import.meta.url), 'utf8');
    const ids = [...fuente.matchAll(/^\s{4}id: '([^']+)',$/gm)].map((m) => m[1]);
    const progreso = readFileSync(new URL('../src/lib/aprendizaje/progreso.svelte.ts', import.meta.url), 'utf8');
    const lista = /CIRCUITOS_GUIADOS = \[([^\]]+)\]/.exec(progreso)![1]!.match(/'([^']+)'/g)!.map((s) => s.slice(1, -1));
    expect(lista).toEqual(ids);
  });
});

// ------------------------------------------------------------------ feedback and XP in a lesson

test.describe('lección: sonido, vibración, XP y celebración', () => {
  test.use({ viewport: TABLETA });

  test('acertar suena y vibra, la lección da XP y logros, y se celebra', async ({ page }) => {
    await preparar(page);
    await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();

    await responderPregunta(page, true);
    // the two notes of «acierto» and its short pulse (an achievement toast may follow with its own)
    expect(await page.evaluate(() => (window as unknown as { __notas: number[] }).__notas.slice(0, 2))).toEqual([659.25, 987.77]);
    expect(await page.evaluate(() => (window as unknown as { __vibraciones: unknown[] }).__vibraciones[0])).toEqual([15]);
    await expect(page.locator('[data-destello="si"]')).toHaveCount(1);
    await expect(page.locator('[data-aviso-xp]')).toHaveAttribute('data-aviso-xp', '10');

    // the remaining questions: one wrong (a soft low note and three pulses), the rest right
    let k = 0;
    while (true) {
      await page.locator('[data-continuar]').click();
      if (await page.locator('[data-resumen]').isVisible()) break;
      await expect(page.locator('[data-pregunta]')).toBeVisible();
      const antes = await notas(page);
      await responderPregunta(page, k !== 0);
      if (k === 0) expect(await page.evaluate((i) => (window as unknown as { __notas: number[] }).__notas.slice(i), antes)).toContain(207.65);
      k++;
    }
    // end: «leccion» sound (five notes), the celebration and the XP of the answers and of the lesson
    const resumen = page.locator('[data-resumen]');
    await expect(resumen.locator('[data-celebracion]')).toBeVisible();
    const libro = async () => (await leer<Libro>(page, 'progreso-xp'))!;
    await expect.poll(async () => Object.keys((await libro()).xp).filter((id) => id.startsWith('l:'))).toEqual(['l:cap05/sec-5.1']);
    const l = await libro();
    expect(l.version).toBe(1);
    expect(l.xp['pq:cap05-01']!.x).toBe(10);
    const esperado = totalXp(l);
    expect(esperado).toBeGreaterThanOrEqual(XP.acierto + XP.leccion);
    await expect(resumen.locator('[data-xp-leccion]')).toHaveAttribute('data-xp-leccion', String(esperado));
    await expect(resumen.locator('.xp [data-valor]')).toHaveText(String(esperado));
    await expect(resumen.locator('[data-precision]')).toBeVisible();
    await expect(resumen.locator('[data-nivel-leccion]')).toContainText('Nivel 1 · Chispa');
    // achievements: first answer and first lesson, announced with the badge toast
    await expect.poll(async () => Object.keys((await libro()).logros).sort()).toEqual(expect.arrayContaining(['primer-acierto', 'primera-leccion']));
    await expect(page.locator('[data-aviso="logro"]')).toBeVisible();
    await expect(page.locator('.celebraciones [role="status"]')).toContainText('Logro desbloqueado');
    await page.screenshot({ path: `${CAPTURAS}leccion-fin-tableta-claro.png` });
  });

  test('«Aa»: sonido y vibración se apagan por separado y se recuerdan', async ({ page }) => {
    await preparar(page);
    await page.goto('#/');
    await abrirAjustes(page);
    const sonido = page.locator('[data-ajuste-sonido]');
    const vibracion = page.locator('[data-ajuste-vibracion]');
    await expect(sonido).toBeChecked();
    await expect(vibracion).toBeChecked();
    await sonido.uncheck();
    await expect.poll(async () => (await leer<{ sonido?: boolean }>(page, 'prefs'))?.sonido).toBe(false);
    await page.reload();
    await abrirAjustes(page);
    await expect(page.locator('[data-ajuste-sonido]')).not.toBeChecked();
    await expect(page.locator('[data-ajuste-vibracion]')).toBeChecked();
    await page.keyboard.press('Escape');

    // without sound: a right answer vibrates but plays nothing
    await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    const n0 = await notas(page);
    await responderPregunta(page, true);
    // the answer's own pattern (an achievement toast may vibrate afterwards too, never with sound)
    expect(await page.evaluate(() => (window as unknown as { __vibraciones: unknown[] }).__vibraciones[0])).toEqual([15]);
    await page.waitForTimeout(1500);
    expect(await notas(page)).toBe(n0);

    // without vibration too: nothing at all
    await page.goto('#/');
    await abrirAjustes(page);
    await page.locator('[data-ajuste-vibracion]').uncheck();
    await expect.poll(async () => (await leer<{ vibracion?: boolean }>(page, 'prefs'))?.vibracion).toBe(false);
    await page.keyboard.press('Escape');
    await page.goto('#/leccion/cap05/sec-5.2/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    const v0 = await vibraciones(page);
    const m0 = await notas(page);
    await responderPregunta(page, false);
    expect(await notas(page)).toBe(m0);
    expect(await vibraciones(page)).toBe(v0);

    // switched on again: the switch itself plays a sample
    await page.goto('#/');
    await abrirAjustes(page);
    await page.locator('[data-ajuste-sonido]').check();
    expect(await notas(page)).toBe(m0 + 2);
  });
});

// ------------------------------------------------------------------ achievements and the «Progreso» page

test.describe('logros y página «Progreso»', () => {
  test.use({ viewport: TABLETA });

  test('logros desbloqueados desde los datos guardados, los bloqueados en gris con lo que falta', async ({ page }) => {
    const lecciones: Record<string, unknown> = {};
    const secs = INDICE.partes.cap05!.secciones!.map((s) => s.label);
    secs.forEach((label, i) => (lecciones[`cap05/${label}`] = { h: [0, 1], u: 2, n: 2, c: Date.UTC(2026, 9, 1, 10, i), t: Date.UTC(2026, 9, 1, 10, i) }));
    const dias: Record<string, unknown> = {};
    for (let k = 1; k <= 7; k++) dias[dia(k)] = { pasos: 3, preguntas: 0, secciones: 0, cumplido: true, t: Date.now() - k * 864e5 };
    await preparar(page, { lecciones, 'progreso-diario': dias });
    await page.goto('#/progreso');
    const pagina = page.locator('[data-pagina-progreso]');
    await expect(pagina).toBeVisible();
    await expect(page.locator('[data-logro="primera-leccion"]')).toHaveAttribute('data-estado', 'conseguido');
    await expect(page.locator('[data-logro="diez-lecciones"]')).toHaveAttribute('data-estado', 'conseguido');
    await expect(page.locator('[data-logro="capitulo-lecciones"]')).toHaveAttribute('data-estado', 'conseguido');
    await expect(page.locator('[data-logro="racha-3"]')).toHaveAttribute('data-estado', 'conseguido');
    await expect(page.locator('[data-logro="racha-7"]')).toHaveAttribute('data-estado', 'conseguido');
    const bloqueado = page.locator('[data-logro="cincuenta-lecciones"]');
    await expect(bloqueado).toHaveAttribute('data-estado', 'bloqueado');
    await expect(bloqueado).toContainText(`${secs.length} de 50`);
    await expect(bloqueado).toContainText('Complete cincuenta lecciones.');
    await expect(page.locator('[data-logro="racha-30"]')).toContainText('7 de 30');
    // XP: 11 lessons × 20 and seven days with the streak bonus (no toasts for what was already done)
    const xpDias = [1, 2, 3, 4, 5, 6, 7].reduce((n, r) => n + xpObjetivo(r), 0);
    const total = secs.length * XP.leccion + xpDias;
    await expect(pagina.locator('[data-xp]').first()).toHaveAttribute('data-xp', String(total));
    await expect(pagina.locator('[data-nivel]')).toHaveAttribute('data-nivel', String(nivelDe(total).nivel));
    await expect(page.locator('[data-aviso="logro"]')).toHaveCount(0);
    await expect(page.locator('[data-logros-conseguidos]')).toHaveAttribute('data-logros-conseguidos', /^[5-9]$/);
  });
});

// ------------------------------------------------------------------ migration from 0.10

test.describe('datos de la 0.10', () => {
  test.use({ viewport: TABLETA });

  test('se conservan intactos y su trabajo cuenta una sola vez', async ({ page }) => {
    const datos010: Record<string, unknown> = {
      marcadores: { 'sec-5.1': { parte: 'cap05', label: 'sec-5.1', num: '5.1', titulo: 'El Semiconductor', t: 1000 } },
      leidas: { cap05: { 'sec-5.1': 1500, 'sec-5.2': 1600 } },
      lecciones: {
        'cap05/sec-5.1': { h: [0, 1, 2], u: 3, n: 3, c: 1761400000000, t: 1761400000000 },
        'cap05/sec-5.2': { h: [0], u: 1, n: 4, c: 0, t: 1761400100000 },
        'cap01/sec-1.4': { h: [0, 1], u: 2, n: 2, c: 1761500000000, t: 1761500000000 },
      },
      ejercicios: {
        'ej-5.1': { intentos: 1, fallos: 0, resuelto: true, pistas: 0, solucion: false, t: 1761400200000 },
        'ej-5.2': { intentos: 3, fallos: 2, resuelto: true, pistas: 1, solucion: false, t: 1761400300000 },
        'ej-5.3': { intentos: 2, fallos: 1, resuelto: false, pistas: 0, solucion: false, t: 1761400400000 },
        'ej-5.4': { intentos: 1, fallos: 0, resuelto: true, pistas: 0, solucion: true, t: 1761400500000 },
      },
      'progreso-diario': {
        [dia(2)]: { pasos: 3, preguntas: 0, secciones: 0, cumplido: true, t: 1761400600000 },
        [dia(1)]: { pasos: 4, preguntas: 0, secciones: 0, cumplido: true, t: 1761400700000 },
      },
      'progreso-objetivo': { tipo: 'pasos', cantidad: 3, secciones: true, t: 5 },
      'repaso-tarjetas': { 'glos-diodo': { e: 'r', p: 0, f: 2.5, i: 3, v: 9e12, n: 4, l: 0, u: 3000 } },
    };
    await preparar(page, datos010);
    await page.goto('#/');
    await expect(page.locator('[data-nivel-inicio]')).toBeVisible();
    const esperado = 2 * XP.leccion + XP.ejercicio + XP.ejercicioConAyuda + xpObjetivo(1) + xpObjetivo(2);
    await expect.poll(async () => totalXp(await leer<Libro>(page, 'progreso-xp'))).toBe(esperado);
    const l = (await leer<Libro>(page, 'progreso-xp'))!;
    expect(l.version).toBe(1);
    expect(Object.keys(l.xp).sort()).toEqual(['d:' + dia(1), 'd:' + dia(2), 'e:ej-5.1', 'e:ej-5.2', 'l:cap01/sec-1.4', 'l:cap05/sec-5.1'].sort());
    expect(l.xp['l:cap05/sec-5.1']!.t).toBe(1761400000000);
    // nothing of the old data changed, except the 1.0 shape of the daily progress (ESQUEMA.md, «Daily progress», 1.0):
    // the schema migration 1 → 2 (`absorberLegado`) moves each old day's activity into a record «<day>@0» (its counts,
    // `cumplido: false` as every record, the summary's time); the day's summary — its counts and its frozen
    // `cumplido` — stays as it was, and the day's activity is the record alone, so it counts once
    const diasViejos = datos010['progreso-diario'] as Record<string, { pasos: number; preguntas: number; secciones: number; cumplido: boolean; t: number }>;
    const diarioEsperado: Record<string, unknown> = { ...diasViejos };
    for (const [d, v] of Object.entries(diasViejos)) diarioEsperado[`${d}@0`] = { ...v, cumplido: false };
    for (const [k, v] of Object.entries(datos010)) expect(await leer(page, k), k).toEqual(k === 'progreso-diario' ? diarioEsperado : v);
    const diario = (await leer<Record<string, DiaProgreso>>(page, 'progreso-diario'))!;
    for (const [d, v] of Object.entries(diasViejos)) expect(totalDia(grupoDe(diario, d)), d).toEqual({ pasos: v.pasos, preguntas: v.preguntas, secciones: v.secciones });
    // a second start does not add anything again
    await page.reload();
    await expect(page.locator('[data-nivel-inicio]')).toBeVisible();
    await page.waitForTimeout(800);
    expect(totalXp(await leer<Libro>(page, 'progreso-xp'))).toBe(esperado);
    expect(await leer(page, 'progreso-diario')).toEqual(diarioEsperado);
    await expect(page.locator('[data-nivel-inicio] .xp [data-valor]')).toHaveAttribute('data-valor', String(esperado));
    // the earlier work also unlocks its achievements (silently: no toasts)
    await expect.poll(async () => (await leer<Libro>(page, 'progreso-xp'))?.logros['primera-leccion']).toBeGreaterThan(0);
    await expect(page.locator('[data-aviso="logro"]')).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ synchronisation

const TOKEN = ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_');
const DATOS = 'Metalaria/electronica-datos';

/** A minimal in-memory GitHub Contents API (as in sincronizacion.spec.ts). */
class FakeGitHub {
  ficheros = new Map<string, { sha: string; texto: string }>();
  doc(): { almacenes: Record<string, Record<string, { t: number; v?: unknown; x?: number }>> } | null {
    const f = this.ficheros.get(`${DATOS}/sincronizacion/datos.json`);
    return f ? JSON.parse(f.texto) : null;
  }
  async atender(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version', 'access-control-allow-methods': 'GET, PUT, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (status: number, cuerpo: unknown) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(cuerpo) });
    const m = /^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
    if (!m) return json(404, { message: 'Not Found' });
    const repo = `${m[1]}/${m[2]}`;
    const resto = m[3] ?? '';
    if (!resto) return json(200, { full_name: repo, private: true });
    if (resto === 'releases/latest') return json(404, { message: 'Not Found' });
    const c = /^contents\/(.+)$/.exec(resto);
    if (!c || repo !== DATOS) return json(404, { message: 'Not Found' });
    const clave = `${repo}/${decodeURIComponent(c[1]!)}`;
    const f = this.ficheros.get(clave);
    if (req.method() === 'GET') {
      if (!f) return json(404, { message: 'Not Found' });
      return json(200, { type: 'file', sha: f.sha, encoding: 'base64', content: Buffer.from(f.texto, 'utf8').toString('base64'), size: f.texto.length });
    }
    const cuerpo = JSON.parse(req.postData() ?? '{}') as { content: string; sha?: string };
    if (f && cuerpo.sha !== f.sha) return json(409, { message: 'sha mismatch' });
    const texto = Buffer.from(cuerpo.content, 'base64').toString('utf8');
    const sha = createHash('sha1').update(texto).digest('hex');
    this.ficheros.set(clave, { sha, texto });
    return json(f ? 200 : 201, { content: { sha } });
  }
}

async function dispositivo(browser: Browser, gh: FakeGitHub, datos: Record<string, unknown>): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route('https://api.github.com/**', (r) => gh.atender(r));
  const page = await ctx.newPage();
  await page.goto('./#/');
  await page.evaluate(
    ({ datos, token }) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(datos)) localStorage.setItem('epa:' + k, JSON.stringify(v));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa-credencial:github', token);
    },
    { datos, token: TOKEN },
  );
  await page.goto('./#/sincronizacion');
  await page.reload();
  await expect(page.locator('[data-pagina="sincronizacion"]')).toBeVisible();
  return { ctx, page };
}

async function sincronizarAhora(page: Page): Promise<void> {
  const pag = page.locator('[data-pagina="sincronizacion"]');
  const n = Number(await pag.getAttribute('data-ejecuciones'));
  await page.locator('[data-sincronizar]').click();
  await expect(pag).toHaveAttribute('data-ejecuciones', String(n + 1));
}

test.describe('sincronización de XP, logros y lecciones superadas', () => {
  test('ida y vuelta entre dos dispositivos sin contar dos veces', async ({ browser }) => {
    const gh = new FakeGitHub();
    const leccion = (c: number) => ({ h: [0], u: 1, n: 1, c, t: c });
    const a = await dispositivo(browser, gh, {
      lecciones: { 'cap05/sec-5.1': leccion(1761400000000), 'cap05/sec-5.2': leccion(1761400100000) },
      cursos: { version: 1, superadas: { 'cap00/sec-0.1': 1761400200000 }, pruebas: { fundamentos: { t: 1761400200000, aciertos: 5, total: 7, recomendado: 'cap01', marcadas: 1 } } },
    });
    await sincronizarAhora(a.page);
    const doc = gh.doc()!;
    expect(Object.keys(doc.almacenes['progreso-xp']!).sort()).toEqual(['l:cap05/sec-5.1', 'l:cap05/sec-5.2']);
    expect(doc.almacenes['progreso-logros']!['primera-leccion']).toBeTruthy();
    expect(doc.almacenes['cursos-superadas']!['cap00/sec-0.1']).toBeTruthy();
    expect(doc.almacenes['cursos-pruebas']!.fundamentos).toBeTruthy();

    // B completed the same lesson 5.1 (at another time) and another one
    const b = await dispositivo(browser, gh, {
      lecciones: { 'cap05/sec-5.1': leccion(1761900000000), 'cap01/sec-1.4': leccion(1761900100000) },
    });
    await sincronizarAhora(b.page);
    const lb = (await leer<Libro>(b.page, 'progreso-xp'))!;
    expect(Object.keys(lb.xp).sort()).toEqual(['l:cap01/sec-1.4', 'l:cap05/sec-5.1', 'l:cap05/sec-5.2']);
    expect(totalXp(lb)).toBe(3 * XP.leccion);
    const cb = (await leer<{ superadas: Record<string, number>; pruebas: Record<string, unknown> }>(b.page, 'cursos'))!;
    expect(Object.keys(cb.superadas)).toEqual(['cap00/sec-0.1']);
    expect(Object.keys(cb.pruebas)).toEqual(['fundamentos']);

    await sincronizarAhora(a.page);
    const la = (await leer<Libro>(a.page, 'progreso-xp'))!;
    expect(totalXp(la)).toBe(3 * XP.leccion);
    expect(Object.keys(la.xp).sort()).toEqual(Object.keys(lb.xp).sort());
    await a.ctx.close();
    await b.ctx.close();
  });
});

// ------------------------------------------------------------------ courses and the placement test

test.describe('cursos y prueba de nivel', () => {
  test.use({ viewport: TABLETA });

  test('la página de cursos: los once cursos, sus capítulos con el título del libro y «Continuar»', async ({ page }) => {
    await preparar(page, { lecciones: { 'cap00/sec-0.1': { h: [0], u: 1, n: 1, c: 1761400000000, t: 1761400000000 } } });
    await page.goto('#/');
    await page.locator('[data-ir-cursos]').click();
    await expect(page.locator('[data-curso-tarjeta]')).toHaveCount(11);
    await expect(page.locator('[data-continuar-curso="fundamentos"]')).toHaveText(/Continuar/);
    await expect(page.locator('[data-continuar-curso="analisis"]')).toHaveText(/Empezar/);
    await page.locator('[data-curso-tarjeta="taller"] h2 a').click();
    await page.locator('[data-vista="lista"]').click(); // 1.0: a course opens as a path; these checks use the list view
    await expect(page.locator('[data-curso="taller"] [data-capitulo]')).toHaveCount(8);
    // chapter titles come from the content (cap15 is printed «Capítulo 14»)
    await expect(page.locator('[data-capitulo="cap15"] .rot')).toHaveText('Capítulo 14');
    await expect(page.locator('[data-capitulo="cap15"] .nombre')).toHaveText(INDICE.partes.cap15!.titulo.split(' — ')[0]!);
    // fundamentos: the first lesson is done, «Continuar» goes to the second one
    await page.goto('#/cursos/fundamentos');
    const sig = INDICE.partes.cap00!.secciones![1]!;
    await expect(page.locator('[data-continuar-curso]')).toHaveAttribute('href', `#/leccion/cap00/${sig.label}`);
    await expect(page.locator('[data-leccion-curso="cap00/sec-0.1"]')).toHaveAttribute('data-estado', 'hecha');
    await page.locator('[data-continuar-curso]').click();
    // (1.1: chapter 0's sections have their hand-made lesson now; the 1.0 one only where there is none)
    await expect(page.locator(`[data-leccion="cap00/${sig.label}"], [data-leccion11="cap00/${sig.label}"]`)).toBeVisible();
  });

  test('prueba de nivel: saltar, responder, recomendación, marcar como superadas (sin XP), deshacer y repetir', async ({ page }) => {
    await preparar(page);
    await page.goto('#/cursos/analisis');
    await page.locator('[data-prueba-nivel]').click();
    await expect(page.locator('[data-prueba="analisis"][data-fase="intro"]')).toBeVisible();
    // skippable
    await page.locator('[data-saltar-prueba]').click();
    await expect(page).toHaveURL(/#\/cursos\/analisis$/);
    await page.locator('[data-prueba-nivel]').click();
    await page.locator('[data-empezar-prueba]').click();
    await expect(page.locator('[data-fase="preguntas"]')).toBeVisible();
    // six questions (4 chapters): the first chapter's right, then «No lo sé» on the rest
    const vistas: string[] = [];
    for (let i = 0; i < 6; i++) {
      const id = (await page.locator('[data-pregunta]').getAttribute('data-pregunta'))!;
      vistas.push(id.split('-')[0]!);
      if (id.startsWith('cap23-')) {
        await responderPregunta(page, true);
        await page.locator('[data-siguiente-prueba]').click();
      } else {
        await page.locator('[data-no-lo-se]').click();
      }
    }
    // easy → hard: in the course's order, 2 + 2 + 1 + 1
    expect(vistas).toEqual(['cap23', 'cap23', 'cap24', 'cap24', 'cap25', 'cap42']);
    const res = page.locator('[data-resultado-prueba]');
    await expect(res).toHaveAttribute('data-aciertos', '2');
    await expect(res).toHaveAttribute('data-recomendado', 'cap24');
    await expect(page.locator('[data-recomendacion]')).toContainText('Capítulo 23');
    // no XP for the test's answers
    expect(Object.keys((await leer<Libro>(page, 'progreso-xp'))?.xp ?? {}).filter((k) => k.startsWith('pq:'))).toEqual([]);
    const n23 = INDICE.partes.cap23!.secciones!.length;
    await expect(page.locator('[data-marcar]')).toContainText(`${n23} lecciones`);
    await page.locator('[data-marcar-superadas]').click();
    await expect(page.locator('[data-marcadas]')).toHaveAttribute('data-marcadas', String(n23));
    await expect.poll(async () => Object.keys((await leer<{ superadas: Record<string, number> }>(page, 'cursos'))?.superadas ?? {}).length).toBe(n23);
    const cursos = (await leer<{ version: number; superadas: Record<string, number>; pruebas: Record<string, { marcadas: number; recomendado: string }> }>(page, 'cursos'))!;
    expect(cursos.version).toBe(1);
    expect(Object.keys(cursos.superadas)).toHaveLength(n23);
    expect(cursos.pruebas.analisis).toMatchObject({ marcadas: n23, recomendado: 'cap24' });
    expect(Object.keys((await leer<Libro>(page, 'progreso-xp'))?.xp ?? {}).filter((k) => k.startsWith('l:'))).toEqual([]);
    await expect.poll(async () => (await leer<Libro>(page, 'progreso-xp'))?.logros['prueba-nivel']).toBeGreaterThan(0);
    // the course page tells them apart from completed lessons
    await page.locator('[data-volver-curso]').click();
    await page.locator('[data-vista="lista"]').click(); // 1.0: a course opens as a path; these checks use the list view
    await expect(page.locator('[data-curso="analisis"] [data-avance]')).toHaveAttribute('data-avance', `0/${n23}/${leccionesDeCurso(CURSOS[1]!, INDICE).length}`);
    await page.locator('[data-capitulo="cap23"] .cab-cap').click();
    await expect(page.locator('[data-capitulo="cap23"] [data-estado="superada"]')).toHaveCount(n23);
    await expect(page.locator('[data-capitulo="cap23"] [data-estado="superada"] .estado').first()).toHaveText('Superada por la prueba');
    await expect(page.locator('[data-ultima-prueba]')).toContainText('2 de 6');
    // «Continuar» now starts in chapter 23's next chapter
    await expect(page.locator('[data-continuar-curso]')).toHaveAttribute('href', `#/leccion/cap24/${INDICE.partes.cap24!.secciones![0]!.label}`);
    // repeat the test and undo the marks
    await page.locator('[data-prueba-nivel]').click();
    await page.locator('[data-empezar-prueba]').click();
    for (let i = 0; i < 6; i++) await page.locator('[data-no-lo-se]').click();
    await expect(page.locator('[data-resultado-prueba]')).toHaveAttribute('data-recomendado', 'cap23');
    await expect(page.locator('[data-marcar]')).toHaveCount(0);
    await page.locator('[data-repetir-prueba]').click();
    await expect(page.locator('[data-fase="preguntas"]')).toBeVisible();
    for (let i = 0; i < 6; i++) {
      const id = (await page.locator('[data-pregunta]').getAttribute('data-pregunta'))!;
      if (id.startsWith('cap23-')) {
        await responderPregunta(page, true);
        await page.locator('[data-siguiente-prueba]').click();
      } else await page.locator('[data-no-lo-se]').click();
    }
    await expect(page.locator('[data-marcar]')).toContainText('ya están completadas');
  });

  test('deshacer las marcas de la prueba', async ({ page }) => {
    await preparar(page);
    await page.goto('#/cursos/placas/prueba');
    await page.locator('[data-empezar-prueba]').click();
    for (let i = 0; i < 6; i++) {
      const id = (await page.locator('[data-pregunta]').getAttribute('data-pregunta'))!;
      if (id.startsWith('cap40-')) {
        await responderPregunta(page, true);
        await page.locator('[data-siguiente-prueba]').click();
      } else await page.locator('[data-no-lo-se]').click();
    }
    await expect(page.locator('[data-resultado-prueba]')).toHaveAttribute('data-recomendado', 'cap41');
    await page.locator('[data-marcar-superadas]').click();
    await expect.poll(async () => Object.keys((await leer<{ superadas: Record<string, number> }>(page, 'cursos'))?.superadas ?? {}).length).toBe(INDICE.partes.cap40!.secciones!.length);
    await page.locator('[data-deshacer-marcas]').click();
    await expect.poll(async () => Object.keys((await leer<{ superadas: Record<string, number> }>(page, 'cursos'))?.superadas ?? {}).length).toBe(0);
    await expect(page.locator('[data-marcar-superadas]')).toBeVisible();
  });
});

// ------------------------------------------------------------------ the daily reminder

test.describe('recordatorio diario', () => {
  test.use({ viewport: TABLETA });

  test('en el escritorio y el navegador: «Solo en Android»', async ({ page }) => {
    await preparar(page);
    await page.goto('#/');
    await abrirAjustes(page);
    await expect(page.locator('[data-recordatorio-no]')).toContainText('Solo en Android');
    await expect(page.locator('[data-ajuste-recordatorio]')).toHaveCount(0);
  });

  test('en Android: permiso, aviso diario a las 20:00, otra hora, permiso denegado y apagado', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: TABLETA,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; 23043RP34G Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Safari/537.36',
    });
    await preparar(ctx);
    const page = await ctx.newPage();
    await page.goto('#/');
    await expect(page.locator('[data-nivel-inicio]')).toBeVisible();
    // the Tauri bridge, stubbed once the app runs (the storage layer already chose localStorage)
    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const llamadas: [string, unknown][] = [];
      w.__llamadas = llamadas;
      w.__permiso = 'granted';
      w.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args: unknown) => {
          llamadas.push([cmd, JSON.parse(JSON.stringify(args ?? null))]);
          if (cmd === 'plugin:notification|is_permission_granted') return false;
          if (cmd === 'plugin:notification|request_permission') return w.__permiso;
          if (cmd === 'plugin:notification|get_pending') return [];
          if (cmd.startsWith('plugin:store|')) throw new Error('sin almacén en la prueba');
          return null;
        },
        transformCallback: () => Math.floor(Math.random() * 1e9),
        unregisterCallback: () => {},
      };
    });
    const llamadas = () => page.evaluate(() => (window as unknown as { __llamadas: [string, { options?: { schedule?: unknown; id?: number; body?: string } }][] }).__llamadas);
    await abrirAjustes(page);
    const interruptor = page.locator('[data-ajuste-recordatorio]');
    await expect(interruptor).not.toBeChecked();
    await interruptor.check();
    await expect(page.locator('[data-aviso-recordatorio]')).toHaveText('Le avisaremos cada día a las 20:00.');
    let ll = await llamadas();
    const cmds = ll.map((x) => x[0]);
    expect(cmds).toEqual(expect.arrayContaining(['plugin:notification|is_permission_granted', 'plugin:notification|request_permission', 'plugin:notification|cancel', 'plugin:notification|notify']));
    const notify = ll.filter((x) => x[0] === 'plugin:notification|notify').at(-1)![1].options!;
    expect(notify.id).toBe(20110);
    expect(notify.body).toBe('Unos minutos con la electrónica: le espera el problema del día.');
    expect(notify.schedule).toEqual({ interval: { interval: { hour: 20, minute: 0 }, allowWhileIdle: true } });
    // 0.12: the app's own small monochrome icon (src-tauri/recursos-android/drawable/ic_stat_epa.xml), not Android's «i»
    expect((notify as { icon?: string }).icon).toBe('ic_stat_epa');
    await expect.poll(async () => leer(page, 'prefs')).toMatchObject({ recordatorio: { activo: true, hora: '20:00' } });

    // another time
    await page.locator('[data-ajuste-hora]').fill('07:30');
    await page.locator('[data-ajuste-hora]').dispatchEvent('change');
    await expect(page.locator('[data-aviso-recordatorio]')).toHaveText('Le avisaremos cada día a las 07:30.');
    ll = await llamadas();
    expect(ll.filter((x) => x[0] === 'plugin:notification|notify').at(-1)![1].options!.schedule).toEqual({ interval: { interval: { hour: 7, minute: 30 }, allowWhileIdle: true } });
    await expect.poll(async () => leer(page, 'prefs')).toMatchObject({ recordatorio: { activo: true, hora: '07:30' } });

    // off: the notification is cancelled
    await interruptor.uncheck();
    await expect.poll(async () => (await leer<{ recordatorio: { activo: boolean } }>(page, 'prefs'))?.recordatorio.activo).toBe(false);
    ll = await llamadas();
    expect(ll.at(-1)).toEqual(['plugin:notification|cancel', { notifications: [20110] }]);

    // permission denied: the switch stays off and says why
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__permiso = 'denied'));
    // (a click: the switch goes back off by itself as soon as Android refuses)
    await interruptor.click();
    await expect(page.locator('[data-aviso-recordatorio]')).toContainText('Android no deja');
    await expect(interruptor).not.toBeChecked();
    await expect.poll(async () => leer(page, 'prefs')).toMatchObject({ recordatorio: { activo: false } });
    await ctx.close();
  });
});

// ------------------------------------------------------------------ breadboard and simulation events

test('un circuito guiado montado da sus XP y los logros de montaje y simulación', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: TABLETA, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await preparar(ctx, { 'protoboard-recorrido': 1, 'protoboard-leccion': 1 });
  const page = await ctx.newPage();
  await page.goto('/#/protoboard');
  await page.waitForFunction(() => !!(window as unknown as { __epaProtoboard?: { pb: { doc: { piezas: unknown[] } } } }).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.locator('.acciones .guiar').tap();
  await page.locator('.elegir [data-guiado="led"]').tap();
  const estado = () =>
    page.evaluate(() => {
      const g = (window as unknown as { __epaProtoboard: { pb: { guia: { estado: { actual: number }; plan: { pasos: unknown[] } } | null } } }).__epaProtoboard.pb.guia!;
      return { actual: g.estado.actual, total: g.plan.pasos.length };
    });
  for (let k = 0; k < 30; k++) {
    const e = await estado();
    if (e.actual >= e.total - 1) break;
    await page.locator('.guia button:has-text("Hazlo por mí")').tap();
    await page.waitForTimeout(120);
  }
  const pasos = await page.evaluate(() => (window as unknown as { __epaEventos: { tipo: string }[] }).__epaEventos.filter((e) => e.tipo === 'paso-montaje').length);
  expect(pasos).toBeGreaterThan(2);
  await page.locator('.guia button:has-text("Simular")').tap();
  await expect(page.locator('.fiesta')).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => (await leer<Libro>(page, 'progreso-xp'))?.xp['c:led']?.x).toBe(XP.circuito);
  await expect.poll(async () => Object.keys((await leer<Libro>(page, 'progreso-xp'))?.logros ?? {})).toEqual(expect.arrayContaining(['primer-circuito', 'primera-simulacion']));
  await ctx.close();
});

// ------------------------------------------------------------------ reduced motion

test.describe('movimiento reducido', () => {
  test.use({ viewport: TABLETA });

  test('sin destellos ni confeti, el contador salta y los avisos solo se funden', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await preparar(page);
    await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    await responderPregunta(page, true);
    await expect(page.locator('[data-destello="si"]')).toHaveCount(0);
    await expect(page.locator('.chispas')).toHaveCount(0);
    // sound is not motion: it still plays (the two notes of «acierto» first; a toast may add its own later)
    expect(await page.evaluate(() => (window as unknown as { __notas: number[] }).__notas.slice(0, 2))).toEqual([659.25, 987.77]);
    const xp = page.locator('[data-aviso-xp]');
    await expect(xp).toBeVisible();
    expect(await xp.evaluate((e) => getComputedStyle(e).animationName)).toMatch(/fundido/);
    while (!(await page.locator('[data-resumen]').isVisible())) {
      await page.locator('[data-continuar]').click();
      if (await page.locator('[data-resumen]').isVisible()) break;
      await responderPregunta(page, true);
    }
    await expect(page.locator('[data-celebracion]')).toBeVisible();
    await expect(page.locator('.confeti')).toHaveCount(0);
    const valor = await page.locator('[data-celebracion] .xp [data-valor]').getAttribute('data-valor');
    await expect(page.locator('[data-celebracion] .xp [data-valor]')).toHaveText(valor!);
    expect(await page.locator('[data-celebracion] .ficha').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  });
});

// ------------------------------------------------------------------ screenshots

test.describe('capturas', () => {
  for (const [nombre, tam] of [
    ['tableta', TABLETA],
    ['movil', MOVIL],
  ] as const) {
    for (const tema of ['claro', 'oscuro'] as const) {
      test(`pantallas nuevas · ${nombre} · ${tema}`, async ({ browser }) => {
        test.setTimeout(180_000);
        const ctx = await browser.newContext({ viewport: tam, colorScheme: tema === 'oscuro' ? 'dark' : 'light', deviceScaleFactor: 1, hasTouch: nombre === 'movil', isMobile: nombre === 'movil' });
        const lecciones: Record<string, unknown> = {};
        for (const s of INDICE.partes.cap00!.secciones!.slice(0, 9)) lecciones[`cap00/${s.label}`] = { h: [0], u: 1, n: 1, c: Date.now() - 864e5, t: Date.now() - 864e5 };
        lecciones['cap01/sec-1.2'] = { h: [0], u: 1, n: 3, c: 0, t: Date.now() };
        const dias: Record<string, unknown> = {};
        for (let k = 1; k <= 4; k++) dias[dia(k)] = { pasos: 3, preguntas: 0, secciones: 0, cumplido: true, t: Date.now() - k * 864e5 };
        await preparar(ctx, {
          lecciones,
          'progreso-diario': dias,
          ejercicios: { 'ej-0.1': { intentos: 1, fallos: 0, resuelto: true, pistas: 0, solucion: false, t: Date.now() - 2 * 864e5 } },
          cursos: { version: 1, superadas: { 'cap23/sec-23.1': Date.now() }, pruebas: { analisis: { t: Date.now(), aciertos: 4, total: 6, recomendado: 'cap24', marcadas: 1 } } },
        });
        const page = await ctx.newPage();
        const foto = (n: string) => page.screenshot({ path: `${CAPTURAS}${n}-${nombre}-${tema}.png`, fullPage: false });
        await page.goto('#/');
        await expect(page.locator('[data-nivel-inicio]')).toBeVisible();
        await page.locator('[data-nivel-inicio]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
        await foto('inicio-nivel');
        await page.goto('#/cursos');
        await expect(page.locator('[data-curso-tarjeta]')).toHaveCount(11);
        await page.waitForTimeout(300);
        await foto('cursos');
        await page.goto('#/cursos/analisis');
        await page.locator('[data-vista="lista"]').click(); // 1.0: a course opens as a path; these checks use the list view
        await expect(page.locator('[data-capitulo="cap23"] .lecciones')).toBeVisible();
        await page.locator('[data-capitulo="cap23"]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await foto('curso');
        await page.goto('#/cursos/fundamentos/prueba');
        await expect(page.locator('[data-fase="intro"]')).toBeVisible();
        await foto('prueba-intro');
        await page.locator('[data-empezar-prueba]').click();
        await expect(page.locator('[data-pregunta]')).toBeVisible();
        await foto('prueba-pregunta');
        await responderPregunta(page, true);
        await page.waitForTimeout(700);
        await foto('prueba-respondida');
        await page.locator('[data-siguiente-prueba]').click();
        for (let i = 1; i < 7; i++) {
          if (i < 3) {
            await responderPregunta(page, true);
            await page.locator('[data-siguiente-prueba]').click();
          } else await page.locator('[data-no-lo-se]').click();
        }
        await expect(page.locator('[data-resultado-prueba]')).toBeVisible();
        await foto('prueba-resultado');
        await page.goto('#/progreso');
        await expect(page.locator('[data-pagina-progreso]')).toBeVisible();
        await page.waitForTimeout(1200);
        await foto('progreso');
        await page.locator('.logros').scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await foto('progreso-logros');
        await page.goto('#/');
        await abrirAjustes(page);
        await page.locator('[data-ajustes-retro]').scrollIntoViewIfNeeded();
        await foto('ajustes');
        await page.keyboard.press('Escape');
        await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
        await expect(page.locator('[data-pregunta]')).toBeVisible();
        await responderPregunta(page, true);
        await page.waitForTimeout(150);
        await foto('acierto');
        while (!(await page.locator('[data-resumen]').isVisible())) {
          await page.locator('[data-continuar]').click();
          if (await page.locator('[data-resumen]').isVisible()) break;
          await responderPregunta(page, true);
        }
        await page.waitForTimeout(350);
        await foto('leccion-fin');
        await ctx.close();
      });
    }
  }
});
