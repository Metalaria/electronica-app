<script lang="ts">
  // Slider of one component value of a live schematic: log scale from ×0,1 to ×10 of the book's value,
  // E12 steps for resistors, capacitors and inductors. Reports every move (`alMover`) and the release
  // (`alSoltar`), so the caller can show the value at once and simulate when the hand stops.
  import { si } from '../formato';
  import type { ParametroEsquema } from './resimular';

  let {
    p,
    valor,
    alMover,
    alSoltar,
  }: { p: ParametroEsquema; valor: number; alMover: (v: number) => void; alSoltar: () => void } = $props();

  const N = 600;
  const id = `fv-${Math.random().toString(36).slice(2, 9)}`;
  const signo = $derived(p.original < 0 ? -1 : 1);

  const posicion = $derived.by(() => {
    const a = Math.abs(valor);
    if (p.e12) {
      let k = 0;
      for (let i = 0; i < p.e12.length; i++) if (Math.abs(Math.log(p.e12[i]! / a)) < Math.abs(Math.log(p.e12[k]! / a))) k = i;
      return k;
    }
    return Math.round((Math.log(a / p.min) / Math.log(p.max / p.min)) * N);
  });

  function leer(ev: Event): number {
    const x = Number((ev.currentTarget as HTMLInputElement).value);
    if (p.e12) return signo * p.e12[Math.max(0, Math.min(p.e12.length - 1, x))]!;
    const v = p.min * (p.max / p.min) ** (x / N);
    return signo * Number(v.toPrecision(3));
  }

  const texto = $derived(si(valor, p.unidad, 3));
  const cambiado = $derived(Math.abs(valor - p.original) > Math.abs(p.original) * 1e-9);
  const fraccion = $derived(p.e12 ? posicion / Math.max(1, p.e12.length - 1) : posicion / N);
</script>

<div class="valor" style:--f={Math.min(1, Math.max(0, fraccion))}>
  <label for={id}>
    <span class="et">{p.etiqueta}</span>
    <output for={id} class:cambiado>{texto}</output>
  </label>
  <input
    {id}
    type="range"
    min="0"
    max={p.e12 ? p.e12.length - 1 : N}
    step="1"
    value={posicion}
    aria-valuetext={texto}
    oninput={(ev) => alMover(leer(ev))}
    onchange={alSoltar}
  />
</div>

<style>
  .valor {
    --c: var(--acento);
    display: grid;
    gap: 0;
    min-width: 0;
  }
  label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    font-size: 13.5px;
    color: var(--tinta-suave);
  }
  .et {
    overflow: hidden;
    font-weight: 600;
    color: var(--tinta);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  output {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    white-space: nowrap;
  }
  output.cambiado {
    color: var(--c);
  }
  input {
    width: 100%;
    height: 30px;
    margin: 0;
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
    border: 2px solid var(--c);
    border-radius: 50%;
    background: var(--superficie);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  }
  input::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: 2px solid var(--c);
    border-radius: 50%;
    background: var(--superficie);
  }
  input:focus-visible {
    outline: none;
  }
  input:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 30%, transparent);
  }
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
