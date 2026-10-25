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
  ev('pointerup', x0, y0);
  const t1 = performance.now();
  const d: number[] = [];
  for (let i = 1; i < marcas.length; i++) d.push(marcas[i]! - marcas[i - 1]!);
  return { fps: ((dibujados() - n0) * 1000) / (t1 - t0), p95: percentil(d, 0.95), marcas: marcas.length };
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
  const l = lienzo(ctx);
  const visor = new Visor(l.c, l.capa);
  try {
    const t2 = performance.now();
    const modelo = M.crearModelo(tipo, {});
    const t3 = performance.now();
    visor.ponerFondo(app.tema === 'oscuro' ? '#23272e' : '#eeece6', app.tema === 'oscuro');
    visor.ponerModelo(modelo);
    const est = globalThis as unknown as { __epa3d?: { n: number; total: number } };
    await cuadros(3);
    const t4 = performance.now();
    if (ctx.cancelada()) return [];
    ctx.avisar(`Visor 3D: girando el modelo ${ctx.segundos} s…`);
    const s0 = { n: est.__epa3d?.n ?? 0, total: est.__epa3d?.total ?? 0 };
    const r = await girar(l.c, ctx.segundos, () => est.__epa3d?.n ?? 0, ctx.cancelada);
    const n = (est.__epa3d?.n ?? 0) - s0.n;
    const cpu = n ? ((est.__epa3d?.total ?? 0) - s0.total) / n : 0;
    const datos = modelo.userData as { triangulos?: number };
    return [
      { grupo: g, prueba: 'Carga del módulo 3D', valor: ms(t1 - t0), detalle: 'three.js y la biblioteca de modelos', estado: 'ok' },
      { grupo: g, prueba: `Modelo «${tipo}»`, valor: ms(t3 - t2), detalle: `${datos.triangulos ?? '?'} triángulos; primer cuadro ${ms(t4 - t3)}`, estado: 'ok' },
      {
        grupo: g,
        prueba: 'Al girar',
        valor: `${coma(r.fps)} cuadros/s`,
        detalle: `p95 entre cuadros ${ms(r.p95)}, render ${ms(cpu)} de CPU`,
        estado: r.fps >= 45 ? 'ok' : r.fps >= 25 ? 'aviso' : 'error',
      },
    ];
  } finally {
    visor.liberar();
    l.quitar();
  }
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
    escena = new Escena3D(l.c, d, geo, app.tema === 'oscuro');
    const r0 = l.caja.getBoundingClientRect();
    escena.tamano(r0.width, r0.height);
    const t3 = performance.now();
    await cuadros(2);
    const t4 = performance.now();
    await escena.cargarPiezas();
    await cuadros(2);
    const t5 = performance.now();
    if (ctx.cancelada()) return [];
    const st = escena.stats;
    ctx.avisar(`Placa SDR: girando la placa ${ctx.segundos} s…`);
    const n0 = st.cuadros ?? 0;
    const ms0 = st.ms.length;
    const r = await girar(l.c, ctx.segundos, () => escena?.stats.cuadros ?? 0, ctx.cancelada);
    const render = st.ms.slice(Math.min(ms0, st.ms.length));
    void n0;
    const f = st.fases;
    return [
      { grupo: g, prueba: 'Datos y geometría', valor: ms(t2 - t0), detalle: `descarga ${ms(t1 - t0)}, trazados ${ms(t2 - t1)}`, estado: 'ok' },
      { grupo: g, prueba: 'Placa visible', valor: seg(t4 - t0), detalle: `${st.textura ? `texturas de las caras ${ms(st.textura)}` : 'caras a ¼ de resolución (las completas, después)'}; escena ${ms(t3 - t2)}`, estado: 'ok' },
      {
        grupo: g,
        prueba: 'Placa con componentes',
        valor: seg(t5 - t0),
        detalle: `${st.piezas.biblioteca + st.piezas.propias} piezas${f ? `, ${f.modelosUnicos} modelos distintos; modelos ${ms(f.modelos)}, unión ${ms(f.fusion)}, sombreadores ${ms(f.compilar ?? 0)}${st.programas ? ` (${st.programas} programas)` : ''}` : ''}`,
        estado: t5 - t0 < 4000 ? 'ok' : t5 - t0 < 10000 ? 'aviso' : 'error',
      },
      {
        grupo: g,
        prueba: 'Al girar',
        valor: `${coma(r.fps)} cuadros/s`,
        detalle: `p95 entre cuadros ${ms(r.p95)}, render ${ms(render.reduce((a, b) => a + b, 0) / Math.max(1, render.length))} de CPU; ${st.llamadas} llamadas, ${Math.round(st.triangulos / 1000)} k triángulos`,
        estado: r.fps >= 45 ? 'ok' : r.fps >= 25 ? 'aviso' : 'error',
      },
    ];
  } finally {
    escena?.liberar();
    l.quitar();
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
