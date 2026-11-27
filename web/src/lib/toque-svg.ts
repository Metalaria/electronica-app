// 2.2: Svelte action for the drawn instruments and any SVG drawn at a scale (the lessons' graph handles): their touch shapes — the transparent
// rect or circle marked `data-toque` inside each button, jack or knob — grow to at least TOQUE_MIN (48) CSS px at the
// size the drawing has on screen, centred on what they cover; the drawing itself does not change. On a computer
// (fine pointer) nothing changes. Re-measured when the drawing changes size.
import { TOQUE_MIN } from './toque';

type Original = { x: number; y: number; w: number; h: number } | { r: number };

export function toqueSvg(svg: SVGSVGElement) {
  const originales = new WeakMap<SVGElement, Original>();
  const grueso = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;

  function aplicar() {
    const vb = svg.viewBox.baseVal;
    const ancho = svg.getBoundingClientRect().width;
    if (!vb || !vb.width || !ancho) return;
    // CSS px per drawing unit; on a fine pointer the shapes keep their own size
    const s = ancho / vb.width;
    const minimo = grueso?.matches ? TOQUE_MIN / s : 0;
    for (const el of svg.querySelectorAll<SVGElement>('[data-toque]')) {
      let o = originales.get(el);
      if (el instanceof SVGCircleElement) {
        if (!o) originales.set(el, (o = { r: el.r.baseVal.value }));
        if ('r' in o) el.setAttribute('r', String(Math.max(o.r, minimo / 2)));
      } else if (el instanceof SVGRectElement) {
        if (!o) originales.set(el, (o = { x: el.x.baseVal.value, y: el.y.baseVal.value, w: el.width.baseVal.value, h: el.height.baseVal.value }));
        if ('w' in o) {
          const w = Math.max(o.w, minimo);
          const h = Math.max(o.h, minimo);
          el.setAttribute('x', String(o.x - (w - o.w) / 2));
          el.setAttribute('y', String(o.y - (h - o.h) / 2));
          el.setAttribute('width', String(w));
          el.setAttribute('height', String(h));
        }
      }
    }
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => aplicar()) : null;
  ro?.observe(svg);
  grueso?.addEventListener('change', aplicar);
  aplicar();
  return {
    destroy() {
      ro?.disconnect();
      grueso?.removeEventListener('change', aplicar);
    },
  };
}
