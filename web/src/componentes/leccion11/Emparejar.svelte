<script lang="ts">
  // 1.1 lessons: «empareje» (drag to place) — each item on the right goes to its partner on the left. Drag a chip onto
  // a slot (pointer), or choose a chip (Intro or Espacio: aria-pressed) and then the slot (keyboard, screen readers).
  // A chip already placed can be moved to another slot; a slot taken gives its chip back.
  import type { Texto } from '../../lib/leccion11/tipos';
  import { textoPlano } from '../../lib/leccion11/texto';
  import TextoVivo from './TextoVivo.svelte';

  let {
    parejas,
    inicio,
    puestas,
    bloqueado,
    comprobado,
    valor,
    cambiar,
  }: {
    parejas: [Texto, Texto][];
    /** Order the chips are offered in. */
    inicio: number[];
    puestas: (number | null)[];
    bloqueado: boolean;
    comprobado: boolean;
    valor: (id: string) => string;
    cambiar: (puestas: (number | null)[]) => void;
  } = $props();

  let elegida = $state<number | null>(null);
  let anuncio = $state('');
  const libres = $derived(inicio.filter((x) => !puestas.includes(x)));

  function poner(slot: number, chip: number) {
    if (bloqueado) return;
    const p = puestas.map((x) => (x === chip ? null : x));
    p[slot] = chip;
    cambiar(p);
    elegida = null;
    anuncio = `«${textoPlano(parejas[chip]![1])}» puesto con «${textoPlano(parejas[slot]![0])}».`;
  }
  function tocarHueco(slot: number) {
    if (bloqueado) return;
    if (elegida !== null) poner(slot, elegida);
    else if (puestas[slot] !== null) {
      // a placed chip goes back to the tray
      const p = [...puestas];
      anuncio = `«${textoPlano(parejas[p[slot]!]![1])}» quitado de «${textoPlano(parejas[slot]![0])}».`;
      p[slot] = null;
      cambiar(p);
    }
  }
  // dragging a chip with the pointer
  let arrastre: { chip: number } | null = $state(null);
  function bajar(chip: number, ev: PointerEvent) {
    if (bloqueado || ev.button !== 0) return;
    arrastre = { chip };
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
  }
  function soltar(ev: PointerEvent) {
    const a = arrastre;
    arrastre = null;
    const t = ev.currentTarget as Element;
    if (t.hasPointerCapture(ev.pointerId)) t.releasePointerCapture(ev.pointerId);
    if (!a) return;
    const debajo = document.elementsFromPoint(ev.clientX, ev.clientY).find((e) => e instanceof HTMLElement && e.dataset.hueco != null) as HTMLElement | undefined;
    if (debajo) poner(Number(debajo.dataset.hueco), a.chip);
  }
  function elegir(chip: number) {
    if (bloqueado) return;
    elegida = elegida === chip ? null : chip;
  }
</script>

<div class="emparejar" data-emparejar>
  <ul class="huecos">
    {#each parejas as par, k (k)}
      {@const puesta = puestas[k] ?? null}
      <li>
        <span class="izq"><TextoVivo texto={par[0]} {valor} /></span>
        <button
          type="button"
          class="hueco"
          class:lleno={puesta !== null}
          class:bien={comprobado && puesta === k}
          class:mal={comprobado && puesta !== null && puesta !== k}
          data-hueco={k}
          aria-label={`${textoPlano(par[0])}: ${puesta !== null ? textoPlano(parejas[puesta]![1]) : 'vacío'}${elegida !== null ? `. Poner aquí «${textoPlano(parejas[elegida]![1])}»` : ''}`}
          aria-disabled={bloqueado}
          onclick={() => tocarHueco(k)}
        >
          {#if puesta !== null}<TextoVivo texto={parejas[puesta]![1]} {valor} />{:else}<span class="vacio" aria-hidden="true">Suelte aquí</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
  {#if libres.length}
    <div class="bandeja" role="group" aria-label="Por colocar">
      {#each libres as c (c)}
        <button
          type="button"
          class="ficha"
          class:elegida={elegida === c}
          class:volando={arrastre?.chip === c}
          aria-pressed={elegida === c}
          aria-disabled={bloqueado}
          data-ficha={c}
          onclick={() => elegir(c)}
          onpointerdown={(ev) => bajar(c, ev)}
          onpointerup={soltar}
          onpointercancel={() => (arrastre = null)}
        >
          <TextoVivo texto={parejas[c]![1]} {valor} />
        </button>
      {/each}
    </div>
  {/if}
</div>
<div class="solo-lector" aria-live="polite">{anuncio}</div>

<style>
  .emparejar {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .huecos {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    /* a long left-hand text wraps in its column instead of pushing the slot out of the card (motor fixes 1.1: a
       41-character item gave a 368 px page at 360 px); the slot keeps at least half the row */
    grid-template-columns: minmax(3.5em, auto) minmax(50%, 1fr);
    align-items: center;
    gap: 10px;
  }
  .izq {
    min-width: 0;
    color: var(--v11-azul);
    font: 700 18px/1.25 var(--v11-titular);
    overflow-wrap: anywhere;
  }
  .hueco,
  .ficha {
    min-height: 48px;
    padding: 8px 12px;
    border-radius: var(--v11-radio-opcion);
    min-width: 0;
    max-width: 100%;
    font: 500 15px/1.3 var(--v11-texto);
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .hueco {
    border: 2px dashed var(--v11-borde);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
  }
  .hueco.lleno {
    border-style: solid;
  }
  .hueco.bien {
    border-color: var(--v11-bien);
    background: var(--v11-bien-tinte);
  }
  .hueco.mal {
    border-color: var(--v11-mal);
    background: var(--v11-mal-tinte);
  }
  .vacio {
    color: var(--v11-tinta-suave);
  }
  .bandeja {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ficha {
    border: 2px solid var(--v11-borde);
    background: var(--v11-panel);
    color: var(--v11-tinta);
    touch-action: none;
  }
  .ficha.volando {
    border-color: var(--v11-azul);
  }
  .ficha.elegida {
    border-color: var(--v11-azul);
    background: var(--v11-azul-tinte);
  }
  button:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
