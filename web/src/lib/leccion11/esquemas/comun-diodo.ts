// 1.1 lessons: what the diode schematics share — the two models of the book a lesson may use for the diode (sección
// 5.3 «Los tres modelos y cuándo usar cada uno»), as pieces of the widget, and the simulator's device for each:
//   - constant drop: piece «vd» (0,7 V; a LED's «vf», 2,0 V): a diode that drops exactly vd at the reference current
//     (comun.ts diodoCaida), and every reading allowed the drop's deviation (tipos.ts NoLineal);
//   - Shockley: pieces «is» and «n» (and «vt», 25,85 mV if absent): exactly I = IS·(e^(V/(n·VT)) − 1), as tight a check
//     as a resistor's. Solving the circuit with it needs the Wright ω function of the model's language:
//     I = n·VT/R·wright(ln(IS·R/(n·VT)) + (V + IS·R)/(n·VT)) − IS (contenido/lecciones11/GUIA.md §5).
import { diodoCaida, diodoShockley, temperatura } from './comun';
import type { ContextoNetlist, NoLineal, Pieza } from './tipos';

export function piezasDiodo(caida: string, valor: string): Record<string, Pieza> {
  return {
    [caida]: { descripcion: `caída constante del ${valor} (V): el modelo de caída constante del libro` },
    is: { descripcion: 'corriente de saturación I_S (A): el modelo de Shockley' },
    n: { descripcion: 'factor de idealidad n (con «is»)' },
    vt: { descripcion: 'tensión térmica V_T (V; sin ella, 25,85 mV, la del libro a 300 K)' },
  };
}

/** One model and only one: the constant drop, or IS and n. */
export function validarDiodo(caida: string) {
  return (tiene: (p: string) => boolean): string[] => {
    const shockley = tiene('is') || tiene('n');
    if (tiene(caida) && shockley) return [`o el modelo de caída constante («${caida}») o el de Shockley («is» y «n»), no los dos`];
    if (!tiene(caida) && !(tiene('is') && tiene('n'))) return [`falta el modelo del diodo: «${caida}» (caída constante) o «is» y «n» (Shockley)`];
    if (tiene('vt') && !shockley) return ['«vt» solo con el modelo de Shockley'];
    return [];
  };
}

/** The approximation a constant drop makes (none with Shockley); `medida`: the diode's real drop in the netlist. */
export function noLinealDiodo(caida: string, desviacion: number, porque: string, medida: string) {
  return (tiene: (p: string) => boolean): NoLineal[] => (tiene(caida) ? [{ pieza: caida, desviacion, porque, medida: () => medida }] : []);
}

/**
 * 1.2 (esquemas12c): a diode or LED mounted the wrong way round (the switch piece «reves», closed): it blocks, so the
 * book's model is I = 0 and the constant drop does not apply — its deviation is read from a 0 V reference at the drop
 * itself (`lineasReves`), so the approximation's check passes and the readings are compared as with a resistor.
 */
export const alReves = (c: ContextoNetlist): boolean => c.tiene('reves') && c.cerrado('reves');

export const piezaReves = (): Pieza => ({ interruptor: true, descripcion: 'montado al revés (1: el cátodo hacia la fuente; bloquea)', color: 'naranja' });

/** The reference the constant drop's check reads while reversed (see above). */
export function lineasReves(c: ContextoNetlist, caida: string): string[] {
  return alReves(c) && c.tiene(caida) ? [`VREVES zrev 0 DC ${c.p(caida)}`] : [];
}

/** noLinealDiodo with the reversed case: `medida` forward, the reference above reversed. */
export function noLinealDiodoReves(caida: string, desviacion: number, porque: string, medida: string) {
  return (tiene: (p: string) => boolean): NoLineal[] => (tiene(caida) ? [{ pieza: caida, desviacion, porque, medida: (c) => (alReves(c) ? 'v(zrev)' : medida) }] : []);
}

/** «.options» and «.model» lines of the diode `nombre` as the widget models it. */
export function modeloDiodo(c: ContextoNetlist, nombre: string, caida: string, iRef: number, nCaida: number): string[] {
  if (c.tiene(caida)) return [temperatura(), diodoCaida(nombre, c.p(caida), iRef, nCaida)];
  return [temperatura(c.tiene('vt') ? c.p('vt') : undefined), diodoShockley(nombre, c.p('is'), c.p('n'))];
}
