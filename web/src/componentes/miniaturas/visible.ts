// Lazy loading of list thumbnails: one IntersectionObserver per scroll root and margin, shared by every
// thumbnail of the page (hundreds of rows cost one observer, not one each). The callback runs once, when the
// element comes within the margin of its root; then the element is no longer observed.
// The root is the nearest ancestor marked with `data-miniaturas-raiz` (a scrolling panel such as the search
// results, so the margin applies inside it), else the viewport.

type Aviso = () => void;

interface Observador {
  io: IntersectionObserver;
  avisos: Map<Element, Aviso>;
}

const porRaiz = new WeakMap<Element | Document, Map<string, Observador>>();

function observador(raiz: Element | null, margen: string): Observador {
  const clave = raiz ?? document;
  let m = porRaiz.get(clave);
  if (!m) porRaiz.set(clave, (m = new Map()));
  let o = m.get(margen);
  if (!o) {
    const avisos = new Map<Element, Aviso>();
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const aviso = avisos.get(e.target);
          avisos.delete(e.target);
          io.unobserve(e.target);
          aviso?.();
        }
      },
      { root: raiz, rootMargin: margen },
    );
    o = { io, avisos };
    m.set(margen, o);
  }
  return o;
}

/** Calls `aviso` once when `el` is about to be seen; returns the cancellation. */
export function alVerse(el: Element, aviso: Aviso, margen = '240px'): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    aviso();
    return () => {};
  }
  const raiz = el.parentElement?.closest('[data-miniaturas-raiz]') ?? null;
  const o = observador(raiz, margen);
  o.avisos.set(el, aviso);
  o.io.observe(el);
  return () => {
    if (o.avisos.delete(el)) o.io.unobserve(el);
  };
}

/** Svelte action: `use:visible={() => (ver = true)}`. */
export function visible(el: Element, aviso: Aviso): { destroy: () => void } {
  return { destroy: alVerse(el, aviso) };
}
