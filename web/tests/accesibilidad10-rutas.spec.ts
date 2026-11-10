// 1.0 accessibility pass: one route of every kind of the app (lib/ruta.svelte.ts's table, the overlays and the 1.0
// practice types) audited with axe-core — WCAG 2.0/2.1/2.2 A and AA plus best practices, contrast included — in the
// light, sepia and dark themes, on the desktop and on a 360 px phone; plus the app-wide structure (one main landmark,
// the «Saltar al contenido» link, page title, lang="es", a level-1 heading) and, on the phone, no horizontal scroll.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb nice npx playwright test -c playwright.accesibilidad10.config.ts tests/accesibilidad10-rutas.spec.ts --workers=1
// ACC_INFORME=<file.json>: audit mode (writes every finding, never fails). ACC_FILTRO, ACC_TEMAS: see the config.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { TEMAS, limpio, asentar, axe, estructura, sinHallazgos, type Hallazgo, type Tema } from './accesibilidad10-comun';

type Accion = 'buscar' | 'ajustes' | 'menu' | 'visor' | 'lateral';

interface RutaA11y {
  id: string;
  hash: string;
  accion?: Accion;
  /** Heavy page (3D, simulation; the reader, which draws the chunks around the anchor first): waits longer. */
  pesada?: boolean;
}

const RUTAS: RutaA11y[] = [
  // start, reader, glossary, bookmarks and the overlays
  { id: 'inicio', hash: '#/' },
  { id: 'buscar', hash: '#/', accion: 'buscar' },
  { id: 'ajustes', hash: '#/', accion: 'ajustes' },
  { id: 'menu', hash: '#/', accion: 'menu' },
  { id: 'indice', hash: '#/cap05', accion: 'lateral' },
  { id: 'parte', hash: '#/cap05', pesada: true },
  { id: 'seccion', hash: '#/cap01/sec-1.4', pesada: true },
  { id: 'teoria-viva', hash: '#/cap06/sec-6.5', pesada: true },
  { id: 'ejercicio-libro', hash: '#/cap02/ej-2.6', pesada: true },
  { id: 'visor', hash: '#/cap05/fig-5.1', accion: 'visor' },
  { id: 'glosario', hash: '#/glosario' },
  { id: 'marcadores', hash: '#/marcadores' },
  // lessons and the practice types (1.0: predict, slider, breadboard, fault-finding, build, live-figure challenge)
  { id: 'leccion', hash: '#/leccion/cap05/sec-5.1' },
  { id: 'leccion-explora', hash: '#/leccion/cap01/sec-1.4/clasica/5' }, // 1.1: the 1.0 lesson of 1.4
  { id: 'practica-num', hash: '#/leccion/cap01/sec-1.4/practica-1' },
  { id: 'practica-predice', hash: '#/leccion/cap01/sec-1.4/practica-2' },
  { id: 'practica-desliza', hash: '#/leccion/cap01/sec-1.4/practica-3' },
  { id: 'practica-proto', hash: '#/leccion/cap01/sec-1.4/practica-4', pesada: true },
  { id: 'practica-averia', hash: '#/leccion/cap01/sec-1.4/practica-5', pesada: true },
  { id: 'practica-construye', hash: '#/leccion/cap01/sec-1.4/practica-6', pesada: true },
  { id: 'practica-reto', hash: '#/leccion/cap01/sec-1.4/practica-7', pesada: true },
  { id: 'practica-toque', hash: '#/leccion/cap45/sec-45.2/practica-4' },
  { id: 'practica-parejas', hash: '#/leccion/cap05/sec-5.1/practica-1' },
  // courses, progress, mastery, smart practice, problem of the day
  { id: 'cursos', hash: '#/cursos' },
  { id: 'curso', hash: '#/cursos/fundamentos' },
  { id: 'curso-prueba', hash: '#/cursos/fundamentos/prueba' },
  { id: 'progreso', hash: '#/progreso' },
  { id: 'dominio', hash: '#/progreso/dominio' },
  { id: 'practicar', hash: '#/practicar' },
  { id: 'practicar-parte', hash: '#/practicar/cap05' },
  { id: 'problema', hash: '#/problema' },
  { id: 'problema-ayer', hash: '#/problema/ayer' },
  // exercises and review
  { id: 'ejercicios', hash: '#/ejercicios' },
  { id: 'ejercicios-repaso', hash: '#/ejercicios/repaso' },
  { id: 'repaso', hash: '#/repaso' },
  { id: 'repaso-tarjetas', hash: '#/repaso/tarjetas' },
  { id: 'repaso-examen', hash: '#/repaso/examen' },
  { id: 'repaso-repasar', hash: '#/repaso/repasar' },
  { id: 'repaso-test', hash: '#/repaso/test/cap05' },
  { id: 'repaso-practica', hash: '#/repaso/practica/cap05' },
  { id: 'calculadoras', hash: '#/calculadoras' },
  { id: 'calculadora', hash: '#/calculadoras/senoide' },
  // simulator, editor, breadboard, instruments, the FM kit
  { id: 'simulador', hash: '#/simulador' },
  { id: 'simulador-nuevo', hash: '#/simulador/nuevo' },
  { id: 'simulador-netlist', hash: '#/simulador/cap05/sec-5.3_led_150ohm', pesada: true },
  { id: 'editor', hash: '#/editor' },
  { id: 'editor-libro', hash: '#/editor/libro/cap05/sec-5.3_led_150ohm' },
  { id: 'editor-importar', hash: '#/editor/importar' },
  { id: 'protoboard', hash: '#/protoboard', pesada: true },
  { id: 'instrumentos', hash: '#/instrumentos' },
  { id: 'instrumentos-practica', hash: '#/instrumentos/practica/1', pesada: true },
  { id: 'instrumentos-libre', hash: '#/instrumentos/libre', pesada: true },
  { id: 'fm7303', hash: '#/fm7303/esquema' },
  { id: 'fm7303-senal', hash: '#/fm7303/senal' },
  // animations, concepts, 3D, consoles, KiCad projects
  { id: 'componentes', hash: '#/componentes' },
  { id: 'animacion', hash: '#/componentes/resistencias' },
  { id: 'modelos3d', hash: '#/componentes/3d' },
  { id: 'modelo3d', hash: '#/componentes/3d/resistencia-axial', pesada: true },
  { id: 'conceptos', hash: '#/conceptos' },
  { id: 'concepto', hash: '#/conceptos/senales' },
  { id: 'consolas', hash: '#/consolas' },
  { id: 'consola-foto', hash: '#/consolas/nes/foto' },
  { id: 'consola-arquitectura', hash: '#/consolas/nes/arquitectura' },
  { id: 'consola-esquema', hash: '#/consolas/nes/esquema' },
  { id: 'consola-placa2d', hash: '#/consolas/nes/placa2d', pesada: true },
  { id: 'proyectos', hash: '#/proyectos' },
  { id: 'proyecto-esquema', hash: '#/proyectos/fuente_laboratorio/esquema' },
  { id: 'proyecto-placa', hash: '#/proyectos/fuente_laboratorio/placa', pesada: true },
  { id: 'proyecto-simulacion', hash: '#/proyectos/fuente_laboratorio/simulacion' },
  { id: 'proyecto-comprobaciones', hash: '#/proyectos/fuente_laboratorio/comprobaciones' },
  // teacher mode, guide, data, diagnostic
  { id: 'docente', hash: '#/docente' },
  { id: 'docente-nuevo-examen', hash: '#/docente/nuevo/examen' },
  { id: 'docente-nuevo-curso', hash: '#/docente/nuevo/curso' },
  { id: 'guia', hash: '#/guia' },
  { id: 'guia-seccion', hash: '#/guia/datos' },
  { id: 'sincronizacion', hash: '#/sincronizacion' },
  { id: 'copia', hash: '#/sincronizacion/copia' },
  { id: 'diagnostico', hash: '#/diagnostico' },
  { id: 'diagnostico-informe', hash: '#/diagnostico/informe' },
  // 1.1 (app-wide restyle): the guided lab, the projects by stages (a stage had no h1) and a lesson that does not exist
  { id: 'laboratorio', hash: '#/instrumentos/laboratorio/1', pesada: true },
  { id: 'etapas', hash: '#/etapas' },
  { id: 'etapa', hash: '#/etapas/cap50/1', pesada: true },
  { id: 'leccion-no-encontrada', hash: '#/leccion/cap99/sec-1' },
];

const filtro = process.env.ACC_FILTRO ? new RegExp(process.env.ACC_FILTRO) : null;
const informe = process.env.ACC_INFORME;
const elegidas = RUTAS.filter((r) => !filtro || filtro.test(r.id));

async function hacer(page: Page, r: RutaA11y): Promise<void> {
  if (r.accion === 'buscar') {
    await page.keyboard.press('Control+k');
    const caja = page.getByRole('dialog', { name: 'Buscar en el libro' }).locator('input');
    await caja.fill('diodo zener');
    await page.waitForTimeout(800);
  } else if (r.accion === 'ajustes') {
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Tema y tamaño de letra' })).toBeVisible();
  } else if (r.accion === 'menu') {
    const b = page.getByRole('button', { name: /^(Más|Herramientas)/ }).first();
    await b.click();
    await expect(page.getByRole('menu').first()).toBeVisible();
  } else if (r.accion === 'lateral') {
    const b = page.getByRole('button', { name: /Índice/ }).first();
    if (await b.isVisible().catch(() => false)) await b.click();
    await page.waitForTimeout(400);
  } else if (r.accion === 'visor') {
    const id = r.hash.split('/').pop()!;
    const fig = page.locator(`[id="${id}"]`);
    await fig.scrollIntoViewIfNeeded();
    await fig.getByRole('button', { name: /^(Ampliar|Abrir .* en grande)/ }).first().click();
    await page.waitForTimeout(600);
  }
}

const todos: Record<string, { estructura: string[]; axe: Hallazgo[]; desborde: number }> = {};

for (const tema of TEMAS) {
  test(`axe y estructura · ${tema}`, async ({ page }, info) => {
    test.setTimeout(Math.max(600_000, elegidas.length * 40_000));
    await limpio(page, tema as Tema);
    const fallos: string[] = [];
    for (const r of elegidas) {
      await page.goto(r.hash);
      // a fresh document each time: an overlay or a dialog left open by the previous route must not count here
      await page.reload();
      await asentar(page, r.pesada ? 2500 : 700);
      await hacer(page, r);
      const nombre = `${info.project.name} · ${tema} · ${r.id}`;
      const h = await axe(page);
      const e = await estructura(page);
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (informe) todos[nombre] = { estructura: e, axe: h, desborde };
      else {
        try {
          sinHallazgos(h, nombre);
          expect(e, nombre).toEqual([]);
          if (info.project.name === 'telefono') expect(desborde, `${nombre}: desborde horizontal`).toBeLessThanOrEqual(0);
        } catch (err) {
          fallos.push(String(err).split('\n').slice(0, 12).join('\n'));
        }
      }
    }
    if (informe) {
      const previo = fs.existsSync(informe) ? (JSON.parse(fs.readFileSync(informe, 'utf8')) as typeof todos) : {};
      fs.writeFileSync(informe, JSON.stringify({ ...previo, ...todos }, null, 1));
    }
    expect(fallos).toEqual([]);
  });
}

// WCAG 1.4.4 / 1.4.10 / 1.4.12: the desktop at 200 % zoom is a 683 px wide window; with the app's largest letter size and
// the text spacing of 1.4.12 (line height 1.5, paragraphs 2 em, letters 0.12 em, words 0.16 em) nothing scrolls sideways.
const ESPACIADO = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }`;
const ZOOM = ['inicio', 'seccion', 'leccion', 'practica-num', 'ejercicios', 'repaso-examen', 'calculadora', 'simulador-netlist', 'editor', 'docente-nuevo-examen', 'guia-seccion', 'copia', 'diagnostico', 'curso', 'proyecto-comprobaciones', 'instrumentos-libre'];
test('zoom al 200 % y espaciado de texto: sin desplazamiento lateral', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'the desktop at 200 %');
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 683, height: 450 });
  await limpio(page, 'claro');
  await page.addInitScript(() => {
    const p = JSON.parse(localStorage.getItem('epa:prefs') ?? '{}');
    localStorage.setItem('epa:prefs', JSON.stringify({ ...p, tam: 24 }));
  });
  const fallos: string[] = [];
  for (const r of RUTAS.filter((x) => ZOOM.includes(x.id) && (!filtro || filtro.test(x.id)))) {
    await page.goto(r.hash);
    await page.reload();
    await asentar(page, r.pesada ? 2500 : 700);
    await page.addStyleTag({ content: ESPACIADO });
    await page.waitForTimeout(300);
    const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (d > 0) fallos.push(`${r.id}: ${d} px de desplazamiento lateral`);
  }
  expect(fallos).toEqual([]);
});

// WCAG 2.4.7 / 2.4.11 / 1.4.11: in every theme, the first stops of Tab on a few pages show a focus indicator (outline or
// box-shadow) of at least 3:1 against the page background, and the focused element is not hidden under the fixed bars.
for (const tema of TEMAS) {
  test(`foco visible con el tabulador · ${tema}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'escritorio', 'keyboard focus on the desktop');
    await limpio(page, tema as Tema);
    const fallos: string[] = [];
    for (const hash of ['#/', '#/cap05', '#/ejercicios', '#/docente', '#/sincronizacion/copia']) {
      await page.goto(hash);
      await page.reload();
      await asentar(page);
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        const r = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          if (!a || a === document.body) return null;
          const lum = (c: string) => {
            const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
            const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(m[0]!) + 0.7152 * f(m[1]!) + 0.0722 * f(m[2]!);
          };
          const ratio = (x: string, y: string) => {
            const [p, q] = [lum(x), lum(y)].sort((u, v) => v - u);
            return (p! + 0.05) / (q! + 0.05);
          };
          const fondo = getComputedStyle(document.body).backgroundColor;
          const nombre = `${a.tagName.toLowerCase()} «${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 30)}»`;
          // the indicator may be drawn on a part of the control (the rail's and the tab bar's icon pill)
          const conIndicador = [a, ...a.querySelectorAll<HTMLElement>('*')].map((e) => getComputedStyle(e)).find((c) => (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2) || c.boxShadow !== 'none');
          const cs = conIndicador ?? getComputedStyle(a);
          const conContorno = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
          const conSombra = cs.boxShadow !== 'none';
          if (!conContorno && !conSombra) return { nombre, mal: 'sin indicador de foco' };
          if (conContorno && ratio(cs.outlineColor, fondo) < 3) return { nombre, mal: `contorno ${cs.outlineColor} de ${ratio(cs.outlineColor, fondo).toFixed(2)}:1` };
          const rc = a.getBoundingClientRect();
          const encima = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, rc.left + rc.width / 2)), Math.min(innerHeight - 1, Math.max(0, rc.top + rc.height / 2)));
          if (rc.width && rc.height && encima && !a.contains(encima) && !encima.contains(a) && getComputedStyle(encima).position === 'fixed') return { nombre, mal: 'tapado por una barra fija' };
          return { nombre, mal: '' };
        });
        if (r?.mal) fallos.push(`${hash} · ${r.nombre}: ${r.mal}`);
      }
    }
    expect(fallos).toEqual([]);
  });
}

// The equations in the reader: their text alternative is the equation in words (lib/habla-matematicas.ts), with the
// Typst source kept in data-fuente (inline) or the title (display).
test('las ecuaciones del lector se leen en palabras', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'once');
  await limpio(page);
  await page.goto('#/cap29');
  await asentar(page, 1500);
  const enLinea = page.locator('main img.m[data-fuente]').first();
  await expect(enLinea).toBeAttached();
  const alt = (await enLinea.getAttribute('alt')) ?? '';
  expect(alt).not.toMatch(/dot\.op|_\(|\^\(|"/);
  expect(alt.length).toBeGreaterThan(0);
  const bloque = page.locator('main img.ec-img').first();
  await expect(bloque).toBeAttached();
  expect((await bloque.getAttribute('alt')) ?? '').not.toMatch(/dot\.op|_\(|\^\(|"/);
});
