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

/** «.options» and «.model» lines of the diode `nombre` as the widget models it. */
export function modeloDiodo(c: ContextoNetlist, nombre: string, caida: string, iRef: number, nCaida: number): string[] {
  if (c.tiene(caida)) return [temperatura(), diodoCaida(nombre, c.p(caida), iRef, nCaida)];
  return [temperatura(c.tiene('vt') ? c.p('vt') : undefined), diodoShockley(nombre, c.p('is'), c.p('n'))];
}
