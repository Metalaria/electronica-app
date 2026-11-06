// Regression tests of the bugs found by the 0.12 QA harness (tests/qa/), each in the profile where it was seen (the
// owner's tablet: 800×1280, touch, unless said otherwise). One test per fix; each failed before its fix.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.regresiones12.config.ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { CLAVE_QA, VERSION_NUEVA, githubFalso, instalarPuenteQa, type ConfigPuente } from './qa/novedades';

const TABLETA = { viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };

interface Entorno {
  origen: string | null;
  guardado: boolean;
  leidoDeBd: boolean;
  error: string;
}
const entorno = (page: Page) => page.evaluate(() => (globalThis as unknown as { __epaEntorno?: Entorno }).__epaEntorno ?? null);

/**
 * Size a finger gets on an element, as the QA harness measures it: its box, or the absolutely placed ::before/::after
 * that enlarges it (negative insets, or its own size when centred with a transform).
 */
async function zonaTactil(page: Page, selector: string): Promise<{ w: number; h: number; n: number }> {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => (e as HTMLElement).offsetParent !== null);
    let w = Infinity;
    let h = Infinity;
    for (const el of els) {
      const rc = el.getBoundingClientRect();
      let a = rc.width;
      let b = rc.height;
      for (const ps of ['::before', '::after']) {
        const p = getComputedStyle(el, ps);
        if (p.content === 'none' || p.position !== 'absolute') continue;
        const n = (v: string) => (v.endsWith('px') ? Math.max(0, -parseFloat(v)) : 0);
        a = Math.max(a, rc.width + n(p.left) + n(p.right), parseFloat(p.width) || 0);
        b = Math.max(b, rc.height + n(p.top) + n(p.bottom), parseFloat(p.height) || 0);
      }
      w = Math.min(w, a);
      h = Math.min(h, b);
    }
    return { w, h, n: els.length };
  }, selector);
}

/** The updater's test bridge (tests/qa/novedades.ts) on, for this page's next loads. */
async function conActualizacion(page: Page, cfg: Partial<ConfigPuente> = {}): Promise<void> {
  await githubFalso(page);
  // (init scripts run in order: the configuration first, then the bridge that reads it)
  await page.addInitScript((c) => sessionStorage.setItem('qa-actualizador', JSON.stringify(c)), { sistema: 'windows', version: VERSION_NUEVA, clave: CLAVE_QA, ...cfg } as ConfigPuente);
  await page.addInitScript(instalarPuenteQa);
}

test.describe('tableta', () => {
  test.use(TABLETA);

  // 0.12 saved the studio's environment (IndexedDB «epa-cache-3d») so that it is filtered once per device, but only
  // the boards' Vista3D read the saved copy at start-up (precargarEntorno): a 3D model's page (Visor3D) in a new
  // session filtered it again (a 7,5 s long task with SwiftShader), and the diagnostic's own views did too, so after a
  // reload its «Entorno del estudio» row said «calculado» where the app's boards say «guardado».
  test('un modelo 3D en una sesión nueva usa el entorno guardado (no lo vuelve a calcular)', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/#/componentes/3d/resistencia-axial');
    await expect.poll(async () => (await entorno(page))?.origen, { timeout: 120_000 }).toBe('pmrem');
    await expect.poll(async () => (await entorno(page))?.guardado, { timeout: 120_000 }).toBe(true);
    await page.reload();
    await expect.poll(async () => (await entorno(page))?.origen ?? null, { timeout: 120_000 }).not.toBeNull();
    const e = await entorno(page);
    expect(e?.origen).toBe('memoria');
    expect(e?.leidoDeBd).toBe(true);
  });

  test('diagnóstico: tras recargar, la fila «Entorno del estudio» de la placa SDR dice «guardado»', async ({ page }) => {
    test.setTimeout(600_000);
    const medir = async () => {
      await page.goto('/#/diagnostico');
      await page.locator('[data-accion="empezar"]').waitFor({ timeout: 60_000 });
      const casillas = page.locator('ul.pruebas input[type="checkbox"]');
      for (let i = 0; i < (await casillas.count()); i++) {
        const c = casillas.nth(i);
        await c.setChecked(/^\s*Placa SDR en 3D/.test((await c.locator('xpath=..').textContent()) ?? ''));
      }
      await page.locator('label.segundos input').fill('2');
      await page.locator('[data-accion="empezar"]').click();
      await expect(page.locator('.diagnostico')).toHaveAttribute('data-estado', 'hecho', { timeout: 300_000 });
      return page.locator('.diagnostico tbody tr', { has: page.locator('td', { hasText: /^Entorno del estudio$/ }) });
    };
    const primera = await medir();
    await expect(primera.locator('td.valor')).toHaveText('calculado');
    await expect.poll(async () => (await entorno(page))?.guardado, { timeout: 120_000 }).toBe(true);
    await page.reload();
    const segunda = await medir();
    await expect(segunda.locator('td.valor')).toHaveText('guardado');
    await expect(segunda).toContainText('leído del almacenamiento');
  });

  // 0.12 touch targets that the harness reached for the first time (the backup card scrolls the synchronisation page,
  // the updater shows its states): «Buscar actualizaciones» and «Ver la publicación» of the page, of «Aa» and of the
  // notice (36 and 19 px), the notice's close button (32 px), and the «details» summaries of the synchronisation page
  // and the diagnostic (22–26 px).
  test('objetivos táctiles de la 0.12: actualizaciones, aviso, sincronización y diagnóstico (≥ 44 px)', async ({ page }) => {
    test.setTimeout(240_000);
    await conActualizacion(page, { aviso: true });
    await page.goto('/#/cap05');
    const aviso = page.locator(`[data-aviso-version="${VERSION_NUEVA}"]`);
    await aviso.waitFor({ timeout: 60_000 });
    for (const sel of ['[data-aviso-version] .botones .boton', '[data-aviso-version] button.cerrar']) {
      const z = await zonaTactil(page, sel);
      expect(z.n, sel).toBeGreaterThan(0);
      expect(Math.min(z.w, z.h), sel).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
    const grupo = page.locator('[data-grupo-actualizaciones]');
    await grupo.getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await grupo.locator('[data-instalador="disponible"]').waitFor({ timeout: 30_000 });
    for (const sel of ['.ajustes [data-grupo-actualizaciones] .botones button.boton', '.ajustes [data-grupo-actualizaciones] p.linea button.enlace', '.ajustes [data-grupo-sincronizacion] .botones .boton']) {
      const z = await zonaTactil(page, sel);
      expect(z.n, sel).toBeGreaterThan(0);
      expect(Math.min(z.w, z.h), sel).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press('Escape');
    await page.goto('/#/sincronizacion');
    await page.locator('[data-version-app]').waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await page.locator('#contenido .nueva').waitFor({ timeout: 30_000 });
    for (const sel of ['#contenido .fila button.boton', '#contenido .nueva button.boton', '#contenido details > summary']) {
      const z = await zonaTactil(page, sel);
      expect(z.n, sel).toBeGreaterThan(0);
      expect(Math.min(z.w, z.h), sel).toBeGreaterThanOrEqual(44);
    }
    await diagnosticoRapido(page);
    for (const sel of ['.diagnostico details > summary']) {
      const z = await zonaTactil(page, sel);
      expect(z.n, sel).toBeGreaterThan(0);
      expect(Math.min(z.w, z.h), sel).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('tableta · fuentes del fotograma', () => {
  test.use(TABLETA);
  // «Un fotograma»'s sources (consolas/fotograma/FotogramaFuentes.svelte): a link alone on its line was 22 px tall on
  // touch screens (the console's other source list got 44 px in 0.11; this one, loaded with the frame's steps, not).
  test('los enlaces de «Un fotograma: de dónde sale cada paso» tienen 44 px de alto en pantallas táctiles', async ({ page }) => {
    await page.goto('/#/consolas/nes/fuentes');
    await page.locator('.fuentes-fotograma li > a').first().waitFor({ timeout: 60_000 });
    const z = await zonaTactil(page, '.fuentes-fotograma li > a');
    expect(z.n).toBeGreaterThan(1);
    expect(z.h).toBeGreaterThanOrEqual(44);
  });
});

test.describe('tableta · sitio del circuito', () => {
  test.use(TABLETA);
  // The netlist page and the instruments bench keep a place for the circuit's drawing while it is decided (0.11), but
  // with a fixed shape (16:9 and 5:2): a drawing much wider or taller than that moved everything under it 300 px when it
  // came (CLS 0,12 on #/simulador/cap29/sec-29.7-contador-asincrono, 0,14–0,16 on two benches; also in 0.11.0).
  for (const hash of ['#/simulador/cap29/sec-29.7-contador-asincrono', '#/instrumentos/circuito/cap20/prob-20.A_puente', '#/instrumentos/circuito/cap32/fig-32.12_prob-32.B'])
    test(`nada se mueve al llegar el dibujo del circuito · ${hash}`, async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`/${hash}`);
      await expect(page.locator('section.circuito-vivo[data-reserva], .reserva-plano')).toHaveCount(0, { timeout: 30_000 });
      await page.waitForTimeout(3000);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
    });
});

// The place kept for the drawing is its real size (scripts/circuitos-proporciones.mjs → proporciones.json): book figures,
// automatic drawings the same at every width, and drawings whose sheet shape depends on the screen (1.1, 1.5, 2).
// REG12_TODAS=1: every book netlist that is simulated in the app (as checked once for 0.12)
const MUESTRA = process.env.REG12_TODAS
  ? Object.entries((JSON.parse(readFileSync(new URL('../public/libro/spice.json', import.meta.url), 'utf8')) as { netlists: Record<string, { motor: { estado: string } }> }).netlists)
      .filter(([, n]) => n.motor.estado !== 'no-disponible')
      .map(([id]) => id)
  : ['cap01/fig-1.3', 'cap02/fig-2.9_divisor_cargado', 'cap01/ejercicios', 'cap01/estrella_triangulo_1.9', 'cap01/prob_1.C', 'cap00/fig-0.2_dos_mallas', 'cap00/rc_descarga', 'cap29/sec-29.7-contador-asincrono'];
for (const [ancho, alto] of [[360, 780], [800, 1280], [1280, 800]] as const)
  test(`el sitio guardado para el dibujo mide lo que el dibujo · ${ancho} px`, async ({ browser }) => {
    test.setTimeout(400_000 + MUESTRA.length * 20_000);
    const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, isMobile: ancho < 1000, hasTouch: ancho < 1000 });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __reservas: number[] };
      w.__reservas = [];
      new MutationObserver(() => {
        const r = document.querySelector('section.circuito-vivo[data-reserva] .placa, .reserva-plano');
        // (the last laid-out height: an element just inserted may not have its styles yet)
        const h = r?.getBoundingClientRect().height;
        if (h) w.__reservas.push(h);
      }).observe(document, { subtree: true, childList: true });
    });
    for (const id of MUESTRA) {
      await page.goto(`/#/simulador/${id}`);
      await page.reload();
      await expect(page.locator('section.circuito-vivo:not([data-reserva]) .placa')).toBeVisible({ timeout: 60_000 });
      const reservado = await page.evaluate(() => (window as unknown as { __reservas: number[] }).__reservas.at(-1) ?? -1);
      const real = await page.locator('section.circuito-vivo:not([data-reserva]) .placa').evaluate((e) => e.getBoundingClientRect().height);
      expect.soft(Math.abs(reservado - real), `${id}: reservado ${reservado}, dibujo ${real}`).toBeLessThanOrEqual(3);
    }
    for (const id of ['cap20/prob-20.A_puente', 'cap32/fig-32.12_prob-32.B', 'cap05/sec-5.3_led_150ohm']) {
      await page.goto(`/#/instrumentos/circuito/${id}`);
      await page.reload();
      await expect(page.locator('.reserva-plano')).toHaveCount(0, { timeout: 60_000 });
      const res = await page.evaluate(() => (window as unknown as { __reservas: number[] }).__reservas.at(-1) ?? -1);
      const real = await page.locator('.banco .plano .lamina').evaluate((e) => e.getBoundingClientRect().height);
      // (a drawing that comes before the reserved place is ever laid out leaves nothing to measure: nothing was shown)
      if (res > 0) expect(Math.abs(res - real), `banco ${id}: reservado ${res}, dibujo ${real}`).toBeLessThanOrEqual(3);
    }
    await ctx.close();
  });

/** The diagnostic with only its instant test (WebGL 2): a results table in a second. */
async function diagnosticoRapido(page: Page): Promise<void> {
  await page.goto('/#/diagnostico');
  await page.locator('[data-accion="empezar"]').waitFor({ timeout: 60_000 });
  const casillas = page.locator('ul.pruebas input[type="checkbox"]');
  for (let i = 0; i < (await casillas.count()); i++) await casillas.nth(i).setChecked(i === 0);
  await page.locator('[data-accion="empezar"]').click();
  await expect(page.locator('.diagnostico')).toHaveAttribute('data-estado', 'hecho', { timeout: 120_000 });
}

/** WCAG contrast of an element's text over the first opaque background of its ancestors. */
function contraste(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    // rgb()/rgba(), or color(srgb r g b / a) as color-mix() computes (0–1)
    const rgb = (c: string) => {
      const n = (c.match(/[\d.]+/g) ?? []).map(Number);
      return c.startsWith('color(') ? n.map((x, i) => (i < 3 ? x * 255 : x)) : n;
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    return [...document.querySelectorAll(sel)].map((el) => {
      // the backgrounds from the element up to the first opaque one, blended (a translucent highlight counts)
      const capas: number[][] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        const alfa = c.length === 4 ? c[3]! : 1;
        if (alfa > 0) capas.push([c[0]!, c[1]!, c[2]!, alfa]);
        if (alfa >= 1) break;
      }
      let fondo = [255, 255, 255];
      for (const [r, g, b, a] of capas.reverse()) fondo = [r! * a! + fondo[0]! * (1 - a!), g! * a! + fondo[1]! * (1 - a!), b! * a! + fondo[2]! * (1 - a!)];
      const a = lum(rgb(getComputedStyle(el).color));
      const b = lum(fondo);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  }, selector);
}

test.describe('tableta en los tres temas', () => {
  test.use(TABLETA);
  // The diagnostic's values of a row with a warning or an error were drawn in fixed colours (#b7791f, #c0392b): 3,6:1
  // on white for the warnings, and the same colours in the dark theme. Its two text areas («Ver el texto que se
  // copia», «Ver el registro») had no label.
  for (const tema of ['claro', 'sepia', 'oscuro'] as const)
    test(`diagnóstico: los valores con aviso se leen (≥ 4,5:1) y los textos para copiar tienen nombre · ${tema}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      await diagnosticoRapido(page);
      const valores = await contraste(page, '.diagnostico tr.aviso td.valor, .diagnostico tr.error td.valor');
      expect(valores.length).toBeGreaterThan(0);
      for (const c of valores) expect(c).toBeGreaterThanOrEqual(4.5);
      // the results' text, and the two read-only logs (1.0: «Registro de la aplicación» and the error report's text,
      // both of class «registro»): every one of them has a name
      for (const [sel, n] of [['.diagnostico textarea:not(.registro)', 1], ['.diagnostico textarea.registro', 2]] as const) {
        const nombres = await page.locator(sel).evaluateAll((ts) => ts.map((t) => t.getAttribute('aria-label') ?? (t as HTMLTextAreaElement).labels?.[0]?.textContent ?? ''));
        expect(nombres, sel).toHaveLength(n);
        for (const nombre of nombres) expect(nombre.trim(), sel).not.toBe('');
      }
    });
});

test.describe('tableta · búsqueda en tema claro y sepia', () => {
  test.use(TABLETA);
  // The words a search finds are marked (<mark>) inside the grey fragment of each result: in the light and sepia themes
  // the mark kept the grey (--tinta-suave) over its yellow, 4,1–4,4:1 (axe, 0.12 QA); the 0.11 fix covered only the dark
  // theme.
  for (const tema of ['claro', 'sepia', 'oscuro'] as const)
    test(`las palabras resaltadas de la búsqueda se leen (≥ 4,5:1) · ${tema}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      await page.goto('/#/');
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog', { name: 'Buscar en el libro' }).locator('input').fill('diodo zener');
      await page.locator('.frag mark').first().waitFor({ timeout: 30_000 });
      const valores = await contraste(page, '.frag mark, .tit mark');
      expect(valores.length).toBeGreaterThan(0);
      expect(Math.min(...valores)).toBeGreaterThanOrEqual(4.5);
    });
});

test.describe('tableta · «Aa» al cambiar de página', () => {
  test.use(TABLETA);
  // «Aa» (a popover) stayed open over the next page when the route changed under it — Android's back button, history,
  // a link outside it —: on the next page it covered «Importar una copia…» (0.12 QA, found by axe after «Exportar copia»).
  test('«Aa» se cierra cuando cambia la página (atrás, un enlace)', async ({ page }) => {
    await page.goto('/#/cap05');
    await page.goto('/#/sincronizacion/copia');
    await page.locator('[data-copia]').waitFor({ timeout: 30_000 });
    const aa = page.locator('div.ajustes[role="dialog"]');
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
    await expect(aa).toBeVisible();
    await page.evaluate(() => history.back());
    await expect(page).toHaveURL(/#\/cap05$/);
    await expect(aa).toHaveCount(0);
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
    await expect(aa).toBeVisible();
    await page.evaluate(() => (location.hash = '#/glosario'));
    await expect(aa).toHaveCount(0);
  });
});

test.describe('móvil de 360 px', () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  // On a phone a section's tools go under its title in one row; with «Simular», «Ver animación», «Practicar» and the
  // five icons that row is 362 px: «Estudiar por pasos» ended at 380 px of 360, off the screen (0.12 QA layout stress,
  // also in 0.11.0: cap22 and cap45 sections).
  test('las herramientas de una sección caben en la pantalla', async ({ page }) => {
    for (const h of ['#/cap22/sec-22.6', '#/cap45', '#/cap05/sec-5.3']) {
      await page.goto(`/${h}`);
      await page.locator('.seccion-cab .herramientas').first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(2500);
      const fuera = await page.evaluate(() =>
        [...document.querySelectorAll('.seccion-cab .herramientas :is(a, button)')]
          .map((e) => ({ r: e.getBoundingClientRect(), t: e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '' }))
          .filter((x) => x.r.width > 0 && (x.r.right > innerWidth + 0.5 || x.r.left < -0.5))
          .map((x) => `${x.t}: ${Math.round(x.r.left)}–${Math.round(x.r.right)}`),
      );
      expect(fuera, h).toEqual([]);
    }
  });
});

test.describe('teléfono 412 px', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 });
  // A display equation 1 px wider than the phone's column scrolls (axe «scrollable-region-focusable», 0.12 QA on cap05's
  // block 312: 372 px in 371) but lib/desplazable.ts only made it focusable from 2 px on.
  test('toda ecuación que se desplaza se puede enfocar para desplazarla con el teclado', async ({ page }) => {
    await page.goto('/#/cap05');
    await page.locator('.ec-marco').first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3000);
    const sinFoco = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.ec-marco')].filter((e) => e.scrollWidth > e.clientWidth && e.tabIndex !== 0).map((e) => `${e.parentElement?.dataset['b']}: ${e.scrollWidth}/${e.clientWidth}`),
    );
    expect(sinFoco).toEqual([]);
  });
});

test.describe('tableta en sepia · lecturas de las animaciones', () => {
  test.use(TABLETA);
  // The readings of the animations and concepts (animaciones/ui/Marco.svelte) mix the scene's colour 55 % with the ink:
  // in sepia an orange reading was #966210 on #efe5cf, 4,17:1 (0.12 QA layout stress, 19 pages).
  test('los valores de las lecturas se leen en sepia (≥ 4,5:1)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'sepia', tam: 18 })));
    let n = 0;
    for (const h of ['#/conceptos/pwm', '#/conceptos/efecto-pelicular', '#/componentes/resistencia-ohm']) {
      await page.goto(`/${h}`);
      await page.locator('.lecturas dd').first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      const valores = await contraste(page, '.lecturas dd');
      n += valores.length;
      expect(Math.min(...valores), h).toBeGreaterThanOrEqual(4.5);
    }
    expect(n).toBeGreaterThan(0);
  });
});

test.describe('escritorio 1280 × 720', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  // The diagnostic draws its 3D views in a zone under the list of tests; on a screen where that zone is below the fold
  // the component viewer (which only draws while it is on screen) never drew its first frame: «primera vista» was the
  // 60 s timeout and «Al girar» 0 cuadros/s (since 0.8; the SDR board draws regardless).
  test('diagnóstico: el visor 3D de componentes dibuja aunque su zona empiece fuera de la pantalla', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/#/diagnostico');
    await page.locator('[data-accion="empezar"]').waitFor({ timeout: 60_000 });
    const casillas = page.locator('ul.pruebas input[type="checkbox"]');
    for (let i = 0; i < (await casillas.count()); i++) await casillas.nth(i).setChecked(i === 1);
    await page.locator('label.segundos input').fill('2');
    await page.locator('[data-accion="empezar"]').click();
    await expect(page.locator('.diagnostico')).toHaveAttribute('data-estado', 'hecho', { timeout: 240_000 });
    const fila = (n: RegExp) => page.locator('.diagnostico tbody tr', { has: page.locator('td', { hasText: n }) }).first();
    const primera = Number(((await fila(/primera vista/).locator('td.valor').textContent()) ?? '').replace(/\D/g, ''));
    expect(primera).toBeLessThan(55_000);
    // (a software GPU turns it slowly — the row may say so —, but it turns)
    expect(await fila(/^Al girar$/).locator('td.valor').textContent()).not.toMatch(/^0,0 /);
  });
});

test.describe('tableta a 2,5 × · placa 3D abierta por primera vez', () => {
  test.use({ ...TABLETA, deviceScaleFactor: 2.5 });
  // The first view of a board on a device filters the studio's environment after its first resize, and reads it back
  // after its first frame (0.12); three's setRenderTarget(null), at the end of both, floors the canvas viewport where
  // setSize() rounds it, so on this tablet (a 572,4 px high canvas at 2×) that view drew 1144 rows instead of 1145:
  // every part a fraction of a pixel off, 1,1 % of the NES board's pixels different from 0.11 and from the same board
  // opened again (the QA's «otra imagen con el entorno guardado»).
  test('la primera apertura dibuja lo mismo que la segunda (entorno calculado y entorno guardado)', async ({ page }) => {
    test.setTimeout(600_000);
    const abrir = async (): Promise<string> => {
      await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 300_000 });
      await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3D?: { carasFinas?: number } }).__epaPlaca3D?.carasFinas != null, null, { timeout: 120_000 });
      await expect.poll(async () => { const e = await entorno(page); return !!e && (e.origen === 'memoria' || e.guardado); }, { timeout: 120_000 }).toBe(true);
      await page.waitForTimeout(3000);
      return (await page.locator('canvas').first().screenshot()).toString('base64');
    };
    await page.goto('/#/consolas/nes/placa3d');
    const primera = await abrir();
    expect((await entorno(page))?.origen).toBe('pmrem');
    await page.reload();
    const segunda = await abrir();
    expect((await entorno(page))?.origen).toBe('memoria');
    const distintos = await page.evaluate(async ([a, b]) => {
      const img = (s: string) => new Promise<HTMLImageElement>((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = `data:image/png;base64,${s}`; });
      const [ia, ib] = await Promise.all([img(a!), img(b!)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const px = (i: HTMLImageElement) => { const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext('2d')!; x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
      const da = px(ia);
      const db = px(ib);
      let n = 0;
      for (let k = 0; k < da.length; k += 4) if (Math.max(Math.abs(da[k]! - db[k]!), Math.abs(da[k + 1]! - db[k + 1]!), Math.abs(da[k + 2]! - db[k + 2]!)) > 40) n++;
      return n / (da.length / 4);
    }, [primera, segunda]);
    expect(distintos).toBeLessThan(0.001);
  });
});

test.describe('tableta · visor de figuras con el teclado', () => {
  test.use(TABLETA);
  // The figure viewer covers the page (role=dialog, aria-modal) but did not keep the focus: Tab from its last control
  // went on to the links and buttons of the page under it, hidden behind the viewer (also in 0.11; the 0.12 QA's axe
  // audit with the viewer open — the first one: until then the harness never opened it — found those covered
  // controls measured against the viewer's white background).
  test('el foco no sale del visor y la página de debajo queda inerte', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/#/cap00/fig-0.1');
    const fig = page.locator('[id="fig-0.1"]');
    await fig.scrollIntoViewIfNeeded({ timeout: 60_000 });
    await fig.getByRole('button', { name: /^(Ampliar|Abrir .* en grande)/ }).first().click();
    await page.locator('.visor[role="dialog"]').waitFor();
    const dentro = () => page.evaluate(() => !!document.activeElement?.closest('.visor'));
    expect(await dentro()).toBe(true);
    for (const tecla of ['Tab', 'Shift+Tab']) {
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press(tecla);
        expect(await dentro(), `${tecla} ×${i + 1}`).toBe(true);
      }
    }
    // everything but the viewer is inert while it is open, and back to normal when it closes
    const inertes = () => page.evaluate(() => [...document.querySelectorAll('[inert]')].filter((e) => !e.closest('.visor') && !e.contains(document.querySelector('.visor'))).length);
    expect(await inertes()).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.visor[role="dialog"]')).toHaveCount(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('#app [inert]')].filter((e) => !e.closest('.lateral')).map((e) => e.className))).toEqual([]);
  });
});

// Owner's decision (0.12 QA): the tools row of a section (chips such as «Ver animación» and the icons such as
// «Estudiar por pasos») never pushes its title to more lines: when they do not fit beside it they go to their own row
// under it. Until then a title that fit on one line beside narrow tools took two beside wider ones (#/cap41/sec-41.1
// on the tablet, regresiones11). Every section of every part, at the three widths: each title has as many lines as
// it has with the tools hidden.
const PARTES_CON_SECCIONES = (() => {
  const ind = JSON.parse(readFileSync(new URL('../public/libro/indice.json', import.meta.url), 'utf8')) as {
    tomos: { partes: string[] }[];
    partes: Record<string, { secciones?: { label: string }[] }>;
  };
  const orden = ind.tomos.flatMap((t) => t.partes);
  return [...orden, ...Object.keys(ind.partes).filter((p) => !orden.includes(p))].filter((p) => p !== 'glosario' && (ind.partes[p]?.secciones?.length ?? 0) > 0);
})();

for (const [nombre, uso] of [
  ['móvil de 360 px', { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['tableta', TABLETA],
  ['escritorio de 1366 px', { viewport: { width: 1366, height: 900 } }],
] as const) {
  test.describe(`${nombre} · títulos de sección`, () => {
    test.use(uso);
    test('las herramientas no añaden líneas a ningún título de sección', async ({ page }) => {
      test.setTimeout(PARTES_CON_SECCIONES.length * 30_000);
      const mal: string[] = [];
      let vistos = 0;
      for (const p of PARTES_CON_SECCIONES) {
        await page.goto(`/#/${p}`);
        await page.locator('.cuerpo.texto-libro').waitFor({ timeout: 60_000 });
        // the part's chunks are rendered in idle time: all of them, and the tools' chips (they come with the indexes)
        await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.cuerpo.texto-libro > .trozo')].every((t) => t.childElementCount > 0)), { timeout: 60_000 }).toBe(true);
        await page.waitForTimeout(1500);
        const r = await page.evaluate(() => {
          const lineas = () =>
            [...document.querySelectorAll<HTMLElement>('.seccion-cab .fila > h2')].map((h) => ({
              id: h.id,
              n: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)),
            }));
          const con = lineas();
          const estilo = document.createElement('style');
          estilo.textContent = '.seccion-cab .herramientas { display: none !important; }';
          document.head.append(estilo);
          const sin = lineas();
          estilo.remove();
          return con.map((c, i) => ({ ...c, sin: sin[i]!.n }));
        });
        vistos += r.length;
        for (const x of r) if (x.n !== x.sin) mal.push(`${p}/${x.id}: ${x.n} líneas con las herramientas, ${x.sin} sin ellas`);
      }
      expect(vistos).toBeGreaterThan(700);
      expect(mal).toEqual([]);
    });
  });
}

// The axe audit over a sample of 40 sections (0.12 QA, after the title change; until then it audited one section):
// the book's tables were all keyboard regions named by their headers — two with the same headers on one page were two
// landmarks with one name (cap31, cap46) — and an empty corner header cell was an empty <th> (cap03, cap10); a code
// listing wider than the column (cap38, cap31) scrolled without being reachable with the keyboard; two live figures of
// one page had two regions «Controles del circuito» (cap22); on the phone a table that overflowed only once its cells
// had grown was never made reachable (cap00). Since 0.11 at least.
async function auditarPartes(page: Page, partes: string[]): Promise<string[]> {
  const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
  const mal: string[] = [];
  for (const p of partes) {
    await page.goto(`/#/${p}`);
    await page.locator('.cuerpo.texto-libro').waitFor({ timeout: 60_000 });
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.cuerpo.texto-libro > .trozo')].every((t) => t.childElementCount > 0)), { timeout: 60_000 }).toBe(true);
    // (a section route: the page scrolled to it, its live figures mounted, as the QA's axe audit sees it)
    await page.waitForTimeout(p.includes('/') ? 6000 : 2500);
    await page.addScriptTag({ content: axe });
    const v = await page.evaluate(async () => {
      const r = await (globalThis as unknown as { axe: { run(c: unknown, o: unknown): Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document.querySelector('.cuerpo.texto-libro'), {
        runOnly: { type: 'rule', values: ['empty-table-header', 'landmark-unique', 'scrollable-region-focusable'] },
      });
      return r.violations.flatMap((x) => x.nodes.map((n) => `${x.id}: ${n.target.join(' ')}`));
    });
    mal.push(...v.map((x) => `${p} ${x}`));
    // the same, without axe's leniency (a box with a link inside passes it): every table or listing that scrolls
    // takes the focus
    const sinFoco = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.cuerpo.texto-libro :is(.tabla-scroll, pre.codigo)')]
        .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth && !e.hasAttribute('tabindex'))
        .map((e) => `${e.className} en data-b=${e.closest('[data-b]')?.getAttribute('data-b')} (${e.scrollWidth}/${e.clientWidth} px)`),
    );
    mal.push(...sinFoco.map((x) => `${p} se desplaza sin foco: ${x}`));
  }
  return mal;
}

test.describe('tableta · tablas, listados y figuras vivas del libro', () => {
  test.use(TABLETA);
  test('axe: sin regiones repetidas, sin cabeceras vacías y con los listados anchos alcanzables', async ({ page }) => {
    test.setTimeout(400_000);
    expect(await auditarPartes(page, ['cap03', 'cap10', 'cap22/sec-22.8', 'cap31', 'cap38', 'cap46'])).toEqual([]);
  });
});

test.describe('teléfono · tablas del libro', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625, colorScheme: 'dark' });
  test('axe: las tablas que desbordan se alcanzan con el teclado', async ({ page }) => {
    test.setTimeout(300_000);
    expect(await auditarPartes(page, ['cap00/sec-0.18', 'cap22/sec-22.8'])).toEqual([]);
  });
});
