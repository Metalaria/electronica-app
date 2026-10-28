<script lang="ts">
  // A knob for one value of a part (potentiometer position, light, temperature, source voltage): a slider that
  // writes the field as it moves (`fin` false) and once more when it is released (`fin` true). Linear or
  // logarithmic; the text shows the value with its unit.
  import { formatoCorto } from '../grafica/formato.ts';
  import { formatoValor, leerValor } from './valores.ts';

  let {
    etiqueta,
    texto,
    unidad,
    min,
    max,
    log = false,
    paso = 0,
    nombre = '',
    alCambiar,
  }: {
    etiqueta: string;
    /** Field text now («50», «4,7k»). */
    texto: string;
    unidad: string;
    min: number;
    max: number;
    log?: boolean;
    /** Rounding of the value (0: 3 significant digits). */
    paso?: number;
    /** Name of the input (tests). */
    nombre?: string;
    alCambiar: (texto: string, fin: boolean) => void;
  } = $props();

  const N = 1000;
  const valor = $derived.by(() => {
    const l = leerValor(texto, unidad === '%' ? '%' : unidad);
    return l.ok && l.v != null ? l.v : min;
  });
  const posicion = $derived(Math.round(N * (log ? Math.log(Math.max(valor, min) / min) / Math.log(max / min) : (valor - min) / (max - min || 1))));

  function deposicion(k: number): number {
    const t = Math.max(0, Math.min(1, k / N));
    let v = log ? min * Math.pow(max / min, t) : min + (max - min) * t;
    if (paso) v = Math.round(v / paso) * paso;
    else v = Number(v.toPrecision(3));
    return v;
  }

  function textoDe(v: number): string {
    if (paso && paso >= 1) return String(Math.round(v)).replace('-', '−');
    if (paso) return String(Number(v.toFixed(Math.max(0, -Math.floor(Math.log10(paso)))))).replace('.', ',').replace('-', '−');
    return formatoValor(v);
  }

  function mover(ev: Event, fin: boolean) {
    const k = Number((ev.currentTarget as HTMLInputElement).value);
    alCambiar(textoDe(deposicion(k)), fin);
  }

  const lectura = $derived(unidad === '%' ? `${String(Math.round(valor))} %` : unidad === '°C' ? `${String(Number(valor.toFixed(1))).replace('.', ',')} °C` : formatoCorto(valor, unidad));
</script>

<label class="mando">
  <span class="cab"><span class="et">{etiqueta}</span><output>{lectura}</output></span>
  <input type="range" name={nombre || undefined} min="0" max={N} step="1" value={posicion} oninput={(e) => mover(e, false)} onchange={(e) => mover(e, true)} aria-label={etiqueta} aria-valuetext={lectura} />
</label>

<style>
  .mando {
    display: grid;
    gap: 2px;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .cab {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .et {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  output {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--tinta);
  }
  input {
    width: 100%;
    min-height: 32px;
    margin: 0;
    accent-color: var(--acento);
    touch-action: pan-y;
  }
</style>
