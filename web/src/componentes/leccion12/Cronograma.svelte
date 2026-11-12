<script lang="ts">
  // 1.2 digital toolkit: a timing diagram (lib/leccion12/digital/logica.ts `cronograma`): one row per signal, two
  // slots per clock cycle (the clock low, then high), dotted lines at the rising edges, and a cursor the reader moves
  // along it (a native slider: arrows, Home, End) — the circuit above shows the levels of that slot. A row can be
  // hidden («?») while it is what the card asks for. Levels are told by the line's height and in text, not by colour.
  import type { Nivel } from '../../lib/leccion12/digital/logica';
  import type { Texto } from '../../lib/leccion11/tipos';
  import { textoPlano } from '../../lib/leccion11/texto';
  import TextoSvg from '../leccion11/TextoSvg.svelte';

  let {
    filas,
    tramo,
    prefijo,
    mover,
  }: {
    filas: { id: string; rotulo: Texto; niveles: Nivel[] | null }[];
    tramo: number;
    prefijo: string;
    /** Moves the cursor (absent: no cursor). */
    mover?: (k: number) => void;
  } = $props();

  const n = $derived(filas[0]?.niveles?.length ?? filas.find((f) => f.niveles)?.niveles?.length ?? 0);
  const ETQ = 46;
  const PASO = 26;
  const ALTO = 30;
  const ancho = $derived(ETQ + n * PASO + 8);
  const alto = $derived(filas.length * ALTO + 18);
  const xs = (k: number) => ETQ + k * PASO;
  function onda(v: Nivel[], y: number): string {
    let d = '';
    v.forEach((x, k) => {
      const yy = y + (x ? 6 : 22);
      d += k === 0 ? `M${xs(0)},${yy}` : `V${yy}`;
      d += `H${xs(k + 1)}`;
    });
    return d;
  }
  const ciclo = $derived(Math.floor(tramo / 2) + 1);
  const texto = $derived(`Ciclo ${ciclo}, reloj ${tramo % 2 ? 'alto' : 'bajo'}: ${filas.map((f) => `${textoPlano(f.rotulo)} ${f.niveles ? f.niveles[tramo] : 'oculta'}`).join(', ')}`);
</script>

<div class="d12-crono" data-cronograma>
  <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Cronograma de ${n / 2} ciclos de reloj: ${filas.map((f) => textoPlano(f.rotulo)).join(', ')}`}>
    {#each Array.from({ length: n / 2 }, (_, k) => k) as k (k)}
      <line class="d12-flanco" x1={xs(2 * k + 1)} x2={xs(2 * k + 1)} y1="2" y2={alto - 14} />
      <text x={xs(2 * k + 1)} y={alto - 3} text-anchor="middle">{k + 1}</text>
    {/each}
    {#if mover}<rect class="d12-cursor" x={xs(tramo)} y="0" width={PASO} height={alto - 14} />{/if}
    {#each filas as f, i (f.id)}
      <text x="4" y={i * ALTO + 20}><TextoSvg t={f.rotulo} /></text>
      {#if f.niveles}
        <path class="d12-onda" d={onda(f.niveles, i * ALTO)} data-onda={f.id} />
      {:else}
        <text class="d12-oculta" x={xs(n / 2)} y={i * ALTO + 20} text-anchor="middle">?</text>
      {/if}
    {/each}
  </svg>
  {#if mover}
    <label class="d12-deslizador">
      <span class="a12-suave">Momento</span>
      <input type="range" min="0" max={Math.max(0, n - 1)} step="1" value={tramo} aria-valuetext={texto} oninput={(ev) => mover?.(Number((ev.currentTarget as HTMLInputElement).value))} id={`${prefijo}-tramo`} data-tramo />
    </label>
    <p class="a12-solo-lector" aria-live="polite">{texto}</p>
  {/if}
</div>
