// In-page probe of the QA harness, installed before the app's scripts (page.addInitScript): layout shifts
// (CLS), long tasks, WebGL contexts, and «flashes» — elements that appear and disappear within a second inside
// stable content, like the 0.10.0 «Simulando con ngspice…» line that pushed the page down and up on the tablet.
// Everything is kept in window.__qa; the harness reads and resets it per route (marcar()).
// The function is serialised by Playwright: it must not reference anything outside itself.

export interface Destello {
  t: number;
  ms: number;
  texto: string;
  firma: string;
  alto: number;
}

export interface EstadoSonda {
  inicio: number;
  ultimaMutacion: number;
  desplazamientos: { t: number; valor: number; fuentes: string[] }[];
  tareasLargas: { t: number; ms: number }[];
  destellos: Destello[];
  contextosCreados: number;
  /** Canvases whose WebGL context exists, is not lost and is still in the document. */
  contextosVivos: () => number;
  /** Canvases out of the document whose WebGL context was never released (GPU memory kept). */
  contextosHuerfanos: () => number;
  marcar: () => void;
  firma: (el: Element) => string;
}

export function instalarSonda(): void {
  const w = window as unknown as { __qa?: EstadoSonda };
  if (w.__qa) return;

  /** Short CSS-like path of an element: up to three ancestors, tag and first class. */
  const firma = (el: Element): string => {
    const partes: string[] = [];
    let e: Element | null = el;
    for (let k = 0; e && k < 4 && e !== document.body; k++, e = e.parentElement) {
      const cls = [...e.classList].filter((c) => !/^s-|^svelte-/.test(c)).slice(0, 2);
      const datos = [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-') && n !== 'data-tema').slice(0, 1);
      partes.unshift(e.tagName.toLowerCase() + cls.map((c) => `.${c}`).join('') + datos.map((d) => `[${d}]`).join(''));
    }
    return partes.join(' > ');
  };

  const qa: EstadoSonda = {
    inicio: performance.now(),
    ultimaMutacion: performance.now(),
    desplazamientos: [],
    tareasLargas: [],
    destellos: [],
    contextosCreados: 0,
    contextosVivos: () => 0,
    contextosHuerfanos: () => 0,
    marcar() {
      qa.inicio = performance.now();
      qa.desplazamientos = [];
      qa.tareasLargas = [];
      qa.destellos = [];
    },
    firma,
  };
  w.__qa = qa;

  // ---- layout shifts and long tasks
  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node | null }[] })[]) {
        if (e.hadRecentInput) continue;
        const fuentes = (e.sources ?? []).map((s) => (s.node && s.node.nodeType === 1 ? firma(s.node as Element) : s.node ? '#texto' : '?')).slice(0, 4);
        qa.desplazamientos.push({ t: e.startTime, valor: e.value, fuentes });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* not supported */
  }
  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) qa.tareasLargas.push({ t: e.startTime, ms: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* not supported */
  }

  // ---- WebGL contexts
  const lienzos = new Set<WeakRef<HTMLCanvasElement>>();
  const original = HTMLCanvasElement.prototype.getContext;
  const conGL = new WeakSet<HTMLCanvasElement>();
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
    const ctx = (original as (...a: unknown[]) => unknown).call(this, tipo, ...resto);
    if (ctx && /webgl/.test(tipo) && !conGL.has(this)) {
      conGL.add(this);
      lienzos.add(new WeakRef(this));
      qa.contextosCreados++;
    }
    return ctx;
  } as typeof original;
  qa.contextosVivos = () => {
    let n = 0;
    for (const ref of lienzos) {
      const c = ref.deref();
      if (!c) {
        lienzos.delete(ref);
        continue;
      }
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
      if (gl && !gl.isContextLost() && c.isConnected) n++;
    }
    return n;
  };

  qa.contextosHuerfanos = () => {
    let n = 0;
    for (const ref of lienzos) {
      const c = ref.deref();
      if (!c || c.isConnected) continue;
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
      if (gl && !gl.isContextLost()) n++;
    }
    return n;
  };

  // ---- flashes: elements added and removed within 1 s while stable siblings stay around them
  interface Visto {
    t: number;
    medido: boolean;
    visible: boolean;
    enFlujo: boolean;
    texto: string;
    alto: number;
    padre: Element | null;
    /** Height of the parent while the element was there. */
    altoPadre: number;
    hermanos: Element[];
  }
  const vistos = new Map<Element, Visto>();
  const pendientes: Element[] = [];
  let programado = false;
  const dentroDeGrafico = (el: Element) => !!el.closest('svg, canvas');

  const medir = () => {
    programado = false;
    for (const el of pendientes.splice(0)) {
      const v = vistos.get(el);
      if (!v || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      v.medido = true;
      v.visible = r.width > 0 && r.height > 2 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && cs.display !== 'none';
      v.enFlujo = cs.position === 'static' || cs.position === 'relative';
      v.alto = Math.round(r.height);
      v.texto = ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      v.padre = el.parentElement;
      v.altoPadre = v.padre?.getBoundingClientRect().height ?? 0;
      // siblings that were already there (not added in this batch): the content the element pushes
      v.hermanos = v.padre ? [...v.padre.children].filter((h) => h !== el && !vistos.has(h)) : [];
    }
  };

  const revisarRetirados = (ahora: number) => {
    for (const [el, v] of vistos) {
      const edad = ahora - v.t;
      if (!el.isConnected) {
        vistos.delete(el);
        // (an element of the previous route that leaves when the next one opens is navigation, not a flash: only
        // what appeared after the current route's mark counts)
        if (edad < 1000 && v.t >= qa.inicio && v.medido && v.visible && v.enFlujo && (v.texto || v.alto > 8)) {
          // only when it intruded into content that is still there: a loading placeholder replaced by the
          // page is not a flash
          const estables = v.hermanos.filter((h) => h.isConnected && h.parentElement === v.padre);
          // swapped in the same place for an element of the same height (Simular ↔ Detener) or of the same kind (a
          // placeholder replaced by what it stood for): not a flash
          const relevo = [...vistos].some(
            ([o, w]) =>
              o !== el &&
              o.isConnected &&
              o.parentElement === v.padre &&
              ahora - w.t < 50 &&
              (Math.abs(o.getBoundingClientRect().height - v.alto) <= 4 || (o.tagName === el.tagName && o.classList[0] !== undefined && o.classList[0] === el.classList[0])),
          );
          // and its going changed the parent's height: it pushed the content (an inline status in a row does not)
          const empujo = !!v.padre?.isConnected && Math.abs(v.padre.getBoundingClientRect().height - v.altoPadre) >= 3;
          if (v.padre?.isConnected && estables.length && !relevo && empujo)
            qa.destellos.push({ t: v.t, ms: Math.round(edad), texto: v.texto, firma: `${firma(v.padre)} > ${firma(el).split(' > ').pop()}`, alto: v.alto });
        }
      } else if (edad > 1500) vistos.delete(el);
    }
  };

  const observador = new MutationObserver((muts) => {
    const ahora = performance.now();
    let relevante = false;
    for (const m of muts) {
      if (m.target.nodeType === 1 && dentroDeGrafico(m.target as Element)) continue;
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        const el = n as Element;
        if (dentroDeGrafico(el) || el.tagName === 'SVG' || el.tagName === 'svg' || el.tagName === 'CANVAS' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
        relevante = true;
        // the outermost added element only
        if (el.parentElement && vistos.has(el.parentElement) && ahora - vistos.get(el.parentElement)!.t < 5) continue;
        vistos.set(el, { t: ahora, medido: false, visible: false, enFlujo: false, texto: '', alto: 0, padre: null, altoPadre: 0, hermanos: [] });
        pendientes.push(el);
      }
      if (m.removedNodes.length) relevante = true;
    }
    if (relevante) qa.ultimaMutacion = ahora;
    revisarRetirados(ahora);
    if (pendientes.length && !programado) {
      programado = true;
      requestAnimationFrame(medir);
    }
  });
  const arrancar = () => observador.observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) arrancar();
  else document.addEventListener('DOMContentLoaded', arrancar);
}

export interface RecursosVivos {
  audio: number;
  trabajadores: number;
  intervalos: number;
  rafPorSegundo: number;
  lienzos: number;
  webgl: number;
  webglHuerfanos: number;
}

/**
 * Phase 2 (leaks): counts the resources a page keeps after it is left — AudioContexts not closed, Workers not
 * terminated, intervals not cleared, requestAnimationFrame loops still running, canvases and WebGL contexts.
 * Installed with page.addInitScript, after instalarSonda; read with window.__qaRecursos().
 */
export function instalarSondaRecursos(): void {
  const w = window as unknown as Record<string, unknown> & { __qaRecursos?: () => Promise<RecursosVivos> };
  if (w.__qaRecursos) return;
  const audios = new Set<{ state: string }>();
  const AC = (window as unknown as { AudioContext?: new (...a: unknown[]) => { state: string } }).AudioContext;
  if (AC) {
    const Envuelto = function (this: unknown, ...a: unknown[]) {
      const c = new AC(...a);
      audios.add(c);
      return c;
    } as unknown as typeof AC;
    Envuelto.prototype = AC.prototype;
    (window as unknown as { AudioContext: unknown }).AudioContext = Envuelto;
    (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = Envuelto;
  }
  const trabajadores = new Set<Worker>();
  const W0 = window.Worker;
  const WEnv = function (this: unknown, url: string | URL, op?: WorkerOptions) {
    const t = new W0(url, op);
    trabajadores.add(t);
    const fin = t.terminate.bind(t);
    t.terminate = () => {
      trabajadores.delete(t);
      fin();
    };
    return t;
  } as unknown as typeof Worker;
  WEnv.prototype = W0.prototype;
  window.Worker = WEnv;
  const intervalos = new Set<number>();
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  window.setInterval = ((f: TimerHandler, ms?: number, ...a: unknown[]) => {
    const id = si(f, ms, ...a);
    intervalos.add(id);
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = ((id?: number) => {
    if (id !== undefined) intervalos.delete(id);
    ci(id);
  }) as typeof window.clearInterval;
  let rafs = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f: FrameRequestCallback) =>
    raf((t) => {
      rafs++;
      f(t);
    });
  w.__qaRecursos = async () => {
    const a = rafs;
    await new Promise((r) => setTimeout(r, 1000));
    const qa = (window as unknown as { __qa?: { contextosVivos: () => number; contextosHuerfanos: () => number } }).__qa;
    return {
      audio: [...audios].filter((c) => c.state !== 'closed').length,
      trabajadores: trabajadores.size,
      intervalos: intervalos.size,
      rafPorSegundo: rafs - a,
      lienzos: document.querySelectorAll('canvas').length,
      webgl: qa?.contextosVivos() ?? 0,
      webglHuerfanos: qa?.contextosHuerfanos() ?? 0,
    };
  };
}
