<script lang="ts">
  // «Animación | Pieza 3D» switch of the component pages: the animated scene (often a circuit, not a
  // drawing of the part) or the physical model of the part. Named by what each shows, because «2D | 3D»
  // suggested the same thing in two styles. The choice is remembered (compartir.svelte.ts) and applies to
  // every component page and to the gallery.
  import { vista3d, ponerVista } from './compartir.svelte';

  let { deshabilitado3d = false, titulo = '' }: { deshabilitado3d?: boolean; titulo?: string } = $props();
</script>

<div class="conmutador" role="radiogroup" aria-label="Vista del componente">
  <button type="button" role="radio" aria-checked={vista3d.modo === '2d' || deshabilitado3d} data-vista="2d" onclick={() => ponerVista('2d')} title="Animación de cómo funciona">Animación</button>
  <button
    type="button"
    role="radio"
    aria-checked={vista3d.modo === '3d' && !deshabilitado3d}
    data-vista="3d"
    disabled={deshabilitado3d}
    onclick={() => ponerVista('3d')}
    title={deshabilitado3d ? titulo || 'Sin vista 3D en este dispositivo' : 'Modelo 3D: cómo es la pieza por fuera y por dentro'}>Pieza 3D</button
  >
</div>

<style>
  .conmutador {
    display: inline-flex;
    padding: 3px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie-2);
    font-family: var(--sans);
  }
  button {
    min-width: 56px;
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }
  button[aria-checked='true'] {
    background: var(--superficie);
    color: var(--acento);
    box-shadow:
      0 0 0 1px var(--acento-borde),
      0 1px 3px rgba(0, 0, 0, 0.08);
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
    }
  }
</style>
