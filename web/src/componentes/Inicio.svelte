<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { usuario } from '../lib/usuario.svelte';
  import { rotuloParte } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { abrirBuscador } from '../lib/acciones';
  import Icono from './Icono.svelte';
  import ProgresoInicio from './aprender/ProgresoInicio.svelte';
  import SeguirLeyendo from './inicio/SeguirLeyendo.svelte';
  import RepasoHoy from './inicio/RepasoHoy.svelte';
  import MapaLibro from './inicio/MapaLibro.svelte';

  const indice = $derived(app.indice!);
  const capitulos = $derived(Object.values(indice.partes).filter((p) => p.tipo === 'capitulo').length);
  const apendices = $derived(Object.values(indice.partes).filter((p) => p.tipo === 'apendice').length);

  const recientes = $derived(
    Object.entries(usuario.posiciones)
      .filter(([id]) => indice.partes[id])
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, 4)
      .map(([id, pos]) => {
        const info = indice.partes[id]!;
        const sec = info.secciones?.find((s) => s.label === pos.sec);
        return { id, pos, info, sec };
      }),
  );
  const totalPersonal = $derived(Object.keys(usuario.marcadores).length + Object.keys(usuario.notas).length);

  function hace(t: number): string {
    const s = (Date.now() - t) / 1000;
    if (s < 90) return 'hace un momento';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>Electrónica Práctica Avanzada</title></svelte:head>

<div class="inicio">
  <section class="portada">
    {#if indice.bloques?.length}
      <div class="espectro" aria-hidden="true">
        {#each indice.bloques as b (b.color)}<span style:background={colorBloque(b.color)}></span>{/each}
      </div>
    {/if}
    <p class="sobre">Gonzalo Mejías</p>
    <h1>Electrónica Práctica Avanzada</h1>
    <p class="datos">
      Edición {indice.edicion} · {indice.tomos.length}
      {indice.tomos.length === 1 ? 'tomo' : 'tomos'} · {capitulos} capítulos{apendices ? ` · ${apendices} apéndices` : ''}
    </p>
    {#if app.modo === 'muestra'}
      <p class="muestra">
        Se está mostrando el <strong>contenido de muestra</strong>. Para ver el libro completo, genere
        <code>web/public/libro/</code> con <code>python3 contenido/generar.py</code>.
      </p>
    {/if}
    <div class="acciones">
      <button class="boton" onclick={abrirBuscador}><Icono nombre="buscar" tam={17} /> Buscar</button>
      <a class="boton" href="#/glosario"><Icono nombre="glosario" tam={17} /> Glosario</a>
      <a class="boton" href="#/componentes"><Icono nombre="componentes" tam={17} /> Componentes animados</a>
      <a class="boton" href="#/conceptos"><Icono nombre="conceptos" tam={17} /> Conceptos animados</a>
      <a class="boton" href="#/marcadores"
        ><Icono nombre="marcador" tam={17} /> Marcadores y notas{#if totalPersonal}<span class="cuenta">{totalPersonal}</span>{/if}</a
      >
    </div>
  </section>

  <!-- Where to go now: the reading left open and today's flashcards. -->
  <div class="destacados">
    <SeguirLeyendo />
    <RepasoHoy />
  </div>
  {#if recientes.length > 1}
    <nav class="otras" aria-label="Otras lecturas recientes">
      <span class="otras-tit">También leyendo</span>
      {#each recientes.slice(1) as r (r.id)}
        <a href={`#/${r.id}`} style:--c={colorBloque(r.info.color)}>
          <i aria-hidden="true"></i>{rotuloParte(r.id)}{#if r.sec}{` · ${r.sec.num} ${r.sec.titulo}`}{/if}
          <span class="cuando">{hace(r.pos.t)}</span>
        </a>
      {/each}
    </nav>
  {/if}

  <MapaLibro actual={recientes[0]?.id ?? ''} />

  <ProgresoInicio />
</div>

<style>
  .inicio {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) 64px;
    font-family: var(--sans);
  }
  .portada {
    padding: clamp(36px, 7vw, 72px) 0 28px;
    border-bottom: 1px solid var(--linea);
  }
  .espectro {
    display: flex;
    gap: 4px;
    width: min(260px, 60%);
    margin-bottom: 22px;
  }
  .espectro span {
    flex: 1;
    height: 6px;
    border-radius: 3px;
  }
  .sobre {
    margin: 0 0 10px;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(36px, 6.4vw, 60px);
    font-weight: 700;
    line-height: 1.04;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .datos {
    margin: 14px 0 0;
    color: var(--tinta-suave);
    font-size: 16.5px;
  }
  .muestra {
    max-width: 44em;
    margin: 18px 0 0;
    padding: 10px 14px;
    border: 1px solid var(--c-importante);
    border-radius: 10px;
    background: rgb(from var(--c-importante) r g b / var(--alfa-caja));
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.45;
  }
  .muestra code {
    font-family: var(--mono);
    font-size: 0.9em;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 24px;
  }
  .acciones .boton {
    min-height: 40px;
  }
  .cuenta {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--linea);
    color: var(--tinta-suave);
    font-size: 12px;
    line-height: 19px;
    text-align: center;
  }

  .destacados {
    display: grid;
    grid-template-columns: minmax(0, 2.1fr) minmax(250px, 1fr);
    gap: 14px;
    margin-top: 30px;
  }
  @media (max-width: 760px) {
    .destacados {
      grid-template-columns: 1fr;
    }
  }
  .otras {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin-top: 12px;
    font-size: 14px;
  }
  .otras-tit {
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 600;
  }
  .otras a {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    max-width: 100%;
    padding: 0 12px;
    overflow: hidden;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .otras a:hover {
    border-color: var(--c);
  }
  .otras i {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 3px;
    background: var(--c);
  }
  .cuando {
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
</style>
