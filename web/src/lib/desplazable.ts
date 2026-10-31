// A box that may scroll (a wide equation on a phone, the search results) can be scrolled with the keyboard only when
// it can take the focus: tabindex and a name while it overflows, nothing otherwise (axe «scrollable-region-focusable»,
// 0.11 QA). The tabindex is set here, not in the markup, because it depends on the overflow.

type Opciones = string | { nombre: string; vertical?: boolean };

export function desplazable(el: HTMLElement, opciones: Opciones = 'Contenido desplazable'): { update(o: Opciones): void; destroy(): void } {
  let actual = typeof opciones === 'string' ? { nombre: opciones } : opciones;
  const mirar = () => {
    const desborda = el.scrollWidth > el.clientWidth + 1 || (!!actual.vertical && el.scrollHeight > el.clientHeight + 1);
    if (desborda) {
      el.tabIndex = 0;
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', actual.nombre);
    } else if (el.hasAttribute('tabindex')) {
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
    }
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mirar) : null;
  ro?.observe(el);
  // (a box of fixed size whose content changes: the results of a new query)
  const mo = actual.vertical && typeof MutationObserver !== 'undefined' ? new MutationObserver(() => requestAnimationFrame(mirar)) : null;
  mo?.observe(el, { childList: true, subtree: true });
  mirar();
  return {
    update(o: Opciones) {
      actual = typeof o === 'string' ? { nombre: o } : o;
      mirar();
    },
    destroy() {
      ro?.disconnect();
      mo?.disconnect();
    },
  };
}
