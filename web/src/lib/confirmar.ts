// «¿Seguro?» before a destructive action, with the app's own dialog (0.12, componentes/Confirmacion.svelte) instead
// of window.confirm — see that component for why. Resolves true only when the reader presses the destructive button.
// The rest of the page is made inert while the dialog is open, and the focus returns to whatever had it. A route change
// while it is open (Android's back button, a link, history.back()) closes it as «Cancelar»: the question belonged to the
// page that is gone.
//   if (!(await confirmar({ titulo: '¿Borrar «X»?', aceptar: 'Borrar' }))) return;

import { mount, unmount } from 'svelte';
import Confirmacion from '../componentes/Confirmacion.svelte';

export interface Pregunta {
  titulo: string;
  mensaje?: string;
  /** Label of the destructive button («Borrar», «Descartar»). */
  aceptar: string;
  cancelar?: string;
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
    const alSalir = () => responder(false);
    const responder = (si: boolean) => {
      if (hecho) return;
      hecho = true;
      window.removeEventListener('hashchange', alSalir);
      window.removeEventListener('popstate', alSalir);
      for (const e of inertes) e.inert = false;
      if (componente) void unmount(componente);
      host.remove();
      // back to the button that asked (if it is still there)
      if (antes?.isConnected) antes.focus();
      resolver(si);
    };
    window.addEventListener('hashchange', alSalir);
    window.addEventListener('popstate', alSalir);
    componente = mount(Confirmacion, { target: host, props: { ...p, responder } });
  });
}
