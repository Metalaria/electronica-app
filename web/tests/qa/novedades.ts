// 0.12 parts of the QA harness: the route actions that put the new interface in each of its states (the backup card
// of #/sincronizacion — preview, «Sustituir todo», result, damaged, foreign and newer files, the automatic backup and
// «Deshacer la sustitución» —, the in-app confirmation dialog, the signed updater's states in «Aa», in the notice and on
// the synchronisation page, and the daily activity summed across devices), so the crawler, the layout stress and axe
// check them like any other page; and the helpers the functional sweep of novedades12.spec.ts shares with them.
// Each action checks its own outcome (a «funcional» finding when the state it leads to does not come) and has an
// `deshacerAccion012` that leaves the page as it was (dialog answered, test bridge and fake GitHub removed).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Registro } from './arnes.ts';

export const ACCIONES_012 = [
  'aa-exportar',
  'copia-unir',
  'copia-sustituir',
  'copia-resultado',
  'copia-danada',
  'copia-ajena',
  'copia-nueva',
  'copia-deshacer',
  'confirmar-borrar',
  'confirmar-nuevo',
  'actualizador-disponible',
  'actualizador-descargando',
  'actualizador-listo',
  'actualizador-error',
  'actualizador-mac',
  'actualizador-aviso',
  'actualizador-pagina',
  'dias-sumados',
] as const;
export type Accion012 = (typeof ACCIONES_012)[number];
export const esAccion012 = (a: string | undefined): a is Accion012 => !!a && (ACCIONES_012 as readonly string[]).includes(a);

// ------------------------------------------------------------------ backup files

const CONF = JSON.parse(readFileSync(new URL('../../../src-tauri/tauri.conf.json', import.meta.url), 'utf8')) as { version: string };
/** The version the fake GitHub announces: one more than the app's. */
export const VERSION_NUEVA = (() => {
  const [x, y, z] = CONF.version.split('.').map(Number) as [number, number, number];
  return `${x}.${y}.${z + 1}`;
})();

const SECCIONES: [string, string, string][] = [
  ['sec-5.1', '5.1', 'El Semiconductor: Silicio Intrínseco y Dopaje'],
  ['sec-5.2', '5.2', 'La Unión P-N y la Barrera de Potencial'],
  ['sec-5.3', '5.3', 'La Ecuación de Shockley y la Curva Característica'],
];

/**
 * A backup as «Exportar copia» writes it (lib/sincronizacion/copia-formato.ts): a bookmark, a note and a section read
 * (cap05), one deletion, one damaged item (dropped and counted by the preview) and a store this version does not know
 * (listed, not imported) — so the preview shows every note it has.
 */
export function copiaQa(ahora = Date.now(), opciones: { danados?: boolean } = {}): string {
  const t = ahora - 60_000;
  const [s1, s2, s3] = SECCIONES as [[string, string, string], [string, string, string], [string, string, string]];
  const marcadores: Record<string, unknown> = {
    [s1[0]]: { t, v: { parte: 'cap05', label: s1[0], num: s1[1], titulo: s1[2], t } },
    [s2[0]]: { t: t + 1, x: 1 },
  };
  const almacenes: Record<string, Record<string, unknown>> = {
    marcadores,
    notas: { [s3[0]]: { t, v: { parte: 'cap05', label: s3[0], num: s3[1], titulo: s3[2], texto: 'Nota de la copia de QA', t } } },
    leidas: { [`cap05/${s1[0]}`]: { t, v: t } },
  };
  if (opciones.danados !== false) {
    marcadores['roto'] = { t, v: { sin: 'etiqueta' } };
    almacenes['almacen-de-otra-version'] = { a: { t, v: { x: 1 } } };
  }
  return JSON.stringify({ formato: 'epa-copia-seguridad', version: 1, app: CONF.version, exportado: ahora - 30_000, dispositivo: 'Tableta de QA', almacenes }, null, 1);
}

/** A backup holding the given stores ({store: {id: {t, v} | {t, x: 1}}}). */
export function copiaDe(almacenes: Record<string, Record<string, unknown>>, ahora = Date.now()): string {
  return JSON.stringify({ formato: 'epa-copia-seguridad', version: 1, app: CONF.version, exportado: ahora - 30_000, dispositivo: 'Tableta de QA', almacenes }, null, 1);
}

/** Cut half-way (a download that did not finish). */
export const COPIA_DANADA = () => copiaQa().slice(0, 300);
/** Another program's JSON. */
export const COPIA_AJENA = () => JSON.stringify({ name: 'otra-aplicacion', version: '1.0.0', dependencias: { a: '1' } });
/** A backup made by a newer version of the app (format version 2). */
export const COPIA_NUEVA = () => copiaQa().replace('"version": 1', '"version": 2');

/** Chooses a file in the backup card (the browser's file picker: Tauri's dialog is not there). */
export async function elegirCopia(page: Page, nombre: string, texto: string): Promise<void> {
  // a new step: what the previous one showed may go now (not a flash of the app)
  await page.evaluate(() => (window as unknown as { __qa?: { marcar: () => void } }).__qa?.marcar()).catch(() => {});
  const tarjeta = page.locator('[data-copia]');
  await tarjeta.waitFor({ timeout: 30_000 });
  await tarjeta.evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15_000 }), page.locator('[data-copia-importar]').click({ timeout: 15_000 })]);
  await fc.setFiles({ name: nombre, mimeType: 'application/json', buffer: Buffer.from(texto, 'utf8') });
}

// ------------------------------------------------------------------ updater bridge (lib/sincronizacion/instalador.svelte.ts)

/**
 * A public key that `claveActualizadorValida` accepts (the shape of a minisign key: a comment line and «Ed» + 8 + 32
 * bytes). It verifies nothing — the bridge below never checks a signature — and is not a secret.
 */
export const CLAVE_QA = Buffer.from(`untrusted comment: minisign public key de QA\n${Buffer.concat([Buffer.from('Ed'), Buffer.alloc(40, 7)]).toString('base64')}\n`).toString('base64');

export interface ConfigPuente {
  sistema: 'windows' | 'macos';
  version: string;
  clave: string;
  /** The download stops half-way (state «descargando»). */
  pausa?: boolean;
  fallarDescarga?: string;
  /** The start-up check runs without a token (as in the apps), so the notice appears. */
  aviso?: boolean;
}

/**
 * Init script (serialised: nothing from outside): when sessionStorage «qa-actualizador» holds a ConfigPuente, the app
 * sees a Windows or macOS webview with the test bridge of tests/actualizador12.spec.ts in place of Tauri's updater.
 */
export function instalarPuenteQa(): void {
  let cfg: ConfigPuente | null = null;
  try {
    cfg = JSON.parse(sessionStorage.getItem('qa-actualizador') ?? 'null') as ConfigPuente | null;
  } catch {
    cfg = null;
  }
  if (!cfg) return;
  const c = cfg;
  const ua =
    c.sistema === 'macos'
      ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  Object.defineProperty(Navigator.prototype, 'userAgent', { configurable: true, get: () => ua });
  const w = window as unknown as Record<string, unknown>;
  if (c.aviso) w['__epaComprobarSinToken'] = true;
  let soltar: () => void = () => {};
  const pausa = new Promise<void>((r) => (soltar = r));
  w['__qaSoltarDescarga'] = () => soltar();
  w['__epaPuenteActualizador'] = {
    clave: c.clave,
    async comprobar() {
      return {
        version: c.version,
        async download(onEvent?: (e: unknown) => void) {
          // one failure (as the plugin's error would be): «Volver a intentarlo» downloads again and succeeds
          if (c.fallarDescarga) {
            const m = c.fallarDescarga;
            c.fallarDescarga = undefined;
            throw m;
          }
          onEvent?.({ event: 'Started', data: { contentLength: 10_000_000 } });
          onEvent?.({ event: 'Progress', data: { chunkLength: 4_000_000 } });
          if (c.pausa) await pausa;
          onEvent?.({ event: 'Progress', data: { chunkLength: 6_000_000 } });
          onEvent?.({ event: 'Finished' });
        },
        async install() {},
        async close() {},
      };
    },
    async reiniciar() {},
  };
}

type Manejador = Parameters<Page['route']>[1];
const falsos = new WeakMap<Page, Manejador>();

/** GitHub's API answering the release check with a newer version (everything else is aborted: no real request leaves). */
export async function githubFalso(page: Page, version = VERSION_NUEVA): Promise<void> {
  const manejador: Manejador = (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    if (url.pathname !== '/repos/Metalaria/electronica-app/releases/latest') return route.abort('blockedbyclient');
    return route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        tag_name: `v${version}`,
        name: `Electrónica Práctica Avanzada v${version}`,
        html_url: `https://github.com/Metalaria/electronica-app/releases/tag/v${version}`,
        body: '## Novedades\n- Actualización automática firmada\n- Copia de seguridad de todo el progreso',
        published_at: '2026-11-04T10:00:00Z',
        assets: [{ name: `Electronica-${version}-windows-x64-setup.exe` }, { name: `Electronica-${version}-macos-universal.dmg` }, { name: 'latest.json' }],
      }),
    });
  };
  falsos.set(page, manejador);
  await page.route('https://api.github.com/**', manejador);
}

/** Removes githubFalso's handler only (prepararPagina's block of the real GitHub stays). */
export async function quitarGithubFalso(page: Page): Promise<void> {
  const m = falsos.get(page);
  if (m) await page.unroute('https://api.github.com/**', m).catch(() => {});
  falsos.delete(page);
}

/** Turns the bridge on (or off with null) for the next document, and loads it. */
async function conPuente(page: Page, cfg: ConfigPuente | null): Promise<void> {
  await page.evaluate((c) => {
    if (c) sessionStorage.setItem('qa-actualizador', JSON.stringify(c));
    else sessionStorage.removeItem('qa-actualizador');
    // the last release found is kept (epa:sinc-version): it would show the notice on every later page
    localStorage.removeItem('epa:sinc-version');
  }, cfg);
  await page.reload({ waitUntil: 'load' });
}

// ------------------------------------------------------------------ daily activity of two devices

/** The review day of now (04:00 local, as componentes/repaso/srs.ts claveDia), computed in the page. */
export async function sembrarDiasSumados(page: Page): Promise<{ dia: string; esperado: number }> {
  return page.evaluate(() => {
    const d = new Date();
    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = Date.now() - 60_000;
    const r = (pasos: number, dt: number) => ({ pasos, preguntas: 1, secciones: 0, cumplido: false, t: t + dt });
    // two other devices studied today (2 + 3 steps); the 0.11 mirror holds what one of them saw (3)
    const dias = { [`${dia}@qaaaaaaaaaaa`]: r(2, 0), [`${dia}@qbbbbbbbbbbb`]: r(3, 1), [dia]: { ...r(3, 1), cumplido: false } };
    localStorage.setItem('epa:progreso-diario', JSON.stringify(dias));
    return { dia, esperado: 5 };
  });
}

// ------------------------------------------------------------------ the actions

const enVista = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
    .catch(() => {});

async function tarjetaCopia(page: Page): Promise<void> {
  await page.locator('[data-copia]').waitFor({ timeout: 30_000 });
  // a previous action's preview or result must not be taken for this one's
  const cancelar = page.locator('[data-copia-vista] button:has-text("Cancelar")');
  if (await cancelar.isVisible().catch(() => false)) await cancelar.click();
}

/** Opens the state the action stands for. Throws when it cannot be reached (visitar records it as «accion»). */
export async function hacerAccion012(page: Page, accion: Accion012, reg: Registro): Promise<void> {
  const fallo = (firma: string, msg: string) => reg.anotar({ sev: 'funcional', tipo: `novedad-${accion}`, firma, msg });
  switch (accion) {
    case 'aa-exportar': {
      await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click({ timeout: 10_000 });
      const b = page.locator('[data-aa-exportar]');
      await b.scrollIntoViewIfNeeded({ timeout: 10_000 });
      await b.click();
      const aviso = page.locator('[data-aa-aviso-copia]');
      await aviso.waitFor({ timeout: 20_000 });
      const t = (await aviso.textContent()) ?? '';
      if (!/^Copia (descargada|guardada)/.test(t.trim())) await fallo('no exporta', `«Aa» → «Exportar copia» dice «${t.trim()}».`);
      await enVista(page, '[data-aa-aviso-copia]');
      return;
    }
    case 'copia-unir':
    case 'copia-sustituir':
    case 'copia-resultado':
    case 'copia-deshacer': {
      await tarjetaCopia(page);
      // one file for the whole action (a second import of the same file must change nothing)
      const fichero = copiaQa();
      await elegirCopia(page, 'qa-copia-de-seguridad.json', fichero);
      const vista = page.locator('[data-copia-vista]');
      await vista.waitFor({ timeout: 20_000 });
      const cambios = Number(await vista.getAttribute('data-cambios'));
      if (!(await page.locator('[data-copia-descartados]').isVisible())) await fallo('sin aviso de dañados', 'La vista previa no dice que deja fuera el elemento dañado de la copia.');
      if (!(await page.locator('[data-copia-desconocidos]').isVisible())) await fallo('sin aviso de desconocidos', 'La vista previa no dice que la copia tiene datos que esta versión no conoce.');
      if (accion === 'copia-unir') {
        await enVista(page, '[data-copia-vista]');
        return;
      }
      if (accion === 'copia-resultado') {
        if (!cambios) {
          // already imported in this context (an earlier visit): the preview says so
          if (!(await page.locator('[data-copia-nada]').isVisible())) await fallo('ni cambios ni «no cambia nada»', 'La vista previa no muestra cambios ni dice que la copia no cambia nada.');
          await enVista(page, '[data-copia-vista]');
          return;
        }
        await page.locator('[data-copia-aplicar]').click();
        await page.locator('[data-copia-resultado]').waitFor({ timeout: 30_000 });
        const m = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:marcadores') ?? '{}') as Record<string, unknown>);
        if (!m['sec-5.1']) await fallo('no importa', '«Importar y unir» termina pero el marcador de la copia no está en el almacenamiento.');
        // a second import of the same copy changes nothing
        await elegirCopia(page, 'qa-copia-de-seguridad.json', fichero);
        await vista.waitFor({ timeout: 20_000 });
        if (Number(await vista.getAttribute('data-cambios')) !== 0) await fallo('importar dos veces cambia', `Importar dos veces la misma copia: la segunda vista previa anuncia ${await vista.getAttribute('data-cambios')} cambios.`);
        await page.locator('[data-copia-vista] button:has-text("Cancelar")').click();
        await enVista(page, '[data-copia-resultado]');
        return;
      }
      await page.locator('[data-copia-modo="sustituir"]').check();
      await page.locator('[data-copia-confirmar]').waitFor({ timeout: 10_000 });
      if (await page.locator('[data-copia-aplicar]').isEnabled()) await fallo('sustituir sin confirmar', '«Sustituir todo» se puede pulsar sin marcar la casilla de confirmación.');
      if (accion === 'copia-sustituir') {
        await page.locator('[data-copia-confirmar]').check();
        await enVista(page, '[data-copia-confirmar]');
        return;
      }
      // copia-deshacer: replace, then ask to undo (the in-app dialog stays open for the checks)
      await page.locator('[data-copia-confirmar]').check();
      if (!(await page.locator('[data-copia-aplicar]').isEnabled())) {
        // nothing to replace (the data already equal the copy): still the undo of an earlier replacement
        await page.locator('[data-copia-vista] button:has-text("Cancelar")').click();
      } else {
        await page.locator('[data-copia-aplicar]').click();
        await page.locator('[data-copia-resultado]').waitFor({ timeout: 30_000 });
        const m = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:marcadores') ?? '{}') as Record<string, unknown>).sort());
        if (m.join(',') !== 'sec-5.1') await fallo('sustituir deja otros', `Tras «Sustituir todo» los marcadores son ${m.join(', ') || '(ninguno)'} y la copia solo tiene sec-5.1.`);
      }
      const deshacer = page.locator('[data-copia-deshacer]');
      await deshacer.waitFor({ timeout: 20_000 });
      await deshacer.click();
      await page.getByRole('alertdialog', { name: '¿Deshacer la sustitución?' }).waitFor({ timeout: 10_000 });
      return;
    }
    case 'copia-danada':
    case 'copia-ajena':
    case 'copia-nueva': {
      await tarjetaCopia(page);
      const [nombre, texto, espera] =
        accion === 'copia-danada' ? ['copia-cortada.json', COPIA_DANADA(), /dañado|incompleto/] : accion === 'copia-ajena' ? ['package.json', COPIA_AJENA(), /no es una copia/] : ['copia-de-la-0.13.json', COPIA_NUEVA(), /actualice|más nueva|posterior/i];
      const antes = await page.evaluate(() => localStorage.getItem('epa:marcadores'));
      await elegirCopia(page, nombre, texto);
      const error = page.locator('[data-copia-error]');
      await error.waitFor({ timeout: 20_000 });
      const t = (await error.textContent()) ?? '';
      if (!espera.test(t)) await fallo('mensaje inesperado', `Un fichero «${nombre}» da el aviso «${t.trim()}».`);
      if (await page.locator('[data-copia-vista]').isVisible()) await fallo('vista previa de un fichero inservible', `El fichero «${nombre}» se rechaza y aun así enseña la vista previa.`);
      if ((await page.evaluate(() => localStorage.getItem('epa:marcadores'))) !== antes) await fallo('cambia datos', `Elegir «${nombre}» (inservible) cambia los marcadores.`);
      await enVista(page, '[data-copia-error]');
      return;
    }
    case 'confirmar-borrar': {
      await page.waitForFunction(() => !!(window as unknown as { __epaProtoboard?: unknown }).__epaProtoboard, null, { timeout: 60_000, polling: 200 });
      const guardar = page.getByRole('button', { name: 'Guardar', exact: true });
      if (await guardar.isVisible().catch(() => false)) {
        await guardar.click();
        await page.waitForFunction(() => /#\/protoboard\/.+/.test(location.hash), null, { timeout: 15_000, polling: 200 });
      }
      const lista = page.getByRole('region', { name: 'Mis montajes' });
      if (!(await lista.isVisible().catch(() => false))) await page.getByRole('button', { name: /Mis montajes|Montajes/ }).first().click();
      const borrar = lista.getByRole('button', { name: 'Borrar' }).first();
      await borrar.waitFor({ timeout: 10_000 });
      await borrar.click();
      await page.getByRole('alertdialog').waitFor({ timeout: 10_000 });
      return;
    }
    case 'confirmar-nuevo': {
      await page.waitForFunction(() => ((window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0) > 0, null, { timeout: 60_000, polling: 200 });
      await page.getByRole('button', { name: 'Nuevo', exact: true }).first().click({ timeout: 10_000 });
      const d = page.getByRole('alertdialog', { name: '¿Empezar un circuito nuevo?' });
      await d.waitFor({ timeout: 10_000 });
      return;
    }
    case 'actualizador-disponible':
    case 'actualizador-descargando':
    case 'actualizador-listo':
    case 'actualizador-error':
    case 'actualizador-mac':
    case 'actualizador-pagina':
    case 'actualizador-aviso': {
      const cfg: ConfigPuente = {
        sistema: accion === 'actualizador-mac' ? 'macos' : 'windows',
        version: VERSION_NUEVA,
        clave: CLAVE_QA,
        pausa: accion === 'actualizador-descargando',
        fallarDescarga: accion === 'actualizador-error' ? 'error sending request for url (https://github.com/Metalaria/electronica-app/releases/download/latest.json)' : undefined,
        aviso: accion === 'actualizador-aviso',
      };
      await githubFalso(page);
      await conPuente(page, cfg);
      if (accion === 'actualizador-aviso') {
        const aviso = page.locator(`[data-aviso-version="${VERSION_NUEVA}"]`);
        await aviso.waitFor({ timeout: 30_000 });
        await aviso.locator('[data-instalador="disponible"]').waitFor({ timeout: 30_000 });
        return;
      }
      let zona = page.locator('#contenido');
      if (accion !== 'actualizador-pagina') {
        await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click({ timeout: 10_000 });
        zona = page.locator('[data-grupo-actualizaciones]');
      }
      const buscar = zona.getByRole('button', { name: 'Buscar actualizaciones' });
      await buscar.scrollIntoViewIfNeeded({ timeout: 15_000 });
      await buscar.click();
      const instalador = zona.locator('[data-instalador]');
      await zona.locator('[data-instalador="disponible"]').waitFor({ timeout: 30_000 });
      if (accion === 'actualizador-disponible' || accion === 'actualizador-pagina') {
        await enVista(page, accion === 'actualizador-pagina' ? '#contenido [data-instalador]' : '[data-grupo-actualizaciones] [data-instalador]');
        return;
      }
      await zona.getByRole('button', { name: /Descargar e instalar/ }).click();
      const final = accion === 'actualizador-descargando' ? 'descargando' : accion === 'actualizador-error' ? 'error' : 'listo';
      await zona.locator(`[data-instalador="${final}"]`).waitFor({ timeout: 30_000 });
      const estado = await instalador.getAttribute('data-instalador');
      if (estado !== final) await fallo(`estado ${estado}`, `El actualizador queda en «${estado}» y se esperaba «${final}».`);
      if (final === 'listo' && !(await zona.getByRole('button', { name: /Reiniciar para terminar/ }).isVisible())) await fallo('sin reiniciar', 'La actualización descargada no ofrece «Reiniciar para terminar».');
      await enVista(page, '[data-grupo-actualizaciones] [data-instalador]');
      return;
    }
    case 'dias-sumados': {
      const { esperado } = await sembrarDiasSumados(page);
      await page.reload({ waitUntil: 'load' });
      if ((await page.evaluate(() => location.hash)) === '#/' || (await page.evaluate(() => location.hash)) === '') {
        const obj = page.locator('section.objetivo');
        await obj.waitFor({ timeout: 30_000 });
        await page.waitForFunction((n) => document.querySelector('section.objetivo')?.getAttribute('data-hechos') === String(n), esperado, { timeout: 15_000, polling: 200 }).catch(() => {});
        const hechos = Number(await obj.getAttribute('data-hechos'));
        if (hechos !== esperado) await fallo('no suma', `El objetivo de hoy dice ${hechos} pasos y dos dispositivos llevan ${esperado} (2 + 3).`);
      }
      return;
    }
  }
}

/** Leaves the page as before the action: the dialog answered, the bridge, the fake GitHub and the release found gone. */
export async function deshacerAccion012(page: Page, accion: Accion012): Promise<void> {
  if (accion === 'confirmar-borrar') {
    // the montage saved for the question is deleted for real (the destructive button), so visits do not pile them up
    const d = page.getByRole('alertdialog');
    if (await d.isVisible().catch(() => false)) await d.getByRole('button', { name: 'Borrar' }).click();
    await d.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  } else if (accion === 'confirmar-nuevo' || accion === 'copia-deshacer') {
    const d = page.getByRole('alertdialog');
    if (await d.isVisible().catch(() => false)) await d.getByRole('button', { name: 'Cancelar' }).click();
    await d.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  } else if (accion.startsWith('actualizador-')) {
    await quitarGithubFalso(page);
    await page.evaluate(() => (window as unknown as { __qaSoltarDescarga?: () => void }).__qaSoltarDescarga?.()).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await conPuente(page, null).catch(() => {});
  }
}
