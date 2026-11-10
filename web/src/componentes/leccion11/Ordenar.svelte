<script lang="ts">
  // 1.1 lessons: «ordene» — the items of a procedure, to put in order. Each item can be dragged by its grip (pointer:
  // mouse or finger) or moved with its «Subir» / «Bajar» buttons (keyboard and screen readers; the move is announced).
  import type { Texto } from '../../lib/leccion11/tipos';
  import { textoPlano } from '../../lib/leccion11/texto';
  import TextoVivo from './TextoVivo.svelte';

  let {
    elementos,
    orden,
    bloqueado,
    comprobado,
    valor,
    cambiar,
  }: {
    elementos: Texto[];
    orden: number[];
    bloqueado: boolean;
    comprobado: boolean;
    valor: (id: string) => string;
    cambiar: (orden: number[]) => void;
  } = $props();

  let anuncio = $state('');
  let lista: HTMLOListElement | undefined = $state();
  let arrastrando = $state<number | null>(null);

  function mover(desde: number, hasta: number) {
    if (bloqueado || hasta < 0 || hasta >= orden.length || desde === hasta) return;
    const o = [...orden];
    const [x] = o.splice(desde, 1);
    o.splice(hasta, 0, x!);
    cambiar(o);
    anuncio = `«${textoPlano(elementos[x!])}», ahora en el puesto ${hasta + 1} de ${o.length}.`;
  }
  function bajarPuntero(k: number, ev: PointerEvent) {
    if (bloqueado || ev.button !== 0) return;
    arrastrando = k;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }
  function moverPuntero(ev: PointerEvent) {
    if (arrastrando === null || !lista) return;
    const filas = [...lista.querySelectorAll<HTMLElement>(':scope > li')];
    let destino = filas.findIndex((f) => {
      const r = f.getBoundingClientRect();
      return ev.clientY < r.top + r.height / 2;
    });
    if (destino < 0) destino = filas.length - 1;
    if (destino !== arrastrando) {
      mover(arrastrando, destino);
      arrastrando = destino;
    }
  }
  function soltar(ev: PointerEvent) {
    arrastrando = null;
    const t = ev.currentTarget as Element;
    if (t.hasPointerCapture(ev.pointerId)) t.releasePointerCapture(ev.pointerId);
  }
</script>

<ol class="ordenar" bind:this={lista} data-ordenar>
  {#each orden as x, k (x)}
    <li class:bien={comprobado && x === k} class:mal={comprobado && x !== k} class:arrastrando={arrastrando === k} data-elemento={x}>
      <span
        class="asa"
        aria-hidden="true"
        onpointerdown={(ev) => bajarPuntero(k, ev)}
        onpointermove={moverPuntero}
        onpointerup={soltar}
        onpointercancel={soltar}
      >⠿</span>
      <span class="num" aria-hidden="true">{k + 1}</span>
      <span class="txt"><TextoVivo texto={elementos[x]} {valor} /></span>
      <span class="botones">
        <button type="button" aria-label={`Subir «${textoPlano(elementos[x])}»`} disabled={bloqueado || k === 0} onclick={() => mover(k, k - 1)} data-subir={x}>↑</button>
        <button type="button" aria-label={`Bajar «${textoPlano(elementos[x])}»`} disabled={bloqueado || k === orden.length - 1} onclick={() => mover(k, k + 1)} data-bajar={x}>↓</button>
      </span>
    </li>
  {/each}
</ol>
<div class="solo-lector" aria-live="polite">{anuncio}</div>

<style>
  .ordenar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 52px;
    padding: 6px 6px 6px 4px;
    border: 2px solid var(--v11-borde);
    border-radius: var(--v11-radio-opcion);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font-size: 15px;
    line-height: 1.35;
  }
  li.arrastrando {
    border-color: var(--v11-azul);
    background: var(--v11-azul-tinte);
  }
  li.bien {
    border-color: var(--v11-bien);
    background: var(--v11-bien-tinte);
  }
  li.mal {
    border-color: var(--v11-mal);
    background: var(--v11-mal-tinte);
  }
  .asa {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    min-height: 44px;
    color: var(--v11-tinta-suave);
    font-size: 20px;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .num {
    flex: none;
    color: var(--v11-tinta-suave);
    font-weight: 700;
  }
  .txt {
    flex: 1;
  }
  .botones {
    flex: none;
    display: flex;
    gap: 4px;
  }
  button {
    width: 44px;
    height: 44px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 10px;
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font-size: 18px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
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
