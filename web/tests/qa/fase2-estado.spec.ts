// Phase 2 · 4 (state and navigation): reload in the middle of a lesson (every lesson, at its middle screen), of a
// simulation, of the editor (the drawing must survive), of the breadboard and the instruments; back and forward
// over 30 random routes (three seeds per touch profile: every step lands on the right route with content);
// double and triple taps on the main buttons (no screen skipped, nothing doubled, no error); leaving a page while
// it simulates or loads 3D (the engine and WebGL recover); odd and very long text in every text field of every
// kind of page (no exception, no NaN, no dialog, nothing pushed off the screen).
//   QA_SEMILLA changes the seeds; QA_MODO=rapido samples the lessons.
import { expect, test, type Page } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina, recogerYComprobar, trozos } from './arnes.ts';
import { MODO } from './perfiles.ts';
import { azarDe, lecciones, rutasDe, spice, todasLasRutas, type Ruta } from './rutas.ts';
import type { EstadoSonda } from './sonda.ts';

const SEMILLA = Number(process.env.QA_SEMILLA ?? 20261030);

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the page shows: content length, an error notice, a loading indicator. */
async function pantalla(page: Page): Promise<{ texto: number; aviso: string; cargando: boolean; hash: string }> {
  return page
    .evaluate(() => {
      const vis = (e: Element) => (e as HTMLElement).offsetParent !== null || e.getClientRects().length > 0;
      const main = document.querySelector('#contenido') ?? document.body;
      const t = (main as HTMLElement).innerText ?? '';
      const aviso = [...document.querySelectorAll('.aviso h1, .aviso.error, [role="alert"]')].filter(vis).map((e) => (e.textContent ?? '').trim()).find((x) => /no se (ha )?pud|no existe|error/i.test(x)) ?? '';
      const cargando = [...document.querySelectorAll('.cargando, .espera-carga, [aria-busy="true"]')].some(vis);
      return { texto: t.replace(/\s+/g, ' ').trim().length, aviso: aviso.slice(0, 160), cargando, hash: location.hash };
    })
    .catch(() => ({ texto: 0, aviso: 'la página no responde', cargando: false, hash: '' }));
}

const marcar = (page: Page) => page.evaluate(() => (window as unknown as { __qa?: EstadoSonda }).__qa?.marcar()).catch(() => {});

test.describe.configure({ mode: 'parallel' });

// ------------------------------------------------------------------ reload in the middle of a lesson
const LECCIONES = lecciones().filter((l) => MODO !== 'rapido' || azarDe(`e:${l.parte}/${l.seccion}`) < 0.05);

trozos(LECCIONES, 80).forEach((grupo, k) => {
  test(`recargar a mitad de lección · ${k + 1}`, async ({ browser }, info) => {
    const reg = new Registro(info);
    test.skip(reg.perfil.id !== 'tableta', 'en la tableta');
    test.setTimeout(grupo.length * 30_000 + 60_000);
    const uso = info.project.use as Record<string, unknown>;
    let ctx = await browser.newContext({ ...uso, baseURL: (uso['baseURL'] as string | undefined) ?? 'http://localhost:4421/' });
    let page = await ctx.newPage();
    await prepararPagina(page, reg);
    let bien = 0;
    for (const [i, l] of grupo.entries()) {
      // a fresh context every 20 lessons: some 40 reloads in a row in one tab exhausted Chromium's resources here
      // (net::ERR_INSUFFICIENT_RESOURCES), which is the test's doing, not the app's
      if (i && i % 20 === 0) {
        await ctx.close();
        ctx = await browser.newContext({ ...uso, baseURL: (uso['baseURL'] as string | undefined) ?? 'http://localhost:4421/' });
        page = await ctx.newPage();
        await prepararPagina(page, reg);
      }
      const mitad = l.pantallas[Math.floor((l.pantallas.length - 1) / 2)]!;
      const hash = `#/leccion/${l.parte}/${l.seccion}/${mitad}`;
      reg.ruta = `leccion:${l.parte}/${l.seccion}/${mitad} (recarga)`;
      reg.traza(reg.ruta);
      if (i % 20 === 0) await page.goto(`/${hash}`);
      else await page.evaluate((h) => (location.hash = h), hash);
      await esperarCalma(page, 15_000, 400);
      const antes = await pantalla(page);
      await page.reload();
      await esperarCalma(page, 20_000, 400);
      const d = await pantalla(page);
      if (d.aviso) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: `lección: ${d.aviso.replace(/\d+/g, '#').slice(0, 60)}`, msg: `${hash}: tras recargar dice «${d.aviso}».` });
      else if (d.texto < 40) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: 'lección en blanco', msg: `${hash}: tras recargar la pantalla se queda casi vacía (${d.texto} caracteres).` });
      else if (d.hash !== antes.hash) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: 'lección cambia de pantalla', msg: `${hash}: tras recargar pasa de ${antes.hash} a ${d.hash}.` });
      else bien++;
    }
    await ctx.close();
    reg.cobertura({ 'recarga: lecciones recargadas a mitad': grupo.length, 'recarga: lecciones que siguen en su pantalla': bien });
  });
});

// ------------------------------------------------------------------ reload in the middle of other work
const SP = spice() as { netlists: Record<string, { motor: { estado: string; pesada?: boolean } }> };
const LARGAS = ['cap04/prob-4.B_fuente_lineal', 'cap50/rectificador'].filter((id) => SP.netlists[id]);
const CORTA = Object.keys(SP.netlists).find((id) => SP.netlists[id]!.motor.estado === 'ok' && !SP.netlists[id]!.motor.pesada)!;

/** Waits for a finished simulation on the simulator page; true when a result (or ngspice's errors) is shown. */
async function simulacionTermina(page: Page, max = 120_000): Promise<boolean> {
  return page
    .waitForFunction(() => !!document.querySelector('.pagina .resultado, .pagina .aviso.error[role="alert"]') && !document.querySelector('.mando .estado .punto'), null, { timeout: max })
    .then(() => true)
    .catch(() => false);
}

test('recargar a mitad: simulación, editor, protoboard e instrumentos', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles');
  test.setTimeout(20 * 60_000);
  await prepararPagina(page, reg);
  // simulation: reload while ngspice runs, then the page simulates again
  for (const id of LARGAS) {
    reg.ruta = `simulador:${id} (recarga)`;
    await page.goto(`/#/simulador/${id}`);
    await page.locator('.mando button.primario').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(800);
    await page.reload();
    if (!(await simulacionTermina(page))) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: 'simulación tras recargar', msg: `${id}: tras recargar a mitad de la simulación, la página no vuelve a simular.` });
    await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: false });
  }
  // editor: a book netlist opened as a drawing, then reload: the drawing is kept (draft)
  reg.ruta = 'editor (recarga)';
  await page.goto(`/#/editor/libro/${CORTA}`);
  const n = await page
    .waitForFunction(() => (window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length || null, null, { timeout: 60_000 })
    .then((h) => h.jsonValue() as Promise<number>)
    .catch(() => 0);
  await page.waitForTimeout(1500);
  await page.reload();
  const m = await page
    .waitForFunction(() => (window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? null, null, { timeout: 60_000 })
    .then((h) => h.jsonValue() as Promise<number>)
    .catch(() => -1);
  if (n && m !== n) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: 'editor pierde el dibujo', msg: `Editor: el dibujo de ${CORTA} tenía ${n} componentes y tras recargar tiene ${m}.` });
  await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: false });
  // breadboard, instruments, a console and the FM7303 kit: reload, the page comes back
  for (const h of ['#/protoboard', '#/instrumentos/practica/1', '#/instrumentos/libre', '#/fm7303/senal', '#/calculadoras', '#/repaso', '#/ejercicios']) {
    reg.ruta = `${h} (recarga)`;
    await page.goto(`/${h}`);
    await esperarCalma(page, 30_000, 500);
    await page.reload();
    await esperarCalma(page, 30_000, 500);
    const d = await pantalla(page);
    if (d.aviso || d.texto < 40) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: `${h.split('/')[1]}: ${d.aviso ? 'aviso' : 'en blanco'}`, msg: `${h}: tras recargar ${d.aviso ? `dice «${d.aviso}»` : 'se queda casi vacía'}.` });
    await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: false });
  }
  // 0.11 group B: a smart-practice session reloaded in its third item comes back to a usable screen (a new session's
  // introduction), and the problem of the day and an explorable lesson screen too
  reg.ruta = '#/practicar (recarga a mitad de la sesión)';
  await page.goto('/#/practicar');
  if (await page.locator('[data-empezar-sesion]').click({ timeout: 30_000 }).then(() => true).catch(() => false)) {
    for (let i = 0; i < 2; i++) await page.locator('[data-saltar]').click({ timeout: 10_000 }).catch(() => {});
    await page.reload();
    const ok = await page.locator('[data-intro-sesion], [data-sesion-vacia], .cuerpo[data-item]').first().waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    if (!ok) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: 'práctica inteligente', msg: 'Tras recargar a mitad de una práctica inteligente, la página no vuelve a ofrecer una sesión.' });
    await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: false });
  }
  for (const h of ['#/problema', '#/leccion/cap01/sec-1.4/5', '#/progreso/dominio']) {
    reg.ruta = `${h} (recarga)`;
    await page.goto(`/${h}`);
    await esperarCalma(page, 30_000, 500);
    await page.reload();
    await esperarCalma(page, 30_000, 500);
    const d = await pantalla(page);
    if (d.aviso || d.texto < 40) await reg.anotar({ sev: 'funcional', tipo: 'recarga', firma: `${h.split('/')[1]}: ${d.aviso ? 'aviso' : 'en blanco'}`, msg: `${h}: tras recargar ${d.aviso ? `dice «${d.aviso}»` : 'se queda casi vacía'}.` });
    await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: false });
  }
});

// ------------------------------------------------------------------ back and forward
for (const s of [0, 1, 2]) {
  test(`atrás y adelante por 30 rutas · semilla ${s + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles');
    test.setTimeout(30 * 60_000);
    await prepararPagina(page, reg);
    const azar = mulberry32(SEMILLA + s * 7919 + (reg.perfil.id === 'telefono' ? 104729 : 0));
    // light routes only (a 3D board takes a minute to load on this machine): history is the point
    const todas = rutasDe(reg.perfil).filter((r) => !r.pesada && !r.accion && r.grupo !== 'modelos3d');
    const lista: Ruta[] = [];
    while (lista.length < 30) {
      const r = todas[Math.floor(azar() * todas.length)]!;
      if (lista[lista.length - 1]?.hash !== r.hash) lista.push(r);
    }
    await page.goto('/#/');
    await esperarCalma(page, 15_000);
    for (const r of lista) {
      await page.evaluate((h) => (location.hash = h), r.hash);
      await esperarCalma(page, 8000, 300);
    }
    const comprobar = async (r: Ruta, como: string) => {
      reg.ruta = `${r.id} (${como})`;
      await esperarCalma(page, 15_000, 300);
      const d = await pantalla(page);
      // a page may rewrite its own hash (the editor's «#/editor»): compare the start
      const base = r.hash.split('/').slice(0, 2).join('/');
      if (!d.hash.startsWith(base)) await reg.anotar({ sev: 'funcional', tipo: 'historial', firma: `${como}: ruta equivocada`, msg: `${como} debía volver a ${r.hash} y está en ${d.hash}.` });
      else if (d.aviso) await reg.anotar({ sev: 'funcional', tipo: 'historial', firma: `${como}: ${d.aviso.replace(/\d+/g, '#').slice(0, 60)}`, msg: `${como} a ${r.hash}: «${d.aviso}».` });
      else if (d.texto < 20 && !d.cargando) await reg.anotar({ sev: 'funcional', tipo: 'historial', firma: `${como}: en blanco`, msg: `${como} a ${r.hash}: la página se queda en blanco.` });
    };
    let atras = 0;
    for (let i = lista.length - 2; i >= 0; i--) {
      await page.goBack({ timeout: 30_000 }).catch(() => {});
      await comprobar(lista[i]!, 'atrás');
      atras++;
    }
    for (let i = 1; i < lista.length; i++) {
      await page.goForward({ timeout: 30_000 }).catch(() => {});
      await comprobar(lista[i]!, 'adelante');
    }
    reg.cobertura({ 'historial: pasos atrás y adelante': atras * 2 });
  });
}

// ------------------------------------------------------------------ double and triple taps
/** Pages and their main buttons. */
const BOTONES: { hash: string; boton: string; que: string }[] = [
  { hash: `#/simulador/${CORTA}`, boton: '.mando button.primario', que: 'Simular' },
  { hash: '#/calculadoras', boton: 'button.calcular, .fila-calcular button', que: 'Calcular' },
  { hash: '#/cap05', boton: '.figura-simular .simular, .h3-simular .simular', que: 'Simular en el libro' },
  { hash: '#/instrumentos/libre', boton: 'button.primario, .simular', que: 'Banco' },
  { hash: '#/editor', boton: 'button.simular, .mando button.primario', que: 'Simular del editor' },
  { hash: '#/ejercicios', boton: '.ejercicios-cab button, button.primario', que: 'Ejercicios' },
  { hash: '#/repaso', boton: 'button.primario, .boton', que: 'Repaso' },
];

test('toques dobles y triples en los botones principales', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles');
  test.setTimeout(30 * 60_000);
  await prepararPagina(page, reg);
  let probados = 0;
  for (const b of BOTONES) {
    for (const veces of [2, 3]) {
      reg.ruta = `${b.hash} (${veces} toques en ${b.que})`;
      await page.goto(`/${b.hash}`);
      await esperarCalma(page, 30_000, 500);
      const el = page.locator(b.boton).first();
      if (!(await el.isVisible().catch(() => false))) continue;
      await el.scrollIntoViewIfNeeded().catch(() => {});
      const box = await el.boundingBox();
      if (!box) continue;
      await marcar(page);
      for (let i = 0; i < veces; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
      await page.waitForFunction(() => !document.querySelector('.mando .estado .punto'), null, { timeout: 120_000 }).catch(() => {});
      await esperarCalma(page, 30_000, 700);
      const d = await pantalla(page);
      if (d.aviso && !/simul/i.test(b.que)) await reg.anotar({ sev: 'funcional', tipo: 'toques-repetidos', firma: `${b.que}: ${d.aviso.slice(0, 60)}`, msg: `${b.hash}: ${veces} toques seguidos en «${b.que}» y aparece «${d.aviso}».` });
      // nothing doubled: two result panels or two dialogs
      const dobles = await page.evaluate(() => {
        const n = (s: string) => document.querySelectorAll(s).length;
        return { dialogos: n('dialog[open], [role="dialog"]'), resultados: n('.pagina .resultado') };
      });
      if (dobles.dialogos > 1 || dobles.resultados > 1) await reg.anotar({ sev: 'funcional', tipo: 'toques-repetidos', firma: `${b.que}: duplicado`, msg: `${b.hash}: tras ${veces} toques en «${b.que}» hay ${dobles.dialogos} diálogos y ${dobles.resultados} paneles de resultado.` });
      await recogerYComprobar(page, reg, { tactil: true, completa: false, accesibilidad: false });
      probados++;
    }
  }
  // «Continuar» of a lesson: two quick taps advance one screen only
  const l = lecciones().find((x) => x.pantallas.length > 4 && !x.pantallas[1]!.startsWith('practica-') && !x.pantallas[1]!.startsWith('pregunta-') && !x.pantallas[0]!.startsWith('practica-') && !x.pantallas[0]!.startsWith('pregunta-'));
  if (l) {
    reg.ruta = `leccion:${l.parte}/${l.seccion} (doble toque en Continuar)`;
    await page.goto(`/#/leccion/${l.parte}/${l.seccion}`);
    await esperarCalma(page, 20_000, 500);
    const c = page.locator('[data-continuar]').first();
    const box = await c.boundingBox().catch(() => null);
    if (box) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await esperarCalma(page, 15_000, 500);
      const h = await page.evaluate(() => location.hash);
      if (!h.endsWith(`/${l.pantallas[1]}`)) await reg.anotar({ sev: 'funcional', tipo: 'toques-repetidos', firma: 'Continuar salta pantallas', msg: `Dos toques rápidos en «Continuar» de ${l.parte}/${l.seccion} llevan a ${h} en vez de a la pantalla ${l.pantallas[1]}.` });
      probados++;
    }
  }
  // 0.11 group B, «Práctica inteligente»: two quick taps on «Empezar» do not answer the first item (the second tap
  // lands on it), and two on «Saltar» skip one item only
  reg.ruta = 'practicar (dobles toques)';
  await page.goto('/#/practicar');
  const empezar = page.locator('[data-empezar-sesion]');
  if (await empezar.waitFor({ timeout: 30_000 }).then(() => true).catch(() => false)) {
    const doble = async (sel: string) => {
      const el = page.locator(sel).first();
      // centred: at the bottom edge the phone's tab bar would take the taps
      await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
      const box = await el.boundingBox();
      if (!box) return false;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(600);
      return true;
    };
    const numero = async () => Number((await page.locator('.cuerpo[data-item] h1').textContent().catch(() => ''))?.match(/Ejercicio (\d+)/)?.[1] ?? 0);
    if (await doble('[data-empezar-sesion]')) {
      const tocado = await page.evaluate(() => {
        const c = document.querySelector<HTMLButtonElement>('[data-continuar]');
        return !!document.querySelector('.cuerpo [data-feedback], .cuerpo [data-final]') || (!!c && !c.disabled);
      });
      if (tocado) await reg.anotar({ sev: 'funcional', tipo: 'toques-repetidos', firma: 'Empezar responde el primer ejercicio', msg: 'Dos toques rápidos en «Empezar» de la práctica inteligente: el segundo responde (o elige algo en) el primer ejercicio.' });
      probados++;
      if ((await numero()) === 1 && (await doble('[data-saltar]'))) {
        const n = await numero();
        if (n !== 2) await reg.anotar({ sev: 'funcional', tipo: 'toques-repetidos', firma: 'Saltar salta dos', msg: `Dos toques rápidos en «Saltar» de la práctica inteligente llevan al ejercicio ${n} en vez del 2.` });
        probados++;
      }
    }
  }
  reg.cobertura({ 'toques repetidos: botones probados': probados });
});

// ------------------------------------------------------------------ leaving while it works
test('salir a mitad de una simulación o de una carga 3D', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles');
  test.setTimeout(30 * 60_000);
  await prepararPagina(page, reg);
  await page.goto('/#/');
  // five times: a long simulation started, then another page at once
  for (let i = 0; i < 5; i++) {
    const id = LARGAS[i % LARGAS.length]!;
    reg.ruta = `simulador:${id} (salir a mitad ${i + 1})`;
    await page.evaluate((h) => (location.hash = h), `#/simulador/${id}`);
    await page.locator('.mando button.primario').waitFor({ timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(300 + i * 200);
    await page.evaluate(() => (location.hash = '#/glosario'));
    await page.waitForTimeout(500);
  }
  // the engine is free again: a short netlist simulates
  reg.ruta = `simulador:${CORTA} (después de salir)`;
  await page.evaluate((h) => (location.hash = h), `#/simulador/${CORTA}`);
  if (!(await simulacionTermina(page))) await reg.anotar({ sev: 'funcional', tipo: 'salir-a-mitad', firma: 'el motor no se recupera', msg: `Tras salir cinco veces a mitad de una simulación, ${CORTA} no llega a simular.` });
  // 3D: a board left while it loads, five times; then no WebGL context may stay alive
  const placas = todasLasRutas().filter((r) => /placa3d|\/3d$/.test(r.hash)).slice(0, 3);
  for (let i = 0; i < 5 && placas.length; i++) {
    const r = placas[i % placas.length]!;
    reg.ruta = `${r.id} (salir a mitad ${i + 1})`;
    await page.evaluate((h) => (location.hash = h), r.hash);
    await page.waitForTimeout(400 + i * 400);
    await page.evaluate(() => (location.hash = '#/glosario'));
    await page.waitForTimeout(800);
  }
  await esperarCalma(page, 30_000, 1000);
  await page.waitForTimeout(3000);
  const vivos = await page.evaluate(() => {
    (window as unknown as { gc?: () => void }).gc?.();
    return (window as unknown as { __qa: EstadoSonda }).__qa.contextosVivos();
  });
  if (vivos > 0) await reg.anotar({ sev: 'rendimiento', tipo: 'webgl-fuga', firma: 'salir a mitad de la carga 3D', msg: `Tras salir cinco veces de una placa 3D mientras cargaba, quedan ${vivos} contexto(s) WebGL vivos en el glosario.` });
  // and a board still opens fine afterwards
  if (placas[0]) {
    reg.ruta = `${placas[0].id} (después de salir)`;
    await page.evaluate((h) => (location.hash = h), placas[0].hash);
    const ok = await page
      .waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true || !!document.querySelector('canvas'), null, { timeout: 300_000 })
      .then(() => true)
      .catch(() => false);
    if (!ok) await reg.anotar({ sev: 'funcional', tipo: 'salir-a-mitad', firma: 'la placa 3D no vuelve a abrir', msg: `Tras salir a mitad de varias cargas, ${placas[0].hash} no termina de abrir.` });
  }
});

// ------------------------------------------------------------------ odd input in every text field
const RAROS = [
  'a'.repeat(5000),
  '⚡️🔥 diodo 😀',
  '‏مرحبا 123',
  '<img src=x onerror=alert(1)>',
  '1e309',
  '-0',
  'NaN',
  '١٢٣',
  '   ',
  '0,000000000000000000001',
  '9'.repeat(400),
  "'; DROP TABLE x; --",
];

/** One route of each kind of page (as the low-end test). */
function representantes(): Ruta[] {
  const m = new Map<string, Ruta>();
  for (const r of todasLasRutas()) {
    const k = `${r.grupo}:${r.hash.split('/').length}`;
    // (0.11 group B: every page of the learning loop)
    if ((!m.has(k) || r.grupo === 'aprendizaje') && !r.accion) m.set(r.grupo === 'aprendizaje' ? r.id : k, r);
  }
  return [...m.values()];
}

trozos(representantes(), 8).forEach((grupo, k) => {
  test(`entradas raras en los campos de texto · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles');
    test.setTimeout(grupo.length * 6 * 60_000);
    await prepararPagina(page, reg);
    let dialogos = 0;
    page.on('dialog', () => dialogos++);
    let campos = 0;
    for (const r of [...grupo, { id: 'buscar', hash: '#/', grupo: 'inicio', accion: 'buscar' } as Ruta]) {
      reg.ruta = `${r.id} (entradas raras)`;
      reg.traza(reg.ruta);
      await page.goto(`/${r.hash}`);
      await esperarCalma(page, r.pesada ? 60_000 : 15_000, 500);
      if (r.accion === 'buscar') await page.keyboard.press('Control+k');
      const n = await page.locator('input:not([type]), input[type="text"], input[type="search"], input[type="number"], textarea').count();
      for (let i = 0; i < Math.min(n, 8); i++) {
        const campo = page.locator('input:not([type]), input[type="text"], input[type="search"], input[type="number"], textarea').nth(i);
        if (!(await campo.isVisible().catch(() => false)) || !(await campo.isEditable().catch(() => false))) continue;
        campos++;
        for (const raro of RAROS) {
          const antes = dialogos;
          await campo.fill(raro, { timeout: 5000 }).catch(() => {});
          await campo.press('Enter', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(120);
          if (dialogos > antes) await reg.anotar({ sev: 'error', tipo: 'entrada-rara', firma: 'diálogo', msg: `${r.hash}: escribir «${raro.slice(0, 40)}» en un campo abre un diálogo del navegador.` });
          // the page may have navigated (search results, Enter in a form): back to the field's page
          if (!(await campo.isVisible().catch(() => false))) break;
        }
        // the longest text left in the field for the layout checks; what the typing itself made appear and go
        // (a filter's «no results», a list filtered and restored) is the field's job, not a flash
        await campo.fill(RAROS[0]!, { timeout: 5000 }).catch(() => {});
        await esperarCalma(page, 8000, 400);
        await marcar(page);
        await page.waitForTimeout(300);
        await recogerYComprobar(page, reg, { tactil: true, completa: false, accesibilidad: false });
        await campo.fill('', { timeout: 5000 }).catch(() => {});
        await esperarCalma(page, 8000, 400);
        await marcar(page);
      }
      if (r.accion === 'buscar') await page.keyboard.press('Escape');
    }
    reg.cobertura({ 'entradas raras: campos probados': campos });
  });
});

test('las rutas de este fichero existen', () => {
  expect(CORTA).toBeTruthy();
  expect(LARGAS.length).toBeGreaterThan(0);
});
