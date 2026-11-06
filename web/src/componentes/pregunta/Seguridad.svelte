<script lang="ts">
  // 1.0 «¿Qué seguridad tiene?»: one optional tap after a right answer — «Lo sabía», «Dudaba», «He adivinado». It never
  // blocks anything (no step waits for it) and nothing is stored when it is skipped. The spaced review uses it
  // (lib/aprendizaje/seguridad.ts): a right answer that was guessed comes back sooner.
  import { NIVELES_SEGURIDAD, NOMBRE_SEGURIDAD, type NivelSeguridad } from '../../lib/aprendizaje/seguridad';

  let { item }: { item: string } = $props();
  let elegido = $state<NivelSeguridad | null>(null);
  let aviso = $state('');

  async function elegir(s: NivelSeguridad) {
    elegido = s;
    aviso = '';
    try {
      const { marcarSeguridad } = await import('../../lib/aprendizaje/seguridad.svelte');
      await marcarSeguridad(item, s);
      aviso = s === 'sabia' ? 'Anotado.' : 'Anotado: volverá a salir antes en el repaso.';
    } catch {
      aviso = 'No se ha podido guardar todavía: se volverá a intentar.';
    }
  }
</script>

<div class="seguridad" role="group" aria-label="¿Qué seguridad tenía? (opcional)" data-seguridad={elegido ?? ''}>
  <span class="rot">¿Qué seguridad tenía? <span class="opc">(opcional)</span></span>
  <div class="botones">
    {#each NIVELES_SEGURIDAD as s (s)}
      <button type="button" class="chip" aria-pressed={elegido === s} onclick={() => elegir(s)} data-nivel-seguridad={s}>{NOMBRE_SEGURIDAD[s]}</button>
    {/each}
  </div>
  <span class="aviso" aria-live="polite">{aviso}</span>
</div>

<style>
  .seguridad {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;
  }
  .rot {
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .opc {
    font-weight: 400;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 22px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 14.5px;
    font-weight: 600;
  }
  .chip:hover {
    background: var(--hover);
  }
  .chip[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento);
    color: var(--fondo);
  }
  .aviso {
    flex-basis: 100%;
    min-height: 1.2em;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
</style>
