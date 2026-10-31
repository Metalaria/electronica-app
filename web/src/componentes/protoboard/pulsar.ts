// A button's action on the release of a tap (0.11): over the bench, after a drag, Chrome on Android sometimes
// does not turn a quick tap into a «click» (seen on the floating bar right after a part is dropped), so the
// action runs on pointerup — when the finger did not move — and the click that may follow is ignored. A click
// with no pointer before it (the keyboard) still works.

export function pulsar(nodo: HTMLElement, accion: () => void) {
  let fn = accion;
  let id = -1;
  let x0 = 0;
  let y0 = 0;
  let hecho = 0;
  const abajo = (e: PointerEvent) => {
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
  };
  const arriba = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (Math.hypot(e.clientX - x0, e.clientY - y0) > 12 || (nodo as HTMLButtonElement).disabled) return;
    hecho = performance.now();
    fn();
  };
  const clic = (e: MouseEvent) => {
    if (performance.now() - hecho < 800) {
      e.preventDefault();
      return;
    }
    fn();
  };
  const fuera = () => (id = -1);
  nodo.addEventListener('pointerdown', abajo);
  nodo.addEventListener('pointerup', arriba);
  nodo.addEventListener('pointercancel', fuera);
  nodo.addEventListener('click', clic);
  return {
    update(a: () => void) {
      fn = a;
    },
    destroy() {
      nodo.removeEventListener('pointerdown', abajo);
      nodo.removeEventListener('pointerup', arriba);
      nodo.removeEventListener('pointercancel', fuera);
      nodo.removeEventListener('click', clic);
    },
  };
}
