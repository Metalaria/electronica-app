// «¿Seguro?» before a destructive action, with the app's own dialog (0.12, componentes/Confirmacion.svelte) instead
// of window.confirm — see that component for why. Resolves true only when the reader presses the destructive button.
// The rest of the page is made inert while the dialog is open, and the focus returns to whatever had it. 2.2: the
// system's back (Android's, the browser's) closes it as «Cancelar» and stays on the page (lib/encima.ts); a route change
// while it is open (a link, a hash set by code) also closes it as «Cancelar»: the question belonged to the page that is gone.
//   if (!(await confirmar({ titulo: '¿Borrar «X»?', aceptar: 'Borrar' }))) return;

import { mount, unmount } from 'svelte';
import Confirmacion from '../componentes/Confirmacion.svelte';
import { abrirEncima, despuesDeCerrar } from './encima';

export interface Pregunta {
  titulo: string;
  mensaje?: string;
  /** Label of the destructive button («Borrar», «Descartar»). */
  aceptar: string;
  cancelar?: string;
  /**
   * 1.0 (review 10h): the question is the guard of a route change itself (lib/salida.ts): the router has already put
   * the page's address back, so a route change does not close it (the reader's repeated «Atrás» keeps one question).
   */
  seguirEnRuta?: boolean;
}

export function confirmar(p: Pregunta): Promise<boolean> {
  return new Promise<boolean>((resolver) => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const host = document.createElement('div');
    host.className = 'confirmacion-host';
    // everything else becomes inert (no focus, no clicks) while the question is open
    const inertes = [...document.body.children].filter((e): e is HTMLElement => e instanceof HTMLElement && !e.inert);
    for (const e of inertes) e.inert = true;
    document.body.append(host);
    let componente: ReturnType<typeof mount> | null = null;
    let hecho = false;
    let quitar: (() => void) | null = null;
    const alSalir = () => responder(false);
    const responder = (si: boolean) => {
      if (hecho) return;
      hecho = true;
      window.removeEventListener('hashchange', alSalir);
      for (const e of inertes) e.inert = false;
      if (componente) void unmount(componente);
      host.remove();
      // back to the button that asked (if it is still there)
      if (antes?.isConnected) antes.focus();
      // 2.2: its history entry goes; the answer arrives once the history has settled, so a caller that changes the
      // route on «yes» does not race the step back
      if (quitar) {
        quitar();
        void despuesDeCerrar().then(() => resolver(si));
      } else resolver(si);
    };
    const { seguirEnRuta, ...props } = p;
    if (!seguirEnRuta) {
      window.addEventListener('hashchange', alSalir);
      // 2.2: on top of the page: the system's back answers «Cancelar» and stays on the page (lib/encima.ts)
      quitar = abrirEncima('confirmar', () => responder(false));
    }
    componente = mount(Confirmacion, { target: host, props: { ...props, responder } });
  });
}
