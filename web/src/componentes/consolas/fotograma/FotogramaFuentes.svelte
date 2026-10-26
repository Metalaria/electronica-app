<script lang="ts">
  // «Fuentes» of «Un fotograma»: where the timing comes from, how the emulators were validated and the licence of
  // every program traced. Loaded only for the machines with an adapter (the adapter module is fetched on demand).
  import type { IdMaquina } from '../datos';
  import { cargarAdaptador, tieneFotograma } from './maquinas';
  import { cargarIndiceFotograma } from './traza';
  import type { Adaptador, IndicePrograma } from './tipos';

  let { maquina }: { maquina: IdMaquina } = $props();
  let ad: Adaptador | null = $state.raw(null);
  let programas: IndicePrograma[] = $state([]);

  $effect(() => {
    const m = maquina;
    if (!tieneFotograma(m)) return;
    let vivo = true;
    Promise.all([cargarAdaptador(m), cargarIndiceFotograma(m)])
      .then(([a, i]) => {
        if (!vivo) return;
        ad = a;
        programas = i.programas;
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  });
</script>

{#if ad && ad.maquina === maquina}
  <section class="fotograma-fuentes">
    <h3>Un fotograma</h3>
    <p>{ad.fidelidad}</p>
    <ul class="lista">
      {#each ad.fuentes as f (f.titulo)}
        <li>
          <p class="titulo"><strong>{f.titulo}</strong></p>
          <p><a href={f.url} target="_blank" rel="noopener noreferrer">{f.url.replace(/^https?:\/\//, '')}</a></p>
          <p class="uso">{f.uso}</p>
        </li>
      {/each}
    </ul>
    {#each programas.filter((p) => p.juego) as p (p.id)}
      {@const j = p.juego!}
      <div class="juego">
        <p class="titulo"><strong>Un juego de verdad: {j.nombre}</strong></p>
        <p>{j.autor} · <a href={j.url} target="_blank" rel="noopener noreferrer">{j.url.replace(/^https?:\/\//, '')}</a>{j.commit ? ` · ${j.commit}` : ''}</p>
        <p class="uso">
          Licencia: {j.licencia}{#if j.licenciaTexto} · <a href="consolas/fotograma/{maquina}/{j.licenciaTexto}" target="_blank" rel="noopener noreferrer">texto de la licencia</a>{/if}.
          La ROM se usa sin modificar, solo para grabar la traza de un cuadro.
        </p>
      </div>
    {/each}
    <p class="nota">
      Programas: {#each programas as p, i (p.id)}{i ? '; ' : ''}«{p.titulo}» — {p.resumen}{/each}{programas.some((p) => p.tipo === 'juego') ? '' : ' Aún no hay juego homebrew elegido.'}
      La demostración es código propio de la aplicación (fuente en <code>contenido/consolas_demos/{maquina}/</code>).
    </p>
  </section>
{/if}

<style>
  .fotograma-fuentes {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .fotograma-fuentes p {
    margin: 4px 0;
    line-height: 1.45;
  }
  .lista {
    display: grid;
    gap: 8px;
    margin: 8px 0;
    padding: 0;
    list-style: none;
  }
  .uso,
  .nota {
    color: var(--tinta-suave);
    font-size: 14px;
  }
</style>
