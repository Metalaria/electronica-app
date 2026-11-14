<script lang="ts">
  // 1.2 schematic kit (esquemas12d; sección 10.1, figura 10.2): a thyristor between (x1, y1) and (x2, y2) on a
  // horizontal or vertical line, leads included — an SCR (a diode, anode at the first point, the gate leaving the
  // cathode side) or a TRIAC (two antiparallel triangles between the main terminals MT2, the first point, and MT1, the
  // gate beside MT1). The body is 22 units long, centred; the gate lead ends 10 units past the body along the line and
  // 34 across it, on the side of the line's normal (below a left-to-right line, left of a top-to-bottom one): the
  // drawing wires the trigger from there. The symbol is a body (data-cuerpo): wires stop at its terminals and the
  // living circuit's particles keep out.
  import { camino, cuerpo, en } from './geometria';
  let { x1, y1, x2, y2, tipo = 'scr', color = 'tinta', pieza }: { x1: number; y1: number; x2: number; y2: number; tipo?: 'scr' | 'triac'; color?: string; pieza?: string } = $props();
  const g = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 22);
    const P = (s: number, t = 0) => en(x1, y1, x2, y2, s, t);
    const scr = tipo === 'scr';
    return {
      hilos: `${camino([P(0), P(a)])} ${camino([P(b), P(l)])}`,
      triangulos: scr ? `${camino([P(a, -11), P(a, 11), P(b, 0)])} Z` : `${camino([P(a, -13), P(a, -1), P(b, -7)])} Z ${camino([P(b, 1), P(b, 13), P(a, 7)])} Z`,
      barras: scr ? camino([P(b, -12), P(b, 12)]) : `${camino([P(a, -14), P(a, 14)])} ${camino([P(b, -14), P(b, 14)])}`,
      puerta: scr ? camino([P(b - 1, 6), P(b + 10, 20), P(b + 10, 34)]) : camino([P(b, 10), P(b + 10, 20), P(b + 10, 34)]),
      // (the gate's bend included; its last 10 units are a lead)
      // (across the line from −15 to +24, the gate's side)
      caja: (() => {
        const q = [P(a, -15), P(b + 12, 24)];
        return `${Math.min(q[0]![0], q[1]![0])} ${Math.min(q[0]![1], q[1]![1])} ${Math.max(q[0]![0], q[1]![0])} ${Math.max(q[0]![1], q[1]![1])}`;
      })(),
    };
  });
</script>

<g data-pieza={pieza} data-cuerpo={g.caja}>
<path class={`pieza ${color}`} d={g.hilos}></path>
<path class={`pieza relleno ${color}`} class:fina={tipo === 'triac'} d={g.triangulos}></path>
<path class={`pieza ${color}`} d={g.barras}></path>
<path class={`pieza ${color}`} d={g.puerta}></path>
</g>
