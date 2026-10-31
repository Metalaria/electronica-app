<script lang="ts">
  // Mastery of a section next to its title in the reader (0.11, group B): the four segments, only once the section
  // has been practised; a tap opens «Practicar esto» (#/practicar/<parte>/<label>). Loaded in idle time so the
  // reader's first paint does not wait for it.
  import { onMount } from 'svelte';
  import { cargarDominio, dominioDe, estadoDominio } from '../../lib/aprendizaje/dominio.svelte';
  import { NOMBRE_NIVEL_DOMINIO, porcentaje } from '../../lib/aprendizaje/dominio';
  import MedidorDominio from './MedidorDominio.svelte';

  let { parte, label }: { parte: string; label: string } = $props();

  const d = $derived(estadoDominio.listo ? dominioDe(`${parte}/${label}`) : null);

  onMount(() => {
    const ir = () => void cargarDominio();
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(ir, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(ir, 800);
    return () => clearTimeout(t);
  });
</script>

{#if d && d.nivel !== 'nuevo'}
  <a
    class="boton-icono marca-dominio"
    href={`#/practicar/${parte}/${encodeURIComponent(label)}`}
    title={`Dominio: ${NOMBRE_NIVEL_DOMINIO[d.nivel].toLowerCase()} (${porcentaje(d.valor)})${d.repasar ? ', para repasar' : ''}. Practicar esta sección`}
    aria-label={`Dominio ${NOMBRE_NIVEL_DOMINIO[d.nivel].toLowerCase()}, ${porcentaje(d.valor)}${d.repasar ? ', para repasar' : ''}: practicar esta sección`}
    data-marca-dominio={d.nivel}><MedidorDominio nivel={d.nivel} valor={d.valor} repasar={d.repasar} /></a
  >
{/if}

<style>
  .marca-dominio {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    text-decoration: none;
  }
  .marca-dominio :global(.solo-lector) {
    display: none;
  }
</style>
