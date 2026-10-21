<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta, navegarDesdeCapa } from '../lib/ruta.svelte';
  import { usuario } from '../lib/usuario.svelte';
  import { ordenLectura, tomoDe } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { abrirBuscador, cerrarLateral } from '../lib/acciones';
  import Icono from './Icono.svelte';
  import Insignia from './Insignia.svelte';

  const indice = $derived(app.indice!);

  // Parts that are not in any volume go to a final group.
  const sueltas = $derived.by(() => {
    const enTomos = new Set(indice.tomos.flatMap((t) => t.partes));
    return ordenLectura().filter((p) => !enTomos.has(p));
  });

  let tomosAbiertos = $state<Record<string, boolean>>({});
  let partesAbiertas = $state<Record<string, boolean>>({});
  let lista: HTMLElement | undefined = $state();

  // The volume of the part being read is always open.
  $effect(() => {
    const t = ruta.parte ? tomoDe(ruta.parte) : indice.tomos[0]?.id;
    if (t && tomosAbiertos[t] === undefined) tomosAbiertos[t] = true;
  });

  // Keep the current chapter in view inside the sidebar.
  $effect(() => {
    void ruta.parte;
    void app.lateral;
    tick().then(() => {
      const el = lista?.querySelector<HTMLElement>('a.capitulo[aria-current="page"]');
      el?.scrollIntoView({ block: 'nearest' });
    });
  });

  function abiertoTomo(id: string): boolean {
    return tomosAbiertos[id] ?? false;
  }

  function abiertaParte(id: string): boolean {
    return partesAbiertas[id] ?? id === ruta.parte;
  }

  function corto(titulo: string): string {
    return titulo.split(' — ')[0] ?? titulo;
  }

  // Inside the drawer, links replace the drawer's history entry instead of stacking on it.
  function enlace(ev: MouseEvent) {
    const a = (ev.target as Element).closest('a');
    if (!a || !app.movil || !app.lateral) return;
    const href = a.getAttribute('href');
    if (!href?.startsWith('#')) return;
    ev.preventDefault();
    navegarDesdeCapa(href);
  }

  const totalPersonal = $derived(Object.keys(usuario.marcadores).length + Object.keys(usuario.notas).length);
</script>

{#if app.movil && app.lateral}
  <button class="velo" aria-label="Cerrar el índice" onclick={cerrarLateral}></button>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<aside
  class="lateral"
  class:movil={app.movil}
  class:abierto={app.lateral}
  aria-label="Índice del libro"
  aria-hidden={app.movil && !app.lateral ? 'true' : undefined}
  inert={app.movil && !app.lateral}
  onclick={enlace}
>
  <div class="cabecera">
    <a class="marca" href="#/" title="Inicio">
      <span class="logo" aria-hidden="true">
        <svg viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="230" fill="#1A3A5C" /><path d="M196 512H330M694 512H828" stroke="#F4F1EA" stroke-width="56" stroke-linecap="round" /><circle cx="176" cy="512" r="64" fill="#F4F1EA" /><circle cx="848" cy="512" r="64" fill="#F4F1EA" /><rect x="318" y="392" width="388" height="240" rx="64" fill="#F4F1EA" /><rect x="388" y="392" width="40" height="240" fill="#A6552B" /><rect x="458" y="392" width="40" height="240" fill="#8A1F3D" /><rect x="528" y="392" width="40" height="240" fill="#1F6F5C" /><rect x="606" y="392" width="28" height="240" fill="#C9A227" /></svg>
      </span>
      <span class="nombre">
        <strong>Electrónica Práctica Avanzada</strong>
        <small>Edición {indice.edicion}</small>
      </span>
    </a>
    {#if app.movil}
      <button class="boton-icono" aria-label="Cerrar el índice" onclick={cerrarLateral}><Icono nombre="x" /></button>
    {/if}
  </div>

  <nav class="atajos" aria-label="Accesos">
    <a href="#/" aria-current={ruta.vista === 'inicio' ? 'page' : undefined}><Icono nombre="inicio" /> Inicio</a>
    <button type="button" onclick={abrirBuscador}><Icono nombre="buscar" /> Buscar <kbd>Ctrl K</kbd></button>
    <a href="#/glosario" aria-current={ruta.vista === 'glosario' ? 'page' : undefined}><Icono nombre="glosario" /> Glosario</a>
    <a href="#/simulador" aria-current={ruta.vista === 'simulador' ? 'page' : undefined}><Icono nombre="simulador" /> Simulador</a>
    <a href="#/componentes" aria-current={ruta.vista === 'componentes' ? 'page' : undefined}><Icono nombre="componentes" /> Componentes animados</a>
    <a href="#/marcadores" aria-current={ruta.vista === 'marcadores' ? 'page' : undefined}>
      <Icono nombre="marcador" /> Marcadores y notas
      {#if totalPersonal}<span class="cuenta">{totalPersonal}</span>{/if}
    </a>
  </nav>

  <nav class="indice" aria-label="Capítulos" bind:this={lista}>
    {#each indice.tomos as tomo (tomo.id)}
      <section class="tomo">
        <button
          type="button"
          class="tomo-cab"
          aria-expanded={abiertoTomo(tomo.id)}
          onclick={() => (tomosAbiertos[tomo.id] = !abiertoTomo(tomo.id))}
        >
          <span class="tomo-num">Tomo {tomo.id}</span>
          <span class="tomo-tit">{tomo.titulo}</span>
          <span class="chev" class:girado={abiertoTomo(tomo.id)}><Icono nombre="chevron" tam={16} /></span>
        </button>
        {#if abiertoTomo(tomo.id)}
          <ul>
            {#each tomo.partes.filter((p) => indice.partes[p]) as id (id)}
              {@render parte(id)}
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
    {#if sueltas.length}
      <section class="tomo">
        <div class="tomo-cab estatico"><span class="tomo-num">Material de consulta</span></div>
        <ul>
          {#each sueltas as id (id)}
            {@render parte(id)}
          {/each}
        </ul>
      </section>
    {/if}
  </nav>
</aside>

{#snippet parte(id: string)}
  {@const p = indice.partes[id]!}
  {@const secs = p.secciones ?? []}
  {@const actual = ruta.parte === id}
  <li class:actual>
    <div class="fila">
      <a
        class="capitulo"
        href={id === 'glosario' ? '#/glosario' : `#/${id}`}
        aria-current={actual ? 'page' : undefined}
        title={p.titulo}
      >
        <Insignia parte={id} />
        <span class="texto">{corto(p.titulo)}</span>
      </a>
      {#if secs.length}
        <button
          type="button"
          class="desplegar"
          aria-label={abiertaParte(id) ? 'Ocultar secciones' : 'Mostrar secciones'}
          aria-expanded={abiertaParte(id)}
          onclick={() => (partesAbiertas[id] = !abiertaParte(id))}
        >
          <span class="chev" class:girado={abiertaParte(id)}><Icono nombre="chevron" tam={15} /></span>
        </button>
      {/if}
    </div>
    {#if secs.length && abiertaParte(id)}
      <ul class="secciones" style:--c={colorBloque(p.color)}>
        {#each secs as s (s.label)}
          <li>
            <a
              href={`#/${id}/${s.label}`}
              class:activa={actual && app.seccion?.label === s.label}
              aria-current={actual && app.seccion?.label === s.label ? 'location' : undefined}
            >
              <span class="sn">{s.num}</span>
              <span class="st">{s.titulo}</span>
              {#if usuario.marcadores[s.label]}<span class="pin" title="Marcador"><Icono nombre="marcador-lleno" tam={12} /></span>{/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

<style>
  .lateral {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    width: var(--ancho-lateral);
    background: var(--fondo-lateral);
    border-right: 1px solid var(--linea);
    font-family: var(--sans);
    overflow: hidden;
  }
  .lateral.movil {
    width: min(88vw, 360px);
    transform: translateX(-102%);
    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s linear 0.24s;
    visibility: hidden;
    box-shadow: var(--sombra-alta);
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .lateral.movil.abierto {
    transform: none;
    visibility: visible;
    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .velo {
    position: fixed;
    inset: 0;
    z-index: 29;
    border: 0;
    background: var(--scrim);
    animation: aparecer 0.2s ease;
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }

  .cabecera {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 12px 10px 16px;
  }
  .marca {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 11px;
    min-width: 0;
    color: var(--titulos);
    text-decoration: none;
  }
  .logo svg {
    display: block;
    width: 34px;
    height: 34px;
  }
  .nombre {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;
  }
  .nombre strong {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.005em;
  }
  .nombre small {
    margin-top: 2px;
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }

  .atajos {
    display: grid;
    gap: 1px;
    padding: 4px 8px 10px;
    border-bottom: 1px solid var(--linea);
  }
  .atajos a,
  .atajos button {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta);
    font-size: 15px;
    text-align: left;
    text-decoration: none;
  }
  .atajos a :global(svg),
  .atajos button :global(svg) {
    color: var(--tinta-suave);
  }
  .atajos a:hover,
  .atajos button:hover {
    background: var(--hover);
  }
  .atajos a[aria-current='page'] {
    background: var(--hover);
    font-weight: 600;
  }
  kbd {
    margin-left: auto;
    padding: 1px 6px;
    border: 1px solid var(--linea);
    border-radius: 5px;
    color: var(--tinta-tenue);
    font-family: var(--sans);
    font-size: 11.5px;
  }
  .lateral.movil kbd {
    display: none;
  }
  .cuenta {
    margin-left: auto;
    min-width: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--linea);
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
    text-align: center;
  }

  .indice {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px 8px 40px;
    scrollbar-width: thin;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tomo + .tomo {
    margin-top: 2px;
  }
  .tomo-cab {
    display: grid;
    grid-template-columns: 1fr auto;
    width: 100%;
    padding: 10px 10px 8px;
    border: 0;
    border-radius: 8px;
    background: none;
    text-align: left;
  }
  .tomo-cab:hover {
    background: var(--hover);
  }
  .tomo-cab.estatico {
    padding-top: 14px;
  }
  .tomo-num {
    grid-column: 1;
    color: var(--tinta-tenue);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .tomo-tit {
    grid-column: 1;
    margin-top: 1px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.3;
  }
  .tomo-cab .chev {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    color: var(--tinta-tenue);
  }
  .chev {
    display: inline-grid;
    transition: transform 0.18s;
  }
  .chev.girado {
    transform: rotate(90deg);
  }

  .fila {
    display: flex;
    align-items: center;
  }
  .capitulo {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 40px;
    padding: 5px 6px 5px 8px;
    border-radius: 8px;
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.25;
    text-decoration: none;
  }
  .capitulo:hover {
    background: var(--hover);
  }
  .capitulo[aria-current='page'] {
    background: var(--superficie);
    box-shadow: var(--sombra);
    font-weight: 600;
  }
  .texto {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .desplegar {
    display: grid;
    flex: none;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta-tenue);
  }
  .desplegar:hover {
    background: var(--hover);
    color: var(--tinta);
  }
  .secciones {
    margin: 2px 0 8px 22px;
    padding-left: 10px;
    border-left: 1.5px solid var(--linea);
  }
  .secciones a {
    position: relative;
    display: flex;
    gap: 8px;
    min-height: 34px;
    padding: 6px 8px;
    border-radius: 7px;
    color: var(--tinta-suave);
    font-size: 13.8px;
    line-height: 1.3;
    text-decoration: none;
  }
  .secciones a:hover {
    background: var(--hover);
    color: var(--tinta);
  }
  .secciones a.activa {
    color: var(--tinta);
    font-weight: 600;
  }
  .secciones a.activa::before {
    content: '';
    position: absolute;
    left: -11.5px;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 2px;
    background: var(--acento);
  }
  .sn {
    flex: none;
    min-width: 2.4em;
    color: var(--acento);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  li:not(.actual) .sn {
    color: var(--tinta-tenue);
  }
  .st {
    flex: 1;
  }
  .pin {
    flex: none;
    color: var(--acento);
  }
</style>
