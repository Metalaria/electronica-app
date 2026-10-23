<script lang="ts">
  // The illustration of a formula: its circuit (template with the quantities labelled on it) and/or the curve
  // or diagram it is about; formulas without either get the generic plot of the result against one input
  // (the one the reader is moving). Loaded lazily by the calculator.
  import type { Entorno } from '../expresion';
  import type { Formula } from '../tipos';
  import { barrido, entradas, variable } from '../motor';
  import { formatoValor, MENOS } from '../unidades';
  import { GRAFICOS, type Escena } from './graficos';
  import { contextoGrafico } from './contexto';
  import Esquema from './Esquema.svelte';
  import Grafico from './Grafico.svelte';

  let {
    f,
    objetivo,
    valores,
    posibles = [],
    onelegir,
    xResp = '',
  }: {
    f: Formula;
    objetivo: string;
    valores: Entorno;
    posibles?: string[];
    onelegir?: (id: string) => void;
    /** Horizontal variable of the generic plot (the input last moved). */
    xResp?: string;
  } = $props();

  const fig = $derived(f.figura ?? {});

  /** The generic plot: the solved quantity against one input over its typical range. */
  function respuesta(): Escena | null {
    const ins = entradas(f, objetivo).filter((v) => !v.entero);
    const pref = [xResp, fig.grafico?.s?.x ?? ''].find((id) => id && ins.some((v) => v.id === id));
    const vx = ins.find((v) => v.id === pref) ?? ins[0];
    const vy = variable(f, objetivo);
    if (!vx || !vy) return null;
    // around the current value (a factor of 30 each way, within the book's range) so the curve reads locally
    const x0v = valores[vx.id] ?? NaN;
    const local = { ...vx };
    if (Number.isFinite(x0v)) {
      if (vx.escala === 'log' && vx.min > 0 && x0v > 0) {
        local.min = Math.max(vx.min, x0v / 30);
        local.max = Math.min(vx.max, x0v * 30);
      } else if (vx.escala !== 'log' && x0v !== 0) {
        // linear: from zero to three times the value, on its side of zero
        const [a, b] = x0v > 0 ? [0, 3 * x0v] : [3 * x0v, 0];
        local.min = Math.max(vx.min, a);
        local.max = Math.min(vx.max, b);
        if (!(local.max > local.min)) [local.min, local.max] = [vx.min, vx.max];
      }
    }
    const fl = { ...f, vars: f.vars.map((v) => (v.id === vx.id ? local : v)) };
    const b = barrido(fl, objetivo, vx.id, valores, 90);
    const xs = Array.from(b.x);
    const ys = Array.from(b.y);
    const fin = ys.filter(Number.isFinite);
    if (fin.length < 2) return null;
    let ymin = Math.min(...fin);
    let ymax = Math.max(...fin);
    const logx = vx.escala === 'log' && vx.min > 0;
    const logy = ymin > 0 && ymax / ymin > 30;
    if (!logy) {
      const pad = (ymax - ymin) * 0.1 || Math.abs(ymax) * 0.1 || 1;
      ymin = ymin >= 0 && ymin - pad < 0 ? 0 : ymin - pad;
      ymax += pad;
    } else {
      ymin /= 1.5;
      ymax *= 1.5;
    }
    const x0 = valores[vx.id] ?? NaN;
    const y0 = valores[objetivo] ?? NaN;
    const fmt = (v: number, u: string) => formatoValor(v, u, 4, true).replace(/^-/, MENOS);
    const s = (h: string) => `<tspan class="g-sim">${h}</tspan>`;
    return {
      x: { min: xs[0] as number, max: xs[xs.length - 1] as number, log: logx, unidad: vx.unidad, titulo: vx.sim },
      y: { min: ymin, max: ymax, log: logy, unidad: vy.unidad, titulo: vy.sim },
      items: [
        { k: 'linea', x: xs, y: ys, cls: 'curva' },
        { k: 'flecha', x1: x0, y1: logy ? ymin : ymin, x2: x0, y2: y0, cls: 'tenue' },
        { k: 'punto', x: x0, y: y0, cls: 'res' },
        { k: 'texto', x: x0, y: y0, html: `${s(vy.sim)} = ${fmt(y0, vy.unidad)}`, cls: 'res', ancla: Number.isFinite(x0) && xs.length && (logx ? Math.log(x0 / (xs[0] as number)) / Math.log((xs[xs.length - 1] as number) / (xs[0] as number)) : (x0 - (xs[0] as number)) / ((xs[xs.length - 1] as number) - (xs[0] as number))) > 0.6 ? 'r' : 'l', dy: -8 },
      ],
      pie: `Cómo cambia ${vy.sim} al mover ${vx.sim}, con los demás datos fijos. Mueve otro control para verlo frente a esa magnitud.`,
    };
  }

  const escena = $derived.by((): Escena | null => {
    void valores;
    const g = fig.grafico;
    if (g && g.p !== 'respuesta') {
      const k = GRAFICOS[g.p];
      const e = k ? k(contextoGrafico(f, g.s, valores, objetivo)) : null;
      if (e) return e;
    }
    return respuesta();
  });
</script>

<div class="ilustracion" class:doble={!!fig.esquema && !!escena}>
  {#if fig.esquema}
    <div class="ilus-esquema">
      <Esquema {f} plantilla={fig.esquema.p} huecos={fig.esquema.s} {valores} {objetivo} {posibles} {onelegir} />
    </div>
  {/if}
  {#if escena}
    <div class="ilus-grafico">
      <Grafico {escena} />
    </div>
  {/if}
</div>

<style>
  .ilustracion {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ilus-esquema {
    padding: 6px 4px 2px;
  }
</style>
