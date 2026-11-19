<script lang="ts">
  // 1.3 (tactil13): fine adjust after a placement — four small arrows around what was just placed (a lead, a leg, a
  // wire's end), each on its own side, that move it one hole (or to the next node) that way without dragging again.
  // Around it, not in a bar under it, so they cover only its own neighbourhood and not the place of the next tap.
  // Buttons, so Enter and Space work; the arrow keys move it too while one has the focus, and Escape closes them. A
  // tap anywhere else, or a scroll of the page, closes them. Fixed to the window (in client px, inside it), so an
  // arrow by the edge of a clipped bench is not cut nor pushed over the thing; the host says what each move did in its
  // live region.
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import { DIRECCION_TECLA, VECTOR, type Direccion } from './precision';

  let {
    x,
    y,
    nombre,
    paso = 'un agujero',
    puede = () => true,
    mover,
    cerrar,
  }: {
    /** Where the placed thing is (client px). */
    x: number;
    y: number;
    /** What is moved, for the labels («la punta roja»). */
    nombre: string;
    /** One step, in words («un agujero»; «al nodo de al lado» on a schematic). */
    paso?: string;
    /** Whether there is somewhere to go that way (an arrow that cannot move it is not shown). */
    puede?: (d: Direccion) => boolean;
    mover: (d: Direccion) => void;
    cerrar: () => void;
  } = $props();

  /** Size of each arrow and its distance from the thing (CSS px). */
  const LADO = 44;
  const R = 50;
  const FLECHAS: { d: Direccion; t: string }[] = [
    { d: 'arriba', t: 'arriba' },
    { d: 'izquierda', t: 'a la izquierda' },
    { d: 'derecha', t: 'a la derecha' },
    { d: 'abajo', t: 'abajo' },
  ];
  /**
   * Each arrow on its side of the thing; by an edge of the window, where it does not fit, beyond the opposite arrow
   * (never pushed over the thing, where a finger going for the thing would get it instead).
   */
  const sitio = (d: Direccion) => {
    const [ux, uy] = VECTOR[d];
    const w = typeof innerWidth === 'number' ? innerWidth : 400;
    const h = typeof innerHeight === 'number' ? innerHeight : 800;
    const m = LADO / 2 + 2;
    const cabe = (cx: number, cy: number) => cx >= m && cx <= w - m && cy >= m && cy <= h - m;
    let cx = x + ux * R;
    let cy = y + uy * R;
    if (!cabe(cx, cy) && cabe(x - ux * 2 * R, y - uy * 2 * R)) {
      cx = x - ux * 2 * R;
      cy = y - uy * 2 * R;
    }
    cx = Math.min(Math.max(cx, m), w - m);
    cy = Math.min(Math.max(cy, m), h - m);
    return { left: cx - LADO / 2 - base.x, top: cy - LADO / 2 - base.y };
  };

  // (fixed to the window: corrected for a transformed ancestor, which would make it relative to that ancestor)
  let caja: HTMLDivElement | undefined = $state();
  let base = $state({ x: 0, y: 0 });
  $effect(() => {
    const el = caja;
    if (!el) return;
    const r = el.getBoundingClientRect();
    base = { x: r.left, y: r.top };
  });
  // a scroll of the page moves the thing away from the arrows: they close
  $effect(() => {
    const f = () => cerrar();
    addEventListener('scroll', f, { capture: true, passive: true });
    return () => removeEventListener('scroll', f, { capture: true });
  });

  function tecla(ev: KeyboardEvent) {
    const d = DIRECCION_TECLA[ev.key];
    if (d && puede(d)) {
      ev.preventDefault();
      ev.stopPropagation();
      mover(d);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      cerrar();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="ajuste" bind:this={caja} role="group" aria-label={`Ajuste fino de ${nombre}: las flechas lo mueven ${paso}`} data-ajuste-fino onkeydown={tecla} onpointerdown={(ev) => ev.stopPropagation()}>
  {#each FLECHAS.filter((f) => puede(f.d)) as f (f.d)}
    {@const p = sitio(f.d)}
    <button
      type="button"
      aria-label={`Mover ${nombre} ${paso} ${f.t}`}
      title={`${paso[0]!.toUpperCase()}${paso.slice(1)} ${f.t}`}
      data-ajuste={f.d}
      style:left={`${p.left}px`}
      style:top={`${p.top}px`}
      onclick={() => mover(f.d)}
    >
      {#if f.d === 'izquierda'}<ArrowLeft size={20} aria-hidden="true" />{:else if f.d === 'arriba'}<ArrowUp size={20} aria-hidden="true" />{:else if f.d === 'abajo'}<ArrowDown size={20} aria-hidden="true" />{:else}<ArrowRight size={20} aria-hidden="true" />{/if}
    </button>
  {/each}
</div>

<style>
  .ajuste {
    position: fixed;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    z-index: 55;
  }
  button {
    position: absolute;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1.5px solid var(--linea, #ccd);
    border-radius: 50%;
    background: color-mix(in srgb, var(--superficie, #fff) 90%, transparent);
    color: var(--tinta, #1d2a3a);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
    touch-action: manipulation;
  }
  button:hover {
    background: var(--superficie, #fff);
    border-color: var(--acento, #2563eb);
  }
  button:focus-visible {
    outline: 3px solid var(--acento, #2563eb);
    outline-offset: 1px;
  }
</style>
