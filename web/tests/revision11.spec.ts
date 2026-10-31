// Fixes of the independent review of 0.11 (findings 1–11 of the review, plus the celebration label's contrast
// reported by the QA audit). Each finding has a test that failed before its fix:
//   1  finishing a guided circuit never overwrites the saved montage or the draft it replaced;
//   2  the problem of the day solved on one device is never lost to the same day merely shown on another
//      (engine: an item the store keeps different from the file is sent again), and two devices whose stores
//      normalise or merge values converge without ping-pong (pure simulation of the engine's rules);
//   3  the union of mastery rounds is stored at once and survives an interrupted synchronisation;
//   4  a second level/achievement celebration in the same session is shown (and its label keeps ≥ 4.5:1 when the
//      theme changes while it is open);
//   5  a failure computing the achievements does not break XP nor the synchronisation;
//   6  the problem of the day takes a «Calcula» of the course before a later chapter's exercise, and prefers the
//      reader's frontier chapter;
//   7  mastery's day cut is the review day (04:00) also on DST days;
//   8  the problem of the day follows the 04:00 day change on the page and on the start page card;
//   9  the learning events survive a failed load of the consumers chunk (retry in the session, kept across a reload);
//   10 a guide replaced by another in the same tick reports no step;
//   11 two browser tabs no longer overwrite each other's XP, mastery, problem of the day and courses.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11.spec.ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { numeroDia, DIA_MS } from '../src/lib/aprendizaje/dominio.ts';
import { preferirDia, problemaDelDia, type CandidatoProblema } from '../src/lib/aprendizaje/seleccion.ts';
import { fusionarPestanas, huellasDe } from '../src/lib/pestanas.ts';
import { CURSOS } from '../src/lib/aprendizaje/cursos.ts';
import { claveDia } from '../src/componentes/repaso/srs.ts';
import { analisisPorDefecto } from '../src/componentes/editor/tipos.ts';
import type { DocSincronizacion } from '../src/lib/sincronizacion/fusion.ts';

const LIBRO = new URL('../public/libro/', import.meta.url);
const leerJson = <T>(ruta: string): T => JSON.parse(readFileSync(new URL(ruta, LIBRO), 'utf8')) as T;
const TABLETA = { width: 800, height: 1280 };

// ================================================================== shared helpers

const TOKEN = ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_');
const DATOS = 'Metalaria/electronica-datos';
const RUTA = 'sincronizacion/datos.json';

/** An in-memory GitHub (Contents API with sha checks), as in sincronizacion.spec.ts. */
class FakeGitHub {
  ficheros = new Map<string, { sha: string; texto: string }>();
  escrituras = 0;
  conflictos = 0;
  /** Delay of each GET of the file (ms): makes two runs overlap when nothing serialises them. */
  esperaLectura = 0;

  doc(): DocSincronizacion | null {
    const f = this.ficheros.get(`${DATOS}/${RUTA}`);
    return f ? (JSON.parse(f.texto) as DocSincronizacion) : null;
  }

  async atender(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version',
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (status: number, cuerpo: unknown) =>
      route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(cuerpo) });
    if ((await req.headerValue('authorization')) !== `Bearer ${TOKEN}`) return json(401, { message: 'Bad credentials' });
    const m = /^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
    if (!m || `${m[1]}/${m[2]}` !== DATOS) return json(404, { message: 'Not Found' });
    const resto = m[3] ?? '';
    if (!resto) return json(200, { full_name: DATOS, private: true });
    const c = /^contents\/(.+)$/.exec(resto);
    if (!c) return json(404, { message: 'Not Found' });
    const clave = `${DATOS}/${decodeURIComponent(c[1]!)}`;
    const f = this.ficheros.get(clave);
    if (req.method() === 'GET') {
      if (this.esperaLectura) await new Promise((r) => setTimeout(r, this.esperaLectura));
      if (!f) return json(404, { message: 'Not Found' });
      const b64 = Buffer.from(f.texto, 'utf8').toString('base64').replace(/.{60}/g, '$&\n');
      return json(200, { type: 'file', sha: f.sha, encoding: 'base64', content: b64, size: f.texto.length });
    }
    if (req.method() === 'PUT') {
      const cuerpo = JSON.parse(req.postData() ?? '{}') as { content: string; sha?: string };
      if (f && cuerpo.sha !== f.sha) {
        this.conflictos++;
        return json(409, { message: 'sha mismatch' });
      }
      if (!f && cuerpo.sha) return json(422, { message: 'sha for a file that does not exist' });
      const texto = Buffer.from(cuerpo.content, 'base64').toString('utf8');
      const sha = createHash('sha1').update(texto).digest('hex');
      this.ficheros.set(clave, { sha, texto });
      this.escrituras++;
      return json(f ? 200 : 201, { content: { sha, path: c[1] } });
    }
    return json(405, { message: 'Method not allowed' });
  }
}

/** A «device»: its own context (own localStorage), seeded data and the fake GitHub, on the synchronisation page. */
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
  await expect(pag).toHaveAttribute('data-ocupado', 'false');
  const n = Number(await pag.getAttribute('data-ejecuciones'));
  await page.locator('[data-sincronizar]').click();
  await expect(pag).toHaveAttribute('data-ejecuciones', String(n + 1));
}

const leer = <T>(page: Page, clave: string) => page.evaluate((k) => JSON.parse(localStorage.getItem('epa:' + k) ?? 'null'), clave) as Promise<T>;

/** Stubs Web Audio and vibration, fixes the practice seed, collects events; seeds localStorage once per context. */
async function preparar(ctx: BrowserContext, datos: Record<string, unknown> = {}): Promise<void> {
  await ctx.addInitScript((d) => {
    const w = window as unknown as Record<string, unknown>;
    w.__epaEventos = [];
    w.__epaSemillaPractica = 12345;
    class Param {
      value = 0;
      setValueAtTime() {
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
      start() {}
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
        return Promise.resolve();
      }
      suspend() {
        return Promise.resolve();
      }
    }
    w.AudioContext = Contexto;
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
    if (sessionStorage.getItem('revision-sembrado')) return;
    sessionStorage.setItem('revision-sembrado', '1');
    for (const [k, v] of Object.entries(d)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
  }, datos);
}

const eventos = (page: Page) => page.evaluate(() => (window as unknown as { __epaEventos: Record<string, unknown>[] }).__epaEventos);

interface PreguntaJson {
  id: string;
  tipo: 'opcion' | 'numero';
  opciones?: string[];
  correcta?: number;
  valor?: number;
}
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

/** Answers the Repaso question on screen, right or wrong, from the book's quiz data. */
async function responderPregunta(page: Page, bien: boolean): Promise<void> {
  const caja = page.locator('[data-pregunta]').first();
  const id = (await caja.getAttribute('data-pregunta'))!;
  const q = leerJson<{ preguntas: PreguntaJson[] }>(`repaso/${id.split('-')[0]}.json`).preguntas.find((x) => x.id === id)!;
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

/** Types the right (or a wrong) result of the numeric problem on screen. */
async function resolverNumerico(page: Page, bien = true): Promise<void> {
  const n = page.locator('.numerico[data-resultado]').first();
  const v = Number(await n.getAttribute('data-resultado'));
  await n.locator('[data-numero]').fill(bien ? String(Number(v.toPrecision(6))).replace('.', ',') : '987654321');
  await n.locator('[data-comprobar]').click();
}

// ================================================================== 1 · guided circuits and the saved montage

interface PbVentana {
  __epaProtoboard?: {
    pb: {
      doc: { titulo: string; piezas: unknown[]; cables: unknown[] };
      guia: { estado: { actual: number }; plan: { pasos: unknown[]; id: string } } | null;
      anadirCable: (a: [number, number], b: [number, number]) => unknown;
    };
  };
}
interface Montajes {
  circuitos: Record<string, { nombre: string; borrado?: number; doc: { titulo: string; piezas: unknown[]; cables: unknown[] } }>;
}

test.describe('1 · protoboard: terminar una guía no pisa el montaje', () => {
  async function abrirProtoboard(browser: Browser) {
    const ctx = await browser.newContext({ viewport: TABLETA, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await preparar(ctx, { 'protoboard-recorrido': 1, 'protoboard-leccion': 1 });
    const page = await ctx.newPage();
    await page.goto('/#/protoboard');
    await page.waitForFunction(() => !!(window as unknown as PbVentana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    return { ctx, page };
  }

  /** Builds the guide on screen with «Hazlo por mí», simulates it and waits for the celebration. */
  async function terminarGuia(page: Page): Promise<void> {
    const estado = () =>
      page.evaluate(() => {
        const g = (window as unknown as PbVentana).__epaProtoboard!.pb.guia!;
        return { actual: g.estado.actual, total: g.plan.pasos.length };
      });
    for (let k = 0; k < 30; k++) {
      const e = await estado();
      if (e.actual >= e.total - 1) break;
      await page.locator('.guia button:has-text("Hazlo por mí")').tap();
      await page.waitForTimeout(120);
    }
    // (the board may already simulate live after an earlier guide: the last step is then done by itself)
    await page.waitForTimeout(500);
    if (!(await page.locator('.fiesta').isVisible())) await page.locator('.guia button:has-text("Simular")').tap({ timeout: 15_000 }).catch(() => {});
    await expect(page.locator('.fiesta')).toBeVisible({ timeout: 120_000 });
  }

  async function elegirGuiado(page: Page, id: string): Promise<void> {
    await page.locator('.acciones .guiar').tap();
    await page.locator(`.elegir [data-guiado="${id}"]`).tap();
    await page.waitForTimeout(300);
  }

  const montajes = async (page: Page) => (await leer<Montajes>(page, 'protoboard-circuitos'))!.circuitos;
  const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as PbVentana).__epaProtoboard!.pb.doc)) as { titulo: string; piezas: unknown[]; cables: unknown[] });

  /** «Mi fuente»: the empty board (supply and its wires) with one wire more, saved in «Mis montajes»; returns its id. */
  async function guardarMiFuente(page: Page): Promise<string> {
    await page.evaluate(() => {
      const pb = (window as unknown as PbVentana).__epaProtoboard!.pb;
      pb.doc.titulo = 'Mi fuente';
      if (!pb.anadirCable([3, 3], [6, 3])) throw new Error('no se pudo poner el cable');
    });
    await page.locator('.cab button:has-text("Guardar")').click();
    await page.waitForURL(/#\/protoboard\/m/);
    const id = /#\/protoboard\/(.+)$/.exec(page.url())![1]!;
    await expect.poll(async () => (await doc(page)).titulo).toBe('Mi fuente');
    return id;
  }

  test('«Otro circuito» y «Seguir con esta placa» dejan «Mi fuente» como estaba', async ({ browser }) => {
    test.setTimeout(400_000);
    const { ctx, page } = await abrirProtoboard(browser);
    const vacia = (await doc(page)).cables.length;
    const id = await guardarMiFuente(page);
    const original = (await montajes(page))[id]!.doc;
    expect(original.cables).toHaveLength(vacia + 1);

    // «Otro circuito»: the chooser opens over the board as it was before the guide
    await elegirGuiado(page, 'led');
    await terminarGuia(page);
    await page.locator('.fiesta button:has-text("Otro circuito")').tap();
    await page.waitForTimeout(1200);
    expect((await montajes(page))[id]!.doc).toEqual(original);
    await expect(page.locator('.elegir')).toBeVisible();
    await page.locator('.elegir header button.salir').tap();
    expect(await doc(page)).toMatchObject({ titulo: 'Mi fuente', cables: original.cables });

    // «Seguir con esta placa»: the guide's board goes on as a new draft; the montage stays as it was
    await elegirGuiado(page, 'led');
    await terminarGuia(page);
    const guiada = await doc(page);
    await page.locator('.fiesta button:has-text("Seguir con esta placa")').tap();
    await page.waitForTimeout(1200);
    expect((await montajes(page))[id]!.doc).toEqual(original);
    await expect(page).toHaveURL(/#\/protoboard$/);
    expect((await doc(page)).piezas.length).toBe(guiada.piezas.length);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('epa:protoboard-borrador')))!).piezas.length).toBe(guiada.piezas.length);
    await ctx.close();
  });

  test('un cambio justo antes de empezar la guía se guarda en el montaje, no la placa de la guía', async ({ browser }) => {
    test.setTimeout(200_000);
    const { ctx, page } = await abrirProtoboard(browser);
    const vacia = (await doc(page)).cables.length;
    const id = await guardarMiFuente(page);
    await page.waitForTimeout(800);
    // a second wire and, at once (< 500 ms), «Monta este circuito» → LED
    await page.evaluate(async () => {
      const pb = (window as unknown as PbVentana).__epaProtoboard!.pb;
      if (!pb.anadirCable([2, 5], [9, 5])) throw new Error('no se pudo poner el cable');
      document.querySelector<HTMLButtonElement>('.acciones .guiar')!.click();
      for (let k = 0; k < 20 && !document.querySelector('.elegir [data-guiado="led"]'); k++) await new Promise((r) => requestAnimationFrame(r));
      document.querySelector<HTMLButtonElement>('.elegir [data-guiado="led"]')!.click();
    });
    await page.waitForTimeout(1500);
    const m = (await montajes(page))[id]!.doc;
    expect(m.titulo).toBe('Mi fuente');
    expect(m.cables).toHaveLength(vacia + 2);
    // «Salir»: back to the board with both wires
    await page.locator('.guia button.salir').tap();
    await expect.poll(async () => (await doc(page)).cables.length).toBe(vacia + 2);
    await ctx.close();
  });
});

// ================================================================== 2 and 3 · synchronisation of the problem of the day and mastery

interface DiasProblema {
  dias: Record<string, { id: string; t: number; r?: { bien: boolean; intentos: number; t: number } }>;
}
interface Dominio {
  items: Record<string, { s: string; c: string; r: number[][] }>;
}

// ------------------------------------------------------------------ the engine's rules
// (The round-1 simulation of the engine that was here assumed that a value a store keeps different from the file is
// sent again as new; since round 2 the union and the preferred day are made in the file itself (`unir`), and since
// round 3 a change without a mark is a stale copy and is not sent. Those cases now run on the REAL engine:
// revision11-motor.spec.ts, scenarios r2·4, r2·5 and r2·7.)

test.describe('2 · reglas del motor de sincronización (sin navegador)', () => {
  test('preferirDia: resuelto > sin resolver, bien > mal, la primera respuesta; simétrico', () => {
    const base = { id: 'x', t: 10 };
    const sin = { ...base, t: 5 };
    const bien = { ...base, r: { bien: true, intentos: 1, t: 20 } };
    const bienTarde = { ...base, r: { bien: true, intentos: 1, t: 30 } };
    const mal = { ...base, r: { bien: false, intentos: 2, t: 15 } };
    const otro = { id: 'y', t: 1 };
    for (const [x, y, gana] of [
      [sin, bien, bien],
      [otro, bien, bien],
      [mal, bien, bien],
      [bienTarde, bien, bien],
      [sin, otro, otro],
    ] as const) {
      expect(preferirDia(x, y)).toBe(gana);
      expect(preferirDia(y, x)).toBe(gana);
    }
  });

});

test.describe('11 · fusión entre pestañas (sin navegador)', () => {
  test('a tres bandas: cambios de una u otra, los dos, altas y bajas', () => {
    const base = huellasDe({ a: 1, b: 2, c: 3, d: 4, e: 5 });
    const local = { a: 1, b: 20, c: 3, e: 50, nuevo: 7 }; // b changed here, d deleted here, e changed here
    const entrante = { a: 10, b: 2, d: 4, e: 51, otro: 8 }; // a changed there, c deleted there, e changed there
    const f = fusionarPestanas(base, local, entrante, (x, y) => Math.max(x, y));
    expect(f.mapa).toEqual({ a: 10, b: 20, e: 51, nuevo: 7, otro: 8 });
    expect(f.cambiado).toBe(true);
    expect(f.reescribir).toBe(true);
    // the other tab already has everything: nothing to write back
    const g = fusionarPestanas(huellasDe({ a: 1 }), { a: 1 }, { a: 1, b: 2 }, (x) => x);
    expect(g).toEqual({ mapa: { a: 1, b: 2 }, cambiado: true, reescribir: false });
  });
});

test.describe('2 · problema del día entre dos dispositivos', () => {
  test('un día resuelto nunca pierde frente al mismo día sin resolver (ni frente a un fallo)', async ({ browser }) => {
    test.setTimeout(240_000);
    const gh = new FakeGitHub();
    const T9 = new Date(2026, 9, 20, 9, 0, 0).getTime();
    const H = 3_600_000;
    const base = { k: 'practica', parte: 'cap00', semilla: 5, curso: 'fundamentos' };
    const resuelto = (id: string, t: number) => ({ ...base, id, t: t - 60_000, r: { bien: true, intentos: 1, t } });
    // A solved three days at 9:00; B, offline, showed them later: the same problem unanswered, another problem
    // unanswered, and the same problem answered wrong
    const a = await dispositivo(browser, gh, {
      'problema-dia': {
        version: 1,
        dias: {
          '2026-10-20': resuelto('cap00-num-carga-rc', T9),
          '2026-10-21': resuelto('cap00-num-carga-rc', T9 + 24 * H),
          '2026-10-22': resuelto('cap00-num-carga-rc', T9 + 48 * H),
        },
      },
    });
    await sincronizarAhora(a.page);
    const b = await dispositivo(browser, gh, {
      'problema-dia': {
        version: 1,
        dias: {
          '2026-10-20': { ...base, id: 'cap00-num-carga-rc', t: T9 + H },
          '2026-10-21': { ...base, id: 'cap00-num-descarga-rc', t: T9 + 25 * H },
          '2026-10-22': { ...base, id: 'cap00-num-carga-rc', t: T9 + 49 * H - 60_000, r: { bien: false, intentos: 2, t: T9 + 49 * H } },
        },
      },
    });
    await sincronizarAhora(b.page);
    for (const p of [a.page, a.page, b.page, a.page, b.page]) await sincronizarAhora(p);
    for (const [quien, p] of [
      ['A', a.page],
      ['B', b.page],
    ] as const) {
      const dias = (await leer<DiasProblema>(p, 'problema-dia'))!.dias;
      for (const d of ['2026-10-20', '2026-10-21', '2026-10-22']) {
        expect(dias[d]?.r?.bien, `${quien} ${d}`).toBe(true);
        expect(dias[d]!.id, `${quien} ${d}`).toBe('cap00-num-carga-rc');
      }
    }
    // converged: one more run on each writes nothing
    const n = gh.escrituras;
    await sincronizarAhora(a.page);
    await sincronizarAhora(b.page);
    expect(gh.escrituras).toBe(n);
    await a.ctx.close();
    await b.ctx.close();
  });
});

test.describe('3 · dominio: la unión de rondas se guarda enseguida', () => {
  test('la unión está en el almacén al terminar la pasada y sobrevive a una sincronización interrumpida', async ({ browser }) => {
    test.setTimeout(180_000);
    const gh = new FakeGitHub();
    const T = new Date(2026, 9, 10, 10, 0, 0).getTime();
    const b = await dispositivo(browser, gh, { dominio: { version: 1, migrado: 1, items: { 'cap05-01': { s: 'cap05/sec-5.1', c: 'q', r: [[T + 3 * DIA_MS, 0]] } } } });
    await sincronizarAhora(b.page);
    const a = await dispositivo(browser, gh, { dominio: { version: 1, migrado: 1, items: { 'cap05-01': { s: 'cap05/sec-5.1', c: 'q', r: [[T, 100]] } } } });
    // what the almacen holds when the run announces its end (a crash right after would keep exactly this)
    await a.page.evaluate(() => {
      window.addEventListener('epa:sincronizado', () => {
        (window as unknown as { __alTerminar: string | null }).__alTerminar = localStorage.getItem('epa:dominio');
      });
    });
    const estadoAntes = await a.page.evaluate(() => localStorage.getItem('epa:sinc-estado'));
    await sincronizarAhora(a.page);
    const union = [
      [T, 100],
      [T + 3 * DIA_MS, 0],
    ];
    const alTerminar = JSON.parse((await a.page.evaluate(() => (window as unknown as { __alTerminar: string | null }).__alTerminar))!) as Dominio;
    expect(alTerminar.items['cap05-01']!.r).toEqual(union);
    // the run is «interrupted»: its record of what was synchronised is lost and the app restarts
    await a.page.evaluate((e) => (e === null ? localStorage.removeItem('epa:sinc-estado') : localStorage.setItem('epa:sinc-estado', e)), estadoAntes);
    await a.page.reload();
    await expect(a.page.locator('[data-pagina="sincronizacion"]')).toBeVisible();
    expect((await leer<Dominio>(a.page, 'dominio'))!.items['cap05-01']!.r).toEqual(union);
    await sincronizarAhora(a.page);
    await sincronizarAhora(b.page);
    expect((await leer<Dominio>(b.page, 'dominio'))!.items['cap05-01']!.r).toEqual(union);
    expect((gh.doc()!.almacenes.dominio!['cap05-01'] as { v: { r: number[][] } }).v.r).toEqual(union);
    await a.ctx.close();
    await b.ctx.close();
  });
});

// ================================================================== 4 · celebrations

/** WCAG contrast of two CSS rgb() colours. */
function contraste(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((x) => {
      const v = Number(x) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

test.describe('4 · celebraciones', () => {
  test.use({ viewport: TABLETA });

  test('un segundo logro en la misma sesión también se celebra, y su rótulo sigue el tema en vivo', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx, { prefs: { tema: 'auto', tam: 18 } });
    const page = await ctx.newPage();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    await responderPregunta(page, true);
    // the first achievement(s) of the session, then nothing on screen for a while
    await expect(page.locator('[data-aviso="logro"]')).toBeVisible();
    await expect(page.locator('[data-aviso]')).toHaveCount(0, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-aviso]')).toHaveCount(0);
    // the rest of the lesson: «primera lección» is a new achievement, announced too
    for (;;) {
      await page.locator('[data-continuar]').click();
      if (await page.locator('[data-resumen]').isVisible()) break;
      await expect(page.locator('[data-pregunta]')).toBeVisible();
      await responderPregunta(page, true);
    }
    const toast = page.locator('[data-aviso="logro"]');
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // the theme changes while it is open (the system's dark mode, then sepia, then light again, as App.svelte sets
    // them): the label takes the new theme's tokens at once (≥ 4.5:1)
    const medir = () =>
      page.evaluate(() => {
        const rot = document.querySelector('.celebraciones .rot');
        if (!rot) return null;
        // the theme's tokens, resolved by the browser on a probe
        const sonda = document.createElement('span');
        sonda.style.cssText = 'position:fixed;color:var(--tinta-suave);background:var(--superficie)';
        document.body.append(sonda);
        const cs = getComputedStyle(sonda);
        const r = {
          tema: document.documentElement.dataset.tema ?? '',
          color: getComputedStyle(rot).color,
          fondo: getComputedStyle(rot.closest('.grande')!).backgroundColor,
          token: cs.color,
          fondoToken: cs.backgroundColor,
        };
        sonda.remove();
        return r;
      });
    const medidas: NonNullable<Awaited<ReturnType<typeof medir>>>[] = [];
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
    medidas.push((await medir())!);
    await page.evaluate(() => (document.documentElement.dataset.tema = 'sepia'));
    medidas.push((await medir())!);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
    medidas.push((await medir())!);
    expect(medidas.map((m) => m.tema)).toEqual(['oscuro', 'sepia', 'claro']);
    for (const m of medidas) {
      expect(m.color, m.tema).toBe(m.token);
      expect(m.fondo, m.tema).toBe(m.fondoToken);
      expect(contraste(m.color, m.fondo), m.tema).toBeGreaterThanOrEqual(4.5);
    }
    await ctx.close();
  });
});

// ================================================================== 5 · achievements failing

test.describe('5 · un fallo al calcular los logros', () => {
  test('no deja sin XP ni rompe la sincronización', async ({ browser }) => {
    test.setTimeout(120_000);
    const gh = new FakeGitHub();
    // a damaged lesson record (null) made the statistics throw: XP never loaded and every run failed
    const a = await dispositivo(browser, gh, {
      lecciones: { 'cap05/sec-5.1': null, 'cap05/sec-5.2': { h: [1], u: 0, n: 3, t: 1761400000000 } },
      'progreso-xp': { version: 1, xp: { 'pq:cap05-01': { x: 10, t: 1761400000000 } }, logros: {} },
    });
    await sincronizarAhora(a.page);
    await expect(a.page.locator('[data-error-sinc]')).toHaveCount(0);
    expect(gh.doc()!.almacenes['progreso-xp']!['pq:cap05-01']).toBeTruthy();
    await a.page.goto('./#/progreso');
    await expect(a.page.locator('.total')).toHaveText(/^\s*10\s*XP\s*$/, { timeout: 20_000 });
    await a.ctx.close();
  });
});

// ================================================================== 6 · problem of the day: pools and frontier chapter

const practicaDe = (p: string) => {
  try {
    return leerJson<{ items: { id: string; tipo: string; parte: string }[] }>(`practica/${p}.json`).items;
  } catch {
    return [];
  }
};

test.describe('6 · problema del día: qué fondo y qué capítulo', () => {
  test('pesa más el capítulo al que ha llegado el lector (determinista)', () => {
    const fund = CURSOS[0]!;
    const cands: CandidatoProblema[] = [];
    for (const p of fund.partes) for (const it of practicaDe(p).filter((x) => x.tipo === 'numerico')) cands.push({ id: it.id, k: 'practica', parte: it.parte, orden: fund.partes.indexOf(p) * 1000 });
    const nivel = 5;
    const cuenta = new Map<string, number>();
    const N = 400;
    for (let d = 0; d < N; d++) {
      const dia = claveDia(new Date(2026, 0, 1, 12).getTime() + d * DIA_MS);
      const x = problemaDelDia(dia, fund, nivel, cands)!;
      expect(problemaDelDia(dia, fund, nivel, [...cands].reverse())).toEqual(x);
      cuenta.set(x.parte, (cuenta.get(x.parte) ?? 0) + 1);
    }
    const frontera = fund.partes[nivel]!;
    expect(cands.some((c) => c.parte === frontera)).toBe(true);
    expect((cuenta.get(frontera) ?? 0) / N).toBeGreaterThan(0.38);
    expect((cuenta.get(frontera) ?? 0) / N).toBeLessThan(0.62);
    // the first chapter only now and then
    expect((cuenta.get(fund.partes[0]!) ?? 0) / N).toBeLessThan(0.12);
    // never beyond the level while the pool has something
    for (const p of cuenta.keys()) expect(fund.partes.indexOf(p)).toBeLessThanOrEqual(nivel);
  });

  test('en «Taller», con el ejercicio de cap11 resuelto, un «Calcula» del curso antes que un ejercicio posterior', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx, {
      posiciones: { cap11: { b: 3, sec: 'sec-11.1', f: 0.1, t: Date.now() - 60_000 } },
      ejercicios: { 'prob-11.A': { intentos: 1, fallos: 0, resuelto: true, pistas: 0, solucion: false, t: Date.now() - 120_000 } },
      'problema-dia': { version: 1, dias: {} },
    });
    const page = await ctx.newPage();
    await page.goto('#/problema');
    await expect(page.locator('[data-problema-dia][data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    type Dias = { dias: Record<string, { id: string; k: string; parte: string; curso: string }> };
    await expect.poll(async () => Object.keys((await leer<Dias>(page, 'problema-dia'))?.dias ?? {}).length).toBe(1);
    const d = Object.values((await leer<Dias>(page, 'problema-dia'))!.dias)[0]!;
    expect(d.curso).toBe('taller');
    expect(d.k).toBe('practica');
    expect(['cap21', 'cap22', 'cap47']).toContain(d.parte);
    await ctx.close();
  });
});

// ================================================================== 7 · DST

test.describe('7 · corte de día del dominio', () => {
  test('numeroDia y claveDia cortan a las 04:00 también en los cambios de hora', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Europe/Madrid';
    try {
      const num = (k: string) => {
        const [a, m, d] = k.split('-').map(Number);
        return Math.round(Date.UTC(a!, m! - 1, d!) / DIA_MS);
      };
      for (const t of [
        new Date(2026, 2, 29, 4, 30).getTime(), // spring forward (03:00 is 02:00 + 1 h)
        new Date(2026, 9, 25, 3, 30).getTime(), // fall back
        new Date(2026, 9, 25, 4, 0).getTime(),
        new Date(2026, 2, 29, 3, 59).getTime(),
        new Date(2026, 5, 1, 4, 0).getTime(),
        new Date(2026, 5, 1, 3, 59).getTime(),
      ]) {
        expect(numeroDia(t), new Date(t).toString()).toBe(num(claveDia(t)));
      }
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});

// ================================================================== 8 · the 04:00 day change

test.describe('8 · el problema del día sigue el cambio de día', () => {
  test('la página y la tarjeta de inicio pasan al día nuevo a las 04:00', async ({ browser }) => {
    test.setTimeout(180_000);
    const ayer = { id: 'cap00-num-carga-rc', k: 'practica', parte: 'cap00', semilla: 11, curso: 'fundamentos', t: 1, r: { bien: true, intentos: 1, t: 2 } };
    const ctx = await browser.newContext({ viewport: TABLETA, timezoneId: 'Europe/Madrid' });
    await preparar(ctx, { 'problema-dia': { version: 1, dias: { '2026-10-29': ayer } } });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-10-30T03:55:00+01:00') });

    // the start page at 03:55: still the 29th, solved
    await page.goto('#/');
    await expect(page.locator('[data-problema-inicio="bien"]')).toBeVisible({ timeout: 30_000 });
    await page.clock.fastForward('10:00');
    await expect(page.locator('[data-problema-inicio="pendiente"]')).toBeVisible({ timeout: 20_000 });

    // the page opened at 03:58 (the 29th, solved)… at 04:00 it shows the 30th's problem, which gets the answer
    const p2 = await ctx.newPage();
    await p2.clock.install({ time: new Date('2026-10-30T03:58:00+01:00') });
    await p2.goto('#/problema');
    await expect(p2.locator('[data-problema-dia="2026-10-29"][data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    await p2.clock.fastForward('05:00');
    await expect(p2.locator('[data-problema-dia="2026-10-30"][data-estado="listo"]')).toBeVisible({ timeout: 20_000 });
    await resolverNumerico(p2, true);
    await expect(p2.locator('[data-problema-dia]')).toHaveAttribute('data-resuelto', 'bien');
    await expect.poll(async () => (await leer<DiasProblema>(p2, 'problema-dia'))?.dias['2026-10-30']?.r?.bien).toBe(true);
    await expect.poll(async () => Object.keys((await leer<{ xp: Record<string, unknown> }>(p2, 'progreso-xp'))?.xp ?? {}).filter((k) => k.startsWith('pd:'))).toEqual(['pd:2026-10-30']);
    await ctx.close();
  });
});

// ================================================================== 9 · consumers chunk failing

test.describe('9 · si falla la carga de los consumidores', () => {
  test.use({ viewport: TABLETA });

  test('los eventos se guardan y se reintentan: el XP llega en la misma sesión o tras recargar', async ({ browser }) => {
    test.setTimeout(180_000);
    // a transient failure: the first request of the chunk fails, the retry in the session gets it
    const ctx = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx);
    let fallos = 0;
    await ctx.route(/\/assets\/consumidores-[^/]+\.js/, (r) => (fallos++ === 0 ? r.abort() : r.continue()));
    const page = await ctx.newPage();
    await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    await responderPregunta(page, true);
    await expect.poll(async () => (await leer<{ xp: Record<string, unknown> }>(page, 'progreso-xp'))?.xp?.['pq:cap05-01'] ?? null, { timeout: 30_000 }).not.toBeNull();
    expect(fallos).toBeGreaterThanOrEqual(2);
    await ctx.close();

    // a lasting failure (e.g. an update replaced the files): the events wait for the next start
    const ctx2 = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx2);
    let bloquear = true;
    await ctx2.route(/\/assets\/consumidores-[^/]+\.js/, (r) => (bloquear ? r.abort() : r.continue()));
    const p2 = await ctx2.newPage();
    await p2.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(p2.locator('[data-pregunta]')).toBeVisible();
    await responderPregunta(p2, true);
    await p2.waitForTimeout(1500);
    expect((await leer<{ xp: Record<string, unknown> }>(p2, 'progreso-xp'))?.xp?.['pq:cap05-01']).toBeUndefined();
    bloquear = false;
    await p2.goto('#/');
    await p2.reload();
    await expect.poll(async () => (await leer<{ xp: Record<string, unknown> }>(p2, 'progreso-xp'))?.xp?.['pq:cap05-01'] ?? null, { timeout: 30_000 }).not.toBeNull();
    await ctx2.close();
  });
});

// ================================================================== 10 · a guide replaced by another

test.describe('10 · una guía que sustituye a otra', () => {
  test('no cuenta ningún paso al empezar', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: TABLETA, isMobile: true, hasTouch: true });
    await preparar(ctx, { 'protoboard-recorrido': 1, 'protoboard-leccion': 1 });
    const page = await ctx.newPage();
    await page.goto('/#/protoboard');
    await page.waitForFunction(() => !!(window as unknown as PbVentana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    const ids = ['led', 'divisor', 'pulsador', 'transistor', '555'];
    const falsos: string[] = [];
    for (const desde of ids) {
      for (const hacia of ids) {
        if (desde === hacia) continue;
        await page.locator('.acciones .guiar').tap();
        await page.locator(`.elegir [data-guiado="${desde}"]`).tap();
        await page.waitForTimeout(150);
        // a few steps of the first guide…
        for (let k = 0; k < 3; k++) {
          await page.locator('.guia button:has-text("Hazlo por mí")').tap();
          await page.waitForTimeout(80);
        }
        // …then, from the chooser, the second one (the first guide closes in the same tap)
        await page.evaluate(() => ((window as unknown as { __epaEventos: unknown[] }).__epaEventos.length = 0));
        await page.locator('.acciones .guiar').tap();
        await page.locator(`.elegir [data-guiado="${hacia}"]`).tap();
        await page.waitForTimeout(250);
        const ev = (await eventos(page)).filter((e) => e.tipo === 'paso-montaje');
        if (ev.length) falsos.push(`${desde}→${hacia}: ${JSON.stringify(ev)}`);
        await page.locator('.guia button.salir').tap();
        await page.waitForTimeout(100);
      }
    }
    expect(falsos).toEqual([]);
    await ctx.close();
  });
});

// ================================================================== 11 · two tabs

test.describe('11 · dos pestañas', () => {
  test('lo que guarda una pestaña no borra lo que guardó la otra', async ({ browser }) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx, { 'problema-dia': { version: 1, dias: {} } });
    const a = await ctx.newPage();
    await a.goto('#/problema');
    await expect(a.locator('[data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => Object.keys((await leer<DiasProblema>(a, 'problema-dia'))?.dias ?? {}).length).toBe(1);
    await a.waitForTimeout(500);

    // another tab of the same browser stores its own progress meanwhile (written as that tab would)
    const b = await ctx.newPage();
    await b.goto('/libro/indice.json');
    const T = Date.now() - 5 * DIA_MS;
    await b.evaluate((T) => {
      const pd = JSON.parse(localStorage.getItem('epa:problema-dia')!);
      pd.dias['2026-01-05'] = { id: 'cap00-num-descarga-rc', k: 'practica', parte: 'cap00', semilla: 3, curso: 'fundamentos', t: T, r: { bien: true, intentos: 1, t: T + 1 } };
      localStorage.setItem('epa:problema-dia', JSON.stringify(pd));
      const xp = JSON.parse(localStorage.getItem('epa:progreso-xp') ?? '{"version":1,"xp":{},"logros":{}}');
      xp.xp['l:cap01/sec-1.1'] = { x: 20, t: T };
      xp.logros['otra-pestana'] = T;
      localStorage.setItem('epa:progreso-xp', JSON.stringify(xp));
      const dom = JSON.parse(localStorage.getItem('epa:dominio') ?? '{"version":1,"items":{},"migrado":1}');
      dom.items['cap01-01'] = { s: 'cap01/sec-1.1', c: 'q', r: [[T, 100]] };
      localStorage.setItem('epa:dominio', JSON.stringify(dom));
      localStorage.setItem('epa:cursos', JSON.stringify({ version: 1, superadas: { 'cap00/sec-0.1': T }, pruebas: {} }));
    }, T);

    // this tab answers today's problem: XP, mastery and the day are written…
    await resolverNumerico(a, true);
    await expect(a.locator('[data-problema-dia]')).toHaveAttribute('data-resuelto', 'bien');
    await expect.poll(async () => Object.keys((await leer<{ xp: Record<string, unknown> }>(a, 'progreso-xp'))?.xp ?? {}).some((k) => k.startsWith('pd:'))).toBe(true);
    await a.waitForTimeout(1500);
    // …and the other tab's are still there
    expect((await leer<DiasProblema>(a, 'problema-dia'))!.dias['2026-01-05']?.r?.bien).toBe(true);
    const xp = (await leer<{ xp: Record<string, unknown>; logros: Record<string, number> }>(a, 'progreso-xp'))!;
    expect(xp.xp['l:cap01/sec-1.1']).toBeTruthy();
    expect(xp.logros['otra-pestana']).toBe(T);
    expect((await leer<Dominio>(a, 'dominio'))!.items['cap01-01']).toBeTruthy();
    expect((await leer<{ superadas: Record<string, number> }>(a, 'cursos'))!.superadas['cap00/sec-0.1']).toBe(T);
    await ctx.close();
  });
});

// ================================================================== second review (round 2): stores and tabs

test.describe('ronda 2 · 6 · pestañas sin evento «storage»', () => {
  test('una pestaña que no recibió el aviso (cargando, o restaurada de la caché) fusiona antes de escribir', async ({ browser }) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx, { 'problema-dia': { version: 1, dias: {} } });
    const a = await ctx.newPage();
    // this tab misses every storage event from now on (as while it loads, or after a back-forward cache restore)
    await a.addInitScript(() => window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true));
    await a.goto('#/problema');
    await expect(a.locator('[data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => Object.keys((await leer<DiasProblema>(a, 'problema-dia'))?.dias ?? {}).length).toBe(1);
    await a.waitForTimeout(500);
    const b = await ctx.newPage();
    await b.goto('/libro/indice.json');
    const T = Date.now() - 5 * DIA_MS;
    await b.evaluate((T) => {
      const pd = JSON.parse(localStorage.getItem('epa:problema-dia')!);
      pd.dias['2026-01-05'] = { id: 'cap00-num-descarga-rc', k: 'practica', parte: 'cap00', semilla: 3, curso: 'fundamentos', t: T, r: { bien: true, intentos: 1, t: T + 1 } };
      localStorage.setItem('epa:problema-dia', JSON.stringify(pd));
      const xp = JSON.parse(localStorage.getItem('epa:progreso-xp') ?? '{"version":1,"xp":{},"logros":{}}');
      xp.xp['pq:cap01-01'] = { x: 10, t: T };
      localStorage.setItem('epa:progreso-xp', JSON.stringify(xp));
      const dom = JSON.parse(localStorage.getItem('epa:dominio') ?? '{"version":1,"items":{},"migrado":1}');
      dom.items['cap01-01'] = { s: 'cap01/sec-1.1', c: 'q', r: [[T, 100]] };
      localStorage.setItem('epa:dominio', JSON.stringify(dom));
    }, T);
    await resolverNumerico(a, true);
    await expect(a.locator('[data-problema-dia]')).toHaveAttribute('data-resuelto', 'bien');
    await expect.poll(async () => Object.keys((await leer<{ xp: Record<string, unknown> }>(a, 'progreso-xp'))?.xp ?? {}).some((k) => k.startsWith('pd:'))).toBe(true);
    await a.waitForTimeout(1500);
    expect((await leer<DiasProblema>(a, 'problema-dia'))!.dias['2026-01-05']?.r?.bien).toBe(true);
    expect((await leer<{ xp: Record<string, unknown> }>(a, 'progreso-xp'))!.xp['pq:cap01-01']).toBeTruthy();
    expect((await leer<Dominio>(a, 'dominio'))!.items['cap01-01']).toBeTruthy();
    await ctx.close();
  });
});

test.describe('ronda 2 · 8 · una escritura que falla al aplicar', () => {
  test('si el almacenamiento no deja guardar lo recibido, no se reenvía después la copia vieja', async ({ browser }) => {
    test.setTimeout(150_000);
    const gh = new FakeGitHub();
    const T1 = new Date(2026, 9, 1, 10).getTime();
    const T2 = T1 + 3 * DIA_MS;
    const prueba = (t: number, aciertos: number) => ({ version: 1, superadas: {}, pruebas: { fundamentos: { t, aciertos, total: 8, recomendado: 'cap01', marcadas: 0 } } });
    const a = await dispositivo(browser, gh, { cursos: prueba(T1, 3) });
    await sincronizarAhora(a.page);
    const b = await dispositivo(browser, gh, { cursos: prueba(T2, 7) });
    await sincronizarAhora(b.page);
    // A's storage refuses the courses key (full, for instance) during the run that receives B's newer test
    await a.page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === 'epa:cursos') throw new DOMException('lleno', 'QuotaExceededError');
        return original.call(this, k, v);
      };
    });
    await sincronizarAhora(a.page);
    // the app restarts (memory lost; the storage works again) and synchronises
    await a.page.reload();
    await expect(a.page.locator('[data-pagina="sincronizacion"]')).toBeVisible();
    await sincronizarAhora(a.page);
    const fichero = gh.doc()!.almacenes['cursos-pruebas']!.fundamentos as { v: { aciertos: number } };
    expect(fichero.v.aciertos).toBe(7);
    expect((await leer<{ pruebas: Record<string, { aciertos: number }> }>(a.page, 'cursos'))!.pruebas.fundamentos!.aciertos).toBe(7);
    await a.ctx.close();
    await b.ctx.close();
  });
});

test.describe('ronda 2 · 9 · varias pestañas sincronizando', () => {
  test('una pasada cada vez (sin conflictos) y la segunda pestaña lee el estado de la primera', async ({ browser }) => {
    test.setTimeout(120_000);
    const gh = new FakeGitHub();
    const a1 = await dispositivo(browser, gh, { marcadores: { 'sec-5.1': { parte: 'cap05', label: 'sec-5.1', num: '5.1', titulo: 'x', t: 1761400000000 } } });
    const a2 = await a1.ctx.newPage();
    await a2.goto('./#/sincronizacion');
    await expect(a2.locator('[data-pagina="sincronizacion"]')).toBeVisible();
    gh.esperaLectura = 400;
    const n = (p: Page) => p.locator('[data-pagina="sincronizacion"]').getAttribute('data-ejecuciones').then(Number);
    const [n1, n2] = [await n(a1.page), await n(a2)];
    await Promise.all([a1.page.locator('[data-sincronizar]').click(), a2.locator('[data-sincronizar]').click()]);
    await expect(a1.page.locator('[data-pagina="sincronizacion"]')).toHaveAttribute('data-ejecuciones', String(n1 + 1));
    await expect(a2.locator('[data-pagina="sincronizacion"]')).toHaveAttribute('data-ejecuciones', String(n2 + 1));
    expect(gh.conflictos).toBe(0);
    expect(gh.escrituras).toBe(1);
    await a1.ctx.close();
  });
});

test.describe('ronda 2 · 10 · eventos mientras cargan sus consumidores', () => {
  test.use({ viewport: TABLETA });
  test('un evento emitido mientras se cargan los consumidores sobrevive a cerrar la página', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx);
    let colgar = true;
    const colgadas: Route[] = [];
    await ctx.route(/\/assets\/consumidores-[^/]+\.js/, (r) => (colgar ? void colgadas.push(r) : r.continue()));
    const page = await ctx.newPage();
    await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    await responderPregunta(page, true);
    await page.waitForTimeout(500);
    expect((await leer<{ xp: Record<string, unknown> }>(page, 'progreso-xp'))?.xp?.['pq:cap05-01']).toBeUndefined();
    // the page is closed while the chunk is still on its way; the next start delivers the event
    colgar = false;
    await page.close();
    for (const r of colgadas) await r.abort().catch(() => {});
    const p2 = await ctx.newPage();
    await p2.goto('#/');
    await expect.poll(async () => (await leer<{ xp: Record<string, unknown> }>(p2, 'progreso-xp'))?.xp?.['pq:cap05-01'] ?? null, { timeout: 30_000 }).not.toBeNull();
    await ctx.close();
  });
});

// ================================================================== third review (round 3): the modules' memory
// (The engine's side of the eight findings runs on the real engine in Node: revision11-motor.spec.ts.)

const circuitoGuardado = (id: string, nombre: string, t: number) => ({
  id,
  nombre,
  creado: t,
  actualizado: t,
  doc: { version: 1, titulo: nombre, componentes: [], cables: [], analisis: analisisPorDefecto(), directivas: '' },
});
type Circuitos = { version: 1; circuitos: Record<string, { nombre: string; borrado?: number }> };

test.describe('ronda 3 · 1 · la memoria de un módulo no pisa lo que trajo la sincronización', () => {
  test('el editor abierto recibe el circuito sincronizado y no lo borra al guardar otro', async ({ browser }) => {
    test.setTimeout(150_000);
    const gh = new FakeGitHub();
    const T = new Date(2026, 9, 1, 10).getTime();
    const b = await dispositivo(browser, gh, { 'editor-circuitos': { version: 1, circuitos: { cB: circuitoGuardado('cB', 'De la tableta', T) } } });
    await sincronizarAhora(b.page);
    const a = await dispositivo(browser, gh, { 'editor-circuitos': { version: 1, circuitos: { cA: circuitoGuardado('cA', 'Del portátil', T + 1000) } } });
    // the editor is opened (its circuits are loaded into memory), then the reader synchronises without reloading
    await a.page.evaluate(() => (location.hash = '#/editor'));
    await expect(a.page.locator('.lienzo')).toBeVisible({ timeout: 30_000 });
    await a.page.evaluate(() => (location.hash = '#/sincronizacion'));
    await expect(a.page.locator('[data-pagina="sincronizacion"]')).toBeVisible();
    await sincronizarAhora(a.page);
    expect(Object.keys((await leer<Circuitos>(a.page, 'editor-circuitos'))!.circuitos).sort()).toEqual(['cA', 'cB']);
    // back in the editor: «Mis circuitos» lists the synchronised circuit, and renaming another one keeps it
    await a.page.evaluate(() => (location.hash = '#/editor'));
    await expect(a.page.locator('.lienzo')).toBeVisible();
    await a.page.getByRole('button', { name: 'Mis circuitos' }).click();
    const dialogo = a.page.getByRole('dialog', { name: 'Mis circuitos' });
    await expect(dialogo).toContainText('De la tableta');
    await dialogo.getByRole('button', { name: 'Cambiar el nombre de Del portátil' }).click();
    await dialogo.getByLabel('Nuevo nombre').fill('Fuente lineal');
    await dialogo.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await expect.poll(async () => (await leer<Circuitos>(a.page, 'editor-circuitos'))!.circuitos.cA?.nombre).toBe('Fuente lineal');
    const guardados = (await leer<Circuitos>(a.page, 'editor-circuitos'))!.circuitos;
    expect(guardados.cB?.nombre).toBe('De la tableta');
    expect(guardados.cB?.borrado).toBeUndefined();
    // and the next synchronisation does not delete it anywhere
    await a.page.evaluate(() => (location.hash = '#/sincronizacion'));
    await sincronizarAhora(a.page);
    const fichero = gh.doc()!.almacenes['editor-circuitos']!;
    expect((fichero.cB as { v?: { borrado?: number } }).v?.borrado).toBeUndefined();
    expect((fichero.cA as { v: { nombre: string } }).v.nombre).toBe('Fuente lineal');
    await a.ctx.close();
    await b.ctx.close();
  });

  test('una pestaña con marcadores viejos en memoria no borra el que trajo otra pestaña al sincronizar', async ({ browser }) => {
    test.setTimeout(150_000);
    const gh = new FakeGitHub();
    const m = (label: string, num: string, t: number) => ({ parte: 'cap05', label, num, titulo: `Sección ${num}`, t });
    const T = new Date(2026, 9, 1, 10).getTime();
    const b = await dispositivo(browser, gh, { marcadores: { 'sec-5.3': m('sec-5.3', '5.3', T) } });
    await sincronizarAhora(b.page);
    const a = await dispositivo(browser, gh, { marcadores: { 'sec-5.1': m('sec-5.1', '5.1', T), 'sec-5.2': m('sec-5.2', '5.2', T) } });
    // a second tab of the same browser, open before the run, shows the two bookmarks it loaded…
    const a2 = await a.ctx.newPage();
    await a2.goto('./#/marcadores');
    await expect(a2.getByRole('button', { name: 'Quitar el marcador de 5.2' })).toBeVisible();
    await sincronizarAhora(a.page);
    expect(Object.keys((await leer<Record<string, unknown>>(a.page, 'marcadores'))!).sort()).toEqual(['sec-5.1', 'sec-5.2', 'sec-5.3']);
    // …the storage event brings the synchronised one to that tab, and removing another bookmark there keeps it
    await expect(a2.getByRole('button', { name: 'Quitar el marcador de 5.3' })).toBeVisible();
    await a2.getByRole('button', { name: 'Quitar el marcador de 5.2' }).click();
    await expect.poll(async () => Object.keys((await leer<Record<string, unknown>>(a2, 'marcadores'))!).sort()).toEqual(['sec-5.1', 'sec-5.3']);
    await sincronizarAhora(a.page);
    expect(gh.doc()!.almacenes.marcadores!['sec-5.3']).toMatchObject({ v: { label: 'sec-5.3' } });
    expect((gh.doc()!.almacenes.marcadores!['sec-5.2'] as { x?: number }).x).toBe(1);
    await a.ctx.close();
    await b.ctx.close();
  });

  test('una pestaña que no recibió el aviso tampoco borra lo sincronizado (lee, fusiona y escribe)', async ({ browser }) => {
    test.setTimeout(150_000);
    const gh = new FakeGitHub();
    const T = new Date(2026, 9, 1, 10).getTime();
    const b = await dispositivo(browser, gh, { notas: { 'sec-5.3': { parte: 'cap05', label: 'sec-5.3', num: '5.3', titulo: 'Shockley', texto: 'de la tableta', t: T } } });
    await sincronizarAhora(b.page);
    const a = await dispositivo(browser, gh, { notas: { 'sec-5.1': { parte: 'cap05', label: 'sec-5.1', num: '5.1', titulo: 'Uno', texto: 'mía', t: T } } });
    // a tab that misses every storage event (loading, or restored from the back-forward cache) shows the notes
    const a2 = await a.ctx.newPage();
    await a2.addInitScript(() => window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true));
    await a2.goto('./#/marcadores');
    await expect(a2.locator('.marcadores .nota', { hasText: 'mía' })).toBeVisible();
    await sincronizarAhora(a.page);
    expect(Object.keys((await leer<Record<string, unknown>>(a.page, 'notas'))!).sort()).toEqual(['sec-5.1', 'sec-5.3']);
    // removing its own note writes what the storage has, minus that note
    await a2.locator('.marcadores li', { hasText: 'mía' }).getByRole('button', { name: 'Borrar' }).click();
    await expect.poll(async () => Object.keys((await leer<Record<string, unknown>>(a2, 'notas'))!).sort()).toEqual(['sec-5.3']);
    await sincronizarAhora(a.page);
    expect(gh.doc()!.almacenes.notas!['sec-5.3']).toMatchObject({ v: { texto: 'de la tableta' } });
    await a.ctx.close();
    await b.ctx.close();
  });
});

test.describe('ronda 3 · 2 · aplicar es atómico en los módulos', () => {
  test('si no se puede guardar lo recibido, la memoria no cambia y la copia vieja no se reenvía', async ({ browser }) => {
    test.setTimeout(150_000);
    const gh = new FakeGitHub();
    const T = new Date(2026, 9, 1, 10).getTime();
    const nota = (texto: string, t: number) => ({ 'sec-5.1': { parte: 'cap05', label: 'sec-5.1', num: '5.1', titulo: 'Uno', texto, t } });
    const a = await dispositivo(browser, gh, { notas: nota('antigua', T) });
    await sincronizarAhora(a.page);
    const b = await dispositivo(browser, gh, { notas: nota('nueva de la tableta', T + DIA_MS) });
    await sincronizarAhora(b.page);
    // A's storage refuses the notes during the run that receives B's newer note
    await a.page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as unknown as { __restaurar: () => void }).__restaurar = () => (Storage.prototype.setItem = original);
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === 'epa:notas') throw new DOMException('lleno', 'QuotaExceededError');
        return original.call(this, k, v);
      };
    });
    await sincronizarAhora(a.page);
    // memory and storage alike: the note on screen is still the stored one
    await a.page.evaluate(() => (location.hash = '#/marcadores'));
    await expect(a.page.locator('.marcadores .nota')).toContainText('antigua');
    expect((await leer<Record<string, { texto: string }>>(a.page, 'notas'))!['sec-5.1']!.texto).toBe('antigua');
    // the storage works again: the next run brings the newer note, and the file keeps it
    await a.page.evaluate(() => (window as unknown as { __restaurar: () => void }).__restaurar());
    await a.page.evaluate(() => (location.hash = '#/sincronizacion'));
    await sincronizarAhora(a.page);
    expect((await leer<Record<string, { texto: string }>>(a.page, 'notas'))!['sec-5.1']!.texto).toBe('nueva de la tableta');
    expect((gh.doc()!.almacenes.notas!['sec-5.1'] as { v: { texto: string } }).v.texto).toBe('nueva de la tableta');
    await a.ctx.close();
    await b.ctx.close();
  });
});
