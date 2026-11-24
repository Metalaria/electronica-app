// 1.4: the simulated FNIRSI's values at this moment, to show next to the real FNIRSI's (FnirsiReal.svelte): its
// multimeter's display in multimeter mode, its oscilloscope's measurements of each channel that is on in oscilloscope
// mode. Null while the bench is being simulated again (the instruments still show the previous circuit) or the
// simulated instrument is off.

import type { Banco } from '../banco.svelte.ts';
import type { SimuladoFnirsi } from '../../../lib/fnirsi-real/comparar.ts';
import { NIVELES_DIV } from '../motor/osciloscopio.ts';

export function simuladoFnirsi(b: Banco): SimuladoFnirsi | null {
  const f = b.fnirsi;
  if (!b.vigente || !f.encendido) return null;
  const l = f.modo === 'dmm' ? f.lecturaDmm : null;
  const canal = (k: 0 | 1) => {
    if (f.modo !== 'osc' || !f.canales[k]?.on) return null;
    const m = f.medidas(k);
    if (!m) return null;
    // 1.4.3: a trace of three samples or less peak to peak is the simulated converter's noise (a circuit with no
    // signal on that channel): its «frequency» changes with every sweep (84 Hz, 1.2 kHz, 9 kHz…) and means nothing,
    // so only its Vpp is compared
    const muestra = f.canales[k]!.vDiv / NIVELES_DIV;
    return { vpp: m.vpp, f: m.vpp > 3 * muestra * 1.0001 ? m.f : null };
  };
  const multimetro = l ? { texto: l.ol ? 'OL' : `${l.texto.replace('-', '−').replace('.', ',')} ${l.unidad}`, valor: l.valor, unidad: l.unidad } : null;
  const canales: SimuladoFnirsi['canales'] = [canal(0), canal(1)];
  return multimetro || canales[0] || canales[1] ? { multimetro, canales } : null;
}
