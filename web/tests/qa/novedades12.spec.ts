// QA of what 0.12 adds, as functional sweeps in the three device profiles (the route actions of novedades.ts already
// put each state under the crawler's, the layout stress's and axe's checks):
//   - backup: export a real progress (made through the reader's own buttons), import it on «another device» (a fresh
//     context) with «Unir», twice (the second changes nothing), «Sustituir todo» and «Deshacer la sustitución», the
//     automatic backup saved as a file, and the files it must refuse without changing anything;
//   - the in-app confirmation: Escape, «Cancelar», a tap outside and the destructive button, focus back on the trigger;
//   - the signed updater through the test bridge: «Cancelar» while downloading and «Volver a intentarlo» after an error;
//   - the diagnostic's «Entorno del estudio» row: «calculado» on a fresh device, «guardado» after a reload and on
//     «Repetir»;
//   - the studio's environment cache (IndexedDB «epa-cache-3d»): every 3D board opened twice in a fresh context — the
//     first open filters and saves it, the second reads it — with the same picture;
//   - the day's activity summed across devices: the goal shows the sum, a step taken here adds to it.
// Findings go to the report; a test fails only when the harness itself breaks.
import { readFileSync } from 'node:fs';
import { test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina, recogerYComprobar } from './arnes.ts';
import { COPIA_AJENA, COPIA_DANADA, COPIA_NUEVA, elegirCopia, githubFalso, quitarGithubFalso, CLAVE_QA, VERSION_NUEVA, sembrarDiasSumados, type ConfigPuente } from './novedades.ts';
import { IDS_MAQUINA } from '../../src/componentes/consolas/datos.ts';
import { PLACAS_DE } from '../../src/componentes/consolas/placa/datos.ts';
import { azarDe, leerJson } from './rutas.ts';
import { MODO } from './perfiles.ts';

test.describe.configure({ mode: 'parallel' });

async function contexto(browser: Browser, info: TestInfo, reg: Registro): Promise<Page> {
  const uso = info.project.use as Record<string, unknown>;
  const ctx = await browser.newContext({ ...uso, baseURL: (uso['baseURL'] as string | undefined) ?? 'http://localhost:4421/' });
  const page = await ctx.newPage();
  await prepararPagina(page, reg);
  return page;
}

/** Every «epa:» key of the storage but the device's own bookkeeping (to see that nothing changed). */
const datos = (page: Page) =>
  page.evaluate(() => {
    const r: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('epa:') && !/^epa:(sinc-|dispositivo-local|prefs|pestana)/.test(k)) r[k] = localStorage.getItem(k)!;
    }
    return r;
  });

/** A step of a walk: what the previous step showed may go now (the probe's flashes count from here). */
const marcar = (page: Page) => page.evaluate(() => (window as unknown as { __qa?: { marcar: () => void } }).__qa?.marcar()).catch(() => {});

const tocar = async (page: Page, reg: Registro, sel: ReturnType<Page['locator']>) => {
  await marcar(page);
  await sel.scrollIntoViewIfNeeded({ timeout: 15_000 });
  if (reg.perfil.tactil) await sel.tap({ timeout: 15_000 });
  else await sel.click({ timeout: 15_000 });
};

/** Bookmarks a section of cap05 and writes a note on another one, with the reader's own buttons. */
async function marcarYAnotar(page: Page, reg: Registro, marcar: string, anotar: string | null, texto: string): Promise<void> {
  await page.goto('/#/cap05');
  await page.locator('.seccion-cab h2[id]').first().waitFor({ timeout: 60_000 });
  await esperarCalma(page, 20_000);
  const cab = (l: string) => page.locator('.seccion-cab', { has: page.locator(`h2[id="${l}"]`) });
  await tocar(page, reg, cab(marcar).locator('button[aria-label="Marcar esta sección"]'));
  if (anotar) {
    await tocar(page, reg, cab(anotar).locator('button[aria-label$="nota a esta sección"]'));
    const area = page.locator('.nota-personal textarea');
    await area.fill(texto);
    await area.press('Control+Enter');
  }
  await page.waitForTimeout(800);
}

// ------------------------------------------------------------------ backup

test('copia de seguridad: exportar, unir en otro dispositivo, dos veces, sustituir y deshacer', async ({ browser }, info) => {
  const reg = new Registro(info);
  test.setTimeout(15 * 60_000);
  const fallo = (firma: string, msg: string) => reg.anotar({ sev: 'funcional', tipo: 'copia', firma, msg });

  // device A: real progress, then «Exportar copia»
  reg.ruta = 'copia: dispositivo A';
  const a = await contexto(browser, info, reg);
  reg.descargas = true;
  await marcarYAnotar(a, reg, 'sec-5.4', 'sec-5.5', 'Nota escrita en el dispositivo A');
  await a.goto('/#/sincronizacion/copia');
  await a.locator('[data-copia]').waitFor({ timeout: 30_000 });
  await esperarCalma(a, 20_000);
  if (!(await a.evaluate(() => document.activeElement?.id === 't-copia'))) await fallo('sin foco en la tarjeta', '#/sincronizacion/copia no pone el foco en el título de «Copia de seguridad».');
  const [descarga] = await Promise.all([a.waitForEvent('download', { timeout: 30_000 }), tocar(a, reg, a.locator('[data-copia-exportar]'))]);
  const nombre = descarga.suggestedFilename();
  const texto = readFileSync((await descarga.path())!, 'utf8');
  if (!/^electronica-copia-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(nombre)) await fallo('nombre del fichero', `La copia se llama «${nombre}».`);
  const aviso = (await a.locator('[data-copia-aviso]').textContent({ timeout: 10_000 }).catch(() => '')) ?? '';
  if (!aviso.includes(nombre)) await fallo('aviso sin el fichero', `Tras exportar dice «${aviso.trim()}» (sin el nombre del fichero).`);
  let copia: { formato?: string; version?: number; almacenes?: Record<string, Record<string, { v?: { texto?: string } }>> } = {};
  try {
    copia = JSON.parse(texto);
  } catch {
    await fallo('fichero no es JSON', 'La copia exportada no es JSON válido.');
  }
  if (copia.formato !== 'epa-copia-seguridad' || copia.version !== 1) await fallo('formato', `La copia dice formato «${copia.formato}», versión ${copia.version}.`);
  if (!copia.almacenes?.['marcadores']?.['sec-5.4']) await fallo('falta el marcador', 'La copia exportada no tiene el marcador puesto en sec-5.4.');
  if (copia.almacenes?.['notas']?.['sec-5.5']?.v?.texto !== 'Nota escrita en el dispositivo A') await fallo('falta la nota', 'La copia exportada no tiene la nota escrita en sec-5.5.');
  for (const prohibido of ['prefs', 'dispositivo-local', 'sinc-ajustes', 'sinc-estado', 'sinc-marcas', 'sinc-version', 'copia-automatica'])
    if (copia.almacenes && prohibido in copia.almacenes) await fallo(`lleva ${prohibido}`, `La copia exportada lleva «${prohibido}», que es de este dispositivo.`);
  if (/github_pat_|epa-credencial/.test(texto)) await fallo('lleva el token', 'La copia exportada lleva el token de GitHub.');
  await recogerYComprobar(a, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });
  await a.context().close();

  // device B: its own progress, then A's copy with «Unir», twice
  reg.ruta = 'copia: dispositivo B (unir)';
  const b = await contexto(browser, info, reg);
  await marcarYAnotar(b, reg, 'sec-5.6', null, '');
  await b.goto('/#/sincronizacion/copia');
  await b.locator('[data-copia]').waitFor({ timeout: 30_000 });
  await elegirCopia(b, nombre, texto);
  const vista = b.locator('[data-copia-vista]');
  await vista.waitFor({ timeout: 20_000 });
  const fila = (k: string) => b.locator(`[data-copia-vista] tr[data-almacen="${k}"]`);
  if ((await fila('marcadores').locator('[data-nuevos]').textContent().catch(() => '')) !== '1') await fallo('vista previa: marcadores', 'La vista previa de unir no anuncia 1 marcador nuevo.');
  if ((await fila('notas').locator('[data-nuevos]').textContent().catch(() => '')) !== '1') await fallo('vista previa: notas', 'La vista previa de unir no anuncia 1 nota nueva.');
  if (Number(await fila('marcadores').locator('[data-borrados]').textContent().catch(() => '0'))) await fallo('unir borra', 'La vista previa de unir dice que se borra un marcador de este dispositivo.');
  await recogerYComprobar(b, reg, { tactil: reg.perfil.tactil, completa: true, accesibilidad: true });
  await tocar(b, reg, b.locator('[data-copia-aplicar]'));
  await b.locator('[data-copia-resultado]').waitFor({ timeout: 30_000 });
  const m1 = await b.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:marcadores') ?? '{}') as object).sort().join(','));
  if (m1 !== 'sec-5.4,sec-5.6') await fallo('unir pierde o no trae', `Tras unir, los marcadores son «${m1}» (se esperaba sec-5.4 de la copia y sec-5.6 propio).`);
  await recogerYComprobar(b, reg, { tactil: reg.perfil.tactil, completa: true, accesibilidad: true });
  await elegirCopia(b, nombre, texto);
  await vista.waitFor({ timeout: 20_000 });
  if (!(await b.locator('[data-copia-nada]').isVisible())) await fallo('importar dos veces', `La segunda importación de la misma copia anuncia ${await vista.getAttribute('data-cambios')} cambios.`);
  await tocar(b, reg, b.locator('[data-copia-vista] button:has-text("Cancelar")'));
  // the reader shows what came in
  reg.ruta = 'copia: dispositivo B (lector tras unir)';
  await b.goto('/#/cap05');
  await b.locator('.seccion-cab h2[id]').first().waitFor({ timeout: 60_000 });
  // (the reader renders the sections around the reading position first)
  await b.locator('h2[id="sec-5.4"]').waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});
  await b.locator('h2[id="sec-5.5"]').waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});
  await esperarCalma(b, 15_000);
  const marcado = await b.locator('.seccion-cab', { has: b.locator('h2[id="sec-5.4"]') }).locator('button[aria-label="Quitar el marcador"]').count();
  const conNota = await b.locator('.seccion-cab', { has: b.locator('h2[id="sec-5.5"]') }).locator('button[aria-label="Editar la nota de esta sección"]').count();
  if (!marcado || !conNota) await fallo('el lector no lo muestra', `Tras unir, el capítulo 5 ${marcado ? '' : 'no muestra el marcador de sec-5.4 '}${conNota ? '' : 'no muestra la nota de sec-5.5'}.`);

  // «Sustituir todo» with the same copy: sec-5.6 goes; then «Deshacer la sustitución» (Escape first: nothing happens)
  reg.ruta = 'copia: dispositivo B (sustituir)';
  const antesDeSustituir = await datos(b);
  await b.goto('/#/sincronizacion/copia');
  await b.locator('[data-copia]').waitFor({ timeout: 30_000 });
  await elegirCopia(b, nombre, texto);
  await vista.waitFor({ timeout: 20_000 });
  await tocar(b, reg, b.locator('[data-copia-modo="sustituir"]'));
  await b.locator('[data-copia-confirmar]').waitFor({ timeout: 10_000 });
  if ((await fila('marcadores').locator('[data-borrados]').textContent().catch(() => '')) !== '1') await fallo('vista previa: sustituir', 'La vista previa de «Sustituir todo» no anuncia que se borra el marcador propio (sec-5.6).');
  if (await b.locator('[data-copia-aplicar]').isEnabled()) await fallo('sustituir sin casilla', '«Sustituir todo» se puede pulsar sin la casilla.');
  await tocar(b, reg, b.locator('[data-copia-confirmar]'));
  await recogerYComprobar(b, reg, { tactil: reg.perfil.tactil, completa: true, accesibilidad: true });
  await tocar(b, reg, b.locator('[data-copia-aplicar]'));
  await b.locator('[data-copia-resultado]').waitFor({ timeout: 30_000 });
  const m2 = await b.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:marcadores') ?? '{}') as object).sort().join(','));
  if (m2 !== 'sec-5.4') await fallo('sustituir', `Tras «Sustituir todo», los marcadores son «${m2}» (la copia solo tiene sec-5.4).`);
  const deshacer = b.locator('[data-copia-deshacer]');
  if (!(await deshacer.isVisible().catch(() => false))) await fallo('sin deshacer', 'Tras «Sustituir todo» no aparece «Deshacer la sustitución».');
  else {
    // the automatic backup as a file
    const [auto] = await Promise.all([b.waitForEvent('download', { timeout: 30_000 }).catch(() => null), tocar(b, reg, b.locator('[data-copia-automatica]'))]);
    if (!auto) await fallo('copia automática', '«Guardarla en un fichero» no descarga la copia automática.');
    else {
      const t = readFileSync((await auto.path())!, 'utf8');
      const o = JSON.parse(t) as { automatica?: boolean; almacenes?: Record<string, Record<string, unknown>> };
      if (!o.almacenes?.['marcadores']?.['sec-5.6']) await fallo('copia automática incompleta', 'La copia automática no tiene el marcador que había antes de sustituir (sec-5.6).');
    }
    await tocar(b, reg, deshacer);
    const dialogo = b.getByRole('alertdialog', { name: '¿Deshacer la sustitución?' });
    await dialogo.waitFor({ timeout: 10_000 });
    // (after its 0.12 s fade-in: measured during it, the text's colour is still blended with the page)
    await b.waitForTimeout(400);
    await recogerYComprobar(b, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });
    await b.keyboard.press('Escape');
    await dialogo.waitFor({ state: 'detached', timeout: 10_000 });
    if ((await b.evaluate(() => document.activeElement?.hasAttribute('data-copia-deshacer'))) !== true) await fallo('foco tras Escape', 'Tras cerrar con Escape el diálogo de deshacer, el foco no vuelve a «Deshacer la sustitución».');
    const m3 = await b.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:marcadores') ?? '{}') as object).sort().join(','));
    if (m3 !== 'sec-5.4') await fallo('Escape deshace', `Escape en «¿Deshacer la sustitución?» cambia los marcadores a «${m3}».`);
    await tocar(b, reg, deshacer);
    await dialogo.waitFor({ timeout: 10_000 });
    await tocar(b, reg, dialogo.getByRole('button', { name: 'Deshacer la sustitución' }));
    await b.locator('[data-copia-resultado]').waitFor({ timeout: 30_000 });
    await b.waitForTimeout(800);
    const despues = await datos(b);
    for (const k of ['epa:marcadores', 'epa:notas']) {
      const x = JSON.parse(antesDeSustituir[k] ?? '{}') as Record<string, unknown>;
      const y = JSON.parse(despues[k] ?? '{}') as Record<string, unknown>;
      if (Object.keys(x).sort().join(',') !== Object.keys(y).sort().join(',')) await fallo(`deshacer: ${k}`, `«Deshacer la sustitución» deja ${k} con «${Object.keys(y).sort().join(', ')}» y antes de sustituir tenía «${Object.keys(x).sort().join(', ')}».`);
    }
    await recogerYComprobar(b, reg, { tactil: reg.perfil.tactil, completa: true, accesibilidad: true });
    // and it survives a reload
    await b.reload();
    await b.waitForTimeout(1500);
    const m4 = await b.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:marcadores') ?? '{}') as object).sort().join(','));
    if (m4 !== 'sec-5.4,sec-5.6') await fallo('deshacer no dura', `Tras deshacer y recargar, los marcadores son «${m4}».`);
  }

  // files it must refuse, without touching anything
  for (const [n, t, que] of [
    ['cortada.json', COPIA_DANADA(), 'dañada'],
    ['package.json', COPIA_AJENA(), 'ajena'],
    ['de-la-0.13.json', COPIA_NUEVA(), 'de una versión más nueva'],
    ['vacia.json', '', 'vacía'],
    ['binario.json', '\u0000\u0001PK\u0003\u0004', 'binaria'],
  ] as const) {
    reg.ruta = `copia: fichero ${que}`;
    await b.goto('/#/sincronizacion/copia');
    await b.locator('[data-copia]').waitFor({ timeout: 30_000 });
    const antes = await datos(b);
    await elegirCopia(b, n, t);
    const error = await b.locator('[data-copia-error]').waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
    if (!error) await fallo(`fichero ${que} sin aviso`, `Una copia ${que} («${n}») no da ningún aviso.`);
    if (await b.locator('[data-copia-vista]').isVisible()) await fallo(`fichero ${que} con vista previa`, `Una copia ${que} enseña la vista previa.`);
    await b.waitForTimeout(500);
    if (JSON.stringify(await datos(b)) !== JSON.stringify(antes)) await fallo(`fichero ${que} cambia datos`, `Elegir una copia ${que} cambia los datos del dispositivo.`);
    await recogerYComprobar(b, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });
  }
  await b.context().close();
  reg.cobertura({ 'copia: recorridos completos (exportar, unir ×2, sustituir, deshacer, 5 ficheros inservibles)': 1 });
});

// ------------------------------------------------------------------ the in-app confirmation

test('confirmación propia: Escape, «Cancelar», fuera y confirmar, con el foco de vuelta', async ({ page }, info) => {
  const reg = new Registro(info);
  test.setTimeout(10 * 60_000);
  await prepararPagina(page, reg);
  const nativos: string[] = [];
  page.on('dialog', (d) => nativos.push(d.message()));
  const fallo = (firma: string, msg: string) => reg.anotar({ sev: 'funcional', tipo: 'confirmacion', firma, msg });
  const dialogo = page.getByRole('alertdialog');
  const cerrado = () => dialogo.waitFor({ state: 'detached', timeout: 10_000 }).then(() => true).catch(() => false);

  // breadboard: «Borrar» a saved montage
  reg.ruta = 'confirmación: protoboard';
  await page.goto('/#/protoboard');
  await page.waitForFunction(() => !!(window as unknown as { __epaProtoboard?: unknown }).__epaProtoboard, null, { timeout: 60_000, polling: 200 });
  await esperarCalma(page, 20_000);
  await tocar(page, reg, page.getByRole('button', { name: 'Guardar', exact: true }));
  await page.waitForFunction(() => /#\/protoboard\/.+/.test(location.hash), null, { timeout: 15_000, polling: 200 });
  await tocar(page, reg, page.getByRole('button', { name: /Mis montajes|Montajes/ }).first());
  const lista = page.getByRole('region', { name: 'Mis montajes' });
  const borrar = lista.getByRole('button', { name: 'Borrar' }).first();
  const n = () => lista.getByRole('listitem').count();
  const antes = await n();
  for (const como of ['Escape', 'Cancelar', 'fuera'] as const) {
    await tocar(page, reg, borrar);
    if (!(await dialogo.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false))) {
      await fallo('no pregunta', '«Borrar» en «Mis montajes» no abre la confirmación.');
      break;
    }
    if (como === 'Escape') {
      if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) !== 'Cancelar') await fallo('foco inicial', 'La confirmación no empieza con el foco en «Cancelar».');
      await page.waitForTimeout(400);
      await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });
      await page.keyboard.press('Escape');
    } else if (como === 'Cancelar') await tocar(page, reg, dialogo.getByRole('button', { name: 'Cancelar' }));
    else {
      await page.waitForTimeout(400);
      // a press that begins and ends on the backdrop (a corner of the screen)
      if (reg.perfil.tactil) await page.touchscreen.tap(6, (page.viewportSize()?.height ?? 800) - 6);
      else await page.mouse.click(6, (page.viewportSize()?.height ?? 800) - 6);
    }
    if (!(await cerrado())) await fallo(`${como} no cierra`, `${como} no cierra la confirmación de «Borrar».`);
    else if (como !== 'fuera' && !(await borrar.evaluate((e) => e === document.activeElement).catch(() => false))) await fallo(`foco tras ${como}`, `Tras ${como}, el foco no vuelve a «Borrar».`);
    if ((await n()) !== antes) await fallo(`${como} borra`, `${como} en la confirmación borra el montaje.`);
  }
  await tocar(page, reg, borrar);
  await dialogo.waitFor({ timeout: 10_000 });
  await tocar(page, reg, dialogo.getByRole('button', { name: 'Borrar' }));
  await cerrado();
  await page.waitForTimeout(500);
  if ((await n()) !== antes - 1) await fallo('no borra', '«Borrar» en la confirmación no borra el montaje.');
  await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });

  // editor: «Nuevo» over a book circuit opened as a drawing (not saved)
  reg.ruta = 'confirmación: editor';
  await page.goto('/#/editor/libro/cap05/sec-5.3_led_150ohm');
  const comps = () => page.evaluate(() => (window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0);
  await page.waitForFunction(() => ((window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0) > 0, null, { timeout: 60_000, polling: 200 });
  await esperarCalma(page, 20_000);
  const c0 = await comps();
  const nuevo = page.getByRole('button', { name: 'Nuevo', exact: true }).first();
  await tocar(page, reg, nuevo);
  await dialogo.waitFor({ timeout: 10_000 });
  // keys do not reach the editor while it asks (Supr would delete the selection, Ctrl+Z undo)
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  if ((await comps()) !== c0) await fallo('teclas pasan', 'Con la confirmación abierta, Supr o Ctrl+Z cambian el dibujo del editor.');
  await tocar(page, reg, dialogo.getByRole('button', { name: 'Cancelar' }));
  await cerrado();
  if ((await comps()) !== c0) await fallo('Cancelar descarta', '«Cancelar» en «¿Empezar un circuito nuevo?» descarta el dibujo.');
  await tocar(page, reg, nuevo);
  await dialogo.waitFor({ timeout: 10_000 });
  // a route change while it asks answers «Cancelar» (Android's back button)
  await page.evaluate(() => history.back());
  if (!(await cerrado())) await fallo('Atrás no cierra', 'Volver atrás con la confirmación abierta no la cierra.');
  await page.goto('/#/editor/libro/cap05/sec-5.3_led_150ohm');
  await page.waitForFunction(() => ((window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0) > 0, null, { timeout: 60_000, polling: 200 });
  await tocar(page, reg, nuevo);
  await dialogo.waitFor({ timeout: 10_000 });
  await tocar(page, reg, dialogo.getByRole('button', { name: 'Descartar' }));
  await cerrado();
  await page.waitForTimeout(500);
  if ((await comps()) !== 0) await fallo('Descartar no vacía', `«Descartar» deja ${await comps()} componentes en el editor.`);
  await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });
  if (nativos.length) await reg.anotar({ sev: 'error', tipo: 'confirmacion', firma: 'diálogo nativo', msg: `Aparece un diálogo nativo del navegador: «${nativos[0]}».` });
  reg.cobertura({ 'confirmación: recorridos (protoboard y editor)': 2 });
});

// ------------------------------------------------------------------ the updater, step by step

test('actualizador: cancelar la descarga y volver a intentarlo tras un error', async ({ page }, info) => {
  const reg = new Registro(info);
  test.setTimeout(10 * 60_000);
  await prepararPagina(page, reg);
  const fallo = (firma: string, msg: string) => reg.anotar({ sev: 'funcional', tipo: 'actualizador', firma, msg });
  await githubFalso(page);
  await page.goto('/#/');
  const cfg: ConfigPuente = { sistema: 'windows', version: VERSION_NUEVA, clave: CLAVE_QA, pausa: true };
  await page.evaluate((c) => sessionStorage.setItem('qa-actualizador', JSON.stringify(c)), cfg);
  await page.reload();
  await esperarCalma(page, 20_000);
  reg.ruta = 'actualizador: cancelar';
  await tocar(page, reg, page.getByRole('button', { name: 'Tema y tamaño de letra' }).first());
  const zona = page.locator('[data-grupo-actualizaciones]');
  await tocar(page, reg, zona.getByRole('button', { name: 'Buscar actualizaciones' }));
  const estado = () => zona.locator('[data-instalador]').getAttribute('data-instalador', { timeout: 5000 }).catch(() => null);
  const llega = (e: string) => zona.locator(`[data-instalador="${e}"]`).waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  if (!(await llega('disponible'))) await fallo('no disponible', `Con una versión nueva firmada, «Aa» queda en «${await estado()}».`);
  await tocar(page, reg, zona.getByRole('button', { name: /Descargar e instalar/ }));
  if (!(await llega('descargando'))) await fallo('no descarga', `«Descargar e instalar» deja el estado en «${await estado()}».`);
  const barra = zona.getByRole('progressbar');
  if ((await barra.getAttribute('aria-valuenow').catch(() => null)) !== '40') await fallo('progreso', `La barra de descarga marca ${await barra.getAttribute('aria-valuenow').catch(() => '?')} (se esperaba 40 %).`);
  await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });
  await tocar(page, reg, zona.getByRole('button', { name: 'Cancelar' }));
  if (!(await llega('disponible'))) await fallo('cancelar', `«Cancelar» durante la descarga deja el estado en «${await estado()}».`);
  // the abandoned download finishing later must not move the state
  await page.evaluate(() => (window as unknown as { __qaSoltarDescarga?: () => void }).__qaSoltarDescarga?.());
  await page.waitForTimeout(800);
  if ((await estado()) !== 'disponible') await fallo('descarga abandonada', `La descarga cancelada, al terminar, cambia el estado a «${await estado()}».`);
  // an error, then «Volver a intentarlo»
  reg.ruta = 'actualizador: error';
  await page.keyboard.press('Escape');
  await page.evaluate((c) => {
    sessionStorage.setItem('qa-actualizador', JSON.stringify(c));
    localStorage.removeItem('epa:sinc-version');
  }, { ...cfg, pausa: false, fallarDescarga: 'The signature verification failed' });
  await page.reload();
  await esperarCalma(page, 20_000);
  await tocar(page, reg, page.getByRole('button', { name: 'Tema y tamaño de letra' }).first());
  await tocar(page, reg, zona.getByRole('button', { name: 'Buscar actualizaciones' }));
  await llega('disponible');
  await tocar(page, reg, zona.getByRole('button', { name: /Descargar e instalar/ }));
  if (!(await llega('error'))) await fallo('sin error', `Una firma no válida deja el estado en «${await estado()}».`);
  const texto = (await zona.textContent()) ?? '';
  if (!/firma/i.test(texto)) await fallo('error sin explicar', `El error de firma no se explica: «${texto.replace(/\s+/g, ' ').slice(0, 160)}».`);
  await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: true });
  const otra = zona.getByRole('button', { name: /Volver a intentarlo/ });
  if (await otra.isVisible().catch(() => false)) {
    await tocar(page, reg, otra);
    // the failed download is tried again (the update is still pending): it ends ready to restart this time
    if (!(await llega('listo'))) await fallo('volver a intentarlo', `«Volver a intentarlo» deja el estado en «${await estado()}» (la descarga de prueba esta vez no falla).`);
  } else await fallo('sin volver a intentarlo', 'Tras un error de descarga no aparece «Volver a intentarlo».');
  // the notice is hidden while «Aa» is open, and shows once it is closed
  reg.ruta = 'actualizador: aviso con «Aa»';
  await page.evaluate((c) => {
    sessionStorage.setItem('qa-actualizador', JSON.stringify(c));
    localStorage.removeItem('epa:sinc-version');
  }, { ...cfg, pausa: false, aviso: true });
  await page.reload();
  const aviso = page.locator(`[data-aviso-version="${VERSION_NUEVA}"]`);
  if (!(await aviso.waitFor({ timeout: 30_000 }).then(() => true).catch(() => false))) await fallo('sin aviso', 'Con la comprobación al abrir, no aparece el aviso de versión nueva.');
  else {
    await tocar(page, reg, page.getByRole('button', { name: 'Tema y tamaño de letra' }).first());
    if (await aviso.isVisible().catch(() => false)) await fallo('aviso con «Aa»', 'El aviso de versión nueva sigue a la vista con «Aa» abierto.');
    await page.keyboard.press('Escape');
    await tocar(page, reg, aviso.getByRole('button', { name: 'Ahora no' }));
    if (!(await aviso.waitFor({ state: 'detached', timeout: 5000 }).then(() => true).catch(() => false))) await fallo('Ahora no', '«Ahora no» no oculta el aviso.');
  }
  await quitarGithubFalso(page);
  await page.evaluate(() => {
    sessionStorage.removeItem('qa-actualizador');
    localStorage.removeItem('epa:sinc-version');
  });
  reg.cobertura({ 'actualizador: recorridos (cancelar, error y reintento, aviso)': 3 });
});

// ------------------------------------------------------------------ diagnostic: «Entorno del estudio»

test('diagnóstico: la fila «Entorno del estudio» (calculado, guardado tras recargar y al repetir)', async ({ browser }, info) => {
  const reg = new Registro(info);
  test.setTimeout(30 * 60_000);
  const page = await contexto(browser, info, reg);
  const fallo = (firma: string, msg: string) => reg.anotar({ sev: 'funcional', tipo: 'diagnostico', firma, msg });
  const medir = async (como: string, repetir = false): Promise<{ valor: string; detalle: string } | null> => {
    reg.ruta = `diagnóstico: ${como}`;
    if (!repetir) {
      await page.goto('/#/diagnostico');
      await page.locator('[data-accion="empezar"]').waitFor({ timeout: 60_000 });
      await esperarCalma(page, 15_000);
      // only the SDR board (the one with the row), turning 2 s
      const casillas = page.locator('ul.pruebas input[type="checkbox"]');
      for (let i = 0; i < (await casillas.count()); i++) {
        const c = casillas.nth(i);
        const nombre = (await c.locator('xpath=..').textContent()) ?? '';
        if (/^\s*Placa SDR en 3D/.test(nombre) !== (await c.isChecked())) await c.setChecked(/^\s*Placa SDR en 3D/.test(nombre));
      }
      await page.locator('label.segundos input').fill('2');
    }
    await tocar(page, reg, page.locator('[data-accion="empezar"]'));
    const hecho = await page.waitForFunction(() => document.querySelector('.diagnostico')?.getAttribute('data-estado') === 'hecho', null, { timeout: 600_000, polling: 1000 }).then(() => true).catch(() => false);
    if (!hecho) {
      await fallo('no termina', `El diagnóstico de la placa SDR no termina en 10 minutos (${como}).`);
      return null;
    }
    await esperarCalma(page, 15_000);
    const fila = await page.evaluate(() => {
      const tr = [...document.querySelectorAll('.diagnostico table tbody tr')].find((t) => t.querySelector('td')?.textContent?.trim() === 'Entorno del estudio');
      return tr ? { valor: tr.querySelector('td.valor')?.textContent?.trim() ?? '', detalle: tr.querySelectorAll('td')[2]?.textContent?.trim() ?? '' } : null;
    });
    await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: true, accesibilidad: true });
    if (!fila) await fallo('sin fila', `Los resultados del diagnóstico no tienen la fila «Entorno del estudio» (${como}).`);
    return fila;
  };
  const f1 = await medir('primera vez en este dispositivo');
  if (f1 && (f1.valor !== 'calculado' || !/calculado ahora/.test(f1.detalle))) await fallo('primera vez', `La primera vez la fila dice «${f1.valor}: ${f1.detalle}» (se esperaba «calculado»).`);
  if (f1 && /pendiente|no se pudo guardar/.test(f1.detalle)) await fallo('no se guarda', `La primera vez el entorno no queda guardado para las vistas siguientes: «${f1.detalle}».`);
  const f2 = await medir('repetir sin recargar', true);
  if (f2 && f2.valor !== 'guardado') await fallo('repetir', `Al repetir sin recargar la fila dice «${f2.valor}: ${f2.detalle}» (se esperaba «guardado»).`);
  await page.reload();
  const f3 = await medir('tras recargar');
  if (f3 && (f3.valor !== 'guardado' || !/leído del almacenamiento/.test(f3.detalle))) await fallo('tras recargar', `Tras recargar la fila dice «${f3.valor}: ${f3.detalle}» (se esperaba «guardado», leído del almacenamiento).`);
  await page.context().close();
  reg.cobertura({ 'diagnóstico: medidas de la placa SDR con la fila del entorno': 3 });
});

// ------------------------------------------------------------------ the environment cache, board by board

interface Placa {
  id: string;
  hash: string;
}
function placas3d(): Placa[] {
  const r: Placa[] = [];
  for (const m of IDS_MAQUINA) if (PLACAS_DE[m]?.length) r.push({ id: `consola:${m}`, hash: `#/consolas/${m}/placa3d` });
  for (const p of leerJson<{ proyectos: { placas: { id: string }[] }[] }>('proyectos/indice.json').proyectos) for (const pl of p.placas) r.push({ id: `proyecto:${pl.id}`, hash: `#/proyectos/${pl.id}/3d` });
  // a component model and the 3D models' list (its thumbnails share the environment)
  r.push({ id: 'modelo:resistencia-axial', hash: '#/componentes/3d/resistencia-axial' });
  return r;
}

test('entorno 3D guardado: primera y segunda apertura de cada placa', async ({ browser }, info) => {
  const reg = new Registro(info);
  // every board in the tablet; a fixed sample elsewhere (each open is a minute with a software GPU)
  const filtro = process.env.QA_FILTRO ? new RegExp(process.env.QA_FILTRO) : null;
  const lista = placas3d().filter((p) => (filtro ? filtro.test(p.id) : reg.perfil.id === 'tableta' || azarDe(`entorno:${reg.perfil.id}:${p.id}`) < (MODO === 'rapido' ? 0.1 : 0.3)));
  test.setTimeout(lista.length * 12 * 60_000 + 60_000);
  let bien = 0;
  type Entorno = { origen: string | null; guardado: boolean; leidoDeBd: boolean; error: string };
  for (const p of lista) {
    const page = await contexto(browser, info, reg);
    const fallo = (firma: string, msg: string) => reg.anotar({ sev: p.id.startsWith('modelo') ? 'funcional' : 'rendimiento', tipo: 'entorno-3d', firma, msg });
    const abrir = async (vez: string): Promise<{ e: Entorno | null; captura: Buffer | null }> => {
      reg.ruta = `${p.id} (${vez})`;
      reg.traza(reg.ruta);
      const ok = await page
        .waitForFunction(
          (modelo) => {
            const g = globalThis as unknown as { __epaPlaca3DListo?: boolean; __epaEntorno?: { origen: string | null } };
            return modelo ? !!g.__epaEntorno?.origen && !!document.querySelector('canvas') : g.__epaPlaca3DListo === true;
          },
          p.id.startsWith('modelo'),
          { timeout: 300_000, polling: 500 },
        )
        .then(() => true)
        .catch(() => false);
      if (!ok) {
        await fallo('no abre', `${p.hash} no termina de abrir en 3D (${vez}).`);
        return { e: null, captura: null };
      }
      // the read-back of a first open waits for the board's first frame and then runs in bands
      await page.waitForFunction(() => {
        const e = (globalThis as unknown as { __epaEntorno?: { origen: string | null; guardado: boolean; error: string } }).__epaEntorno;
        return !!e && (e.origen === 'memoria' || e.guardado || !!e.error);
      }, null, { timeout: 120_000, polling: 500 }).catch(() => {});
      // the faces at full resolution arrive after the first frame (Vista3D's __epaPlaca3D = the scene's stats, carasFinas): the picture to compare
      if (!p.id.startsWith('modelo'))
        await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3D?: { carasFinas?: number } }).__epaPlaca3D?.carasFinas != null, null, { timeout: 120_000, polling: 500 }).catch(() => {});
      await esperarCalma(page, 30_000, 1000);
      await page.waitForTimeout(1500);
      const e = await page.evaluate(() => {
        const x = (globalThis as unknown as { __epaEntorno?: Entorno }).__epaEntorno;
        return x ? { origen: x.origen, guardado: x.guardado, leidoDeBd: x.leidoDeBd, error: x.error } : null;
      });
      const captura = await page.locator('canvas').first().screenshot({ timeout: 30_000, animations: 'disabled' }).catch(() => null);
      await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: false });
      return { e, captura };
    };
    await page.goto(`/${p.hash}`);
    const primera = await abrir('primera apertura');
    if (primera.e) {
      if (primera.e.origen !== 'pmrem') await fallo('primera no calcula', `${p.hash}, primera apertura en un dispositivo nuevo: el entorno sale de «${primera.e.origen}» (se esperaba calcularlo).`);
      if (!primera.e.guardado) await fallo('no se guarda', `${p.hash}: el entorno calculado en la primera apertura no se guarda${primera.e.error ? ` (${primera.e.error})` : ''}.`);
    }
    await page.reload();
    const segunda = await abrir('segunda apertura');
    if (segunda.e && (segunda.e.origen !== 'memoria' || !segunda.e.leidoDeBd)) await fallo('segunda no lee', `${p.hash}, segunda apertura (tras recargar): el entorno sale de «${segunda.e.origen}»${segunda.e.leidoDeBd ? '' : ', sin leerlo del almacenamiento'}.`);
    // the same picture: the saved environment is the computed one
    if (primera.captura && segunda.captura) {
      const dif = await page.evaluate(
        async ([a, b]) => {
          const img = (s: string) =>
            new Promise<HTMLImageElement>((ok, mal) => {
              const i = new Image();
              i.onload = () => ok(i);
              i.onerror = mal;
              i.src = `data:image/png;base64,${s}`;
            });
          const [ia, ib] = await Promise.all([img(a), img(b)]);
          if (ia.width !== ib.width || ia.height !== ib.height) return 1;
          const px = (i: HTMLImageElement) => {
            const c = new OffscreenCanvas(i.width, i.height);
            const x = c.getContext('2d')!;
            x.drawImage(i, 0, 0);
            return x.getImageData(0, 0, i.width, i.height).data;
          };
          const da = px(ia);
          const db = px(ib);
          let n = 0;
          for (let k = 0; k < da.length; k += 4) if (Math.max(Math.abs(da[k]! - db[k]!), Math.abs(da[k + 1]! - db[k + 1]!), Math.abs(da[k + 2]! - db[k + 2]!)) > 40) n++;
          return n / (ia.width * ia.height);
        },
        [primera.captura.toString('base64'), segunda.captura.toString('base64')] as const,
      );
      if (dif > 0.005) await reg.anotar({ sev: 'visual', tipo: 'entorno-3d', firma: 'otra imagen con el entorno guardado', msg: `${p.hash}: la segunda apertura (entorno leído del almacenamiento) cambia el ${(dif * 100).toFixed(1)} % de la vista 3D respecto a la primera.` });
    }
    if (primera.e?.origen === 'pmrem' && primera.e.guardado && segunda.e?.origen === 'memoria' && segunda.e.leidoDeBd) bien++;
    await page.context().close();
  }
  reg.cobertura({ 'entorno 3D: vistas abiertas dos veces': lista.length, 'entorno 3D: calculado, guardado y leído': bien });
});

// ------------------------------------------------------------------ the day summed across devices

test('actividad del día: la suma de dos dispositivos y un paso dado aquí', async ({ page }, info) => {
  const reg = new Registro(info);
  test.setTimeout(10 * 60_000);
  await prepararPagina(page, reg);
  const fallo = (firma: string, msg: string) => reg.anotar({ sev: 'funcional', tipo: 'actividad-dia', firma, msg });
  reg.ruta = 'actividad: inicio';
  await page.goto('/#/');
  const { dia, esperado } = await sembrarDiasSumados(page);
  await page.reload();
  const obj = page.locator('section.objetivo');
  await obj.waitFor({ timeout: 30_000 });
  await esperarCalma(page, 15_000);
  const hechos = async () => Number(await obj.getAttribute('data-hechos'));
  if ((await hechos()) !== esperado) await fallo('no suma', `El objetivo de hoy dice ${await hechos()} y dos dispositivos llevan ${esperado}.`);
  if (!(await obj.evaluate((e) => e.classList.contains('cumplido')))) await fallo('no cumplido', `Con ${esperado} pasos (objetivo 3), el objetivo de hoy no sale cumplido.`);
  const racha = Number(await page.locator('section.racha').getAttribute('data-racha').catch(() => '0'));
  if (racha < 1) await fallo('sin racha', 'Con el objetivo de hoy cumplido entre dos dispositivos, la racha es 0.');
  await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: true, accesibilidad: true });
  // one step here: the total grows by one, kept in this device's own record
  reg.ruta = 'actividad: un paso aquí';
  await page.goto('/#/leccion/cap01/sec-1.1');
  const c = page.locator('[data-continuar]').first();
  await c.waitFor({ timeout: 30_000 });
  await esperarCalma(page, 15_000);
  await tocar(page, reg, c);
  await page.waitForTimeout(1500);
  await page.goto('/#/');
  await obj.waitFor({ timeout: 30_000 });
  await page.waitForFunction((n) => Number(document.querySelector('section.objetivo')?.getAttribute('data-hechos')) > n, esperado, { timeout: 15_000, polling: 250 }).catch(() => {});
  if ((await hechos()) !== esperado + 1) await fallo('paso no suma', `Tras un paso de lección aquí, el objetivo dice ${await hechos()} (se esperaba ${esperado + 1}).`);
  const propios = await page.evaluate((d) => Object.keys(JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as object).filter((k) => k.startsWith(`${d}@`) && !/@q[ab]{11}$/.test(k)), dia);
  if (!propios.length) await fallo('sin registro propio', 'El paso dado aquí no queda en un registro propio de este dispositivo.');
  reg.ruta = 'actividad: progreso';
  await page.goto('/#/progreso');
  await esperarCalma(page, 20_000);
  await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: true, accesibilidad: true });
  reg.cobertura({ 'actividad del día: recorridos': 1 });
});
