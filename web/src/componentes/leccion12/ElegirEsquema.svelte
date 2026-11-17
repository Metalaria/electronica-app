<script lang="ts">
  // 1.2.1 (piloto121) «Elija en el esquema»: the zones of the live schematic as a list of buttons (the keyboard's and
  // the screen reader's way; a tap on the drawing does the same through CircuitoVivo's targets). A wrong zone is
  // crossed out with its explanation and cannot be chosen again; the right one is marked when the card is solved.
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Elegir, EstadoElegir } from '../../lib/leccion12/hacer/tipos';
  import type { Texto } from '../../lib/leccion11/tipos';

  let { a, ea, resuelta, tocar }: { a: Elegir; ea: EstadoElegir; resuelta: boolean; tocar: (id: string) => void } = $props();
  const estado = (id: string) => (resuelta && a.bien.includes(id) ? 'bien' : ea.descartadas.includes(id) ? 'mal' : ea.elegidas.includes(id) ? 'elegida' : '');
  const plano = (t: Texto) => textoPlano(t);
</script>

<div class="a12 elegir" data-elegir>
  <p class="a12-suave">{a.todas ? 'Toque en el esquema todas las que cumplan, o elíjalas aquí:' : 'Toque en el esquema, o elija aquí:'}</p>
  <ul class="zonas">
    {#each a.zonas as z (z.id)}
      {@const st = estado(z.id)}
      <li>
        <button
          type="button"
          class="a12-boton zona"
          class:elegida={st === 'elegida'}
          class:mal={st === 'mal'}
          class:bien={st === 'bien'}
          aria-pressed={st === 'elegida' || st === 'bien'}
          aria-disabled={st === 'mal' || resuelta ? 'true' : undefined}
          onclick={() => !resuelta && st !== 'mal' && tocar(z.id)}
          data-boton-zona-esquema={z.id}
          data-estado={st}
        >{plano(z.rotulo)}{#if st === 'mal'}<span class="solo-lector"> (descartada)</span>{/if}</button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .zonas {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .zona.elegida {
    border-color: var(--v11-azul);
    background: var(--v11-azul-tinte);
  }
  .zona.mal {
    border-color: var(--v11-mal);
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
    text-decoration: line-through;
    cursor: default;
  }
  .zona.bien {
    border-color: var(--v11-bien);
    background: var(--v11-bien-tinte);
    color: var(--v11-bien-texto);
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
