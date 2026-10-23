// Svelte action for instrument buttons: short press and long press (≥ 0.8 s, as the BM869s's «hold for one
// second» functions), by mouse, touch, pen or keyboard (Enter/Space; Shift+Enter is the long press).

import { prepararAudio } from '../audio';

export interface OpcionesPulsacion {
  corta: () => void;
  larga?: () => void;
  /** Repeat the short action while held (arrow keys). */
  repetir?: boolean;
}

export function pulsacion(nodo: Element, op: OpcionesPulsacion) {
  let opciones = op;
  let reloj: ReturnType<typeof setTimeout> | null = null;
  let repe: ReturnType<typeof setInterval> | null = null;
  let largaHecha = false;
  let activo = false;

  const limpiar = () => {
    if (reloj) clearTimeout(reloj);
    if (repe) clearInterval(repe);
    reloj = null;
    repe = null;
    nodo.classList.remove('pulsado');
  };
  const abajo = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.button !== undefined && e.button > 0) return;
    prepararAudio();
    activo = true;
    largaHecha = false;
    nodo.classList.add('pulsado');
    try {
      (nodo as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* not capturable */
    }
    if (opciones.larga) {
      reloj = setTimeout(() => {
        largaHecha = true;
        opciones.larga?.();
      }, 800);
    } else if (opciones.repetir) {
      reloj = setTimeout(() => {
        largaHecha = true;
        opciones.corta();
        repe = setInterval(() => opciones.corta(), 140);
      }, 450);
    }
  };
  const arriba = () => {
    if (!activo) return;
    activo = false;
    limpiar();
    if (!largaHecha) opciones.corta();
  };
  const cancelar = () => {
    activo = false;
    limpiar();
  };
  const tecla = (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    prepararAudio();
    if (e.shiftKey && opciones.larga) opciones.larga();
    else opciones.corta();
  };
  nodo.addEventListener('pointerdown', abajo);
  nodo.addEventListener('pointerup', arriba);
  nodo.addEventListener('pointercancel', cancelar);
  nodo.addEventListener('lostpointercapture', cancelar);
  nodo.addEventListener('keydown', tecla);
  nodo.addEventListener('contextmenu', (e) => e.preventDefault());
  return {
    update(n: OpcionesPulsacion) {
      opciones = n;
    },
    destroy() {
      limpiar();
      nodo.removeEventListener('pointerdown', abajo);
      nodo.removeEventListener('pointerup', arriba);
      nodo.removeEventListener('pointercancel', cancelar);
      nodo.removeEventListener('lostpointercapture', cancelar);
      nodo.removeEventListener('keydown', tecla);
    },
  };
}
