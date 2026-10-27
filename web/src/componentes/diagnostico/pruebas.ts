// The measurements of «Diagnóstico de rendimiento» (Diagnostico.svelte): what the reader's own device does
// with the app's heaviest views, so the numbers can be pasted into a conversation. Nothing here runs until the
// page's «Empezar» button; every test builds its view in a box of the page, measures it and disposes it.

import { app } from '../../lib/estado.svelte';

export type Estado = 'ok' | 'aviso' | 'error' | 'omitida';

export interface Resultado {
  grupo: string;
  prueba: string;
  valor: string;
  detalle?: string;
  estado: Estado;
}

export interface ContextoPrueba {
  /** Box of the page where a test puts its canvas (visible, so the browser really draws it). */
  zona: HTMLElement;
  /** Seconds each FPS measurement lasts. */
  segundos: number;
  avisar: (texto: string) => void;
  cancelada: () => boolean;
  /** 0.9: a breadcrumb of the running test (see Migas): the phase about to start. */
  miga?: (fase: string) => void;
}

// ------------------------------------------------------------------ breadcrumbs (0.9)

/**
 * Breadcrumbs of the running test in localStorage, written as each phase starts, so that a test that freezes or
 * crashes the app (the Neo Geo board froze the Xiaomi Pad 6 in 0.8.2) still says where it stopped: the next time
 * the diagnostic opens it finds a run without `fin` and shows «La última prueba se quedó en: … tras N s». Times
 * are Date.now() (ms). Consecutive phases of one kind («pieza 12: R3», «pieza 13: C4»…) replace each other, so
 * the record stays a few hundred bytes. The WebView writes storage to disk a few seconds after a change.
 */
export interface Migas {
  prueba: string;
  inicio: number;
  /** [ms since `inicio`, phase] in order. */
  fases: [number, string][];
  /** When the test ended (absent: it never did). */
  fin?: number;
}

const CLAVE_MIGAS = 'epa-diagnostico-migas';

function guardarMigas(m: Migas | null): void {
  try {
    if (m) localStorage.setItem(CLAVE_MIGAS, JSON.stringify(m));
    else localStorage.removeItem(CLAVE_MIGAS);
  } catch {
    /* no storage: no breadcrumbs */
  }
}

/** The breadcrumbs of one test: `fase()` before each phase, `terminar()` when it ends (even with an error). */
export function migasDe(prueba: string): { fase: (texto: string) => void; terminar: () => void } {
  const m: Migas = { prueba, inicio: Date.now(), fases: [] };
  const tipo = (f: string) => /^(pieza \d|compilando \d)/.test(f) ? f.split(' ')[0] : f;
  guardarMigas(m);
  return {
    fase: (texto) => {
      const ult = m.fases.at(-1);
      const e: [number, string] = [Date.now() - m.inicio, texto];
      if (ult && tipo(ult[1]) === tipo(texto) && tipo(texto) !== texto) m.fases[m.fases.length - 1] = e;
      else m.fases.push(e);
      guardarMigas(m);
    },
    terminar: () => {
      m.fin = Date.now();
      guardarMigas(m);
    },
  };
}

/** The breadcrumbs of a test that never ended (the app froze or closed during it), or null. */
export function migasPendientes(): Migas | null {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_MIGAS) ?? 'null') as Migas | null;
    return m && typeof m.inicio === 'number' && Array.isArray(m.fases) && !m.fin ? m : null;
  } catch {
    return null;
  }
}

/** The row that reports an unfinished test: «La última prueba se quedó en: <fase> tras N s». */
export function filaMigas(m: Migas): Resultado {
  const ult = m.fases.at(-1) ?? [0, 'el comienzo'];
  const antes = m.fases.slice(-6, -1).map(([t, f]) => `${f} (${coma(t / 1000)} s)`);
  return {
    grupo: 'Prueba anterior sin terminar',
    prueba: 'La última prueba se quedó en',
    valor: `${ult[1]} tras ${coma(ult[0] / 1000)} s`,
    detalle: `«${m.prueba}», empezada el ${new Date(m.inicio).toLocaleString('es-ES')}${antes.length ? `; antes: ${antes.join(', ')}` : ''}. La aplicación se colgó o se cerró en esa fase.`,
    estado: 'error',
  };
}

const ms = (x: number) => `${x < 10 ? x.toFixed(1).replace('.', ',') : Math.round(x)} ms`;
const seg = (x: number) => `${(x / 1000).toFixed(2).replace('.', ',')} s`;
const coma = (x: number, d = 1) => x.toFixed(d).replace('.', ',');

function cuadro(): Promise<number> {
  return new Promise((r) => requestAnimationFrame(r));
}

async function cuadros(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await cuadro();
}

/** Waits (frame by frame) until `cond()` or `ms` milliseconds; returns the time waited. */
async function hasta(cond: () => boolean, ms: number, cancelada: () => boolean): Promise<number> {
  const t0 = performance.now();
  while (!cond() && performance.now() - t0 < ms && !cancelada()) await cuadro();
  return performance.now() - t0;
}

/**
 * Longest gap of the page's thread while `f` runs: a 4 ms timer chain whose late callbacks are the tasks that
 * held the thread (painting, uploads, compiles…), whatever their kind.
 */
async function conLatido<T>(f: () => Promise<T>): Promise<{ r: T; max: number }> {
  let max = 0;
  let previo = performance.now();
  let vivo = true;
  const latir = () => {
    const t = performance.now();
    max = Math.max(max, t - previo);
    previo = t;
    if (vivo) setTimeout(latir, 4);
  };
  setTimeout(latir, 4);
  try {
    const r = await f();
    return { r, max };
  } finally {
    vivo = false;
  }
}

const mpx = (k: number) => `×${coma(k, 2)}`;

function percentil(a: number[], p: number): number {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
}

/** A canvas in the test box, sized like the app's views (16:10, the box's width). */
function lienzo(ctx: ContextoPrueba): { caja: HTMLDivElement; c: HTMLCanvasElement; capa: HTMLDivElement; quitar: () => void } {
  const caja = document.createElement('div');
  caja.className = 'lienzo-prueba';
  const c = document.createElement('canvas');
  const capa = document.createElement('div');
  capa.className = 'capa-prueba';
  caja.append(c, capa);
  ctx.zona.append(caja);
  return { caja, c, capa, quitar: () => caja.remove() };
}

/**
 * Turns whatever is on `c` with a synthetic mouse drag for `s` seconds, as a reader would, and returns the
 * frames the view drew (`dibujados()` before and after) and the intervals between animation frames.
 */
async function girar(c: HTMLCanvasElement, s: number, dibujados: () => number, cancelada: () => boolean): Promise<{ fps: number; p95: number; marcas: number }> {
  const r = c.getBoundingClientRect();
  const x0 = r.left + r.width / 2;
  const y0 = r.top + r.height / 2;
  const ev = (t: string, x: number, y: number) => c.dispatchEvent(new PointerEvent(t, { pointerId: 41, clientX: x, clientY: y, bubbles: true, button: 0, buttons: t === 'pointerup' ? 0 : 1, pointerType: 'mouse' }));
  const n0 = dibujados();
  const marcas: number[] = [];
  ev('pointerdown', x0, y0);
  const t0 = performance.now();
  for (;;) {
    const t = await cuadro();
    marcas.push(t);
    const dt = performance.now() - t0;
    ev('pointermove', x0 + Math.sin(dt / 700) * r.width * 0.3, y0 + Math.sin(dt / 1100) * r.height * 0.12);
    if (dt > s * 1000 || cancelada()) break;
  }
  const t1 = performance.now();
  const n1 = dibujados();
  // Released after a short pause, without inertia (on a slow GPU it would keep the view moving for long).
  await new Promise((res) => setTimeout(res, 150));
  ev('pointerup', x0, y0);
  const d: number[] = [];
  for (let i = 1; i < marcas.length; i++) d.push(marcas[i]! - marcas[i - 1]!);
  return { fps: ((n1 - n0) * 1000) / (t1 - t0), p95: percentil(d, 0.95), marcas: marcas.length };
}

// ------------------------------------------------------------------ device and WebGL

export function infoDispositivo(): Resultado[] {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; mobile?: boolean } };
  const g = 'Dispositivo';
  const res: Resultado[] = [
    { grupo: g, prueba: 'Navegador', valor: nav.userAgent, estado: 'ok' },
    { grupo: g, prueba: 'Pantalla', valor: `${screen.width} × ${screen.height} px, densidad ${coma(window.devicePixelRatio || 1, 2)}`, detalle: `ventana ${innerWidth} × ${innerHeight} px`, estado: 'ok' },
    { grupo: g, prueba: 'Núcleos de CPU', valor: String(nav.hardwareConcurrency ?? '¿?'), estado: 'ok' },
  ];
  if (nav.deviceMemory) res.push({ grupo: g, prueba: 'Memoria (aprox.)', valor: `${nav.deviceMemory} GB`, estado: 'ok' });
  res.push({ grupo: g, prueba: 'Tema', valor: app.tema, estado: 'ok' });
  return res;
}

export function infoWebGL(): Resultado[] {
  const g = 'WebGL 2';
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2', { antialias: true }) as WebGL2RenderingContext | null;
  if (!gl) return [{ grupo: g, prueba: 'WebGL 2', valor: 'no disponible', detalle: 'las vistas 3D se quedan en 2D', estado: 'error' }];
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const alta = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const res: Resultado[] = [
    { grupo: g, prueba: 'GPU', valor: renderer, detalle: vendor, estado: /swiftshader|llvmpipe|software/i.test(renderer) ? 'aviso' : 'ok' },
    { grupo: g, prueba: 'Versión', valor: String(gl.getParameter(gl.VERSION)), detalle: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)), estado: 'ok' },
    { grupo: g, prueba: 'Textura máxima', valor: `${gl.getParameter(gl.MAX_TEXTURE_SIZE)} px`, detalle: `renderbuffer ${gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)} px, ${gl.getParameter(gl.MAX_SAMPLES)} muestras MSAA`, estado: 'ok' },
    {
      grupo: g,
      prueba: 'Profundidad',
      valor: `${gl.getParameter(gl.DEPTH_BITS)} bits`,
      detalle: `float alto en fragmentos: ${alta && alta.precision > 0 ? `${alta.precision} bits` : 'no'}`,
      estado: (gl.getParameter(gl.DEPTH_BITS) as number) < 24 ? 'aviso' : 'ok',
    },
    { grupo: g, prueba: 'Anisotropía', valor: aniso ? `×${gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}` : 'no', estado: 'ok' },
    { grupo: g, prueba: 'Compilación paralela', valor: gl.getExtension('KHR_parallel_shader_compile') ? 'sí' : 'no', detalle: 'KHR_parallel_shader_compile', estado: 'ok' },
  ];
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return res;
}

// ------------------------------------------------------------------ 3D component viewer

export async function visor3d(ctx: ContextoPrueba, tipo = 'qfp'): Promise<Resultado[]> {
  const g = 'Visor 3D de componentes';
  ctx.avisar('Visor 3D: cargando three.js y el modelo…');
  const t0 = performance.now();
  const [{ Visor }, M] = await Promise.all([import('../tres/motor/visor'), import('../tres/modelos')]);
  const t1 = performance.now();
  const est = globalThis as unknown as { __epa3d?: { n: number; total: number; resolucion?: { base: number; actual: number; minima: number; cambios: number } } };
  // One view: build, programs (0.8: compiled before the first frame), first frame; `girarlo` also turns it.
  const vista = async (girarlo: boolean) => {
    const l = lienzo(ctx);
    const visor = new Visor(l.c, l.capa);
    try {
      const a = performance.now();
      const modelo = M.crearModelo(tipo, {});
      const b = performance.now();
      visor.ponerFondo(app.tema === 'oscuro' ? '#23272e' : '#eeece6', app.tema === 'oscuro');
      const n0 = est.__epa3d?.n ?? 0;
      visor.ponerModelo(modelo);
      await hasta(() => (est.__epa3d?.n ?? 0) > n0, 60_000, ctx.cancelada);
      const c = performance.now();
      const p = { ...visor.preparacion };
      let giro: { fps: number; p95: number; cpu: number; res?: { base: number; minima: number; cambios: number } } | null = null;
      if (girarlo && !ctx.cancelada()) {
        ctx.avisar(`Visor 3D: girando el modelo ${ctx.segundos} s…`);
        const s0 = { n: est.__epa3d?.n ?? 0, total: est.__epa3d?.total ?? 0 };
        const r = await girar(l.c, ctx.segundos, () => est.__epa3d?.n ?? 0, ctx.cancelada);
        const n = (est.__epa3d?.n ?? 0) - s0.n;
        giro = { fps: r.fps, p95: r.p95, cpu: n ? ((est.__epa3d?.total ?? 0) - s0.total) / n : 0, res: est.__epa3d?.resolucion ? { ...est.__epa3d.resolucion } : undefined };
        // Back at rest: full resolution again? (a slow GPU may take a few frames to get there)
        await hasta(() => !est.__epa3d?.resolucion || est.__epa3d.resolucion.actual === est.__epa3d.resolucion.base, 10_000, ctx.cancelada);
      }
      const reposo = est.__epa3d?.resolucion?.actual;
      return { construir: b - a, primero: c - b, p, giro, reposo, triangulos: (modelo.userData as { triangulos?: number }).triangulos };
    } finally {
      visor.liberar();
      l.quitar();
    }
  };
  const fria = await vista(true);
  if (ctx.cancelada()) return [];
  ctx.avisar('Visor 3D: una segunda vista del mismo modelo (programas ya vistos por el controlador)…');
  const segunda = await vista(false);
  const res: Resultado[] = [
    { grupo: g, prueba: 'Carga del módulo 3D', valor: ms(t1 - t0), detalle: 'three.js y la biblioteca de modelos', estado: 'ok' },
    {
      grupo: g,
      prueba: `Modelo «${tipo}», primera vista`,
      valor: ms(fria.primero),
      detalle: `hasta el primer cuadro: sombreadores ${ms(fria.p.compilar)} (${fria.p.programas} programas, compilación ${fria.p.paralela ? 'en paralelo' : 'sin KHR_parallel_shader_compile'}); modelo ${ms(fria.construir)}, ${fria.triangulos ?? '?'} triángulos`,
      estado: fria.primero < 1000 ? 'ok' : 'aviso',
    },
    {
      grupo: g,
      prueba: 'Segunda vista (otro contexto WebGL)',
      valor: ms(segunda.primero),
      detalle: `sombreadores ${ms(segunda.p.compilar)}; lo que el controlador de la GPU ya tenía compilado`,
      estado: 'ok',
    },
  ];
  const r = fria.giro;
  if (r) {
    res.push({
      grupo: g,
      prueba: 'Al girar',
      valor: `${coma(r.fps)} cuadros/s`,
      detalle: `p95 entre cuadros ${ms(r.p95)}, render ${ms(r.cpu)} de CPU`,
      estado: r.fps >= 45 ? 'ok' : r.fps >= 25 ? 'aviso' : 'error',
    });
    if (r.res)
      res.push({
        grupo: g,
        prueba: 'Resolución al girar',
        valor: r.res.cambios ? `${mpx(r.res.base)} → ${mpx(r.res.minima)}` : `${mpx(r.res.base)} fija`,
        detalle: `${r.res.cambios ? `${r.res.cambios} cambios mientras gira; ` : 'no hizo falta bajarla; '}en reposo ${fria.reposo != null ? mpx(fria.reposo) : '?'}`,
        estado: fria.reposo != null && Math.abs(fria.reposo - r.res.base) > 1e-3 ? 'aviso' : 'ok',
      });
  }
  return res;
}

// ------------------------------------------------------------------ SDR board

export async function placaSdr(ctx: ContextoPrueba, id = 'sdr'): Promise<Resultado[]> {
  const g = 'Placa KiCad (SDR)';
  ctx.avisar('Placa SDR: descargando los datos…');
  const t0 = performance.now();
  const [{ cargarPlaca }, { construirGeometria }, { Escena3D }] = await Promise.all([import('../proyectos/datos'), import('../proyectos/geometria'), import('../proyectos/escena3d')]);
  const d = await cargarPlaca(id);
  const t1 = performance.now();
  const geo = construirGeometria(d);
  const t2 = performance.now();
  const l = lienzo(ctx);
  let escena: InstanceType<typeof Escena3D> | null = null;
  try {
    ctx.avisar('Placa SDR: pintando las caras y colocando los componentes…');
    ctx.miga?.('caras');
    escena = new Escena3D(l.c, d, geo, app.tema === 'oscuro');
    const r0 = l.caja.getBoundingClientRect();
    escena.tamano(r0.width, r0.height);
    const t3 = performance.now();
    const st = escena.stats;
    // 0.8: the board's programs are compiled before its first frame; wait for that frame.
    await hasta(() => st.cuadros > 0, 60_000, ctx.cancelada);
    const t4 = performance.now();
    await escena.cargarPiezas({ alFase: ctx.miga });
    ctx.miga?.('primer cuadro');
    await cuadros(2);
    const t5 = performance.now();
    if (ctx.cancelada()) return [];
    ctx.avisar('Placa SDR: esperando las caras a resolución completa…');
    await hasta(() => st.carasFinas != null, 120_000, ctx.cancelada);
    await cuadros(2);
    ctx.avisar(`Placa SDR: girando la placa ${ctx.segundos} s…`);
    const ms0 = st.ms.length;
    const r = await girar(l.c, ctx.segundos, () => escena?.stats.cuadros ?? 0, ctx.cancelada);
    const render = st.ms.slice(Math.min(ms0, st.ms.length));
    const resGiro = st.resolucion ? { ...st.resolucion } : null;
    await hasta(() => !st.resolucion || st.resolucion.actual === st.resolucion.base, 10_000, ctx.cancelada);
    const reposo = st.resolucion?.actual;
    const f = st.fases;
    const fc = st.fasesCaras;
    const c = fc?.completa;
    const res: Resultado[] = [
      { grupo: g, prueba: 'Datos y geometría', valor: ms(t2 - t0), detalle: `descarga ${ms(t1 - t0)}, trazados ${ms(t2 - t1)}`, estado: 'ok' },
      {
        grupo: g,
        prueba: 'Placa visible',
        valor: seg(t4 - t0),
        detalle: `escena ${ms(t3 - t2)}; sombreadores de la placa ${ms(st.compilarPlaca ?? 0)}; caras a ¼ (${fc?.modo ?? '?'}): pintar ${ms(fc?.cuarto.pintar ?? 0)}, leer ${ms(fc?.cuarto.leer ?? 0)}, subir ${ms(fc?.cuarto.subir ?? 0)}`,
        estado: 'ok',
      },
      {
        grupo: g,
        prueba: 'Placa con componentes',
        valor: seg(t5 - t0),
        detalle: `${st.piezas.biblioteca + st.piezas.propias} piezas${f ? `, ${f.modelosUnicos} modelos distintos; modelos ${ms(f.modelos)}, unión ${ms(f.fusion)}, sombreadores ${ms(f.compilar ?? 0)}${st.programas ? ` (${st.programas} programas)` : ''}; tramo más largo ${ms(f.maxTramo ?? 0)}` : ''}`,
        estado: t5 - t0 < 4000 ? 'ok' : t5 - t0 < 10000 ? 'aviso' : 'error',
      },
    ];
    if (c)
      res.push({
        grupo: g,
        prueba: 'Caras a resolución completa',
        valor: ms(c.total),
        detalle: `modo ${c.modo}${c.motivo ? ` (${c.motivo})` : ''}; hilo de la página ${ms(st.textura)}, tarea más larga ${ms(c.maxTarea)}; ${c.modo === 'directo' ? `pintar ${ms(c.pintar)}, subir ${ms(c.subir)}` : `pintar ${ms(c.pintar)}, leer ${ms(c.leer)}, voltear ${ms(c.voltear)}${c.modo === 'trabajador' ? `, geometría ${ms(c.geometria)}, primera cara a los ${ms(c.espera)}` : ''}; subir ${ms(c.subir)} en ${c.franjas} franjas, espera a la GPU ${ms(c.gpu)}`}`,
        estado: c.maxTarea < 50 ? 'ok' : c.maxTarea < 200 ? 'aviso' : 'error',
      });
    res.push({
      grupo: g,
      prueba: 'Al girar',
      valor: `${coma(r.fps)} cuadros/s`,
      detalle: `p95 entre cuadros ${ms(r.p95)}, render ${ms(render.reduce((a, b) => a + b, 0) / Math.max(1, render.length))} de CPU; ${st.llamadas} llamadas, ${Math.round(st.triangulos / 1000)} k triángulos`,
      estado: r.fps >= 45 ? 'ok' : r.fps >= 25 ? 'aviso' : 'error',
    });
    if (resGiro)
      res.push({
        grupo: g,
        prueba: 'Resolución al girar',
        valor: resGiro.cambios ? `${mpx(resGiro.base)} → ${mpx(resGiro.minima)}` : `${mpx(resGiro.base)} fija`,
        detalle: `${resGiro.cambios ? `${resGiro.cambios} cambios mientras gira, intervalo ${ms(resGiro.intervalo)}; ` : 'no hizo falta bajarla; '}en reposo ${reposo != null ? mpx(reposo) : '?'}`,
        estado: reposo != null && Math.abs(reposo - resGiro.base) > 1e-3 ? 'aviso' : 'ok',
      });
    return res;
  } finally {
    escena?.liberar();
    l.quitar();
    // Time for the dropped context and its textures to be given back before the next test builds a view.
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/**
 * 0.8: the SDR board's faces painted at full resolution by each of the three ways (escena3d.ts, ModoCaras), one
 * new view each, without the parts: time to both faces on screen, page-thread time and the page's longest gap
 * meanwhile (a timer chain), so the WebView's best way can be read off on the device itself.
 */
export async function carasSdr(ctx: ContextoPrueba, id = 'sdr'): Promise<Resultado[]> {
  const g = 'Caras de la placa SDR (resolución completa)';
  const [{ cargarPlaca }, { construirGeometria }, { Escena3D, modoCarasPorDefecto }] = await Promise.all([
    import('../proyectos/datos'),
    import('../proyectos/geometria'),
    import('../proyectos/escena3d'),
  ]);
  const d = await cargarPlaca(id);
  const geo = construirGeometria(d);
  const res: Resultado[] = [];
  const porDefecto = modoCarasPorDefecto();
  // The worker and the strips exist for WebKit (Mac, iPhone). Where the faces are painted directly (Chromium:
  // Android, Windows) the previous test («Placa SDR en 3D») has already measured them in that mode, and a second
  // full board right after the first one closed the app on the Xiaomi Pad 6 (0.8.0: the WebView's GPU memory
  // had not been given back yet). So this test only runs where it tells something new.
  if (porDefecto === 'directo') {
    for (const modo of ['directo', 'trabajador', 'franjas'] as const)
      res.push({
        grupo: g,
        prueba: modo,
        valor: modo === 'directo' ? 'en «Placa SDR»' : 'no se mide aquí',
        detalle:
          modo === 'directo'
            ? 'Es el modo de este dispositivo: lo mide la prueba «Placa SDR en 3D» (fila «Caras a resolución completa»).'
            : 'Solo se usa en WebKit (Mac, iPhone); este dispositivo pinta las caras en el modo directo.',
        estado: 'omitida',
      });
    return res;
  }
  for (const modo of ['directo', 'trabajador', 'franjas'] as const) {
    if (ctx.cancelada()) break;
    ctx.avisar(`Caras de la placa: modo «${modo}»…`);
    const l = lienzo(ctx);
    let escena: InstanceType<typeof Escena3D> | null = null;
    try {
      escena = new Escena3D(l.c, d, geo, app.tema === 'oscuro', { modoCaras: modo });
      const r0 = l.caja.getBoundingClientRect();
      escena.tamano(r0.width, r0.height);
      const st = escena.stats;
      await hasta(() => st.cuadros > 0, 60_000, ctx.cancelada);
      await cuadros(2);
      const e = escena;
      const { max } = await conLatido(async () => {
        await e.refinarCaras();
        await hasta(() => st.carasFinas != null, 120_000, ctx.cancelada);
        await cuadros(2);
      });
      const c = st.fasesCaras?.completa;
      const q = st.fasesCaras?.cuarto;
      res.push({
        grupo: g,
        prueba: `${modo}${modo === porDefecto ? ' (el de este dispositivo)' : ''}`,
        valor: c ? ms(c.total) : 'sin datos',
        detalle: c
          ? `hilo de la página ${ms(c.modo === 'trabajador' ? c.subir : c.pintar + c.leer + c.subir)}, hueco más largo de la página ${ms(max)}${c.modo !== modo ? `; usó «${c.modo}»${c.motivo ? ` (${c.motivo})` : ''}` : ''}; pintar ${ms(c.pintar)}, leer ${ms(c.leer)}, subir ${ms(c.subir)}${c.franjas ? ` en ${c.franjas} franjas` : ''}${c.gpu ? `, espera a la GPU ${ms(c.gpu)}` : ''}; ¼: ${ms((q?.pintar ?? 0) + (q?.leer ?? 0) + (q?.subir ?? 0))}`
          : undefined,
        estado: !c ? 'error' : max < 60 ? 'ok' : max < 250 ? 'aviso' : 'error',
      });
    } finally {
      escena?.liberar();
      l.quitar();
    }
    // Time for the dropped context and textures to be reclaimed before the next view is created.
    await new Promise((r) => setTimeout(r, 1000));
  }
  return res;
}

// ------------------------------------------------------------------ a console board (0.9)

/**
 * 0.9: the Neo Geo board in 3D (the one that froze the Xiaomi Pad 6 in 0.8.2), loaded as the consoles' tab
 * does, with breadcrumbs before every phase («datos», «geometría», «caras», «pieza 237: R1», «uniendo»,
 * «compilando», «primer cuadro»…) and the longest gap of the page's thread over the whole load.
 */
export async function placaConsola(ctx: ContextoPrueba, id = 'neogeo'): Promise<Resultado[]> {
  const g = 'Placa de consola en 3D (Neo Geo)';
  const miga = ctx.miga ?? (() => {});
  ctx.avisar('Placa de la Neo Geo: descargando los datos…');
  const t0 = performance.now();
  miga('datos');
  const [{ cargarPlacaConsola }, { construirGeometria }, { Escena3D }] = await Promise.all([
    import('../consolas/placa/datos'),
    import('../proyectos/geometria'),
    import('../proyectos/escena3d'),
  ]);
  const d = await cargarPlacaConsola(id);
  const t1 = performance.now();
  miga('geometría');
  const geo = construirGeometria(d);
  const t2 = performance.now();
  const l = lienzo(ctx);
  // (a holder: the scene is created inside the timed function)
  const v: { escena: InstanceType<typeof Escena3D> | null } = { escena: null };
  try {
    miga('caras');
    ctx.avisar('Placa de la Neo Geo: pintando las caras y colocando los componentes…');
    let tPlaca = 0;
    let tPiezas = 0;
    let tCuadro = 0;
    const { max } = await conLatido(async () => {
      const e = new Escena3D(l.c, d, geo, app.tema === 'oscuro');
      v.escena = e;
      const r0 = l.caja.getBoundingClientRect();
      e.tamano(r0.width, r0.height);
      miga('primer cuadro de la placa');
      await hasta(() => e.stats.cuadros > 0, 120_000, ctx.cancelada);
      tPlaca = performance.now();
      await e.cargarPiezas({ alFase: miga });
      tPiezas = performance.now();
      miga('primer cuadro');
      await hasta(() => !!e.stats.fases?.primerCuadro, 120_000, ctx.cancelada);
      tCuadro = performance.now();
      miga('caras a resolución completa');
      await hasta(() => e.stats.carasFinas != null, 120_000, ctx.cancelada);
      await cuadros(2);
    });
    if (ctx.cancelada() || !v.escena) return [];
    const st = v.escena.stats;
    const f = st.fases;
    const rv = st.revision;
    const cp = st.compilacion;
    const fc = st.fasesCaras?.completa;
    const problemas = rv ? [...rv.noFinitas, ...rv.enormes, ...rv.pinesDistintos, ...rv.patasFuera] : [];
    return [
      { grupo: g, prueba: 'Datos y geometría', valor: ms(t2 - t0), detalle: `descarga ${ms(t1 - t0)}, trazados ${ms(t2 - t1)}; ${d.huellas.length} huellas, ${d.pads.length} pads`, estado: 'ok' },
      { grupo: g, prueba: 'Placa visible', valor: seg(tPlaca - t0), detalle: `sombreadores de la placa ${ms(st.compilarPlaca ?? 0)}`, estado: tPlaca - t0 < 4000 ? 'ok' : 'aviso' },
      {
        grupo: g,
        prueba: 'Placa con componentes',
        valor: seg(tCuadro - t0),
        detalle: `${st.piezas.biblioteca + st.piezas.propias} piezas${f ? `, ${f.modelosUnicos} modelos distintos; modelos ${ms(f.modelos)}, unión ${ms(f.fusion)}, sombreadores ${ms(f.compilar)}` : ''}${cp ? ` (${cp.paralela ? 'en paralelo' : `${cp.programas} programas, uno por tarea, el más largo ${ms(cp.maxPrograma)}`})` : ''}; tramo más largo de las piezas ${ms(f?.maxTramo ?? 0)}; primer cuadro con ellas ${ms(f?.primerCuadro ?? tCuadro - tPiezas)}`,
        estado: tCuadro - t0 < 6000 ? 'ok' : tCuadro - t0 < 15000 ? 'aviso' : 'error',
      },
      {
        grupo: g,
        prueba: 'Hueco más largo de la página',
        valor: ms(max),
        detalle: 'la tarea más larga del hilo de la página durante toda la carga (pintar, piezas, sombreadores, caras)',
        estado: max < 100 ? 'ok' : max < 500 ? 'aviso' : 'error',
      },
      ...(fc ? [{ grupo: g, prueba: 'Caras a resolución completa', valor: ms(fc.total), detalle: `modo ${fc.modo}; tarea más larga ${ms(fc.maxTarea)}`, estado: (fc.maxTarea < 50 ? 'ok' : fc.maxTarea < 200 ? 'aviso' : 'error') as Estado }] : []),
      {
        grupo: g,
        prueba: 'Revisión de las piezas',
        valor: problemas.length ? `${problemas.length} piezas con otro cuerpo` : 'sin problemas',
        detalle: rv
          ? `${rv.plantillas} modelos, ${Math.round(rv.triangulos / 1000)} k triángulos, ${rv.fusionNoFinitos} valores no finitos${problemas.length ? `; ${problemas.join(', ')}` : ''}`
          : undefined,
        estado: !rv || rv.fusionNoFinitos || rv.noFinitas.length ? 'error' : 'ok',
      },
    ];
  } finally {
    v.escena?.liberar();
    l.quitar();
    // Time for the dropped context and its textures to be given back before the next test builds a view.
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ------------------------------------------------------------------ automatic schematics

const NETLISTS_ESQUEMA = ['cap50/rectificador', 'cap06/fig-6.13_configuraciones', 'cap08/fig-8.3', 'cap29/prob-29.C-decodificador'];

export async function esquemaVivo(ctx: ContextoPrueba): Promise<Resultado[]> {
  const g = 'Esquema automático (en vivo)';
  ctx.avisar('Esquemas automáticos: trazando cuatro circuitos grandes…');
  const [{ generarEsquema, olvidarDibujos }] = await Promise.all([import('../esquema-auto/generar')]);
  const res: Resultado[] = [];
  const base = document.baseURI;
  // Warm-up (JIT), as in a running app.
  generarEsquema('* calentamiento\nV1 a 0 1\nR1 a b 1k\nC1 b 0 1n\n.end\n');
  for (const id of NETLISTS_ESQUEMA) {
    if (ctx.cancelada()) break;
    const texto = await (await fetch(new URL(`libro/spice/${id}.cir`, base))).text();
    olvidarDibujos();
    await cuadro();
    const t0 = performance.now();
    const a = generarEsquema(texto, { esfuerzo: 1 });
    const t = performance.now() - t0;
    const e = a?.estadisticas;
    res.push({
      grupo: g,
      prueba: id,
      valor: ms(t),
      detalle: e ? `${e.unidades} piezas, ${e.cruces} cruces, ${e.etiquetasRed} etiquetas de red` : 'sin esquema',
      estado: !a ? 'error' : t < 400 ? 'ok' : 'aviso',
    });
  }
  return res;
}

// ------------------------------------------------------------------ ngspice

export async function simulacion(ctx: ContextoPrueba): Promise<Resultado[]> {
  const g = 'Simulación (ngspice)';
  ctx.avisar('ngspice: descargando y compilando el motor…');
  const { simularTexto } = await import('../../simulador/cliente.svelte');
  const texto = await (await fetch(new URL('libro/spice/cap03/fig-3.1_carga_descarga_rc.cir', document.baseURI))).text();
  const t0 = performance.now();
  const a = await simularTexto(texto);
  const t1 = performance.now();
  if (ctx.cancelada()) return [];
  ctx.avisar('ngspice: segunda simulación (motor ya cargado)…');
  const b = await simularTexto(texto);
  const t2 = performance.now();
  const ok = !a.ejecucion.fallo && !b.ejecucion.fallo;
  return [
    { grupo: g, prueba: 'Primera (con descarga y compilación)', valor: ms(t1 - t0), detalle: 'fig. 3.1: carga y descarga RC, transitorio de 10 s', estado: ok ? 'ok' : 'error' },
    { grupo: g, prueba: 'Segunda (motor cargado)', valor: ms(t2 - t1), detalle: `ngspice ${ms(b.ejecucion.ms)}`, estado: ok ? (t2 - t1 < 1500 ? 'ok' : 'aviso') : 'error' },
  ];
}

// ------------------------------------------------------------------ plain text for the chat

export function textoResultados(res: Resultado[], version: string): string {
  const fecha = new Date().toLocaleString('es-ES');
  const lineas = [`Diagnóstico de rendimiento · Electrónica Práctica Avanzada ${version} · ${fecha}`];
  let grupo = '';
  for (const r of res) {
    if (r.grupo !== grupo) {
      grupo = r.grupo;
      lineas.push('', `${grupo}:`);
    }
    const marca = r.estado === 'error' ? ' [!]' : r.estado === 'aviso' ? ' [?]' : '';
    lineas.push(`- ${r.prueba}: ${r.valor}${r.detalle ? ` (${r.detalle})` : ''}${marca}`);
  }
  return lineas.join('\n');
}
