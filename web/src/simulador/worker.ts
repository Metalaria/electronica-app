// Web Worker that runs ngspice, so the interface never blocks. It receives the compiled WebAssembly module
// once (or its bytes) and then one netlist per message; printed lines are streamed back in batches.

import { compilar } from './motor/nucleo.ts';
import { simular } from './motor/simular.ts';
import type { MensajeAlMotor, MensajeDelMotor } from './protocolo';

let modulo: WebAssembly.Module | null = null;

const enviar = (m: MensajeDelMotor, transferir: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(m, transferir);

self.onmessage = async (ev: MessageEvent<MensajeAlMotor>) => {
  const m = ev.data;
  if (m.t === 'motor') {
    try {
      modulo = m.modulo ?? (await compilar(m.bytes!));
      enviar({ t: 'listo' });
    } catch (e) {
      enviar({ t: 'error', id: 0, mensaje: `No se pudo preparar ngspice: ${String(e)}` });
    }
    return;
  }
  if (m.t === 'simular') {
    if (!modulo) {
      enviar({ t: 'error', id: m.id, mensaje: 'El motor no está preparado.' });
      return;
    }
    // Printed lines go out at most every 150 ms (the worker is busy inside ngspice in between).
    let lote: string[] = [];
    let ultimo = 0;
    const alImprimir = (l: string) => {
      lote.push(l);
      const ahora = Date.now();
      if (ahora - ultimo > 150) {
        ultimo = ahora;
        enviar({ t: 'lineas', id: m.id, lineas: lote });
        lote = [];
      }
    };
    try {
      const r = await simular(modulo, m.texto, alImprimir);
      const buffers: Transferable[] = [];
      for (const g of r.ejecucion.graficas) {
        for (const v of g.vectores) {
          buffers.push(v.re.buffer);
          if (v.im) buffers.push(v.im.buffer);
        }
      }
      enviar({ t: 'fin', id: m.id, resultado: r }, buffers);
    } catch (e) {
      enviar({ t: 'error', id: m.id, mensaje: String(e instanceof Error ? e.message : e) });
    }
  }
};
