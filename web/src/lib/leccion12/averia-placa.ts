// 1.3 (motor13b, petición de averias13): the lesson widget «averia-placa» — the board of a console with a hidden fault
// from its lesson of faults, the simulated multimeter's leads on the real board's pads, and the faulty part named
// (componentes/consolas/averia/BusqueAveria.svelte, averias13). On an explore card with a goal `{ averia: encontrada }`
// the card is done when the reader names the right part: the shell adds the variable «averia:encontrada» (1 once found)
// to the card's values from the widget's state (EstadoWidget12.encontrada), like a figure's zones. The generator checks
// the console has a fault definition (lib/averias-placa/definiciones.ts) and the fault is one of its lesson card's.
// Pure.

import type { Valores } from '../leccion11/modelo';
import type { Mando } from '../leccion11/tipos';
import { averiasDe } from '../averias-placa/definiciones';
import type { ContextoDigital } from './digital/generar-digital';
import type { EstadoWidget12 } from './digital/tipos';

export interface WidgetAveriaPlaca {
  tipo: 'averia-placa';
  maquina: string;
  /** The fault definition (lib/averias-placa/definiciones.ts): «snes-no-enciende». */
  definicion: string;
  /** The fault's id in its lesson card (`actividad.fallos`); absent: one at random, with «Otra avería». */
  averia?: string;
  vista?: 'foto' | '3d';
  mandos: Mando[];
  ocultar: false;
}

/** The goal's variable: 1 once the faulty part has been named. */
export const VARIABLE_ENCONTRADA = 'averia:encontrada';

export function widgetAveriaPlacaDe(x: Record<string, unknown>, c: Pick<ContextoDigital, 'e' | 'aviso' | 'recursos'>): WidgetAveriaPlaca | null {
  const { e } = c;
  for (const k of Object.keys(x)) if (!['tipo', 'maquina', 'definicion', 'averia', 'vista', 'mandos'].includes(k)) e(`«widget.${k}»: clave desconocida`);
  if (Array.isArray(x.mandos) && x.mandos.length) e('«widget.mandos»: la placa no lleva mandos (se mide en ella)');
  const maquina = String(x.maquina ?? '');
  const defs = averiasDe(maquina);
  if (!defs.length) {
    e(`«widget.maquina»: «${maquina}» no tiene averías en la placa (${['snes', 'sms', 'nes'].join(', ')})`);
    return null;
  }
  const def = x.definicion != null ? defs.find((d) => d.id === x.definicion) : defs[0];
  if (!def) {
    e(`«widget.definicion»: «${String(x.definicion)}» no es una avería de ${maquina} (${defs.map((d) => d.id).join(', ')})`);
    return null;
  }
  if (x.vista != null && x.vista !== 'foto' && x.vista !== '3d') e('«widget.vista»: foto o 3d');
  let averia: string | undefined;
  if (x.averia != null) {
    averia = String(x.averia);
    // (the fault is one of the lesson card's: read from the published lesson, which the script can read)
    const l = c.recursos?.leccion?.(`${def.leccion.parte}/${def.leccion.seccion}`);
    if (!l) c.aviso(`«widget.averia»: no se ha podido leer la lección ${def.leccion.parte}/${def.leccion.seccion} para comprobar «${averia}»`);
    else {
      const t = (Array.isArray(l.tarjetas) ? l.tarjetas : []).find((y: { id?: string }) => y?.id === def.leccion.tarjeta) as { actividad?: { fallos?: { id?: string }[] } } | undefined;
      const ids = (t?.actividad?.fallos ?? []).map((f) => String(f.id));
      if (!ids.includes(averia)) e(`«widget.averia»: «${averia}» no es una avería de la tarjeta ${def.leccion.tarjeta} de ${def.leccion.parte}/${def.leccion.seccion} (${ids.join(', ') || 'ninguna'})`);
    }
  }
  return {
    tipo: 'averia-placa',
    maquina,
    definicion: def.id,
    ...(averia ? { averia } : {}),
    ...(x.vista === 'foto' || x.vista === '3d' ? { vista: x.vista } : {}),
    mandos: [],
    ocultar: false,
  };
}

/** A goal condition on the board (`{ averia: encontrada }`, or `valor: 0` in a hint: not yet) → an ordinary condition. */
export function condicionAveriaPlaca(x: Record<string, unknown>): { valor: string; min?: number; max?: number } | string {
  for (const k of Object.keys(x)) if (!['averia', 'valor', 'rotulo'].includes(k)) return `clave desconocida «${k}» (una condición de la placa es { averia: encontrada, rotulo })`;
  if (x.averia !== 'encontrada') return '«averia»: encontrada (la pieza averiada, señalada)';
  if (x.valor != null && x.valor !== 0 && x.valor !== 1) return '«valor»: 1 (encontrada, por defecto) o 0 (todavía no)';
  return x.valor === 0 ? { valor: VARIABLE_ENCONTRADA, max: 0 } : { valor: VARIABLE_ENCONTRADA, min: 1 };
}

export function variablesAveriaPlaca(w12: EstadoWidget12 | undefined): Valores {
  return { [VARIABLE_ENCONTRADA]: w12?.encontrada ? 1 : 0 };
}
