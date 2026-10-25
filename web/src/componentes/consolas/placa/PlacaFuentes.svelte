<script lang="ts">
  // «Fuentes» tab: credits and licences of the boards of «Placa en 3D / 2D» (public/consolas/placas/indice.json).
  import type { IdMaquina } from '../datos';
  import { cargarIndicePlacas, tienePlaca, type ResumenPlaca } from './datos';

  let { maquina }: { maquina: IdMaquina } = $props();
  let placas = $state<ResumenPlaca[]>([]);

  $effect(() => {
    const m = maquina;
    placas = [];
    if (!tienePlaca(m)) return;
    let vivo = true;
    cargarIndicePlacas()
      .then((i) => {
        if (vivo) placas = i.placas.filter((p) => p.maquina === m);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  });
</script>

{#if placas.length}
  <section class="placas-fuentes">
    <h3>Placa en 3D y en 2D</h3>
    <ul class="lista">
      {#each placas as p (p.id)}
        <li>
          <p class="titulo"><strong>{p.fuente.titulo}</strong>{#if !p.enlazada} <span class="marca">no es la placa original</span>{/if}</p>
          <p>{p.fuente.autor} · <a href={p.fuente.url} target="_blank" rel="noopener noreferrer">{p.fuente.url.replace(/^https?:\/\//, '')}</a></p>
          <p class="licencia">Licencia: {p.fuente.licencia}</p>
          <p class="uso">{p.fuente.uso}</p>
          <p class="uso">{p.aviso}</p>
        </li>
      {/each}
    </ul>
    <p class="nota">
      Los ficheros de las placas no se copian en la aplicación: <code>contenido/consolas_pcb.py</code> los lee de la carpeta de
      investigación y guarda solo la geometría que dibuja el visor (cobre, taladros, serigrafía, huellas y redes).
    </p>
  </section>
{/if}

<style>
  .placas-fuentes h3 {
    margin: 0 0 8px;
    color: var(--titulos);
  }
  .lista {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lista li {
    padding: 10px 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  p {
    margin: 3px 0;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .licencia {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .uso,
  .nota {
    color: var(--tinta-suave);
  }
  .marca {
    margin-left: 4px;
    padding: 1px 6px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--c-importante) 14%, transparent);
    color: var(--tinta);
    font-size: 12px;
    font-weight: 700;
  }
  code {
    font-family: var(--mono);
    font-size: 0.92em;
  }
</style>
