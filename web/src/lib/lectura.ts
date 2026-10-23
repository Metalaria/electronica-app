// Sections read, detected while reading: a section counts as read when its end has come into view and
// its chunks have been on screen long enough for its length (about 5 s per screenful, between 4 and 75 s).
// One IntersectionObserver over the reader's chunks; nothing runs on scroll events, and the only timer is a
// timeout set to the moment the next section could be complete (none while nothing is on screen or the
// page is hidden).

import { aprendizaje, cargarAprendizaje, esLeida, marcarLeida } from './aprendizaje.svelte';

const MS_POR_PANTALLA = 5000;
const MIN_MS = 4000;
const MAX_MS = 75000;

/** Sections unmarked by hand in this session: not marked again automatically. */
const desmarcadas = new Set<string>();

export function alternarLeida(parte: string, label: string): void {
  const leida = esLeida(parte, label);
  if (leida) desmarcadas.add(`${parte}:${label}`);
  else desmarcadas.delete(`${parte}:${label}`);
  marcarLeida(parte, label, !leida);
}

interface Seccion {
  label: string;
  trozos: number[];
  visibleMs: number;
}

/** Starts tracking a part's chunks (`.trozo` children of the reader's body); returns the cleanup. */
export function seguirLectura(cuerpo: HTMLElement, parte: string, barra = 56): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  void cargarAprendizaje();
  const trozos = Array.from(cuerpo.children).filter((e): e is HTMLElement => e.classList.contains('trozo'));
  const final = cuerpo.parentElement?.querySelector<HTMLElement>('nav.contiguos') ?? null;

  const secciones = new Map<string, Seccion>();
  const deTrozo: (Seccion | null)[] = trozos.map((t, k) => {
    const label = t.dataset.seccion;
    if (!label) return null;
    let s = secciones.get(label);
    if (!s) secciones.set(label, (s = { label, trozos: [], visibleMs: 0 }));
    s.trozos.push(k);
    return s;
  });
  const alturas = new Float64Array(trozos.length);
  const finVisto = new Uint8Array(trozos.length);
  const visibles = new Set<number>();
  let ultimo = performance.now();
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const requerido = (s: Seccion) => {
    let h = 0;
    for (const k of s.trozos) h += alturas[k]!;
    const pantalla = Math.max(300, window.innerHeight - barra);
    return Math.min(MAX_MS, Math.max(MIN_MS, (h / pantalla) * MS_POR_PANTALLA));
  };

  function acumular() {
    const ahora = performance.now();
    const dt = ahora - ultimo;
    ultimo = ahora;
    if (document.visibilityState !== 'visible' || dt <= 0) return;
    const vistas = new Set<Seccion>();
    for (const k of visibles) {
      const s = deTrozo[k];
      if (s) vistas.add(s);
    }
    // a long gap (sleep, background tab without a visibility event) is not reading time
    const paso = Math.min(dt, 30000);
    for (const s of vistas) s.visibleMs += paso;
  }

  function revisar() {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    if (!aprendizaje.listo) {
      void cargarAprendizaje().then(revisar);
      return;
    }
    let proximo = Infinity;
    for (const s of secciones.values()) {
      if (esLeida(parte, s.label) || desmarcadas.has(`${parte}:${s.label}`)) continue;
      const falta = requerido(s) - s.visibleMs;
      const fin = finVisto[s.trozos[s.trozos.length - 1]!] === 1;
      if (falta <= 0 && fin) {
        marcarLeida(parte, s.label, true);
        continue;
      }
      // only sections on screen can progress; once the time is complete, the end will come from the observer
      if (falta > 0 && s.trozos.some((k) => visibles.has(k))) proximo = Math.min(proximo, Math.max(falta, 400));
    }
    if (proximo < Infinity && document.visibilityState === 'visible') {
      temporizador = setTimeout(() => {
        acumular();
        revisar();
      }, proximo + 50);
    }
  }

  const io = new IntersectionObserver(
    (entradas) => {
      acumular();
      for (const e of entradas) {
        const el = e.target as HTMLElement;
        if (el === final) {
          if (e.isIntersecting && trozos.length) finVisto[trozos.length - 1] = 1;
          continue;
        }
        const k = trozos.indexOf(el);
        if (k < 0) continue;
        alturas[k] = e.boundingClientRect.height;
        if (e.isIntersecting) {
          visibles.add(k);
          // the next chunk on screen means the end of this one has been seen
          if (k > 0) finVisto[k - 1] = 1;
          // a chunk whose bottom is already on screen
          if (e.rootBounds && e.boundingClientRect.bottom <= e.rootBounds.bottom) finVisto[k] = 1;
        } else {
          visibles.delete(k);
        }
      }
      revisar();
    },
    { rootMargin: `-${barra}px 0px 0px 0px`, threshold: [0, 1] },
  );
  for (const t of trozos) io.observe(t);
  if (final) io.observe(final);

  const visibilidad = () => {
    acumular();
    if (document.visibilityState === 'visible') revisar();
    else if (temporizador) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  };
  document.addEventListener('visibilitychange', visibilidad);

  return () => {
    acumular();
    revisar();
    if (temporizador) clearTimeout(temporizador);
    io.disconnect();
    document.removeEventListener('visibilitychange', visibilidad);
  };
}

/** Read fraction of a part (sections read / sections), 0 when it has no sections. */
export function fraccionLeida(parte: string, secciones: { label: string }[] | undefined): number {
  if (!secciones?.length) return 0;
  const l = aprendizaje.leidas[parte];
  if (!l) return 0;
  let n = 0;
  for (const s of secciones) if (l[s.label]) n++;
  return n / secciones.length;
}
