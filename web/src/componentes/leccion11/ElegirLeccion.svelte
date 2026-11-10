<script lang="ts">
  // 1.1: the lesson route (#/leccion/<parte>/<label>[/<rest>]) opens the hand-authored lesson when the section has one
  // (libro/lecciones11/indice.json), and the 1.0 lesson otherwise — or when asked for it (…/clasica[/<n>]) or for one
  // of its own screens (practica-N, pregunta-N, fin). lib/leccion11/ruta.ts has the rule. Both are loaded on demand.
  import { ruta } from '../../lib/ruta.svelte';
  import { app } from '../../lib/estado.svelte';
  import { hayLeccion11 } from '../../lib/leccion11/datos';
  import { elegirModo, restoDeAncla } from '../../lib/leccion11/ruta';
  import { resolverEnlace } from '../../lib/enlaces';
  import ErrorCarga from '../ErrorCarga.svelte';

  let { parte, seccion }: { parte: string; seccion: string } = $props();

  // 1.1 deep links (lib/enlaces.ts): a part or section the book does not have opens «no encontrada» (never the
  // lessons' loading error); one written in another case (a link read before the index was loaded: epa://… is
  // compared in lower case) goes to the book's own spelling.
  const sitio = $derived.by((): 'esperando' | 'no' | 'si' | { parte: string; label: string } => {
    if (!app.indice) return 'esperando';
    if (!parte || !seccion) return 'no';
    if (app.indice.partes[parte]?.secciones?.some((x) => x.label === seccion)) return 'si';
    return resolverEnlace({ parte: parte.toLowerCase(), label: seccion.toLowerCase() }, app.indice) ?? 'no';
  });
  $effect(() => {
    const r = sitio;
    if (typeof r !== 'object') return;
    const resto = ruta.ancla.split('/').slice(1).join('/');
    location.replace(`#/leccion/${r.parte}/${r.label}${resto ? `/${resto}` : ''}`);
  });

  let hay = $state<boolean | null>(null);
  $effect(() => {
    const [p, s] = [parte, seccion];
    hay = null;
    if (sitio !== 'si') return;
    void hayLeccion11(p, s).then((x) => {
      if (p === parte && s === seccion) hay = x;
    });
  });
  const modo = $derived(hay === null ? null : elegirModo(restoDeAncla(ruta.ancla), hay));
</script>

{#if sitio === 'no'}
  <div class="no-encontrada" data-leccion-no-encontrada>
    <h1>No se encuentra esa lección</h1>
    {#if parte && seccion}
      <p>El enlace lleva a la sección «{seccion}» de «{parte}», que no está en esta edición del libro.</p>
    {:else}
      <p>El enlace no es una dirección de lección válida.</p>
    {/if}
    <p>Compruebe que la aplicación está al día, o búsquela en el índice.</p>
    <p><a class="boton primario" href="#/">Ir al índice del libro</a></p>
  </div>
{:else if modo === null}
  <div class="cargando" aria-live="polite"><span class="punto"></span> Abriendo la lección…</div>
{:else if modo === 'nueva'}
  {#await import('./Leccion11.svelte')}
    <div class="cargando" aria-live="polite"><span class="punto"></span> Abriendo la lección…</div>
  {:then m}
    {#key 'nueva'}
      <m.default {parte} {seccion} />
    {/key}
  {:catch e}
    <ErrorCarga grande titulo="No se pudo abrir la lección" error={e} />
  {/await}
{:else}
  {#await import('../leccion/Leccion.svelte')}
    <div class="cargando" aria-live="polite"><span class="punto"></span> Abriendo la lección…</div>
  {:then m}
    {#key 'clasica'}
      <m.default {parte} {seccion} clasica={!!hay} />
    {/key}
  {:catch e}
    <ErrorCarga grande titulo="No se pudo abrir la lección" error={e} />
  {/await}
{/if}

<style>
  .no-encontrada {
    max-width: 36rem;
    margin: 0 auto;
    padding: 20vh 16px 32px;
    color: var(--tinta);
  }
  .no-encontrada h1 {
    margin: 0 0 12px;
    font-size: 1.5rem;
  }
  .no-encontrada p {
    margin: 0 0 12px;
    color: var(--tinta-suave);
    line-height: 1.5;
  }
  .cargando {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 30vh 20px;
    color: var(--tinta-suave);
  }
  .punto {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--acento);
    animation: latido 1s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .punto {
      animation: none;
    }
  }
</style>
