<script lang="ts">
  // 1.1 «Proyectos por etapas»: the chip next to a section title of printed chapters 48–51 that teaches a stage
  // («Etapa 2 en el editor»), like «Ver la placa» (componentes/proyectos/VerPlaca.svelte). The map is static.
  import Wrench from '@lucide/svelte/icons/wrench';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { app } from '../../lib/estado.svelte';
  import { ETAPAS_DE_SECCION } from '../../lib/proyectos11/indice';

  let { label, compacto = false }: { label: string; compacto?: boolean } = $props();
  const etapas = $derived(ETAPAS_DE_SECCION[label] ?? []);
  const plano = (h: string) => h.replace(/<[^>]+>/g, '');

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a la sección ${r.num}` : 'Volver al libro' });
  }
</script>

{#each etapas as { parte, etapa } (etapa.id)}
  <a class="ver-etapa" class:compacto href={`#/etapas/${parte}/${etapa.n}`} onclick={salto} title={`Proyecto por etapas: ${plano(etapa.titulo)}`} data-ver-etapa={etapa.id}>
    <Wrench size={16} strokeWidth={2.2} /><span class="texto">Etapa {etapa.n}</span><span class="solo-lector">: {plano(etapa.titulo)}, en el editor</span>
  </a>
{/each}

<style>
  .ver-etapa {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: middle;
  }
  .ver-etapa:hover {
    background: var(--acento-suave);
    border-color: var(--acento);
  }
  .ver-etapa.compacto {
    min-height: 28px;
    padding: 0 9px;
    font-size: 12.5px;
  }
  @media (pointer: coarse) {
    .ver-etapa {
      min-height: 44px;
    }
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
