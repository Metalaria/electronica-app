// 1.0 «Brilliant» in the browser: a challenge with a live figure solved with the keyboard only (feedback on how far,
// hint ladder, development); a building challenge on the breadboard (a wrong circuit explained, a right one
// accepted); the explanation of a wrong option (Repaso question in a lesson, prediction); the course as a path
// (locked nodes, «Saltar hasta aquí» with its short check, «Lista»), the review schedule on the path and on the start
// page; 44 px on a phone and axe (contrast included) in light, sepia and dark.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.brilliant10.config.ts tests/brilliant10-navegador.spec.ts
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { ItemReto, PracticaParte } from '../src/componentes/practica/tipos.ts';
import type { PorqueParte } from '../src/componentes/pregunta/porque.ts';
import { dominioConcepto, type RegistroItem } from '../src/lib/aprendizaje/dominio.ts';
import { repasoDe } from '../src/lib/aprendizaje/camino.ts';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const libro = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;
const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const DIA = 86_400_000;

async function limpio(page: Page, tema: 'claro' | 'sepia' | 'oscuro' = 'claro', datos: Record<string, unknown> = {}): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(
    ({ t, d }) => {
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        localStorage.clear();
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
        localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
        for (const [k, v] of Object.entries(d)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
      }
    },
    { t: tema, d: datos },
  );
}

/** The lesson screen of a practice item of a section («practica-<n>»). */
function rutaPractica(parte: string, seccion: string, id: string): string {
  const d = J<PracticaParte>(`practica/${parte}.json`);
  const i = d.secciones[seccion]!.items.indexOf(id);
  expect(i, id).toBeGreaterThanOrEqual(0);
  return `#/leccion/${parte}/${seccion}/practica-${i + 1}`;
}

/**
 * The option button whose text is exactly `texto`. A substring match (`hasText`) is ambiguous: in cap00-12 «Vp» is
 * also inside «Vp/√3» and «Vp/√2, como una senoide», and with the options shuffled `.first()` clicked a wrong one
 * about one run in fifteen (the flake of «el curso como camino», which draws 4 random questions).
 */
function opcionExacta(page: Page, texto: string) {
  const exacto = new RegExp(`^\\s*${texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
  return page.locator('button.opcion').filter({ has: page.locator('.txt', { hasText: exacto }) });
}

/** Tab until the focused element matches (keyboard only). */
async function tabHasta(page: Page, sel: string, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => !!document.activeElement?.matches(s), sel)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`no se llega con el tabulador a ${sel}`);
}

test('reto con la figura solo con el teclado: lo lejos que está, la pista y el desarrollo', async ({ page }) => {
  await limpio(page);
  const reto = J<PracticaParte>('practica/cap01.json').items.find((x) => x.id === 'cap01-reto-fig-1.4-0-2') as ItemReto;
  await page.goto(rutaPractica('cap01', 'sec-1.4', reto.id));
  const r = page.locator('[data-reto]');
  await expect(r).toBeVisible();
  await expect(r.locator('[data-vivo]')).toBeVisible();
  // the start reading is outside the target and says how far
  await expect(page.locator('[data-distancia]')).toContainText(/le (sobran|faltan)/);
  const m0 = reto.mandos[0]!;
  const m1 = reto.mandos[1]!;
  // one step of the first knob, then check: still wrong, with the distance and the first hint
  await tabHasta(page, '[data-mando="0"]');
  await page.keyboard.press(m0.valores.indexOf(m0.de) > m0.valores.indexOf(m0.inicio) ? 'ArrowRight' : 'ArrowLeft');
  await expect(r).not.toHaveAttribute('data-leyendo', '', { timeout: 15_000 });
  await tabHasta(page, '[data-comprobar]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-reintento]')).toContainText(/le (sobran|faltan)/);
  await expect(page.locator('[data-pistas]')).toHaveAttribute('data-pistas', '1');
  // both knobs to the book's values with the arrows
  for (const [i, m] of [m0, m1].entries()) {
    await tabHasta(page, `[data-mando="${i}"]`);
    const ahora = await page.locator(`[data-mando="${i}"]`).inputValue();
    const d = m.valores.indexOf(m.de) - Number(ahora);
    for (let k = 0; k < Math.abs(d); k++) await page.keyboard.press(d > 0 ? 'ArrowRight' : 'ArrowLeft');
  }
  await expect(r).not.toHaveAttribute('data-leyendo', '', { timeout: 15_000 });
  await expect(page.locator('[data-distancia]')).toContainText('dentro de');
  await tabHasta(page, '[data-comprobar]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-feedback="bien"]')).toContainText('¡Correcto a la segunda!');
  await expect(page.locator('[data-desarrollo]')).toContainText('Con los valores del libro');
  await expect(page.locator('[data-cita]').first()).toBeVisible();
});

test('reto de montar en la protoboard: lo que falla se explica y vale cualquier solución', async ({ page }) => {
  await limpio(page);
  await page.goto(rutaPractica('cap45', 'sec-45.2', 'cap45-construye-ej-45.1'));
  await expect(page.locator('[data-construye]')).toBeVisible();
  await expect(page.locator('[data-mesa]')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __epaConstruye?: unknown }).__epaConstruye);
  // LED and a 100 Ω resistor: too much current
  const puesto = await page.evaluate(() => {
    const pb = (window as unknown as { __epaConstruye: { componente: (t: string, c: Record<string, string>) => unknown; anadirEn: (c: unknown, p: number[][]) => unknown } }).__epaConstruye;
    const r = pb.anadirEn(pb.componente('R', { valor: '100' }), [[4, 0], [10, 3]]);
    const d = pb.anadirEn(pb.componente('LED', { modelo: 'LEDR' }), [[10, 5], [15, 1]]);
    return !!r && !!d;
  });
  expect(puesto).toBe(true);
  await page.locator('[data-comprobar]').click();
  await expect(page.locator('[data-condicion="led"]')).toHaveAttribute('data-estado', 'mal');
  await expect(page.locator('[data-reintento]')).toContainText('la resistencia en serie tiene que ser mayor');
  await expect(page.locator('[data-condicion="fuente"]')).toHaveAttribute('data-estado', 'bien');
  // 330 Ω instead (any valid value is accepted, not a given layout)
  await page.evaluate(() => {
    const pb = (window as unknown as { __epaConstruye: { doc: { piezas: { id: string; comp: { tipo: string } }[] }; cambiarCampo: (id: string, c: string, v: string) => void } }).__epaConstruye;
    const r = pb.doc.piezas.find((p) => p.comp.tipo === 'R')!;
    pb.cambiarCampo(r.id, 'valor', '330');
  });
  await page.locator('[data-comprobar]').click();
  await expect(page.locator('[data-feedback="bien"]')).toBeVisible();
  await expect(page.locator('[data-desarrollo]')).toContainText('Una solución que cumple');
});

test('«Comprobar» en «Monte el circuito» responde al momento con 4× de CPU: «Comprobando…», ocupado y con el foco (QA 1.0)', async ({ page }) => {
  await limpio(page);
  await page.goto(rutaPractica('cap45', 'sec-45.2', 'cap45-construye-ej-45.1'));
  await expect(page.locator('[data-mesa]')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __epaConstruye?: unknown }).__epaConstruye);
  await page.evaluate(() => {
    const pb = (window as unknown as { __epaConstruye: { componente: (t: string, c: Record<string, string>) => unknown; anadirEn: (c: unknown, p: number[][]) => unknown } }).__epaConstruye;
    pb.anadirEn(pb.componente('R', { valor: '100' }), [[4, 0], [10, 3]]);
    pb.anadirEn(pb.componente('LED', { modelo: 'LEDR' }), [[10, 5], [15, 1]]);
  });
  await expect(page.locator('[data-comprobar]')).toBeEnabled();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    // time from the press to the first frame painted with «Comprobando…» (it used to be ~0,44 s: the netlist was
    // built before the busy state reached the screen)
    const r = await page.evaluate(
      () =>
        new Promise<{ ms: number; foco: boolean; ocupado: string | null; estado: string }>((listo) => {
          const b = document.querySelector<HTMLButtonElement>('[data-comprobar]')!;
          b.focus();
          const t0 = performance.now();
          const mo = new MutationObserver(() => {
            if (!b.textContent?.includes('Comprobando')) return;
            mo.disconnect();
            requestAnimationFrame(() =>
              listo({
                ms: performance.now() - t0,
                foco: document.activeElement === b,
                ocupado: b.getAttribute('aria-busy'),
                estado: document.querySelector('[data-estado-comprobar]')?.textContent ?? '',
              }),
            );
          });
          mo.observe(b, { subtree: true, childList: true, characterData: true });
          b.click();
        }),
    );
    expect(r.ms).toBeLessThan(200);
    expect(r.foco).toBe(true);
    expect(r.ocupado).toBe('true');
    expect(r.estado).toBe('Comprobando…');
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  // the result is still announced (role="alert") and the focus was not dropped to the page (with `disabled` while
  // busy, the button lost it and it fell to <body>)
  await expect(page.locator('[data-reintento][role="alert"]')).toContainText('la resistencia en serie tiene que ser mayor');
  await expect(page.locator('[data-comprobar]')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-comprobar]')).toBeFocused();
});

test('reto de montar con un transistor (ej. 6.2): la protoboard llega al comprobador y se acepta', async ({ page }) => {
  await limpio(page);
  await page.goto(rutaPractica('cap06', 'sec-6.5', 'cap06-construye-ej-6.2'));
  await expect(page.locator('[data-construye]')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __epaConstruye?: unknown }).__epaConstruye);
  const ok = await page.evaluate(() => {
    type Pb = { componente: (t: string, c: Record<string, string>) => unknown; anadirEn: (c: unknown, p: number[][]) => unknown; anadirCable: (a: number[], b: number[]) => unknown };
    const pb = (window as unknown as { __epaConstruye: Pb }).__epaConstruye;
    // TO-92 in columns 12-14 (emitter, base, collector); R1 and RC from the + rail; the base and the emitter taken
    // with wires to free columns for R2 and RE to the − rail
    const q = pb.anadirEn(pb.componente('QN', {}), [[12, 5], [13, 5], [14, 5]]);
    const r = (v: string, a: number[], b: number[]) => !!pb.anadirEn(pb.componente('R', { valor: v }), [a, b]);
    return (
      !!q && r('22k', [4, 0], [13, 3]) && r('2.2k', [9, 0], [14, 3]) &&
      !!pb.anadirCable([13, 7], [20, 7]) && r('4.7k', [20, 3], [21, 1]) &&
      !!pb.anadirCable([12, 7], [26, 7]) && r('470', [26, 3], [27, 1])
    );
  });
  expect(ok).toBe(true);
  await page.locator('[data-comprobar]').click();
  await expect(page.locator('[data-feedback="bien"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-condicion="transistor"]')).toHaveAttribute('data-estado', 'bien');
});

test('la explicación de la opción incorrecta: una pregunta de la lección y una predicción', async ({ page }) => {
  await limpio(page);
  // a Repaso question of a lesson whose wrong option has its own sentence of the book
  const porque = J<PorqueParte>('porque/cap01.json');
  const quiz = J<{ preguntas: { id: string; ref: string; tipo: string; opciones: string[]; correcta: number }[] }>('repaso/cap01.json').preguntas;
  const parte = J<{ bloques: { t: string; label?: string; bloques?: unknown[] }[] }>('partes/cap01.json');
  // the h2 of every label (a question's ref may be a subsection or a problem)
  const seccionDe = new Map<string, string>();
  let h2 = '';
  const anotar = (b: { t: string; label?: string; bloques?: unknown[]; items?: { label?: string }[] }) => {
    if (b.label) seccionDe.set(b.label, h2);
    for (const x of (b.bloques ?? []) as typeof b[]) anotar(x);
    for (const x of b.items ?? []) if (x.label) seccionDe.set(x.label, h2);
  };
  for (const b of parte.bloques) {
    if (b.t === 'h2') h2 = b.label!;
    anotar(b);
  }
  let elegida: { sec: string; n: number; opcion: string; frase: string } | null = null;
  for (const q of quiz) {
    const e = porque.repaso[q.id];
    const k = e ? Object.keys(e).find((i) => e[i]!.k === 'libro') : undefined;
    if (!e || k == null) continue;
    const sec = seccionDe.get(q.ref);
    if (!sec) continue;
    const enLeccion = quiz.filter((x) => seccionDe.get(x.ref) === sec);
    const x = e[k]!;
    elegida = { sec, n: enLeccion.indexOf(q) + 1, opcion: plano(q.opciones[Number(k)]!), frase: x.k === 'libro' ? plano(x.html).slice(0, 40) : '' };
    break;
  }
  expect(elegida).not.toBeNull();
  await page.goto(`#/leccion/cap01/${elegida!.sec}/pregunta-${elegida!.n}`);
  await opcionExacta(page, elegida!.opcion).click();
  const bloque = page.locator('[data-porque="libro"]');
  await expect(bloque).toBeVisible();
  await expect(bloque).toContainText('Por qué no');
  await expect(bloque).toContainText(elegida!.frase);
  await expect(page.locator('[data-feedback="mal"] .explicacion')).toBeVisible();

  // a prediction: the wrong direction explained with the simulated numbers
  const pred = J<PracticaParte>('practica/cap01.json').items.find((x) => x.id === 'cap01-pred-sec-1.4');
  expect(pred?.tipo).toBe('prediccion');
  await page.goto(rutaPractica('cap01', 'sec-1.4', 'cap01-pred-sec-1.4'));
  const mala = ['sube', 'baja', 'igual'].find((s) => pred!.tipo === 'prediccion' && s !== pred!.esperado.respuesta)!;
  await page.locator(`[data-opcion="${mala}"]`).click();
  const sim = page.locator('[data-porque]');
  await expect(sim).toBeVisible({ timeout: 20_000 });
  await expect(sim).toContainText(/pasa de .* a /);
});

/** Answers the question on screen correctly (from the quiz files). */
async function acertar(page: Page): Promise<void> {
  const id = await page.locator('[data-pregunta]').getAttribute('data-pregunta');
  const parte = id!.replace(/-\d+$/, '');
  const q = J<{ preguntas: { id: string; tipo: string; opciones?: string[]; correcta?: number; valor_texto?: string }[] }>(`repaso/${parte}.json`).preguntas.find((x) => x.id === id)!;
  if (q.tipo === 'opcion') await opcionExacta(page, plano(q.opciones![q.correcta!]!)).click();
  else {
    await page.locator('[data-numero]').fill(q.valor_texto!);
    await page.locator('[data-numero]').press('Enter');
  }
  await expect(page.locator('[data-feedback="bien"]')).toBeVisible();
}

test('acertar elige la opción exacta, no otra que la contiene (cap00-12: «Vp», «Vp/√3», «Vp/√2…»)', async ({ page }) => {
  // the cause of the flake: the old matcher found three buttons for «Vp»; the exact one finds one, and it is right
  await limpio(page);
  const quiz = J<{ preguntas: { id: string; ref: string }[] }>('repaso/cap00.json').preguntas;
  const n = quiz.filter((x) => x.ref === 'sec-0.7').findIndex((x) => x.id === 'cap00-12') + 1;
  expect(n).toBeGreaterThan(0);
  await page.goto(`#/leccion/cap00/sec-0.7/pregunta-${n}`);
  await expect(page.locator('[data-pregunta="cap00-12"]')).toBeVisible();
  await expect(page.locator('button.opcion', { hasText: 'Vp' })).toHaveCount(3);
  await expect(opcionExacta(page, 'Vp')).toHaveCount(1);
  await acertar(page);
});

test('el curso como camino: bloqueadas, «Saltar hasta aquí» con su prueba corta y la vista de lista', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cursos/fundamentos');
  const camino = page.locator('[data-camino]');
  await expect(camino).toBeVisible();
  await expect(page.locator('[data-nodo="cap00/sec-0.1"]')).toHaveAttribute('data-estado', 'disponible');
  await expect(page.locator('[data-nodo="cap00/sec-0.2"]')).toHaveAttribute('data-estado', 'bloqueado');
  // a locked node is not a link; the keyboard reaches the open one and the jump
  await expect(page.locator('[data-nodo="cap00/sec-0.2"] [data-abrir-nodo]')).toHaveCount(0);
  await tabHasta(page, '[data-nodo="cap00/sec-0.1"] [data-abrir-nodo]');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /Números, Magnitudes y Notación: Disponible/);
  // the list view is the same course
  await page.locator('[data-vista="lista"]').click();
  await expect(page.locator('.capitulos')).toBeVisible();
  await page.locator('[data-vista="camino"]').click();
  // jump to 0.2: a short check on 0.1 — only on 0.1 (QA 1.0: it used to fill up with ω, complex numbers, inductors…
  // from the chapter's later lessons); 0.1 has two Repaso questions, so the check has two
  const de01 = J<{ preguntas: { ref: string }[] }>('repaso/cap00.json').preguntas.filter((x) => /^sec-0\.1(\.|$)/.test(x.ref)).length;
  expect(de01).toBeGreaterThan(0);
  expect(de01).toBeLessThan(4);
  await page.locator('[data-saltar="cap00/sec-0.2"]').click();
  await expect(page.locator('[data-saltar-prueba]')).toBeVisible();
  await expect(page.locator(`[data-total-salto="${de01}"]`)).toContainText('si las acierta todas');
  await page.locator('[data-empezar-salto]').click();
  await expect(page.locator('[data-pregunta]')).toBeVisible();
  const vistas: string[] = [];
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('[data-pregunta], [data-resultado-salto]').first()).toBeVisible();
    if (!(await page.locator('[data-pregunta]').count())) break;
    vistas.push((await page.locator('[data-ref-salto]').getAttribute('data-ref-salto')) ?? '');
    await acertar(page);
    await page.locator('[data-siguiente-salto]').click();
  }
  expect(vistas).toHaveLength(de01);
  for (const r of vistas) expect(r).toMatch(/^cap00\/sec-0\.1(\.|$)/);
  await expect(page.locator('[data-resultado-salto="aprobado"]')).toBeVisible();
  await expect(page.locator('[data-marcadas="1"]')).toBeVisible();
  await page.goto('#/cursos/fundamentos');
  await expect(page.locator('[data-nodo="cap00/sec-0.1"]')).toHaveAttribute('data-estado', 'superado');
  await expect(page.locator('[data-nodo="cap00/sec-0.2"]')).toHaveAttribute('data-estado', 'disponible');
  await expect(page.locator('[data-nodo="cap00/sec-0.3"]')).toHaveAttribute('data-estado', 'bloqueado');
  // stored where the placement test stores it (cursos.superadas), and kept after a reload
  await page.reload();
  await expect(page.locator('[data-nodo="cap00/sec-0.1"]')).toHaveAttribute('data-estado', 'superado');
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:cursos') ?? '{}') as { superadas?: Record<string, number> });
  expect(Object.keys(guardado.superadas ?? {})).toEqual(['cap00/sec-0.1']);
});

test('«Saltar hasta aquí» sobre lecciones sin preguntas de repaso: sin prueba, con su nota, y se puede deshacer (QA 1.0)', async ({ page }) => {
  const t = Date.now() - 3_600_000;
  expect(J<{ preguntas: { ref: string }[] }>('repaso/cap00.json').preguntas.filter((x) => /^sec-0\.2(\.|$)/.test(x.ref))).toHaveLength(0);
  await limpio(page, 'claro', { lecciones: { 'cap00/sec-0.1': { h: [0], u: 0, n: 1, c: t, t } } });
  await page.goto('#/cursos/fundamentos');
  await expect(page.locator('[data-nodo="cap00/sec-0.2"]')).toHaveAttribute('data-estado', 'disponible');
  await page.locator('[data-saltar="cap00/sec-0.3"]').click();
  await expect(page.locator('[data-sin-preguntas]')).toContainText('no hay prueba');
  await expect(page.locator('[data-empezar-salto]')).toHaveCount(0);
  await page.locator('[data-saltar-sin-prueba]').click();
  await expect(page.locator('[data-resultado-salto="aprobado"] h1')).toHaveText('Lecciones saltadas');
  await expect(page.locator('[data-marcadas="1"]')).toBeVisible();
  await page.locator('[data-deshacer-salto]').click();
  await expect(page.locator('[data-marcadas]')).toHaveCount(0);
});

test('repaso espaciado de las lecciones completadas: en el camino y en el inicio', async ({ page }) => {
  const ahora = Date.now();
  const viejo = ahora - 20 * DIA;
  const ronda = (t: number) => [[t, 100], [t + 2 * DIA, 100]];
  await limpio(page, 'claro', {
    lecciones: {
      'cap00/sec-0.1': { h: [0], u: 0, n: 1, c: viejo, t: viejo },
      'cap00/sec-0.2': { h: [0], u: 0, n: 1, c: ahora - 3_600_000, t: ahora - 3_600_000 },
    },
    dominio: {
      version: 1,
      migrado: 1,
      items: {
        'cap00-01': { s: 'cap00/sec-0.1', c: 'q', r: ronda(viejo - 2 * DIA) },
        'cap00-02': { s: 'cap00/sec-0.1', c: 'q', r: ronda(viejo - 2 * DIA) },
        'cap00-03': { s: 'cap00/sec-0.1', c: 'q', r: ronda(viejo - 2 * DIA) },
        'cap00-04': { s: 'cap00/sec-0.2', c: 'q', r: ronda(ahora - 2 * DIA - 3_600_000) },
        'cap00-05': { s: 'cap00/sec-0.2', c: 'q', r: ronda(ahora - 2 * DIA - 3_600_000) },
        'cap00-06': { s: 'cap00/sec-0.2', c: 'q', r: ronda(ahora - 2 * DIA - 3_600_000) },
      },
    },
  });
  await page.goto('#/cursos/fundamentos');
  await expect(page.locator('[data-nodo="cap00/sec-0.1"]')).toHaveAttribute('data-repaso', 'ahora');
  await expect(page.locator('[data-nodo="cap00/sec-0.1"] [data-repasar]')).toHaveText(/Para repasar hoy/);
  await expect(page.locator('[data-nodo="cap00/sec-0.2"]')).toHaveAttribute('data-repaso', 'fecha');
  await expect(page.locator('[data-nodo="cap00/sec-0.2"] [data-repasar]')).toHaveText(/Repaso en \d+ días/);
  await expect(page.locator('[data-nodo="cap00/sec-0.3"]')).toHaveAttribute('data-estado', 'disponible');
  await page.goto('#/');
  const tarjeta = page.locator('[data-repaso-camino]');
  await expect(tarjeta).toHaveAttribute('data-repaso-camino', '1');
  await expect(tarjeta.getByRole('link', { name: 'Repasar' })).toHaveAttribute('href', '#/practicar/cap00/sec-0.1');
});

test('un curso propio también es un camino: sus ejercicios y preguntas se abren con su lección', async ({ page }) => {
  const t = Date.now() - 60_000;
  await limpio(page, 'claro', {
    docente: {
      version: 1,
      propios: {
        c1: {
          id: 'c1', tipo: 'curso', titulo: 'Mi curso', notas: '', creado: t, actualizado: t, version: 1,
          curso: { elementos: [{ k: 'seccion', parte: 'cap00', label: 'sec-0.1' }, { k: 'pregunta', id: 'cap00-01' }, { k: 'seccion', parte: 'cap00', label: 'sec-0.2' }, { k: 'ejercicio', label: 'ej-0.1' }] },
        },
      },
    },
  });
  await page.goto('#/docente/curso/c1');
  await expect(page.locator('[data-camino]')).toBeVisible();
  const estados = await page.locator('[data-nodo]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-estado')));
  expect(estados).toEqual(['disponible', 'disponible', 'bloqueado', 'bloqueado']);
  await expect(page.locator('[data-nodo^="2:"] [data-saltar]')).toHaveAttribute('href', '#/docente/curso/c1/saltar/2');
  await page.locator('[data-nodo^="2:"] [data-saltar]').click();
  await expect(page.locator('[data-saltar-prueba]')).toBeVisible();
  await expect(page.locator('[data-saltar-prueba] h1')).toContainText('Saltar hasta');
  await page.locator('[data-saltar-prueba]').getByRole('link', { name: 'Volver al camino' }).click();
  await page.locator('[data-vista="lista"]').click();
  await expect(page.locator('.elementos [data-elemento]')).toHaveCount(4);
});

test('encuentre la avería solo con el teclado: medir, elegir la pieza y la avería, y la explicación', async ({ page }) => {
  await limpio(page);
  const id = 'cap01-averia-fig-1.4-0-E2-abierta';
  await page.goto(rutaPractica('cap01', 'sec-1.4', id));
  const z = page.locator(`[data-averia="${id}"]`);
  await expect(z).toHaveAttribute('data-listo', '', { timeout: 20_000 });
  // the red probe to Vsal with the arrows of its select, then «Medir»
  await tabHasta(page, '[data-punta="roja"]');
  for (let i = 0; i < 5 && (await page.locator('[data-punta="roja"] option:checked').textContent()) !== 'Vsal'; i++) await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-punta="roja"] option:checked')).toHaveText('Vsal');
  await tabHasta(page, '[data-medir]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-lectura-polimetro]')).toContainText('0,000 V');
  await expect(z).toHaveAttribute('data-medidas', '1');
  // the current through R1 (the multimeter in series)
  // (a radio group: Tab reaches the checked one, the arrows choose)
  await tabHasta(page, 'input[value="V"]');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[value="A"]')).toBeChecked();
  await tabHasta(page, '[data-medir]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-lectura-polimetro]')).toContainText('0,000 A');
  // the part and the fault with the keyboard
  await tabHasta(page, '[data-pieza="E2"]');
  await page.keyboard.press('Space');
  await tabHasta(page, '[data-tipo="abierta"]');
  await page.keyboard.press('Space');
  await tabHasta(page, '[data-comprobar]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-feedback="bien"]')).toBeVisible();
  await expect(page.locator('[data-puntuacion]')).toHaveAttribute('data-puntuacion', '100');
  await expect(page.locator('[data-desarrollo] [data-revela]').first()).toContainText('Esta medida delata la avería');
  // a right answer offers «¿Qué seguridad tenía?»; skipping it stores nothing
  await expect(page.locator('[data-seguridad]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('epa:seguridad'))).toBeNull();
});

test('¿Qué seguridad tiene?: un toque opcional tras acertar, guardado para el repaso; equivocarse no lo pide', async ({ page }) => {
  await limpio(page);
  const id = 'cap01-averia-fig-1.4-0-E2-abierta';
  await page.goto(rutaPractica('cap01', 'sec-1.4', id));
  await expect(page.locator(`[data-averia="${id}"]`)).toHaveAttribute('data-listo', '', { timeout: 20_000 });
  // wrong first (another part): no confidence question
  await page.locator('label:has([data-pieza="E4"])').click();
  await page.locator('label:has([data-tipo="corto"])').click();
  await page.locator('[data-comprobar]').click();
  await expect(page.locator('[data-reintento]')).toBeVisible();
  await expect(page.locator('[data-seguridad]')).toHaveCount(0);
  // then right: the chips appear; «He adivinado» is stored for that item
  await page.locator('label:has([data-pieza="E2"])').click();
  await page.locator('label:has([data-tipo="abierta"])').click();
  await page.locator('[data-comprobar]').click();
  // review 10d: the wrong guess before costs points (not 100)
  await expect(page.locator('[data-puntuacion]')).toHaveAttribute('data-puntuacion', '75');
  await expect(page.locator('[data-puntuacion]')).toContainText('1 diagnóstico fallido');
  await page.locator('[data-nivel-seguridad="adivinado"]').click();
  await expect(page.locator('[data-seguridad]')).toHaveAttribute('data-seguridad', 'adivinado');
  await expect(page.locator('[data-seguridad]')).toContainText('volverá a salir antes');
  await expect
    .poll(async () => page.evaluate((k) => (JSON.parse(localStorage.getItem('epa:seguridad') ?? '{}') as { items?: Record<string, { e: [number, string][] }> }).items?.[k]?.e.map((x) => x[1]), id))
    .toEqual(['adivinado']);
});

test('revisión 10d: si no se puede guardar el toque de seguridad, no dice «Anotado»', async ({ page }) => {
  await limpio(page);
  // the store's writes fail on this page (a full or blocked storage): the tap stays in memory, the chip says so
  await page.addInitScript(() => {
    const poner = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === 'epa:seguridad') throw new DOMException('lleno', 'QuotaExceededError');
      return poner.call(this, k, v);
    };
  });
  const id = 'cap01-averia-fig-1.4-0-E2-abierta';
  await page.goto(rutaPractica('cap01', 'sec-1.4', id));
  await expect(page.locator(`[data-averia="${id}"]`)).toHaveAttribute('data-listo', '', { timeout: 20_000 });
  await page.locator('label:has([data-pieza="E2"])').click();
  await page.locator('label:has([data-tipo="abierta"])').click();
  await page.locator('[data-comprobar]').click();
  await page.locator('[data-nivel-seguridad="dudaba"]').click();
  await expect(page.locator('[data-seguridad] .aviso')).toHaveText('No se ha podido guardar todavía: se volverá a intentar.');
  await expect(page.locator('[data-seguridad] .aviso')).not.toContainText('Anotado');
});

test('revisión 10d: «Para repasar hoy» llega con el paso del tiempo, sin volver a abrir la página', async ({ page }) => {
  // a lesson whose review falls due two hours after the page is opened
  const T = Date.UTC(2026, 10, 6, 9);
  const regs = (b: number): RegistroItem[] => [1, 2, 3].map((i) => ({ s: 'cap00/sec-0.1', c: 'q', r: [[b + i * 1000, 100], [b + 2 * DIA + i * 1000, 100]] }));
  const r0 = repasoDe(dominioConcepto('cap00/sec-0.1', regs(0), 2 * DIA + 3_600_000));
  expect(r0.k).toBe('fecha');
  const base = T + 2 * 3_600_000 - (r0.k === 'fecha' ? r0.t : 0);
  const items = Object.fromEntries(regs(base).map((x, i) => [`cap00-0${i + 1}`, x]));
  const hecha = base + 2 * DIA + 10_000;
  await page.clock.install({ time: T });
  await limpio(page, 'claro', { lecciones: { 'cap00/sec-0.1': { h: [0], u: 0, n: 1, c: hecha, t: hecha } }, dominio: { version: 1, migrado: 1, items } });
  await page.goto('#/');
  const tarjeta = page.locator('[data-repaso-camino]');
  await expect(tarjeta).toHaveAttribute('data-repaso-camino', '0');
  await expect(tarjeta).toContainText('Próximo repaso hoy');
  await page.clock.fastForward('02:30:00');
  await expect(tarjeta).toHaveAttribute('data-repaso-camino', '1');
  await expect(tarjeta).toContainText('Una lección para repasar hoy');
  // and on the path, the same
  await page.goto('#/cursos/fundamentos');
  await expect(page.locator('[data-nodo="cap00/sec-0.1"]')).toHaveAttribute('data-repaso', 'ahora');
});

async function tactil(browser: Browser, tema: 'claro' | 'sepia' | 'oscuro') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await limpio(page, tema);
  return { ctx, page };
}

const PANTALLAS: [string, string, () => string][] = [
  ['camino', '[data-camino]', () => '#/cursos/fundamentos'],
  ['reto', '[data-reto]', () => rutaPractica('cap01', 'sec-1.4', 'cap01-reto-fig-1.4-0-2')],
  ['montar', '[data-construye]', () => rutaPractica('cap01', 'sec-1.4', 'cap01-construye-ej-1.4')],
  ['avería', '[data-averia]', () => rutaPractica('cap01', 'sec-1.4', 'cap01-averia-fig-1.4-0-E2-abierta')],
];

test('en el teléfono: 44 px y sin desbordar', async ({ browser }) => {
  const { ctx, page } = await tactil(browser, 'claro');
  for (const [nombre, sel, ruta] of PANTALLAS) {
    await page.goto(ruta());
    const zona = page.locator(sel);
    await expect(zona).toBeVisible();
    await page.waitForTimeout(800);
    const pequenos = await zona.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('a, button, input[type=range]')]
        .filter((x) => x.offsetParent && !x.closest('[data-mesa]'))
        .map((x) => ({ n: (x.textContent || x.getAttribute('aria-label') || x.tagName).trim().slice(0, 30), r: x.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
    );
    expect(pequenos, nombre).toEqual([]);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ancho, nombre).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test('accesibilidad (axe, contraste incluido) en claro, sepia y oscuro', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await limpio(page, tema);
    for (const [nombre, sel, ruta] of PANTALLAS) {
      await page.goto(ruta());
      await expect(page.locator(sel)).toBeVisible();
      await page.waitForTimeout(800);
      await page.addScriptTag({ path: AXE });
      const fallos = await page.evaluate(async (s) => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run({ include: [[s]], exclude: [['[data-mesa]'], ['[data-vivo]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      }, sel);
      expect(fallos, `${nombre} ${tema}`).toEqual([]);
    }
    await ctx.close();
  }
});

// ------------------------------------------------------------------ QA 1.0 (final QA findings 2, 3, 6, 7)

test('reto y avería de la sec 0.2/1.3: la figura tapa las anotaciones del libro (sin la respuesta ni las lecturas del circuito sano)', async ({ page }) => {
  await limpio(page);
  for (const [parte, sec, tipo] of [
    ['cap00', 'sec-0.2', 'reto'],
    ['cap01', 'sec-1.3', 'averia'],
  ] as const) {
    const d = J<PracticaParte>(`practica/${parte}.json`);
    const id = d.secciones[sec]!.items.find((x) => x.includes(`-${tipo}-`))!;
    expect(id, `${sec} ${tipo}`).toBeTruthy();
    const it = d.items.find((x) => x.id === id) as unknown as { fuente: { ocultar?: number[][] } };
    expect(it.fuente.ocultar?.length, id).toBeGreaterThan(0);
    await page.goto(rutaPractica(parte, sec, id));
    const fig = id.includes('averia') ? page.locator('[data-averia] figure') : page.locator('[data-reto] [data-vivo]');
    await expect(fig).toBeVisible();
    await expect(fig.locator('[data-tapa]')).toHaveCount(it.fuente.ocultar!.length);
    // painted with the plate's colour
    const relleno = await fig.locator('[data-tapa]').first().evaluate((r) => getComputedStyle(r).fill);
    const placa = await fig.evaluate((f) => getComputedStyle(f.closest('.p10-placa') ?? f).backgroundColor);
    expect(relleno).toBe(placa);
  }
});

test('el informe de fallos tapa lo que el lector escribió aunque el mensaje lo repita sin comillas (QA 1.0)', async ({ page }) => {
  await limpio(page);
  await page.goto('#/guia');
  const campo = page.locator('#filtro-guia');
  await campo.fill('apuntes privados del lector');
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('No se entiende: apuntes privados del lector');
    });
  });
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('epa-informe-fallos') ?? ''))
    .toContain('No se entiende');
  const guardado = await page.evaluate(() => localStorage.getItem('epa-informe-fallos') ?? '');
  expect(guardado).not.toContain('apuntes privados');
  expect(guardado).toContain('[texto]');
});

/** Contrast ratio of two CSS colours «rgb(…)». */
function contraste(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map((x) => {
      const v = Number(x) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

for (const tema of ['claro', 'sepia', 'oscuro'] as const)
  test(`foco visible del buscador de la guía y del problema del día, con el anillo de la aplicación (${tema}, QA 1.0)`, async ({ page }) => {
    await limpio(page, tema);
    for (const [ruta, sel] of [
      ['#/guia', '#filtro-guia'],
      ['#/problema', 'input[id^="n10-"]'],
    ] as const) {
      await page.goto(ruta);
      const campo = page.locator(sel).first();
      await expect(campo).toBeVisible();
      await campo.focus();
      const r = await campo.evaluate((el) => {
        // the ring is on the field or on its frame (focus-within)
        let x: Element | null = el;
        for (let i = 0; i < 3 && x; i++, x = x.parentElement) {
          const c = getComputedStyle(x);
          if (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2) return { ancho: parseFloat(c.outlineWidth), color: c.outlineColor, fondo: getComputedStyle(document.body).backgroundColor };
        }
        return null;
      });
      expect(r, `${ruta}: sin anillo de foco`).not.toBeNull();
      expect(r!.ancho).toBeGreaterThanOrEqual(2);
      expect(contraste(r!.color, r!.fondo), `${ruta} ${r!.color} sobre ${r!.fondo}`).toBeGreaterThanOrEqual(3);
    }
  });

