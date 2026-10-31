// Regression tests of the bugs found by the 0.11 QA harness (tests/qa/), each in the profile where it was seen
// (the owner's tablet: 800×1280, touch). One test per fix; the harness itself is run with playwright.qa.config.ts.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.regresiones11.config.ts tests/regresiones11.spec.ts
import { expect, test, type Page } from '@playwright/test';

const TABLETA = { viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };

/** Records elements added under `selector` (their text) and the layout shifts, from now on. */
async function vigilar(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const w = window as unknown as { __añadidos: string[]; __cls: number };
    w.__añadidos = [];
    w.__cls = 0;
    const raiz = document.querySelector(sel) ?? document.body;
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) w.__añadidos.push(`${n.className}|${(n.textContent ?? '').trim().slice(0, 60)}`);
    }).observe(raiz, { subtree: true, childList: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift' });
  }, selector);
}

test.describe('tableta', () => {
  test.use(TABLETA);

  // The circuit drawn on the simulator page re-solves itself with the same engine after every result: the page's
  // toolbar used to follow that background run, so «Detener», «Simulando…», ngspice's first line («Warning: can't
  // find the initialization file spinit.») and «Salida de ngspice» flashed after each «Simular».
  test('simulador: «Simular» no hace parpadear la barra ni la salida de ngspice', async ({ page }) => {
    await page.goto('/#/simulador/cap50/disipacion');
    const boton = page.locator('.mando button.primario');
    await expect(page.locator('.pagina .resultado')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('section.circuito-vivo:not([data-reserva])')).toBeVisible({ timeout: 30_000 });
    // let the drawing's own re-solve finish
    await page.waitForTimeout(2500);
    await vigilar(page, '.pagina');
    await boton.click();
    await expect(page.locator('.mando .estado')).toContainText('Simulado en', { timeout: 60_000 });
    await page.waitForTimeout(2500);
    const añadidos = await page.evaluate(() => (window as unknown as { __añadidos: string[] }).__añadidos);
    // the page's own run may show «Detener» once; the drawing's re-solve afterwards must add nothing
    expect(añadidos.filter((t) => /Detener/.test(t)).length).toBeLessThanOrEqual(1);
    expect(añadidos.filter((t) => /spinit/.test(t))).toEqual([]);
    expect(añadidos.filter((t) => /^ultima/.test(t))).toEqual([]);
    expect(añadidos.filter((t) => /Pulse «Simular»/.test(t))).toEqual([]);
    // a slow re-solve of the drawn circuit is announced inside the panel's row, never as a line of its own
    expect(añadidos.filter((t) => /^estado(?! en-fila)/.test(t) && /Simulando con ngspice/.test(t))).toEqual([]);
  });

  // On the tablet (one column) the circuit appeared above everything about a second after opening a netlist and
  // pushed the whole page some 500 px down (CLS 0.3–1.1). Its place is now kept while the drawing is decided.
  test('simulador: el circuito dibujado no empuja la página al aparecer', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __notas: string[] };
      w.__cls = 0;
      w.__notas = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new MutationObserver((ms) => {
        for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement && /Pulse «Simular»/.test(n.textContent ?? '')) w.__notas.push(n.textContent ?? '');
      }).observe(document, { subtree: true, childList: true });
    });
    for (const id of ['cap50/disipacion', 'cap01/superposicion_1.5']) {
      await page.goto(`/#/simulador/${id}`);
      await page.reload();
      await expect(page.locator('.pagina .resultado')).toBeVisible({ timeout: 90_000 });
      await expect(page.locator('section.circuito-vivo:not([data-reserva])')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      const { cls, notas } = await page.evaluate(() => ({ cls: (window as unknown as { __cls: number }).__cls, notas: (window as unknown as { __notas: string[] }).__notas }));
      expect(cls, id).toBeLessThan(0.1);
      // an automatic run never shows «Pulse «Simular»…» for a few frames first
      expect(notas, id).toEqual([]);
    }
  });

  // The problem panels, the «Simular» buttons and the «Calcular» rows arrived after the text of the first part
  // opened and pushed it down under the reader (up to 360 px on the tablet).
  test('lector: la primera parte que se abre no salta cuando llegan los paneles y los botones', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/#/cap08/sec-8.10');
    await page.reload();
    await expect(page.locator('.panel-problema').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);
    // the panel, the «Simular» chip of the problem and the «Calcular» rows were all there in the first layout
    await expect(page.locator('h3 .simular, h3 button.simular').first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
  });

  // The glossary drew its entries before the symbols and 3D pictures of the terms arrived: the term opened from a
  // link moved some 200 px down a second later.
  test('glosario: el término abierto desde un enlace se queda en su sitio', async ({ page }) => {
    // the term's place on screen, every frame from the moment it exists until 3 s later
    await page.addInitScript(() => {
      const w = window as unknown as { __ys: number[] };
      w.__ys = [];
      const mirar = () => {
        const el = document.getElementById('glos-radiofrecuencia');
        if (el && w.__ys.length < 400) w.__ys.push(Math.round(el.getBoundingClientRect().top));
        requestAnimationFrame(mirar);
      };
      requestAnimationFrame(mirar);
    });
    // the pictures' map arrives a little after the terms (as on a busy tablet)
    await page.route('**/glosario-imagenes.json', async (r) => {
      await new Promise((f) => setTimeout(f, 700));
      await r.continue();
    });
    await page.goto('/#/glosario/glos-radiofrecuencia');
    await page.reload();
    await expect(page.locator('[id="glos-radiofrecuencia"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3500);
    // from the first frame it is on screen, it does not move
    const ys = (await page.evaluate(() => (window as unknown as { __ys: number[] }).__ys)).filter((y) => y >= 0 && y < 1280);
    expect(ys.length).toBeGreaterThan(0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4);
    await expect(page.locator('.entrada.con-imagen').first()).toBeAttached();
  });

  // The editor showed «Circuito nuevo» while a book circuit loaded, and the longer title that came with it pushed
  // the buttons to a new line and the whole editor 52 px down.
  test('editor: abrir un circuito del libro no mueve los botones ni enseña «Circuito nuevo»', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => {
      const w = window as unknown as { __titulos: string[] };
      w.__titulos = [];
      new MutationObserver(() => {
        const h = document.querySelector('.editor-pagina h1, main h1');
        if (h) w.__titulos.push(h.textContent ?? '');
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await page.evaluate(() => (location.hash = '#/editor/libro/cap00/descarga_470u_320v'));
    const botones = page.locator('.editor-pagina .cab .botones');
    await expect(botones).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.editor-pagina h1')).toContainText('470', { timeout: 30_000 });
    const y0 = (await botones.boundingBox())!.y;
    await page.waitForTimeout(1500);
    expect(Math.abs((await botones.boundingBox())!.y - y0)).toBeLessThan(2);
    const titulos = await page.evaluate(() => (window as unknown as { __titulos: string[] }).__titulos);
    expect(titulos.filter((t) => t.includes('Circuito nuevo'))).toEqual([]);
  });

  // The loading placeholders («Abriendo…», «Cargando la placa…») flashed for a few frames on quick loads: they now
  // fade in only after 0.3 s.
  test('los avisos de carga no se ven en una carga rápida', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('main')).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __vistos: string[] };
      w.__vistos = [];
      new MutationObserver((ms) => {
        for (const m of ms)
          for (const n of m.addedNodes)
            if (n instanceof HTMLElement && n.classList.contains('cargando'))
              requestAnimationFrame(() => {
                if (n.isConnected && Number(getComputedStyle(n).opacity) > 0.05) w.__vistos.push(n.textContent ?? '');
              });
      }).observe(document.body, { subtree: true, childList: true });
    });
    for (const h of ['#/simulador', '#/calculadoras', '#/repaso', '#/proyectos/hifi-potencia/comprobaciones', '#/consolas/gb/fotograma', '#/consolas/snes/arquitectura']) {
      await page.evaluate((x) => (location.hash = x), h);
      await page.waitForTimeout(1200);
    }
    expect(await page.evaluate(() => (window as unknown as { __vistos: string[] }).__vistos)).toEqual([]);
  });

  // The place kept for the drawn circuit must go when there is nothing to draw (the empty free circuit): it stayed
  // as an empty «Circuito» box for ever.
  test('simulador: el circuito libre vacío no deja un hueco de circuito', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('epa:circuito'));
    await page.goto('/#/simulador/nuevo');
    await expect(page.getByText('Escriba una netlist de ngspice')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('section.circuito-vivo')).toHaveCount(0);
  });

  // The book figure on the instruments' bench had no size until it loaded: the connections, the options and the
  // instruments under it jumped some 290 px down.
  test('instrumentos: la figura del banco no empuja los instrumentos al cargar', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/#/instrumentos/practica/1');
    await expect(page.locator('.banco .plano img')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });

  // A section title whose last line filled the column put the hanging «Estudiar por pasos» icon under the
  // section's tools («Simular» covered it on the tablet). Since the final pass it is one of the tools: none of them
  // overlaps another or the title.
  test('lector: el icono «Estudiar por pasos» no queda debajo de las herramientas de la sección', async ({ page }) => {
    for (const ruta of ['#/cap39/sec-39.8', '#/cap02/sec-2.11', '#/cap25/sec-25.6']) {
      await page.goto(`/${ruta}`);
      const label = ruta.split('/')[2]!;
      const cab = page.locator('.seccion-cab', { has: page.locator(`h2[id="${label}"]`) });
      await expect(cab.locator('.herramientas [data-por-pasos]')).toBeVisible({ timeout: 30_000 });
      const pisadas = await cab.evaluate((c) => {
        const cruza = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        const rango = document.createRange();
        rango.selectNodeContents(c.querySelector('h2')!);
        const texto = [...rango.getClientRects()].filter((x) => x.width > 1);
        const herr = [...c.querySelectorAll('.herramientas :is(.chips, .iconos) > *')].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0);
        let n = 0;
        for (let i = 0; i < herr.length; i++) {
          for (let k = i + 1; k < herr.length; k++) if (cruza(herr[i]!, herr[k]!)) n++;
          if (texto.some((t) => cruza(herr[i]!, t))) n++;
        }
        return n;
      });
      expect(pisadas, ruta).toBe(0);
    }
  });
});

test.describe('teléfono', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

  // On a phone a section title could not shrink below its longest word, and the section's tools («Añadir nota»,
  // «Marcador») were pushed past the right edge of the screen, out of reach.
  test('lector: las herramientas de la sección caben en la pantalla', async ({ page }) => {
    for (const ruta of ['#/cap39/sec-39.8', '#/cap08/sec-8.10', '#/cap02/sec-2.11']) {
      await page.goto(`/${ruta}`);
      const label = ruta.split('/')[2]!;
      const cab = page.locator('.seccion-cab', { has: page.locator(`h2[id="${label}"]`) });
      await expect(cab).toBeVisible({ timeout: 30_000 });
      const derecha = await cab.evaluate((c) => Math.max(...[...c.querySelectorAll('.herramientas :is(.chips, .iconos) > *')].map((e) => e.getBoundingClientRect().right)));
      expect(derecha, ruta).toBeLessThanOrEqual(412);
    }
  });

  // Touch areas of at least 44 px for the simulator's small controls (owner's rule for 0.11), without making them
  // look bigger: the visible button keeps its height and a transparent box around it takes the taps.
  test('simulador: «Simular», «Fijar referencia», la cabecera y las migas tienen 44 px para el dedo', async ({ page }) => {
    await page.goto('/#/simulador/cap05/sec-5.3_led_150ohm');
    await expect(page.locator('.pagina .resultado')).toBeVisible({ timeout: 90_000 });
    const tamanos = await page.evaluate(() =>
      ['.mando button.primario', '.mando button:not(.primario)', '.meta a.libro', '.meta button.protoboard', '.migas a', 'label.e12'].map((sel) => {
        const el = document.querySelector(sel)!;
        const r = el.getBoundingClientRect();
        const p = getComputedStyle(el, '::after');
        const w = Math.max(r.width, p.content !== 'none' ? parseFloat(p.width) || 0 : 0);
        const h = Math.max(r.height, p.content !== 'none' ? parseFloat(p.height) || 0 : 0);
        return [sel, Math.round(Math.min(w, h))] as const;
      }),
    );
    for (const [sel, t] of tamanos) expect(t, sel).toBeGreaterThanOrEqual(44);
    // and a tap on the edge of the touch area, outside the drawn button, reaches it
    await page.locator('.mando button.primario').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const b = await page.locator('.mando button.primario').boundingBox();
    const arriba = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('button')?.textContent?.trim() ?? '', [b!.x + b!.width / 2, b!.y - 3]);
    expect(arriba).toContain('Simular');
  });
});

// The faint text colour (--tinta-tenue) was 2.9:1 on the light backgrounds; the owner chose darker values for every
// theme (0.11): at least 4.5:1 (WCAG AA) over each background token of each theme.
test('contraste: el gris tenue llega a 4,5:1 sobre todos los fondos de los tres temas', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('main')).toBeVisible();
  for (const tema of ['claro', 'sepia', 'oscuro']) {
    const peor = await page.evaluate((t) => {
      document.documentElement.dataset.tema = t;
      const cs = getComputedStyle(document.documentElement);
      const rgb = (v: string) => {
        let h = v.trim().replace('#', '');
        if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
        return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      };
      const lum = (c: number[]) => c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i]!, 0);
      const f = lum(rgb(cs.getPropertyValue('--tinta-tenue')));
      return Math.min(
        ...['--fondo', '--fondo-lateral', '--fondo-carril', '--superficie', '--superficie-2', '--tarjeta-fondo', '--codigo-fondo', '--nota-personal'].map((k) => {
          const b = lum(rgb(cs.getPropertyValue(k)));
          return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05);
        }),
      );
    }, tema);
    expect(peor, tema).toBeGreaterThanOrEqual(4.5);
  }
});

// The practice problems write their answers with the calculators' formatter («17,3 nV/√Hz», «2,1 mV/m»), and the
// checker did not take a prefix on those units: the right answer, typed as the app itself writes it, was rejected
// with «nV/√Hz no es una unidad de esta magnitud». Every numeric practice item, at two variants, must accept the
// answer exactly as the app writes it (found by the lesson sweep of the QA harness).
test('práctica: cada problema numérico acepta su respuesta escrita como la escribe la aplicación', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { comprobar } = await import('../src/lib/magnitudes.ts');
  const { variante, valorTexto } = await import('../src/componentes/practica/variantes.ts');
  const dir = new URL('../public/libro/practica/', import.meta.url);
  const fallos: string[] = [];
  let n = 0;
  for (const f of readdirSync(dir).filter((x) => x !== 'indice.json')) {
    const p = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { items: { tipo: string; id: string; objetivo: string; tol: number; formula: { vars: { id: string; unidad: string }[] } }[] };
    for (const it of p.items) {
      if (it.tipo !== 'numerico') continue;
      const unidad = it.formula.vars.find((v) => v.id === it.objetivo)?.unidad ?? '';
      for (const semilla of [0, 1]) {
        const v = variante(it as never, semilla);
        if (!v) continue;
        n++;
        const texto = valorTexto(v.resultado, unidad);
        const r = comprobar(texto, { valor: v.resultado, unidad, tol: it.tol, texto: '' });
        if (r.tipo !== 'bien') fallos.push(`${it.id} «${texto}»: ${r.tipo}`);
      }
    }
  }
  expect(n).toBeGreaterThan(300);
  expect(fallos).toEqual([]);
});

// Table headers had «white-space: nowrap» with cells limited to 22em: a header longer than that spilled out of its
// column (cap48: «Ejemplo (fuente de banco ampliada, sección 49.14)»). Headers now wrap only when they do not fit,
// so short ones («Portadores libres») stay on one line.
test.describe('tablas', () => {
  test.use(TABLETA);
  test('lector: una cabecera larga se parte dentro de su columna y una corta no se parte', async ({ page }) => {
    const medir = (th: import('@playwright/test').Locator) =>
      th.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        const rs = [...r.getClientRects()].filter((q) => q.width > 0);
        const c = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return {
          sobra: Math.max(...rs.map((q) => q.right)) - (c.right - parseFloat(s.paddingRight)),
          lineas: Math.round((Math.max(...rs.map((q) => q.bottom)) - Math.min(...rs.map((q) => q.top))) / parseFloat(s.fontSize) / 1.4),
        };
      });
    await page.goto('/#/cap48');
    const largo = page.locator('.tabla thead th', { hasText: 'fuente de banco ampliada' }).first();
    await largo.scrollIntoViewIfNeeded({ timeout: 30_000 });
    const l = await medir(largo);
    expect(l.sobra).toBeLessThanOrEqual(1);
    expect(l.lineas).toBeGreaterThanOrEqual(2);
    await page.goto('/#/cap05');
    const corto = page.locator('.tabla thead th', { hasText: 'Portadores libres' }).first();
    await corto.scrollIntoViewIfNeeded({ timeout: 30_000 });
    expect((await medir(corto)).lineas).toBe(1);
  });
});

// Phase 2 fuzzing of the answer checker: «3.323 V» (decimal point, three decimals) was read as Spanish thousands
// (3323) and marked «cerca» even when 3,323 V was the answer; and the calculators' formatter wrote «960 mkg».
test('comprobador: punto decimal con tres decimales y unidades que ya llevan prefijo', async () => {
  const { comprobar } = await import('../src/lib/magnitudes.ts');
  const { formatoValor } = await import('../src/componentes/calculadoras/unidades.ts');
  expect(comprobar('3.323 V', { valor: 3.323, unidad: 'V', tol: 0.002, texto: '' }).tipo).toBe('bien');
  expect(comprobar('1.139 mA', { valor: 1.139e-3, unidad: 'A', tol: 0.002, texto: '' }).tipo).toBe('bien');
  // thousands keep working
  expect(comprobar('2.200', { valor: 2200, unidad: 'Ω', tol: 0.01, texto: '' }).tipo).toBe('bien');
  expect(comprobar('3.323', { valor: 3323, unidad: 'Ω', tol: 0.01, texto: '' }).tipo).toBe('bien');
  expect(formatoValor(0.96, 'kg', 3, true)).not.toContain('mkg');
  expect(formatoValor(0.002, 'FIT', 3, true)).not.toMatch(/mFIT/);
});

// Phase 2 round trip of the schematic editor: a book netlist opened as a drawing gave back nodes renamed «n1»
// when their pins met without a wire (cap42 fig-42.3: «e» and «e2», so «print v(e)» failed), and a node the layout
// had drawn half as wire and half as a lone net label (the minus of a diode bridge: cap04 prob-4.B «neg», cap50
// rectificador) came back split in two, the bridge disconnected from its load.
test('editor: la netlist del libro abierta como dibujo conserva nodos y conexiones', async () => {
  const { readFileSync } = await import('node:fs');
  const { sembrarDibujos } = await import('../src/componentes/esquema-auto/generar.ts');
  const { editableDeNetlist } = await import('../src/componentes/esquema-auto/editable.ts');
  const { documentoDeEditable } = await import('../src/componentes/editor/importar.ts');
  const { generarNetlist } = await import('../src/componentes/editor/netlist.ts');
  sembrarDibujos(JSON.parse(readFileSync(new URL('../src/componentes/esquema-auto/precalculado.json', import.meta.url), 'utf8')));
  const libro = new URL('../public/libro/', import.meta.url);
  const sp = JSON.parse(readFileSync(new URL('spice.json', libro), 'utf8')) as { netlists: Record<string, { fichero: string }> };
  const ida = (id: string) => {
    const t = readFileSync(new URL(sp.netlists[id]!.fichero, libro), 'utf8');
    const texto = generarNetlist(documentoDeEditable(t, editableDeNetlist(t)!, { tipo: 'libro', id })).texto;
    return (nombre: string) => texto.split('\n').find((l) => l.split(/\s+/)[0] === nombre) ?? '';
  };
  const a = ida('cap42/fig-42.3_op_emisor_comun');
  expect(a('RE')).toMatch(/^RE e 0 /);
  expect(a('Q2')).toMatch(/^Q2 c2 b2 e2 /);
  const b = ida('cap04/prob-4.B_fuente_lineal');
  expect(b('D3')).toMatch(/^D3 neg x /);
  expect(b('CF')).toMatch(/^CF pos neg /);
  expect(b('RLB')).toMatch(/^RLB pos neg /);
  const c = ida('cap50/rectificador');
  expect(c('DA3')).toMatch(/^DA3 na a1a /);
  expect(c('CA')).toMatch(/^CA pa na /);
});

// Phase 2 «sin red»: with the content's JSON failing, pages said «No se pudieron cargar los datos: Failed to fetch»
// with no way out (consoles, KiCad projects, the FM7303 kit), stayed «Cargando…» (a bench circuit) or showed half
// of themselves as if nothing was missing (calculators, simulator, Repaso, glossary); and the glossary, the search
// index, the cards and the tests kept the failure, so even a reload of the view could not recover. Now every one
// says it in Spanish with «Reintentar», and «Reintentar» brings the page once the network is back.
test.describe('sin red', () => {
  test.use(TABLETA);
  for (const hash of ['#/consolas', '#/proyectos', '#/fm7303/esquema', '#/calculadoras', '#/simulador', '#/glosario', '#/repaso', '#/repaso/practica/cap05', '#/instrumentos/circuito/cap17/prob-17.A-fuga']) {
    test(`${hash}: avisa con «Reintentar» y se recupera`, async ({ page }) => {
      test.setTimeout(120_000);
      // from the bookmarks page, which loads nothing of what the tested page needs (the start page has the glossary)
      await page.goto('/#/marcadores');
      await page.locator('#contenido').waitFor();
      await page.waitForTimeout(1500);
      await page.route(
        (u) => /\.json(\?|$)/.test(u.pathname) && !/\/libro\/(indice|refs)\.json$/.test(u.pathname),
        (r) => r.abort('internetdisconnected'),
      );
      await page.evaluate((h) => (location.hash = h), hash);
      const aviso = page.locator('.error-carga');
      await expect(aviso.first()).toBeVisible({ timeout: 30_000 });
      await expect(aviso.first()).toContainText('Compruebe la conexión');
      await expect(aviso.first()).not.toContainText(/fetch/i);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await aviso.first().getByRole('button', { name: 'Reintentar' }).click();
      await expect(page.locator('.error-carga')).toHaveCount(0, { timeout: 30_000 });
    });
  }
});

// Phase 2 visual comparison with 0.10.1: section titles wrapped that fit on one line in 0.10.1 (the room for the
// «Estudiar por pasos» icon at the end of the title). Owner's decision (final pass): the icon is one of the section's
// tools, the four icon buttons take the width of the three of 0.10.1, and titles wrap as they did — these four fit
// on one line in 0.10.1 at the tablet's width (measured on the 0.10.1 build).
test.describe('tableta: títulos', () => {
  test.use(TABLETA);
  for (const [ruta, lineas] of [
    ['#/cap41/sec-41.1', 1],
    ['#/cap41/sec-41.4', 1],
    ['#/cap41/sec-41.7', 1],
    ['#/cap42/sec-42.5', 1],
  ] as const) {
    test(`lector: el título de ${ruta} ocupa ${lineas} línea(s), como en la 0.10.1`, async ({ page }) => {
      await page.goto(`/${ruta}`);
      const label = ruta.split('/')[2]!;
      const h2 = page.locator(`h2[id="${label}"]`);
      await expect(h2).toBeVisible({ timeout: 30_000 });
      expect(await h2.evaluate((h) => Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)))).toBe(lineas);
      // the icon: with the tools, same name and link, not in the title
      const icono = page.locator('.seccion-cab', { has: h2 }).locator('.herramientas a[data-por-pasos]');
      await expect(icono).toHaveAccessibleName('Estudiar por pasos');
      await expect(icono).toHaveAttribute('href', `#/leccion/${ruta.slice(2)}`);
      await expect(h2.locator('[data-por-pasos]')).toHaveCount(0);
      // 44 px for the finger around it
      const caja = (await icono.boundingBox())!;
      const cx = caja.x + caja.width / 2;
      const cy = caja.y + caja.height / 2;
      for (const [dx, dy] of [[0, -21], [0, 21], [-9, 0], [9, 0]] as const)
        expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('[data-por-pasos]'), [cx + dx, cy + dy])).toBe(true);
    });
  }
});

// The book's photos (img/*.jpg) came without their size: the text under them jumped when they arrived. The content
// generator now writes `img_tam` (contenido/datos_figuras.py) and the figure gives the <img> its width and height.
test('fotos del libro: la imagen lleva su tamaño antes de cargar', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const parte = JSON.parse(readFileSync(new URL('../public/libro/partes/cap35.json', import.meta.url), 'utf8')) as { bloques: { t: string; src?: string; img_tam?: number[] }[] };
  const foto = parte.bloques.find((b) => b.t === 'figura' && b.src === 'img/foto_temperatura.jpg');
  expect(foto?.img_tam?.length).toBe(2);
  await page.route('**/img/foto_temperatura.jpg', () => {}); // never arrives
  await page.goto('/#/cap35');
  const img = page.locator('img[src$="foto_temperatura.jpg"]').first();
  await img.scrollIntoViewIfNeeded({ timeout: 30_000 });
  expect(await img.getAttribute('width')).toBe(String(foto!.img_tam![0]));
  const caja = await img.boundingBox();
  expect(caja!.height).toBeGreaterThan(50);
});

// Svelte warned «derived_inert» when the practice index arrived after leaving a part: «Practicar con otros valores»
// read its exercise's label from a destroyed parent (found by the monkey and the memory walk of the harness).
test('lector: salir de una parte antes de que llegue el índice de práctica no deja avisos', async ({ page }) => {
  const avisos: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') avisos.push(m.text());
  });
  await page.route('**/libro/practica/indice.json', async (r) => {
    await new Promise((ok) => setTimeout(ok, 1500));
    await r.continue().catch(() => {});
  });
  await page.goto('/#/glosario');
  for (const parte of ['cap01', 'cap02', 'cap05']) {
    await page.evaluate((h) => (location.hash = h), `#/${parte}`);
    await page.locator('.otros-valores, [data-practicar-ej], section.ejercicios').first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.evaluate(() => (location.hash = '#/glosario'));
    await page.waitForTimeout(2000);
  }
  expect(avisos.filter((a) => /derived_inert/.test(a))).toEqual([]);
});

// The glossary list jumped some 3 s after opening a term (CLS 0.25 on the tablet, 0.9 once): the book's fonts were
// only asked for once the list was drawn, and every entry reflowed when they came; and pictures that arrived after
// the 1 s wait grew their entries. The list now waits (≤ 1.5 s) for the fonts, as the reader does, and keeps the
// pictures' places from the small glosario-imagenes.json until their chunk arrives.
test.describe('glosario lento', () => {
  test.use(TABLETA);
  test('glosario: las imágenes que llegan tarde no mueven la lista', async ({ page }) => {
    await page.route(/\/assets\/imagenes-[\w-]+\.js$/, async (r) => {
      await new Promise((ok) => setTimeout(ok, 3500));
      await r.continue().catch(() => {});
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/#/glosario/glos-via');
    await expect(page.locator('[id="glos-via"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.entrada .simbolo svg').first()).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

// On a phone (one column) a calculator's controls were drawn first and its illustration (a lazy chunk) pushed them
// down by a quarter of the screen when it came (CLS 0.11–0.15). The controls now wait, hidden, for it.
test.describe('teléfono: calculadora', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  test('calculadora: la ilustración que llega tarde no empuja los controles', async ({ page }) => {
    await page.route(/\/assets\/Ilustracion-[\w-]+\.js$/, async (r) => {
      await new Promise((ok) => setTimeout(ok, 1500));
      await r.continue().catch(() => {});
    });
    await page.goto('/#/calculadoras');
    await page.locator('a[href^="#/calculadoras/"]').first().waitFor({ timeout: 30_000 });
    await page.evaluate(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift' });
    });
    await page.evaluate(() => (location.hash = '#/calculadoras/p-conduccion-mosfet'));
    await expect(page.locator('.calculadora .control')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

// Phase 2 (fase2-estado): two quick taps on a lesson's «Continuar» skipped a screen: the second tap landed on the next
// screen's «Continuar», in the same place. The second click of a double tap or double click is ignored.
test.describe('tableta: lección', () => {
  test.use(TABLETA);
  test('lección: un doble toque en «Continuar» avanza una sola pantalla', async ({ page }) => {
    await page.goto('/#/leccion/cap00/sec-0.1');
    const c = page.locator('[data-continuar]').first();
    await expect(c).toBeEnabled({ timeout: 30_000 });
    await page.waitForTimeout(500);
    const b = (await c.boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => location.hash)).toBe('#/leccion/cap00/sec-0.1/2');
  });
});

// On a phone a 3D model's page pushed its details down twice while the model loaded (CLS 0.17): the placeholder was
// 16:10 where the view is 4:4.2 with a tool bar, and the labels and the tool bar came with the model. The placeholder
// has the view's size and the details wait, hidden, for the complete view.
test.describe('teléfono: modelo 3D', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  test('modelo 3D: la vista que se completa no empuja la ficha', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/#/componentes/3d');
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift' });
    });
    await page.evaluate(() => (location.hash = '#/componentes/3d/resistencia-smd'));
    await expect(page.locator('.visor3d.completo')).toBeAttached({ timeout: 120_000 });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

// Phase 2 (reload in the middle of the work): «Repaso» drew its three parts as each arrived and the tests' section was
// pushed down by the cards' summary (CLS 0.13 on the tablet). The page now shows at once (≤ 2.5 s).
test.describe('tableta: repaso', () => {
  test.use(TABLETA);
  test('repaso: la portada aparece entera, sin empujones', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.route('**/libro/practica/indice.json', async (r) => {
      await new Promise((ok) => setTimeout(ok, 800));
      await r.continue().catch(() => {});
    });
    await page.goto('/#/repaso');
    await expect(page.locator('#tit-tests')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

// Phase 2 (slow network): the review cards chose a card when the glossary arrived even if the reader had already left
// the page («derived_inert»); the chapter's «Test del capítulo» button did the same with the tests' index.
test('repaso: las tarjetas que llegan tras salir de la página no dejan avisos', async ({ page }) => {
  const avisos: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') avisos.push(m.text());
  });
  await page.route('**/libro/glosario.json', async (r) => {
    await new Promise((ok) => setTimeout(ok, 2000));
    await r.continue().catch(() => {});
  });
  await page.route('**/libro/repaso/indice.json', async (r) => {
    await new Promise((ok) => setTimeout(ok, 2000));
    await r.continue().catch(() => {});
  });
  await page.goto('/#/marcadores');
  await page.locator('#contenido').waitFor();
  await page.evaluate(() => (location.hash = '#/repaso/tarjetas'));
  await page.waitForTimeout(400);
  await page.evaluate(() => (location.hash = '#/cap05'));
  await page.waitForTimeout(400);
  await page.evaluate(() => (location.hash = '#/marcadores'));
  await page.waitForTimeout(3500);
  expect(avisos.filter((a) => /derived_inert/.test(a))).toEqual([]);
});

// Phase 2 (group B's intermittent «stuck after Continuar» under load): the learning events' consumers load lazily on
// the first answer; a session that ended before they arrived computed its summary without the session's answers
// (nothing improved, and the «what improved» list could stay empty). The end screen now waits for them.
test.describe('tableta: práctica inteligente', () => {
  test.use(TABLETA);
  test('práctica inteligente: el resumen cuenta las respuestas aunque los consumidores tarden en cargar', async ({ page }) => {
    test.setTimeout(240_000);
    const DIA = 86_400_000;
    const ahora = Date.now();
    const dominio = {
      version: 1,
      migrado: 1,
      items: {
        'cap05-01': { s: 'cap05/sec-5.1', c: 'q', r: [[ahora - 2 * DIA, 0]] },
        'cap05-03': { s: 'cap05/sec-5.1', c: 'q', r: [[ahora - 2 * DIA, 0]] },
        'cap05-04': { s: 'cap05/sec-5.2', c: 'q', r: [[ahora - 40 * DIA, 100]] },
      },
    };
    await page.addInitScript((d) => {
      (window as unknown as { __epaSemillaPractica: number }).__epaSemillaPractica = 4242;
      if (sessionStorage.getItem('sembrado')) return;
      sessionStorage.setItem('sembrado', '1');
      localStorage.setItem('epa:dominio', JSON.stringify(d));
    }, dominio);
    await page.route('**/assets/consumidores-*.js', async (r) => {
      await new Promise((ok) => setTimeout(ok, 20_000));
      await r.continue().catch(() => {});
    });
    const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    await page.goto('/#/practicar');
    await page.locator('[data-empezar-sesion]').click({ timeout: 60_000 });
    let concepto = '';
    for (let i = 0; i < 15 && !(await page.locator('[data-fin-sesion]').isVisible()); i++) {
      const cuerpo = page.locator('.cuerpo[data-item]');
      const id = (await cuerpo.getAttribute('data-item'))!;
      if (!concepto && (await cuerpo.getAttribute('data-item-tipo')) === 'pregunta') {
        // one right answer, from the book's quiz data
        const qs = (await page.evaluate(async (p) => (await (await fetch(`libro/repaso/${p}.json`)).json()).preguntas, id.split('-')[0])) as {
          id: string;
          tipo: string;
          opciones?: string[];
          correcta?: number;
          valor?: number;
        }[];
        const q = qs.find((x) => x.id === id)!;
        const caja = page.locator('[data-pregunta]').first();
        if (q.tipo === 'opcion') {
          const objetivo = plano(q.opciones![q.correcta!]!);
          const textos = (await caja.locator('button.opcion .txt').allTextContents()).map(plano);
          await caja.locator('button.opcion').nth(textos.findIndex((t) => t === objetivo)).click();
        } else {
          await caja.locator('[data-numero]').fill(String(q.valor).replace('.', ','));
          await caja.locator('[data-comprobar]').click();
        }
        await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', 'bien');
        concepto = (await cuerpo.getAttribute('data-concepto'))!;
        await page.locator('[data-continuar]').click();
      } else await page.locator('[data-saltar]').click();
      await expect.poll(async () => ((await page.locator('[data-fin-sesion]').isVisible()) ? 'fin' : await cuerpo.getAttribute('data-item'))).not.toBe(id);
    }
    expect(concepto).not.toBe('');
    await expect(page.locator('[data-fin-sesion]')).toBeVisible();
    // the answered concept is listed as improved once the answers are in (the summary waited for them)
    const mejora = page.locator(`[data-mejora="${concepto}"]`);
    await expect(mejora).toBeVisible({ timeout: 60_000 });
    expect(Number(await mejora.getAttribute('data-delta'))).toBeGreaterThan(0);
  });
});

// Phase 2 (stress of the smart practice): two quick taps on «Empezar», «Saltar» or «Continuar» count as one, as the
// lesson's «Continuar» (which skipped a screen); here a guard of the same kind, kept by this test (it did not fail
// before the guard in this profile: Chrome did not deliver the second tap as a click).
test.describe('tableta: práctica inteligente, toques dobles', () => {
  test.use(TABLETA);
  test('práctica inteligente: dos toques en «Empezar» o «Saltar» cuentan como uno', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => ((window as unknown as { __epaSemillaPractica: number }).__epaSemillaPractica = 7));
    await page.goto('/#/practicar');
    const doble = async (sel: string) => {
      await page.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const box = (await page.locator(sel).first().boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(600);
    };
    await page.locator('[data-empezar-sesion]').waitFor({ timeout: 60_000 });
    await doble('[data-empezar-sesion]');
    const titulo = page.locator('.cuerpo[data-item] h1');
    await expect(titulo).toHaveText(/^Ejercicio 1 de/);
    await expect(page.locator('.cuerpo [data-feedback], .cuerpo [data-final]')).toHaveCount(0);
    await expect(page.locator('[data-continuar]')).toBeDisabled();
    await doble('[data-saltar]');
    await expect(titulo).toHaveText(/^Ejercicio 2 de/);
  });
});

// Phase 2 (owner's decision on the small touch targets): on a touch screen the calculator's formula is one button that
// opens a picker with a large button per quantity; the glossary's letters are 44 px (two rows) and the colour-code
// swatches 44 px each. Mouse layouts are unchanged.
test.describe('tableta: objetivos táctiles grandes', () => {
  test.use(TABLETA);
  test('calculadora: la fórmula abre un elector de magnitudes de 44 px', async ({ page }) => {
    await page.goto('/#/calculadoras/deslizamiento');
    const formula = page.locator('[data-formula-tactil]');
    await expect(formula).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.formula-viva button.m-pulsable')).toHaveCount(0);
    await formula.click();
    const elector = page.locator('[data-elegir-magnitud]');
    await expect(elector).toBeVisible();
    await expect(formula).toHaveAttribute('aria-expanded', 'true');
    const opciones = elector.getByRole('radio');
    const n = await opciones.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) {
      const b = (await opciones.nth(i).boundingBox())!;
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    }
    // the focus is on the quantity being computed; another one is chosen as tapping its symbol would
    await expect(opciones.and(page.locator('[aria-checked="true"]'))).toBeFocused();
    const otra = opciones.and(page.locator('[aria-checked="false"]')).first();
    const id = await otra.getAttribute('data-var-tactil');
    await otra.click();
    await expect(elector).toHaveCount(0);
    await expect(page.locator(`.objetivo [role="radio"][aria-checked="true"]`)).toHaveCount(1);
    await formula.click();
    await expect(elector.locator(`[data-var-tactil="${id}"]`)).toHaveAttribute('aria-checked', 'true');
    // Escape closes it and gives the focus back; so does a tap outside
    await page.keyboard.press('Escape');
    await expect(elector).toHaveCount(0);
    await expect(formula).toBeFocused();
    await formula.click();
    await page.mouse.click(5, 600);
    await expect(elector).toHaveCount(0);
  });

  test('glosario y código de colores: letras y muestras de 44 px sin desbordar', async ({ page }) => {
    await page.goto('/#/glosario');
    const letras = page.locator('nav.letras button');
    await expect(letras.first()).toBeVisible({ timeout: 30_000 });
    const cajas = await letras.evaluateAll((l) => l.map((b) => b.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height, x: r.x, y: r.y })));
    expect(cajas.length).toBe(28);
    for (const c of cajas) expect(Math.min(c.w, c.h)).toBeGreaterThanOrEqual(44);
    expect(new Set(cajas.map((c) => Math.round(c.y))).size).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto('/#/componentes/codigo-colores');
    const muestras = page.locator('.muestras button.muestra');
    await expect(muestras.first()).toBeVisible({ timeout: 30_000 });
    const m = await muestras.evaluateAll((l) => l.map((b) => b.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height, x: r.x, y: r.y })));
    for (const c of m) expect(Math.min(c.w, c.h)).toBeGreaterThanOrEqual(44);
    // side by side, never overlapping
    for (let i = 1; i < m.length; i++) if (Math.abs(m[i]!.y - m[i - 1]!.y) < 1) expect(m[i]!.x).toBeGreaterThanOrEqual(m[i - 1]!.x + m[i - 1]!.w - 0.5);
  });

  test('«Ver en protoboard»: 44 px de zona táctil y la cifra con contraste', async ({ page }) => {
    await page.goto('/#/cap51/fig-51.9');
    const b = page.locator('[id="fig-51.9"] button.boton-pb').first();
    await expect(b).toBeVisible({ timeout: 60_000 });
    await b.scrollIntoViewIfNeeded();
    const caja = (await b.boundingBox())!;
    const cx = caja.x + caja.width / 2;
    const cy = caja.y + caja.height / 2;
    // the touch area reaches 22 px above and below the centre
    for (const dy of [-21, 21]) expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('.boton-pb'), [cx, cy + dy])).toBe(true);
    // the count: 4.5:1 at least on its tint
    const contraste = await b.locator('.n').evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (c: number[]) => {
        const [r, g, bb] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * bb!;
      };
      const cs = getComputedStyle(el);
      // the background is a color-mix(): resolved by painting it on a canvas
      const cv = document.createElement('canvas').getContext('2d')!;
      cv.fillStyle = cs.backgroundColor;
      cv.fillRect(0, 0, 1, 1);
      const fondo = [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3);
      const a = lum(rgb(cs.color));
      const f = lum(fondo);
      return (Math.max(a, f) + 0.05) / (Math.min(a, f) + 0.05);
    });
    expect(contraste).toBeGreaterThanOrEqual(4.5);
  });
});

// Phase 2 (axe and keyboard): the search results scroll inside the dialog while their links stay out of the tab order:
// the box takes the focus while it overflows; the settings popover closes when the focus leaves it with Tab.
test('teclado: resultados de búsqueda desplazables y el panel de ajustes al salir con el tabulador', async ({ page }) => {
  await page.goto('/#/cap05');
  await page.locator('#contenido').waitFor();
  await page.keyboard.press('Control+k');
  await page.keyboard.type('diodo');
  const cuerpo = page.locator('.panel .cuerpo[data-miniaturas-raiz]');
  await expect(cuerpo.locator('[role="option"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(cuerpo).toHaveAttribute('tabindex', '0');
  await expect(cuerpo).toHaveAttribute('aria-label', 'Resultados de la búsqueda');
  await page.keyboard.press('Escape');

  const ajustes = page.getByRole('button', { name: 'Tema y tamaño de letra' });
  await ajustes.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Tema y tamaño de letra' });
  await expect(panel).toBeVisible();
  let cerrado = false;
  for (let i = 0; i < 30 && !cerrado; i++) {
    await page.keyboard.press('Tab');
    cerrado = !(await panel.count());
    // while open, the focus is in the panel or on its button
    if (!cerrado) expect(await page.evaluate(() => !!document.activeElement?.closest('.ajustes') || document.activeElement?.getAttribute('aria-label') === 'Tema y tamaño de letra')).toBe(true);
  }
  expect(cerrado).toBe(true);
});

// Phase 2 · leaks: each visit to a board in 3D kept the whole board alive (≈ 0.7 MB of heap and several MB of
// geometry buffers): three.js keeps the WebGL contexts it used reachable, and through the canvas a listener of the
// scene and the view's own handlers held everything. 0.6 MB or less per visit after the first ones now.
test.describe('escritorio: fugas', () => {
  // (on a touch screen the board waits for a tap before loading its 3D; the desktop opens it at once)
  test('placa 3D: abrirla y dejarla varias veces no acumula memoria', async ({ page }) => {
    test.setTimeout(600_000);
    const cdp = await page.context().newCDPSession(page);
    const heap = async () => {
      await page.evaluate(() => (location.hash = '#/'));
      await page.waitForTimeout(1500);
      for (let k = 0; k < 3; k++) {
        await cdp.send('HeapProfiler.collectGarbage');
        await page.waitForTimeout(200);
      }
      const c = (await cdp.send('Memory.getDOMCounters')) as { nodes: number; jsEventListeners: number };
      return { mb: ((await cdp.send('Runtime.getHeapUsage')) as { usedSize: number }).usedSize / 1e6, ...c };
    };
    await page.goto('/#/');
    await page.locator('#contenido').waitFor();
    const v: { mb: number; nodes: number; jsEventListeners: number }[] = [];
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => (location.hash = '#/consolas/nes/placa3d'));
      await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 120_000 });
      await page.waitForTimeout(1500);
      v.push(await heap());
    }
    const t = v.map((x) => `${x.mb.toFixed(1)} MB/${x.nodes} nodos/${x.jsEventListeners} oyentes`).join(' → ');
    console.log(`placa 3D tras cada visita: ${t}`);
    // the first visits load code and shared data; from the second to the sixth only the leak would grow
    expect(v[5]!.jsEventListeners - v[1]!.jsEventListeners, t).toBeLessThanOrEqual(0);
    expect(v[5]!.nodes - v[1]!.nodes, t).toBeLessThan(200);
  });
});

// Phase 2 · layout stress (360 px phone, CPU × 4): the free circuit, empty, showed the circuit's reserved place and
// took it away when the drawing module answered that there was nothing to draw (the page jumped 300 px up).
test.describe('teléfono pequeño: simulador', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  test('circuito libre vacío: la página no salta al cargar', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('epa:circuito');
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/#/simulador/nuevo');
    await page.locator('.pagina .rejilla').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(6000);
    expect(await page.locator('.circuito-vivo[data-reserva]').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });

  // the circuit's reserved place was 300 px for 450 on a phone, and its controls' panel came empty and filled when the
  // drawn circuit's readings arrived (CLS 0.10–0.14): taller reserve, and the panel keeps it until its first result
  test('netlist del libro: el circuito dibujado no empuja la página', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/#/simulador/cap03/sec-3.10_supercondensador');
    await page.locator('.circuito-vivo:not([data-reserva]) .panel-e').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(5000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

// Phase 2 · layout stress (sepia theme): status and accent inks fell to 3.6–4.4:1 on sepia's warmer surfaces.
test('sepia: las tintas de estado y el acento llegan a 4,5:1 sobre sus fondos', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'sepia', tam: 18 })));
  await page.goto('/#/');
  await page.locator('#contenido').waitFor();
  const peor = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const hex = (v: string) => {
      const h = cs.getPropertyValue(v).trim().replace('#', '');
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    };
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((x) => {
        const s = x / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const cr = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const r: [string, number][] = [];
    // the darkest sepia surfaces they were measured on (#e7e2d4, #efe0c5) are about as dark as --superficie-2
    for (const t of ['--acento', '--c-nota', '--c-ejemplo', '--c-tarjeta-texto'])
      for (const f of ['--superficie', '--superficie-2', '--tarjeta-fondo', '--fondo']) r.push([`${t} / ${f}`, cr(hex(t), hex(f))]);
    return r.sort((a, b) => a[1] - b[1])[0]!;
  });
  expect(peor[1], peor[0]).toBeGreaterThanOrEqual(4.5);
});

// Phase 2 · layout stress (tablet turned, 1280 px): the editor's title shared its row with the buttons, and a long
// book title arriving with the circuit pushed them (and the editor) down. The title has its own row up to 1439 px.
test.describe('tableta apaisada: editor', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: true, hasTouch: true });
  test('editor: el título va en su propia fila', async ({ page }) => {
    // a short title (a new circuit): it used to share the row with the buttons, so a long one moved them
    await page.addInitScript(() => localStorage.removeItem('epa:editor-borrador'));
    await page.goto('/#/editor');
    const cab = page.locator('.editor-pagina header.cab');
    await expect(cab.locator('h1')).not.toHaveText(/^\s*$/, { timeout: 60_000 });
    const [t, b] = await Promise.all([cab.locator('.titulo').boundingBox(), cab.locator('.botones').boundingBox()]);
    expect(b!.y).toBeGreaterThanOrEqual(t!.y + t!.height - 1);
  });
});

// Phase 2 · layout stress (larger text): a console's «Fuentes» tab drew the boards' and the frame's sources when
// they arrived (a lazy chunk and two data files) and pushed the sections under them a screen down (CLS 0.15).
test.describe('tableta: consolas', () => {
  test.use(TABLETA);
  test('consola: la pestaña «Fuentes» no salta al llegar sus partes', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'auto', tam: 26 }));
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    await page.goto('/#/consolas/nes/fuentes');
    await page.locator('.fuentes').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(5000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

// Final pass (0.11 integrated): with the browser's storage blocked the libraries live in memory, and after «Guardar»
// the editor and the breadboard said «Guardado en este dispositivo» — lost when the page closes. They say so now.
test.describe('tableta: almacenamiento bloqueado', () => {
  test.use(TABLETA);
  for (const [que, ruta, boton] of [
    ['editor', '/#/editor/libro/cap42/fig-42.5_filtro_rc', '.editor-pagina header.cab .botones button.primario:has-text("Guardar")'],
    ['protoboard', '/#/protoboard', 'button.primario:has-text("Guardar")'],
  ] as const) {
    test(`${que}: sin almacenamiento no dice «Guardado en este dispositivo»`, async ({ page }) => {
      await page.addInitScript(() =>
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('Almacenamiento bloqueado', 'SecurityError');
          },
        }),
      );
      await page.goto(ruta);
      const aviso = page.locator('[data-aviso-guardado="memoria"]');
      await expect(aviso).toBeVisible({ timeout: 60_000 });
      await expect(aviso).toContainText('solo mientras no cierre la página');
      await page.locator(boton).first().click();
      await page.waitForTimeout(1500);
      await expect(page.locator('#contenido')).not.toContainText('Guardado en este dispositivo');
      await expect(page.locator('#contenido')).toContainText('Sin guardar en este dispositivo');
    });
  }
});

// Final pass (0.11 integrated, tablet): the breadboard opened over a book netlist did not simulate (84 of 314 in the
// sweep). The simulator page under it runs its netlist again when another run replaces its own (the 0.11 fix of the
// slider race with the drawn circuit's background run); it did so also when the breadboard's run replaced it, and
// that cancelled the breadboard's. Now only a background run (the drawn circuit) makes the page run again.
test.describe('tableta: protoboard sobre el simulador', () => {
  test.use(TABLETA);
  test('«Simular» de la protoboard abierta sobre una netlist del libro da su resultado', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/#/simulador/cap08/fig-8.7');
    await page.locator('.meta button:has-text("Ver en protoboard")').first().click({ timeout: 60_000 });
    await page.waitForFunction(() => !!(window as unknown as { __epaProtoboard?: { pb: { doc: { piezas: unknown[] } } } }).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    const simular = page.locator('.capa-protoboard button.simular').first();
    await expect(simular).toBeEnabled({ timeout: 120_000 });
    await page.evaluate(() => delete (window as unknown as { __epaProtoboardSim?: unknown }).__epaProtoboardSim);
    await simular.click();
    await page.waitForFunction(() => !!(window as unknown as { __epaProtoboardSim?: unknown }).__epaProtoboardSim, null, { timeout: 90_000, polling: 250 });
  });
});

// Final pass (0.11 integrated, tablet): leaving a lesson while it was still loading — a link to another lesson —
// let the left lesson finish its load anyway: it wrote its own address over the new page's (and, when that came
// before the router read it, the reader's navigation was undone) and Svelte warned «derived_inert».
test.describe('tableta: salir de una lección que carga', () => {
  test.use(TABLETA);
  test('la lección que se deja a medio cargar no pisa la dirección de la nueva', async ({ page }) => {
    const avisos: string[] = [];
    page.on('console', (m) => {
      if (/derived_inert/.test(m.text())) avisos.push(m.text());
    });
    // the chapter of the lesson left comes late
    let soltar: () => void = () => {};
    const llega = new Promise<void>((r) => (soltar = r));
    await page.route('**/partes/cap02.json', async (r) => {
      await llega;
      await r.continue();
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __direcciones: string[] };
      w.__direcciones = [];
      const rs = history.replaceState.bind(history);
      history.replaceState = (st, t, u) => {
        w.__direcciones.push(String(u));
        rs(st, t, u);
      };
    });
    await page.goto('/#/leccion/cap02/sec-2.1/2');
    await expect(page.locator('.leccion .cargando')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => (location.hash = '#/leccion/cap01/sec-1.2/2'));
    await expect(page.locator('[data-leccion="cap01/sec-1.2"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-leccion="cap01/sec-1.2"] .cargando')).toHaveCount(0, { timeout: 30_000 });
    soltar();
    await page.waitForResponse('**/partes/cap02.json').catch(() => {});
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => location.hash)).toBe('#/leccion/cap01/sec-1.2/2');
    expect(await page.evaluate(() => (window as unknown as { __direcciones: string[] }).__direcciones.filter((u) => u.includes('cap02')))).toEqual([]);
    await expect(page.locator('[data-leccion="cap01/sec-1.2"]')).toBeVisible();
    expect(avisos).toEqual([]);
  });
});

// Final pass (0.11 integrated, tablet): a practice slider left while its reading was still being simulated (the next
// screen, a reload) took the reading anyway and read its destroyed item (Svelte's «derived_inert»; reloading the
// lessons of chapter 1).
test.describe('tableta: práctica que se deja a medio simular', () => {
  test.use(TABLETA);
  test('el deslizador que se deja mientras simula no lee su ítem destruido', async ({ page }) => {
    test.setTimeout(120_000);
    const avisos: string[] = [];
    page.on('console', (m) => {
      if (/derived_inert/.test(m.text())) avisos.push(m.text());
    });
    let soltar: () => void = () => {};
    const llega = new Promise<void>((r) => (soltar = r));
    await page.route('**/ngspice/**', async (r) => {
      await llega;
      await r.continue();
    });
    await page.goto('/#/leccion/cap23/sec-23.6/practica-3');
    await expect(page.locator('[data-practica]').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => (location.hash = '#/cap23'));
    await expect(page.locator('[data-practica]')).toHaveCount(0, { timeout: 30_000 });
    soltar();
    // the engine loads and the reading comes
    await page.waitForTimeout(8000);
    expect(avisos).toEqual([]);
  });
});

// Final pass (0.11 integrated): the same with the schematic editor — a book netlist still loading when the reader
// left the editor put «#/editor» over the new page's address (a reload then opened the editor).
test('el editor que se deja mientras carga una netlist no pisa la dirección de la nueva página', async ({ page }) => {
  let soltar: () => void = () => {};
  const llega = new Promise<void>((r) => (soltar = r));
  let pedida = false;
  await page.route('**/spice/cap42/fig-42.5_filtro_rc.cir', async (r) => {
    pedida = true;
    await llega;
    await r.continue();
  });
  await page.goto('/#/glosario');
  await expect(page.locator('#contenido h1')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => (location.hash = '#/editor/libro/cap42/fig-42.5_filtro_rc'));
  await expect.poll(() => pedida, { timeout: 30_000 }).toBe(true);
  await page.evaluate(() => (location.hash = '#/glosario'));
  await expect(page.locator('#contenido h1')).toContainText('Glosario', { timeout: 30_000 });
  soltar();
  await page.waitForResponse('**/spice/cap42/fig-42.5_filtro_rc.cir').catch(() => {});
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => location.hash)).toBe('#/glosario');
  await page.reload();
  await expect(page.locator('#contenido h1')).toContainText('Glosario', { timeout: 30_000 });
});

// Final pass (0.11 integrated): «Filtro en T» typed whole was one more «filtro» in the search (single letters and
// stop words are not indexed) and fell below the tenth result. A title typed whole goes first.
test('buscar un título entero lo da el primero', async ({ page }) => {
  await page.goto('/#/');
  await page.keyboard.press('Control+k');
  const caja = page.getByRole('dialog', { name: 'Buscar en el libro' }).locator('input');
  for (const [q, href] of [
    ['Filtro en T', '#/glosario/glos-filtro-en-t'],
    ['filtro en t', '#/glosario/glos-filtro-en-t'],
    ['CIC (filtro)', '#/glosario/glos-cic-filtro'],
    ['Tabla de Bandas de Color', '#/apA/sec-A.1'],
  ] as const) {
    await caja.fill(q);
    await expect.poll(async () => decodeURIComponent((await page.locator('#resultados a').first().getAttribute('href')) ?? ''), { message: q, timeout: 30_000 }).toBe(href);
  }
});

// Final pass (0.11 integrated, tablet): offline, a chapter's smart practice was prepared with the few exercises that
// did not need the chapter's banks (4 of 10) and said nothing. It says so now and «Reintentar» prepares it again.
test.describe('tableta: práctica de un capítulo sin red', () => {
  test.use(TABLETA);
  test('sin red avisa de que faltan ejercicios y «Reintentar» los trae', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/#/');
    await expect(page.locator('#contenido h1, #contenido h2').first()).toBeVisible({ timeout: 30_000 });
    const cortar = /\/libro\/(practica|repaso)\/cap23\.json$/;
    await page.route((u) => cortar.test(u.pathname), (r) => r.abort('internetdisconnected'));
    await page.evaluate(() => (location.hash = '#/practicar/cap23'));
    const aviso = page.locator('[data-sesion-incompleta], .practicar .aviso-red');
    await expect(aviso.first()).toBeVisible({ timeout: 60_000 });
    await expect(aviso.first()).toContainText('Sin conexión');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.locator('.practicar button:has-text("Reintentar")').first().click();
    await expect(page.locator('[data-intro-sesion]')).toBeVisible({ timeout: 60_000 });
    await expect(aviso).toHaveCount(0);
    await expect(page.locator('[data-intro-sesion]')).toContainText('10 ejercicios');
  });
});

// Final pass (0.11 integrated, tablet): small touch targets the full sweep found — the compact «Abrir el kit FM7303
// vivo» chip in a heading (its 28 px rule beat the touch rule), and the breadboard's notices and «Netlist del
// montaje» (20 px).
test.describe('tableta: objetivos táctiles de la pasada final', () => {
  test.use(TABLETA);
  test('«Abrir el kit FM7303 vivo» compacto: 44 px de zona táctil', async ({ page }) => {
    await page.goto('/#/cap16/fig-16.10');
    const b = page.locator('.h3-simular a.ver-kit.compacto').first();
    await expect(b).toBeVisible({ timeout: 60_000 });
    await b.scrollIntoViewIfNeeded();
    const caja = (await b.boundingBox())!;
    const cx = caja.x + caja.width / 2;
    const cy = caja.y + caja.height / 2;
    for (const dy of [-21, 21]) expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('.ver-kit'), [cx, cy + dy])).toBe(true);
  });
  for (const [ruta, sel] of [
    ['/#/consolas/gb/fuentes', '.fuentes .lista li > p > a'],
    ['/#/consolas/snes/fuentes', 'details.texto-licencia > summary'],
    ['/#/proyectos/estacion_iot/esquema', 'details.notas > summary'],
  ] as const) {
    test(`${ruta}: «${sel}» mide 44 px`, async ({ page }) => {
      await page.goto(ruta);
      const e = page.locator(sel).first();
      await expect(e).toBeVisible({ timeout: 60_000 });
      expect((await e.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });
  }
  test('protoboard: los avisos y «Netlist del montaje» miden 44 px', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/#/simulador/cap42/fig-42.6_error2_nombre_duplicado');
    await page.locator('.meta button:has-text("Ver en protoboard")').first().click({ timeout: 60_000 });
    await page.locator('.capa-protoboard [role="tab"]:has-text("Avisos")').first().click({ timeout: 60_000 });
    const aviso = page.locator('.capa-protoboard ul.avisos li.error button.enlace').first();
    await expect(aviso).toBeVisible({ timeout: 30_000 });
    expect((await aviso.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await page.locator('.capa-protoboard details.netlist > summary').first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

// Final pass (0.11 integrated, tablet): a saved note under a section showed «Editar la nota» and «Borrar la nota» at
// 32 × 32 px, and «Marcadores y notas» its «Editar en la sección» and «Borrar» at 32 px high (the crawler starts with
// no notes, so only the two-tab check of the final pass saw them): 44 px on touch.
test.describe('tableta: nota guardada', () => {
  test.use(TABLETA);
  test('los botones de una nota guardada miden 44 px (sección y «Marcadores y notas»)', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('epa:notas')) return;
      const t = Date.now();
      localStorage.setItem('epa:notas', JSON.stringify({ 'sec-5.1': { parte: 'cap05', label: 'sec-5.1', num: '5.1', titulo: 'Sección', texto: 'Una nota de prueba', t } }));
    });
    await page.goto('/#/cap05');
    const nota = page.locator('.nota-personal').first();
    await expect(nota).toContainText('Una nota de prueba', { timeout: 60_000 });
    for (const n of ['Editar la nota', 'Borrar la nota']) {
      const caja = (await nota.getByRole('button', { name: n, exact: true }).boundingBox())!;
      expect(Math.min(caja.width, caja.height), n).toBeGreaterThanOrEqual(44);
    }
    // and in «Marcadores y notas»
    await page.goto('/#/marcadores');
    const acc = page.locator('.nota .acc').first();
    await expect(acc).toBeVisible({ timeout: 30_000 });
    for (const b of await acc.locator('.boton').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

// Final pass (0.11 integrated, phone): a live figure opened by its link drew its panels when its data came, after the
// first paint, and pushed its caption and the text 350 px down (CLS 0.08–0.22). The reader asks for that figure's
// data with the part (≤ 1.5 s) and the figure takes them before painting.
test.describe('teléfono: figura viva enlazada', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  test('figura viva abierta por su enlace: sus paneles no empujan el pie', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    await page.goto('/#/cap06/fig-6.13');
    await expect(page.locator('[data-figura-viva="6.13"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.panel-e').first()).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

// Final pass (tablet): on a book netlist's page the results come before the netlist (tablets and phones), and the
// first run's results pushed the netlist at the bottom of the screen out of it (CLS 0.10–0.15 on some 120 netlists).
// Their place is kept during the first run.
test.describe('tableta: resultados de una netlist del libro', () => {
  test.use(TABLETA);
  for (const id of ['cap41/prob-41.B_red_desacoplo', 'cap25/fig-25.9']) {
    test(`${id}: los primeros resultados no empujan la netlist`, async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`/#/simulador/${id}`);
      await expect(page.locator('.pagina .resultado')).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(2500);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
    });
  }
});

// Final pass (360 px phone): a frame with a dozen steps (the Master System's) left each step 22 px to the finger
// (WCAG 2.5.8 asks 24): on a small phone the count goes above and the steps take the whole row.
test.describe('móvil de 360 px: pasos del fotograma', () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  test('cada paso tiene al menos 24 px de ancho para el dedo', async ({ page }) => {
    await page.goto('/#/consolas/sms/fotograma');
    const segs = page.locator('.progreso .segmentos button.seg');
    await expect(segs.first()).toBeVisible({ timeout: 60_000 });
    const xs = await segs.evaluateAll((l) => l.map((b) => b.getBoundingClientRect().left));
    expect(xs.length).toBeGreaterThan(8);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(24);
  });
});

// Final pass (phone, layout stress): moving within a part to a live figure further on (a reference, a link) scrolled
// to it and only then loaded its data: its panels came in under the reader's eyes and pushed the caption 280 px. The
// reader now asks for the destination figure's data before scrolling, and a figure already on the page takes them.
test.describe('teléfono: figura viva más adelante en la parte', () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  test('ir a una figura viva de la misma parte: sus paneles ya están al llegar', async ({ page }) => {
    await page.goto('/#/cap03/fig-3.11');
    await expect(page.locator('[data-figura-viva="3.11"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);
    const marcos = await page.evaluate(async () => {
      const out: { y: number; pie: number; paneles: number }[] = [];
      const y0 = scrollY;
      location.hash = '#/cap03/fig-3.12';
      for (let i = 0; i < 90; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        const f = document.getElementById('fig-3.12');
        const pie = f?.querySelector('figcaption');
        if (scrollY !== y0 && pie) out.push({ y: scrollY, pie: Math.round(pie.getBoundingClientRect().top), paneles: f!.querySelectorAll('.panel-e').length });
      }
      return out;
    });
    expect(marcos.length).toBeGreaterThan(5);
    // from the first frame at the figure: its panels are there and the caption does not move any more
    expect(marcos[0]!.paneles).toBeGreaterThan(0);
    const ultimo = marcos[marcos.length - 1]!;
    for (const m of marcos) if (m.y === ultimo.y) expect(Math.abs(m.pie - ultimo.pie)).toBeLessThanOrEqual(1);
  });
});

// Final pass (desktop): a page's first top margin collapsed through <main>, so when the page replaced the loading
// notice <main> itself — the whole page — moved 28 px down (CLS 0.2 in the glossary and the simulator). <main> is
// its own block formatting context now.
test('escritorio: al cargar una página no se mueve <main> entero', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __mainMovido: number };
    w.__mainMovido = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { sources?: { node?: Node }[] })[])
        for (const s of e.sources ?? []) if (s.node instanceof HTMLElement && s.node.tagName === 'MAIN') w.__mainMovido++;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
  for (const ruta of ['/#/glosario', '/#/simulador/cap26/ej-26.1_rd_diodo']) {
    await page.goto(ruta);
    await page.locator('main h1').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => (window as unknown as { __mainMovido: number }).__mainMovido), ruta).toBe(0);
  }
});
