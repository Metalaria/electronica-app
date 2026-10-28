// What keeps a bench alive in a view (the bench page, and since 0.10 the breadboard and the editor): it
// simulates whenever the bench's netlist changes, the multimeters read five times a second and the
// oscilloscope acquires eight times a second, only while the page is visible, with the continuity beeper.
// Call it during a component's initialisation (it registers effects and the mount/destroy hooks).

import { onMount, untrack } from 'svelte';
import type { Banco } from '../banco.svelte.ts';
import { tono, pitido } from '../audio';

export interface BancoActivo {
  /** AUTO of the oscilloscope with what is on its inputs now. */
  auto: () => void;
}

/**
 * `activo`: the bench simulates only while it returns true (a hidden panel, or a view that lends the
 * simulator to something else, pauses it).
 */
export function activarBanco(b: Banco, activo: () => boolean = () => true): BancoActivo {
  $effect(() => {
    const n = b.plan.netlist;
    if (!activo()) return;
    untrack(() => b.pedir(n));
  });

  function leerMultimetros() {
    b.brymen.leer(b.senalDmm('bm'));
    b.fnirsi.leerDmm(b.senalDmm('fn'));
    tono(b.brymen.pantalla.pitido);
    b.leido = b.version;
    b.tic++;
  }
  function adquirir() {
    const { entradas, inicio, fin } = b.entradasOsc();
    b.fnirsi.adquirir(entradas, inicio, fin);
  }
  // A new result or a change of the oscilloscope's settings: read and acquire at once.
  $effect(() => {
    void b.version;
    const f = b.fnirsi;
    void [f.sDiv, f.hpos, f.disparo, f.modo, f.run, f.esperando, f.encendido, ...f.canales.map((c) => [c.vDiv, c.pos, c.on, c.invertir, c.menuX10])];
    untrack(() => {
      adquirir();
      leerMultimetros();
    });
  });
  // BeepJack.
  let ultimoBeep = b.brymen.beepJack;
  $effect(() => {
    const n = b.brymen.beepJack;
    if (n !== ultimoBeep) {
      ultimoBeep = n;
      pitido(450);
    }
  });

  onMount(() => {
    const visible = () => document.visibilityState === 'visible';
    const t1 = setInterval(() => visible() && activo() && leerMultimetros(), 200);
    const t2 = setInterval(() => {
      const f = b.fnirsi;
      if (!visible() || !activo() || f.modo !== 'osc' || (!f.run && !f.esperando)) return;
      adquirir();
    }, 125);
    const oculto = () => !visible() && tono(false);
    document.addEventListener('visibilitychange', oculto);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      document.removeEventListener('visibilitychange', oculto);
      tono(false);
      b.cancelar();
    };
  });

  return {
    auto() {
      const { entradas } = b.entradasOsc();
      b.fnirsi.pulsarAuto(entradas, b.plan.fBase ?? (b.fuenteGenerador ? b.fnirsi.dds.frecuencia : null));
    },
  };
}
