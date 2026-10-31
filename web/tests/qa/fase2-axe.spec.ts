// Phase 2 · 7 (accessibility audit): axe-core (dev dependency) on one route of every kind, in both touch
// profiles, each in the light and the dark theme (WCAG 2.0/2.1 A and AA rules plus axe's best practices); and the
// main flows done with the keyboard only on the desktop: the search dialog, a part from the index, «Simular»,
// a calculator, a lesson (an answer and «Continuar»), the settings dialog (focus kept inside, back on Escape).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers nice npx playwright test -c playwright.qa.config.ts tests/qa/fase2-axe.spec.ts
import { createRequire } from 'node:module';
import { test, type Page } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina, trozos } from './arnes.ts';
import { lecciones, spice, todasLasRutas, type Ruta } from './rutas.ts';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

/** One route of each kind (group, depth and action), as the other phase 2 sweeps. */
function representantes(): Ruta[] {
  const m = new Map<string, Ruta>();
  for (const r of todasLasRutas()) {
    const k = `${r.grupo}:${r.hash.split('/').length}:${r.accion ?? ''}`;
    // (0.11 group B: every page of the learning loop — smart practice, problem of the day, mastery, explorable rows)
    if (!m.has(k) || r.grupo === 'aprendizaje') m.set(r.grupo === 'aprendizaje' ? r.id : k, r);
  }
  const filtro = process.env.QA_FILTRO;
  return [...m.values()].filter((r) => !filtro || r.id.includes(filtro));
}

interface Violacion {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[]; failureSummary?: string }[];
}

/** Opens what the route's action opens (settings, search, menu, a figure's viewer). */
async function accion(page: Page, r: Ruta): Promise<void> {
  if (r.accion === 'ajustes') await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click({ timeout: 10_000 });
  else if (r.accion === 'buscar') {
    await page.keyboard.press('Control+k');
    const caja = page.getByRole('dialog', { name: 'Buscar en el libro' }).locator('input');
    await caja.waitFor({ timeout: 10_000 });
    await caja.fill('diodo zener');
    await page.waitForTimeout(600);
  } else if (r.accion === 'menu') await page.getByRole('button', { name: 'Más' }).first().click({ timeout: 10_000 });
  else if (r.accion === 'visor') {
    const id = r.hash.split('/').pop()!;
    await page.locator(`[id="${id}"] button`).filter({ hasText: /^(Ampliar|Abrir .* en grande)/ }).first().click({ timeout: 15_000 });
  }
  await page.waitForTimeout(500);
}

test.describe.configure({ mode: 'parallel' });

trozos(representantes(), 8).forEach((trozo, k) => {
  test(`axe-core · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles (el escritorio hace el recorrido con teclado)');
    test.setTimeout(trozo.length * 2 * 4 * 60_000);
    await prepararPagina(page, reg);
    let auditadas = 0;
    let reglas = 0;
    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema });
      for (const [i, r] of trozo.entries()) {
        reg.ruta = `${r.id} (${tema === 'light' ? 'claro' : 'oscuro'})`;
        reg.traza(reg.ruta);
        if (i === 0) await page.goto(`/${r.hash}`);
        else await page.goto(`/${r.hash}`);
        await esperarCalma(page, r.pesada ? 60_000 : 15_000, 600);
        if (r.accion) await accion(page, r).catch(() => {});
        await page.addScriptTag({ path: AXE });
        const v = (await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Violacion[] }> } }).axe;
          const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
          return res.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.slice(0, 6).map((n) => ({ target: n.target as string[], failureSummary: n.failureSummary })) }));
        })) as Violacion[];
        auditadas++;
        for (const x of v) {
          reglas++;
          for (const n of x.nodes) {
            // the selector without the ids and nth-child that change from page to page
            const sel = n.target.join(' ').replace(/#[\w-]+/g, '#…').replace(/:nth-child\(\d+\)/g, '').slice(0, 80);
            await reg.anotar({
              sev: 'accesibilidad',
              tipo: `axe-${x.id}`,
              firma: sel,
              msg: `axe «${x.id}» (${x.impact ?? 'sin impacto'}): ${x.help}. ${(n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 220)}`,
            });
          }
        }
      }
    }
    reg.cobertura({ 'axe: páginas auditadas (claro y oscuro)': auditadas, 'axe: reglas incumplidas (página × regla)': reglas });
  });
});

// ------------------------------------------------------------------ keyboard only
/**
 * Presses Tab until the focus is on an element that matches `cumple` (at most `max` times), and then Shift+Tab as
 * many (a control before the starting point: the app puts the focus on the page's title after navigating). A text
 * area that takes Tab for indentation (the netlist editor) is left with Escape, as its hint says.
 */
/** The elements the last failed `tabularHasta` went through (for the finding's message). */
let rastro: string[] = [];
async function tabularHasta(page: Page, cumple: (el: Element) => boolean, max = 300): Promise<boolean> {
  const f = cumple.toString();
  const ahora = () =>
    page.evaluate((src) => {
      const el = document.activeElement;
      const d = el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')!.slice(0, 30)}]` : ''}` : '-';
      return { ok: !!el && (new Function('el', `return (${src})(el)`) as (e: Element) => boolean)(el), area: el?.tagName === 'TEXTAREA', d };
    }, f);
  rastro = [];
  // both directions start from where the focus was (the page's title after navigating)
  // (with nothing focused, Chrome would go on from wherever the previous page left its starting point: the body
  // takes the focus for a moment so both directions start from the page's edges, as on a fresh load)
  const enfocarCuerpo = () => {
    document.body.tabIndex = -1;
    document.body.focus({ preventScroll: true });
    document.body.removeAttribute('tabindex');
  };
  const inicio = await page.evaluate((cuerpo) => {
    document.querySelector('[data-qa-inicio-tab]')?.removeAttribute('data-qa-inicio-tab');
    const el = document.activeElement;
    if (!el || el === document.body) new Function(`(${cuerpo})()`)();
    else el.setAttribute('data-qa-inicio-tab', '');
    return el && el !== document.body ? el.outerHTML.slice(0, 80) : 'body';
  }, enfocarCuerpo.toString());
  for (const tecla of ['Tab', 'Shift+Tab']) {
    if (tecla === 'Shift+Tab') rastro.push('⇧');
    if (tecla === 'Shift+Tab')
      await page.evaluate((cuerpo) => {
        const el = document.querySelector<HTMLElement>('[data-qa-inicio-tab]');
        if (el) el.focus({ preventScroll: true });
        else new Function(`(${cuerpo})()`)();
      }, enfocarCuerpo.toString());
    for (let i = 0; i < max; i++) {
      if ((await ahora()).area) await page.keyboard.press('Escape');
      await page.keyboard.press(tecla);
      const a = await ahora();
      if (a.ok) return true;
      if (rastro.at(-1) !== a.d) rastro.push(a.d);
    }
  }
  const k = rastro.indexOf('⇧');
  rastro = [`desde ${inicio}`, ...rastro.slice(0, Math.min(k, 4)), '…', ...rastro.slice(k, k + 7)];
  return false;
}

test('teclado: los recorridos principales sin ratón', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'escritorio', 'en el escritorio');
  test.setTimeout(20 * 60_000);
  await prepararPagina(page, reg);
  let hechos = 0;
  const fallo = async (flujo: string, msg: string) => reg.anotar({ sev: 'accesibilidad', tipo: 'teclado', firma: flujo, msg });

  // 1. search: Ctrl+K, type, arrow down, Enter → a section
  reg.ruta = 'teclado: búsqueda';
  await page.goto('/#/');
  await esperarCalma(page, 20_000);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('rectificador de onda completa', { delay: 20 });
  await page.waitForTimeout(800);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await esperarCalma(page, 15_000);
  if (!/#\/cap\d+|#\/ap/.test(await page.evaluate(() => location.hash))) await fallo('búsqueda', 'Con el teclado, buscar, bajar con la flecha y pulsar Intro no abre ninguna sección.');
  else hechos++;

  // 2. the index: a part reached with Tab and opened with Enter
  reg.ruta = 'teclado: índice';
  await page.goto('/#/');
  await esperarCalma(page, 20_000);
  // a chapter's link (which ones the start page shows depends on the reader's course and progress)
  const parte = await tabularHasta(page, (el) => el.tagName === 'A' && /^#\/cap\d+$/.test(el.getAttribute('href') ?? ''), 200);
  const destino = await page.evaluate(() => document.activeElement?.getAttribute('href') ?? '');
  if (!parte) await fallo('índice', `Con el tabulador no se llega a ningún enlace de capítulo en el inicio (pasa por: ${rastro.join(', ')}).`);
  else {
    await page.keyboard.press('Enter');
    await esperarCalma(page, 15_000);
    if (!(await page.evaluate(() => location.hash)).startsWith(destino)) await fallo('índice', `Intro sobre el enlace ${destino} del inicio no lo abre.`);
    else hechos++;
  }

  // 3. the simulator: «Simular» with the keyboard
  reg.ruta = 'teclado: simular';
  const sp = spice();
  const id = Object.keys(sp.netlists).find((x) => sp.netlists[x]!.motor.estado === 'ok' && !sp.netlists[x]!.motor.pesada)!;
  await page.goto(`/#/simulador/${id}`);
  await page.waitForFunction(() => !!document.querySelector('.pagina .resultado') && !document.querySelector('.mando .estado .punto'), null, { timeout: 120_000 }).catch(() => {});
  await esperarCalma(page, 15_000);
  if (!(await tabularHasta(page, (el) => el.matches('.mando button.primario')))) await fallo('simular', 'Con el tabulador no se llega a «Simular».');
  else {
    await page.evaluate(() => ((window as unknown as { __n: number }).__n = document.querySelectorAll('.pagina .resultado').length));
    await page.keyboard.press('Enter');
    const ok = await page
      .waitForFunction(() => !!document.querySelector('.mando .estado .punto') || !!document.querySelector('.pagina .resultado'), null, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForFunction(() => !document.querySelector('.mando .estado .punto'), null, { timeout: 120_000 }).catch(() => {});
    if (!ok) await fallo('simular', 'Intro sobre «Simular» no simula.');
    else hechos++;
  }

  // 4. a calculator: the first field, a value, «Calcular»
  reg.ruta = 'teclado: calculadora';
  await page.goto('/#/calculadoras');
  await esperarCalma(page, 20_000);
  const enlace = await tabularHasta(page, (el) => el.tagName === 'A' && (el.getAttribute('href') ?? '').startsWith('#/calculadoras/'), 200);
  if (!enlace) await fallo('calculadora', 'Con el tabulador no se llega a ninguna calculadora de la lista.');
  else {
    await page.keyboard.press('Enter');
    await esperarCalma(page, 15_000);
    const campo = await tabularHasta(page, (el) => el.tagName === 'INPUT');
    if (!campo) await fallo('calculadora', 'Con el tabulador no se llega a los campos de la calculadora.');
    else {
      await page.keyboard.press('Control+a');
      await page.keyboard.type('10');
      await page.keyboard.press('Enter');
      await esperarCalma(page, 8000);
      const roto = await page.evaluate(() => /NaN|undefined|Infinity/.test(document.querySelector('#contenido')?.textContent ?? ''));
      if (roto) await fallo('calculadora', 'Escribir un valor con el teclado y pulsar Intro deja un resultado roto (NaN, undefined…).');
      else hechos++;
    }
  }

  // 5. a lesson: «Continuar» and an answer with the keyboard
  reg.ruta = 'teclado: lección';
  const l = lecciones().find((x) => x.pantallas.some((p) => p.startsWith('pregunta-')) && x.pantallas.length > 3)!;
  await page.goto(`/#/leccion/${l.parte}/${l.seccion}`);
  await esperarCalma(page, 20_000);
  let pasos = 0;
  for (; pasos < l.pantallas.length && !(await page.evaluate(() => location.hash)).includes('/pregunta-'); pasos++) {
    if (!(await tabularHasta(page, (el) => el.hasAttribute('data-continuar')))) break;
    await page.keyboard.press('Enter');
    await esperarCalma(page, 15_000);
  }
  if (!(await page.evaluate(() => location.hash)).includes('/pregunta-')) await fallo('lección', `Con el teclado no se llega a la primera pregunta de ${l.parte}/${l.seccion} («Continuar» inalcanzable o sin efecto).`);
  else {
    const opcion = await tabularHasta(page, (el) => !!el.closest('.opciones') && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.getAttribute('role') === 'radio'));
    if (!opcion) await fallo('lección', 'Con el tabulador no se llega a las opciones de una pregunta.');
    else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const marcada = await page.evaluate(() => !!document.querySelector('.opciones [aria-pressed="true"], .opciones [aria-checked="true"], .opciones .elegida, .opciones input:checked, .opciones [data-estado]'));
      if (!marcada) await fallo('lección', 'Intro sobre una opción de una pregunta no la elige.');
      else hechos++;
    }
  }

  // 6. the settings dialog: opened with the keyboard, focus inside, Escape closes it and gives the focus back
  reg.ruta = 'teclado: ajustes';
  await page.goto('/#/cap05');
  await esperarCalma(page, 20_000);
  if (!(await tabularHasta(page, (el) => el.getAttribute('aria-label') === 'Tema y tamaño de letra' || el.getAttribute('title') === 'Tema y tamaño de letra'))) await fallo('ajustes', `Con el tabulador no se llega al botón «Tema y tamaño de letra» (pasa por: ${rastro.join(', ')}).`);
  else {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    let fuera = 0;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      // a popover may also close when the focus leaves it (only focus behind a panel still open is wrong)
      if (await page.evaluate(() => !document.activeElement?.closest('[role="dialog"], dialog, .ajustes') && !!document.querySelector('.ajustes'))) fuera++;
    }
    if (fuera) await fallo('ajustes', `En el panel de ajustes, el tabulador sale del panel ${fuera} de 25 veces.`);
    // closed by tabbing out of it: opened again for Escape
    if (!(await page.evaluate(() => !!document.querySelector('.ajustes')))) {
      await page.locator('button[aria-label="Tema y tamaño de letra"]').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const vuelve = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute('aria-label') === 'Tema y tamaño de letra' || el?.getAttribute('title') === 'Tema y tamaño de letra';
    });
    const abierto = await page.evaluate(() => !!document.querySelector('.ajustes'));
    if (abierto) await fallo('ajustes', 'Escape no cierra el panel de ajustes.');
    else if (!vuelve) await fallo('ajustes', 'Al cerrar el panel de ajustes con Escape, el foco no vuelve al botón que lo abrió.');
    else if (!fuera) hechos++;
  }
  reg.cobertura({ 'teclado: recorridos completos': hechos, 'teclado: recorridos probados': 6 });
});
