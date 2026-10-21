<script lang="ts">
  // Slider with its label and the current value with unit (Spanish format), optionally logarithmic.
  import { si } from '../nucleo/formato';
  import Rico from './Rico.svelte';

  let {
    etiqueta,
    valor = $bindable(),
    min,
    max,
    paso,
    unidad = '',
    log = false,
    cifras = 3,
    formato,
    color,
    desactivado = false,
  }: {
    etiqueta: string;
    valor: number;
    min: number;
    max: number;
    paso?: number;
    unidad?: string;
    log?: boolean;
    cifras?: number;
    formato?: (v: number) => string;
    color?: string;
    desactivado?: boolean;
  } = $props();

  const N = 1000;
  const id = `d${Math.random().toString(36).slice(2, 9)}`;

  // Position of the native range input (0..N for log sliders, the value itself otherwise).
  const posicion = $derived(log ? (Math.log(valor / min) / Math.log(max / min)) * N : valor);

  function cambiar(ev: Event): void {
    const x = Number((ev.target as HTMLInputElement).value);
    if (log) {
      let v = min * Math.pow(max / min, x / N);
      // Round to 3 significant digits so values look tidy.
      const e = Math.floor(Math.log10(v)) - 2;
      v = Math.round(v / 10 ** e) * 10 ** e;
      valor = Math.min(max, Math.max(min, v));
    } else valor = x;
  }

  const texto = $derived(formato ? formato(valor) : si(valor, unidad, cifras));
  const fraccion = $derived(log ? posicion / N : (valor - min) / (max - min || 1));
</script>

<div class="deslizador" class:desactivado style:--c={color} style:--f={Math.min(1, Math.max(0, fraccion))}>
  <label for={id}><span class="et"><Rico texto={etiqueta} /></span><output for={id}>{texto}</output></label>
  <input
    {id}
    type="range"
    min={log ? 0 : min}
    max={log ? N : max}
    step={log ? 1 : (paso ?? (max - min) / 200)}
    value={posicion}
    disabled={desactivado}
    oninput={cambiar}
    aria-valuetext={texto}
  />
</div>

<style>
  .deslizador {
    --c: var(--acento);
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .desactivado {
    opacity: 0.45;
  }
  label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    font-size: 14px;
    color: var(--tinta-suave);
  }
  .et {
    font-weight: 600;
    color: var(--tinta);
  }
  output {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: var(--c);
    white-space: nowrap;
  }
  input {
    width: 100%;
    margin: 0;
    height: 30px;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }
  input::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(to right, var(--c) calc(var(--f) * 100%), var(--linea) calc(var(--f) * 100%));
  }
  input::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--linea);
  }
  input::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: var(--c);
  }
  input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px;
    height: 22px;
    margin-top: -8px;
    border-radius: 50%;
    background: var(--superficie);
    border: 2px solid var(--c);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  }
  input::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--superficie);
    border: 2px solid var(--c);
  }
  input:focus-visible {
    outline: none;
  }
  input:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 30%, transparent);
  }
  /* Touch screens: a 44 px tall hit area and a larger thumb. */
  @media (pointer: coarse) {
    input {
      height: 44px;
    }
    input::-webkit-slider-thumb {
      width: 28px;
      height: 28px;
      margin-top: -11px;
    }
  }
</style>
