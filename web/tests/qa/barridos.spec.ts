// Functional sweeps over the book's data (tablet profile): every simulator netlist simulates (or shows the
// documented «No se puede simular» notice), and pressing «Simular» again neither flashes nor moves the page;
// every lesson is walked screen by screen with every practice item answered wrong and then right and every
// Repaso question answered; every «Ver en protoboard» opens, places the circuit without problems, simulates
// and closes; every console and KiCad board opens in 3D and in 2D; every calculator shows the book's result
// with its example values; every self-checked exercise accepts the book's answer.
// In the quick mode (QA_MODO=rapido) each sweep takes a deterministic sample.
import { readFileSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina, recogerYComprobar, trozos } from './arnes.ts';
import { MODO } from './perfiles.ts';
import { azarDe, bloquesDe, indice, lecciones, leerJson, recorrer, spice } from './rutas.ts';
import { contestarPractica, contestarPregunta, itemPractica } from './respuestas.ts';
import { comprobar } from '../../src/lib/magnitudes.ts';
import { IDS_MAQUINA } from '../../src/componentes/consolas/datos.ts';
import { PLACAS_DE } from '../../src/componentes/consolas/placa/datos.ts';
import type { EstadoSonda } from './sonda.ts';

test.describe.configure({ mode: 'parallel' });

/** Deterministic sample in the quick mode. */
const muestra = <T>(xs: T[], clave: (x: T) => string, fraccion: number): T[] => (MODO === 'rapido' ? xs.filter((x) => azarDe(`b:${clave(x)}`) < fraccion) : xs);

function soloTableta(reg: Registro) {
  test.skip(reg.perfil.id !== 'tableta', 'los barridos funcionales se hacen en la tableta');
  if (process.env.QA_FILTRO) test.skip(true, 'con QA_FILTRO solo corre el rastreador');
}

const marcar = (page: Page) => page.evaluate(() => (window as unknown as { __qa: EstadoSonda }).__qa.marcar());

// ------------------------------------------------------------------ simulator
const SP = spice();
const NETLISTS = muestra(Object.keys(SP.netlists), (x) => x, 0.08);

for (const [k, grupo] of trozos(NETLISTS, 25).entries()) {
  test(`simulador · netlists ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    soloTableta(reg);
    test.setTimeout(grupo.length * 150_000);
    await prepararPagina(page, reg);
    let ok = 0;
    for (const [i, id] of grupo.entries()) {
      const n = SP.netlists[id]!;
      reg.ruta = `simulador:${id}`;
      reg.traza(reg.ruta);
      // the book's netlists that show ngspice errors on purpose
      reg.silenciar = n.motor.estado === 'errores' ? [/.*/] : [];
      if (i === 0) await page.goto(`/#/simulador/${id}`);
      else await page.evaluate((h) => (location.hash = h), `#/simulador/${id}`);
      const pagina = page.locator('.pagina').first();
      await pagina.waitFor({ timeout: 30_000 }).catch(() => {});
      if (n.motor.estado === 'no-disponible') {
        const aviso = await page.getByText('No se puede simular en la aplicación.').isVisible().catch(() => false);
        if (!aviso) await reg.anotar({ sev: 'funcional', tipo: 'simulacion', firma: 'sin aviso de no simulable', msg: `${id}: no se puede simular y no muestra el aviso «No se puede simular en la aplicación».` });
        continue;
      }
      if (n.motor.pesada) continue;
      // first, automatic run: a result, or ngspice's errors when the book's netlist has them on purpose
      const fin = await page
        .waitForFunction(() => !!document.querySelector('.pagina .resultado, .pagina .aviso.error[role="alert"]') && !document.querySelector('.mando .estado .punto'), null, { timeout: 120_000 })
        .then(() => true)
        .catch(() => false);
      if (!fin) {
        await reg.anotar({ sev: 'funcional', tipo: 'simulacion', firma: 'no termina', msg: `${id}: la simulación automática no termina en 2 minutos.` });
        continue;
      }
      // (a locator's textContent() would wait for ever when there is no such element)
      const error = await page.evaluate(() => document.querySelector('.pagina .aviso.error[role="alert"]')?.textContent ?? null);
      if (error && n.motor.estado === 'ok') await reg.anotar({ sev: 'funcional', tipo: 'simulacion', firma: error.replace(/\d+/g, '#').slice(0, 80), msg: `${id}: falla en la aplicación aunque el validador la dio por buena: ${error.slice(0, 200)}` });
      // the main action again: nothing may flash or move (the 0.10.0 «Simulando con ngspice…» bug)
      await esperarCalma(page, 15_000, 700);
      await marcar(page);
      await page.locator('.mando button.primario').click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.waitForFunction(() => !document.querySelector('.mando .estado .punto'), null, { timeout: 120_000 }).catch(() => {});
      await esperarCalma(page, 15_000, 700);
      await recogerYComprobar(page, reg, { tactil: true, completa: false, accesibilidad: false });
      ok++;
    }
    reg.silenciar = [];
    reg.cobertura({ 'simulador: netlists simuladas': ok, 'simulador: netlists revisadas': grupo.length });
  });
}

// ------------------------------------------------------------------ lessons
const LECCIONES = muestra(lecciones(), (l) => `${l.parte}/${l.seccion}`, 0.05);
const PREGUNTAS = new Map<string, { tipo: string; opciones?: string[]; correcta?: number; valor_texto?: string }>();
for (const p of new Set(LECCIONES.map((l) => l.parte))) {
  try {
    for (const q of leerJson<{ preguntas: { id: string; tipo: string }[] }>(`libro/repaso/${p}.json`).preguntas) PREGUNTAS.set(q.id, q);
  } catch {
    /* no quiz */
  }
}

for (const [k, grupo] of trozos(LECCIONES, 12).entries()) {
  test(`lecciones · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    soloTableta(reg);
    test.setTimeout(grupo.reduce((s, l) => s + l.pantallas.length, 0) * 40_000 + 60_000);
    await prepararPagina(page, reg);
    let pantallas = 0;
    let items = 0;
    let preguntas = 0;
    for (const [i, l] of grupo.entries()) {
      const base = `#/leccion/${l.parte}/${l.seccion}`;
      reg.ruta = `leccion:${l.parte}/${l.seccion}`;
      await marcar(page).catch(() => {});
      if (i === 0) await page.goto(`/${base}`);
      else await page.evaluate((h) => (location.hash = h), base);
      let k = 0;
      for (const esperada of l.pantallas) {
        reg.ruta = `leccion:${l.parte}/${l.seccion}/${esperada}`;
        reg.traza(reg.ruta);
        const ok = await page
          .waitForFunction((e) => location.hash.endsWith(`/${e}`) || (e === '1' && /\/leccion\/[^/]+\/[^/]+$/.test(location.hash)), esperada, { timeout: 30_000 })
          .then(() => true)
          .catch(() => false);
        if (!ok) {
          const hash = await page.evaluate(() => location.hash);
          await reg.anotar({ sev: 'funcional', tipo: 'leccion', firma: 'pantalla inesperada', msg: `Se esperaba la pantalla «${esperada}» (${k + 1} de ${l.pantallas.length}) y la ruta es ${hash}.` });
          break;
        }
        await esperarCalma(page, 15_000, 400);
        await recogerYComprobar(page, reg, { tactil: true, completa: false, accesibilidad: k === 0 });
        pantallas++;
        try {
          if (esperada.startsWith('practica-')) {
            const id = l.items[Number(esperada.slice(9)) - 1]!;
            const it = itemPractica(id, l.parte);
            if (!it) throw new Error(`no existe el ítem ${id}`);
            for (const f of await contestarPractica(page, it)) await reg.anotar({ sev: 'funcional', tipo: `practica-${it.tipo}`, firma: f.replace(/[\d,.]+/g, '#').slice(0, 90), msg: `${id}: ${f}` });
            items++;
          } else if (esperada.startsWith('pregunta-')) {
            for (const f of await contestarPregunta(page, PREGUNTAS, preguntas % 2 === 0)) await reg.anotar({ sev: 'funcional', tipo: 'pregunta', firma: f.replace(/^pregunta \S+: /, '').slice(0, 90), msg: f });
            preguntas++;
          } else if (esperada === 'fin') {
            const resumen = await page.locator('[data-resumen]').isVisible().catch(() => false);
            if (!resumen) await reg.anotar({ sev: 'funcional', tipo: 'leccion', firma: 'sin resumen', msg: 'La pantalla final de la lección no muestra el resumen.' });
            break;
          }
          const cont = page.locator('[data-continuar]').first();
          await cont.waitFor({ timeout: 15_000 });
          if (await cont.isDisabled()) {
            await reg.anotar({ sev: 'funcional', tipo: 'leccion', firma: `«Continuar» desactivado en ${esperada.replace(/\d+/g, '#')}`, msg: `«Continuar» sigue desactivado tras contestar la pantalla ${esperada}.` });
            break;
          }
          // the next screen's load window starts here (what the harness's own answers made appear and go is not
          // the app's flashing)
          await marcar(page);
          await cont.click();
        } catch (e) {
          await reg.anotar({ sev: 'funcional', tipo: 'leccion', firma: String(e).split('\n')[0]!.replace(/\d+/g, '#').slice(0, 90), msg: `Pantalla ${esperada}: ${String(e).split('\n')[0]}` });
          break;
        }
        k++;
      }
    }
    reg.cobertura({ 'lecciones recorridas': grupo.length, 'pantallas de lección vistas': pantallas, 'prácticas contestadas (mal y bien)': items, 'preguntas contestadas': preguntas });
  });
}

// ------------------------------------------------------------------ «Ver en protoboard»
interface Montable {
  id: string;
  hash: string;
  boton: string;
}
function montables(): Montable[] {
  const r: Montable[] = [];
  for (const id of Object.keys(SP.netlists)) if (SP.netlists[id]!.motor.estado !== 'no-disponible') r.push({ id: `netlist:${id}`, hash: `#/simulador/${id}`, boton: '.meta button:has-text("Ver en protoboard")' });
  const ind = indice();
  for (const parte of ind.tomos.flatMap((t) => t.partes)) {
    if (parte === 'glosario') continue;
    recorrer(bloquesDe(parte), (b) => {
      if (b.t !== 'figura' || !b.label) return;
      const f = b as unknown as { tipo_figura?: string; datos?: string; label: string };
      if (SP.porRef[f.label]?.length) return; // the same circuit as its netlist
      if (f.tipo_figura !== 'esquema' || !f.datos) return;
      try {
        const d = leerJson<{ esquemas?: { simulacion?: { simulable?: boolean } }[] }>(`libro/${f.datos}`);
        if (d.esquemas?.some((e) => e.simulacion?.simulable)) r.push({ id: `figura:${f.label}`, hash: `#/${parte}/${f.label}`, boton: `[id="${f.label}"] .ver-protoboard button.boton-pb` });
      } catch {
        /* no data */
      }
    });
  }
  return r;
}
const MONTABLES = muestra(montables(), (m) => m.id, 0.06);

for (const [k, grupo] of trozos(MONTABLES, 20).entries()) {
  test(`protoboard · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    soloTableta(reg);
    test.setTimeout(grupo.length * 150_000);
    await prepararPagina(page, reg);
    let abiertos = 0;
    for (const m of grupo) {
      reg.ruta = `protoboard:${m.id}`;
      reg.traza(reg.ruta);
      await page.goto(`/${m.hash}`);
      try {
        const b = page.locator(m.boton).first();
        await b.scrollIntoViewIfNeeded({ timeout: 30_000 });
        await b.click({ timeout: 30_000 });
        // a figure with two schematics opens a menu
        const menu = page.locator('.ver-protoboard .menu button').first();
        if (await menu.isVisible().catch(() => false)) await menu.click();
        await page.waitForFunction(() => !!(window as unknown as { __epaProtoboard?: { pb: { doc: { piezas: unknown[] } } } }).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
        const problemas = await page.evaluate(() => (window as unknown as { __epaProtoboard: { verificar: () => string[] } }).__epaProtoboard.verificar());
        for (const p of problemas) await reg.anotar({ sev: 'funcional', tipo: 'protoboard-montaje', firma: p.replace(/[A-Z]+\d+/g, 'X').replace(/\d+/g, '#').slice(0, 90), msg: `${m.id}: ${p}` });
        await page.evaluate(() => delete (window as unknown as { __epaProtoboardSim?: unknown }).__epaProtoboardSim);
        // the board shows the engine's global state: a run of the page under it turns its «Simular» into «Detener»
        if (await page.locator('.capa-protoboard button:has-text("Detener")').first().isVisible().catch(() => false))
          await reg.anotar({ sev: 'funcional', tipo: 'protoboard-simular', firma: '«Detener» por una simulación ajena', msg: `${m.id}: al abrir la protoboard su barra muestra «Detener» (la simulación es la de la página de debajo, no la suya; pulsarlo la cancela).` });
        const simular = page.locator('.capa-protoboard button.simular').first();
        await simular.waitFor({ timeout: 120_000 });
        await page.waitForFunction(() => !(document.querySelector('.capa-protoboard button.simular') as HTMLButtonElement | null)?.disabled, null, { timeout: 120_000 });
        await simular.click({ timeout: 15_000 });
        // the run's output, or the board's own notice (a book netlist with deliberate errors is not simulated:
        // «Corrija lo que se indica antes de simular», or the «Avisos» tab opened with them in a narrow layout)
        const sim = await page
          .waitForFunction(
            () =>
              (window as unknown as { __epaProtoboardSim?: { salida: { errores: string[] } } }).__epaProtoboardSim?.salida ??
              (document.querySelector('.capa-protoboard [role="alert"]') ||
              [...document.querySelectorAll('.capa-protoboard [role="tab"][aria-selected="true"]')].some((t) => /Avisos/.test(t.textContent ?? ''))
                ? { errores: [], aviso: true }
                : null),
            null,
            { timeout: 120_000 },
          )
          .then((h) => h.jsonValue() as Promise<{ errores: string[]; aviso?: boolean }>)
          .catch(() => null);
        if (sim?.aviso && SP.netlists[m.id.slice(8)]?.motor.estado !== 'errores')
          await reg.anotar({ sev: 'funcional', tipo: 'protoboard-simular', firma: 'aviso en vez de simular', msg: `${m.id}: la protoboard no simula el montaje y avisa de errores, pero la netlist del libro simula sin errores.` });
        if (!sim) await reg.anotar({ sev: 'funcional', tipo: 'protoboard-simular', firma: 'no termina', msg: `${m.id}: la simulación desde la protoboard no termina.` });
        else if (sim.errores.length && SP.netlists[m.id.slice(8)]?.motor.estado !== 'errores')
          await reg.anotar({ sev: 'funcional', tipo: 'protoboard-simular', firma: sim.errores[0]!.replace(/\d+/g, '#').slice(0, 80), msg: `${m.id}: ngspice da errores al simular el montaje: ${sim.errores.slice(0, 2).join(' · ')}` });
        await recogerYComprobar(page, reg, { tactil: true, completa: false, accesibilidad: false });
        await page.locator('.capa-protoboard button[aria-label="Cerrar y volver al esquema"]').click({ timeout: 10_000 });
        await page.locator('.capa-protoboard').waitFor({ state: 'detached', timeout: 10_000 });
        abiertos++;
      } catch (e) {
        await reg.anotar({ sev: 'funcional', tipo: 'protoboard', firma: String(e).split('\n')[0]!.replace(/\d+/g, '#').slice(0, 90), msg: `${m.id}: ${String(e).split('\n')[0]}` });
      }
    }
    reg.cobertura({ 'protoboard: circuitos abiertos, simulados y cerrados': abiertos, 'protoboard: circuitos probados': grupo.length });
  });
}

// ------------------------------------------------------------------ boards in 3D and 2D
interface Placa {
  id: string;
  d3: string;
  d2: string;
}
function placas(): Placa[] {
  const r: Placa[] = [];
  for (const m of IDS_MAQUINA) if (PLACAS_DE[m]?.length) r.push({ id: `consola:${m}`, d3: `#/consolas/${m}/placa3d`, d2: `#/consolas/${m}/placa2d` });
  for (const p of leerJson<{ proyectos: { placas: { id: string }[] }[] }>('proyectos/indice.json').proyectos)
    for (const pl of p.placas) r.push({ id: `proyecto:${pl.id}`, d3: `#/proyectos/${pl.id}/3d`, d2: `#/proyectos/${pl.id}/placa` });
  return r;
}

test('placas · 3D y 2D de consolas y proyectos', async ({ page }, info) => {
  const reg = new Registro(info);
  soloTableta(reg);
  const lista = muestra(placas(), (p) => p.id, 0.3);
  test.setTimeout(lista.length * 400_000);
  await prepararPagina(page, reg);
  let bien = 0;
  for (const p of lista) {
    reg.ruta = `placa:${p.id}`;
    reg.traza(reg.ruta);
    try {
      await page.goto(`/${p.d3}`);
      await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 300_000 });
      await recogerYComprobar(page, reg, { tactil: true, completa: false, accesibilidad: false });
      await page.evaluate((h) => (location.hash = h), p.d2);
      await page.waitForFunction(() => !!(globalThis as unknown as { __epaPlacaVista?: unknown }).__epaPlacaVista, null, { timeout: 120_000 });
      await esperarCalma(page, 10_000);
      const huerfanos = await page.evaluate(() => {
        (window as unknown as { gc?: () => void }).gc?.();
        return (window as unknown as { __qa: EstadoSonda }).__qa.contextosHuerfanos();
      });
      if (huerfanos) await reg.anotar({ sev: 'rendimiento', tipo: 'webgl-fuga', firma: p.id.split(':')[0]!, msg: `Al pasar de la placa en 3D a 2D quedan ${huerfanos} contexto(s) WebGL sin liberar.` });
      await recogerYComprobar(page, reg, { tactil: true, completa: false, accesibilidad: false });
      bien++;
    } catch (e) {
      await reg.anotar({ sev: 'funcional', tipo: 'placa', firma: `${p.id.split(':')[0]}: ${String(e).split('\n')[0]!.slice(0, 80)}`, msg: `${p.id}: ${String(e).split('\n')[0]}` });
    }
  }
  reg.cobertura({ 'placas abiertas en 3D y 2D': bien, 'placas probadas': lista.length });
});

// ------------------------------------------------------------------ calculators
interface Formula {
  id: string;
  resultado: string;
  vars: { id: string; unidad: string; defecto: number }[];
}
const FORMULAS = muestra(leerJson<{ formulas: Formula[] }>('libro/formulas.json').formulas, (f) => f.id, 0.08);

for (const [k, grupo] of trozos(FORMULAS, 60).entries()) {
  test(`calculadoras · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    soloTableta(reg);
    test.setTimeout(grupo.length * 30_000);
    await prepararPagina(page, reg);
    let bien = 0;
    for (const [i, f] of grupo.entries()) {
      reg.ruta = `calculadoras:${f.id}`;
      if (i === 0) await page.goto(`/#/calculadoras/${f.id}`);
      else await page.evaluate((h) => (location.hash = h), `#/calculadoras/${f.id}`);
      const valor = page.locator('.calculadora .resultado .valor').first();
      const texto = await valor
        .waitFor({ timeout: 20_000 })
        .then(() => valor.textContent())
        .catch(() => null);
      const r = f.vars.find((v) => v.id === f.resultado)!;
      if (!texto) {
        await reg.anotar({ sev: 'funcional', tipo: 'calculadora', firma: 'sin resultado', msg: `${f.id}: no muestra ningún resultado.` });
        continue;
      }
      const v = comprobar(texto.replace(/\s+/g, ' ').trim(), { valor: r.defecto, unidad: r.unidad, tol: 0.01, texto: '' });
      if (v.tipo !== 'bien') await reg.anotar({ sev: 'funcional', tipo: 'calculadora', firma: `resultado distinto del libro (${v.tipo})`, msg: `${f.id}: muestra «${texto.trim()}» y el ejemplo del libro da ${r.defecto} ${r.unidad} (${v.tipo}).` });
      else bien++;
    }
    reg.cobertura({ 'calculadoras con el resultado del libro': bien, 'calculadoras probadas': grupo.length });
  });
}

// ------------------------------------------------------------------ self-checked exercises
interface Ejercicio {
  parte: string;
  modo: string;
  respuestas: { id: string; texto: string; valor: number; unidad: string }[];
}
const EJERCICIOS = muestra(
  Object.entries(leerJson<{ items: Record<string, Ejercicio> }>('libro/ejercicios.json').items).filter(([, e]) => e.modo === 'auto' && e.respuestas.length),
  ([l]) => l,
  0.1,
);

for (const [k, grupo] of trozos(EJERCICIOS, 60).entries()) {
  test(`ejercicios · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    soloTableta(reg);
    test.setTimeout(grupo.length * 40_000);
    await prepararPagina(page, reg);
    let bien = 0;
    for (const [i, [label, e]] of grupo.entries()) {
      reg.ruta = `ejercicio:${label}`;
      if (i === 0) await page.goto(`/#/${e.parte}/${label}`);
      else await page.evaluate((h) => (location.hash = h), `#/${e.parte}/${label}`);
      const panel = page.locator(`.comprobador[data-label="${label}"]`);
      try {
        await panel.waitFor({ timeout: 20_000 });
        await panel.scrollIntoViewIfNeeded();
        for (const r of e.respuestas) {
          const c = page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r.id}`);
          await c.fill(r.texto);
          await c.press('Enter');
        }
        const n = await panel.locator('.fb-bien').count();
        if (n !== e.respuestas.length) {
          const fb = await panel.locator('[class*="fb-"]').allTextContents();
          await reg.anotar({ sev: 'funcional', tipo: 'ejercicio', firma: 'no acepta la respuesta del libro', msg: `${label}: con las respuestas del libro (${e.respuestas.map((r) => r.texto).join('; ')}) solo ${n} de ${e.respuestas.length} son correctas: ${fb.join(' · ').slice(0, 200)}` });
        } else bien++;
      } catch (x) {
        await reg.anotar({ sev: 'funcional', tipo: 'ejercicio', firma: String(x).split('\n')[0]!.replace(/\d+/g, '#').slice(0, 80), msg: `${label}: ${String(x).split('\n')[0]}` });
      }
    }
    reg.cobertura({ 'ejercicios que aceptan la respuesta del libro': bien, 'ejercicios probados': grupo.length });
  });
}

// ------------------------------------------------------------------ data assets referenced by the book
test('recursos: cada figura, imagen y ecuación que cita el libro existe', async ({ request }, info) => {
  const reg = new Registro(info);
  soloTableta(reg);
  test.setTimeout(20 * 60_000);
  const rutas = new Set<string>();
  const ind = indice();
  for (const parte of Object.keys(ind.partes)) {
    const texto = readFileSync(new URL(`../../public/libro/partes/${parte}.json`, import.meta.url), 'utf8');
    for (const m of texto.matchAll(/"(?:src|svg|datos)":\s*"((?:fig|img|ec|datos)\/[^"]+)"/g)) rutas.add(`libro/${m[1]}`);
    for (const m of texto.matchAll(/src=\\"((?:fig|img|ec)\/[^"\\]+)\\"/g)) rutas.add(`libro/${m[1]}`);
  }
  let faltan = 0;
  const lista = [...rutas];
  for (const t of trozos(lista, 32)) {
    const rs = await Promise.all(t.map((u) => request.head(`/${u}`).then((r) => [u, r.status()] as const)));
    for (const [u, st] of rs)
      if (st >= 400) {
        faltan++;
        reg.ruta = 'recursos';
        await reg.anotar({ sev: 'error', tipo: 'recurso', firma: u, msg: `El libro cita ${u} y no existe (HTTP ${st}).` });
      }
  }
  reg.cobertura({ 'recursos del libro comprobados': lista.length, 'recursos que faltan': faltan });
});
