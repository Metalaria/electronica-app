<script lang="ts">
  // Start page (0.9, from the approved mockup «Main.dc.html»): greeting; on the left «Seguir leyendo», the
  // streak and today's goal side by side, «Repaso pendiente»; on the right the book as a path of chapters.
  // Two columns from ~730 px of content (tablet, desktop), one on the phone. Below: other recent readings,
  // the reading and exercise progress (ProgresoInicio) and shortcuts.
  import { onMount } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { usuario } from '../lib/usuario.svelte';
  import { rotuloParte } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { abrirBuscador } from '../lib/acciones';
  import { hrefParte } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import ProgresoInicio from './aprender/ProgresoInicio.svelte';
  import SeguirLeyendo from './inicio/SeguirLeyendo.svelte';
  import Racha from './inicio/Racha.svelte';
  import Objetivo from './inicio/Objetivo.svelte';
  import RepasoHoy from './inicio/RepasoHoy.svelte';
  import CaminoLibro from './inicio/CaminoLibro.svelte';
  import Chip from './ui09/Chip.svelte';
  import Rotulo from './ui09/Rotulo.svelte';
  import { destinoActual, enPalabras } from './inicio/destino.svelte';

  const indice = $derived(app.indice!);
  const destino = $derived(destinoActual());
  const nombre = $derived((usuario.prefs.nombre ?? '').trim());

  const entrada = $derived.by(() => {
    const d = destino;
    if (!d) return '';
    const num = d.seccion?.num;
    if (d.tipo === 'leccion') {
      const quedan = Math.max(1, d.pasos - d.paso);
      return `Hoy toca la sección ${num ?? d.capitulo}: te ${quedan === 1 ? 'queda un paso' : `quedan ${enPalabras(quedan)} pasos`}.`;
    }
    if (d.tipo === 'lectura') return num ? `Sigues en la sección ${num}, ${d.seccion!.titulo}.` : `Sigues en ${d.capitulo}.`;
    return `Empieza por ${d.capitulo}.`;
  });

  const recientes = $derived(
    Object.entries(usuario.posiciones)
      .filter(([id]) => indice.partes[id] && id !== destino?.parte)
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, 3)
      .map(([id, pos]) => {
        const info = indice.partes[id]!;
        const sec = info.secciones?.find((s) => s.label === pos.sec);
        return { id, info, sec };
      }),
  );
  const totalPersonal = $derived(Object.keys(usuario.marcadores).length + Object.keys(usuario.notas).length);

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>Electrónica Práctica Avanzada</title></svelte:head>

<div class="inicio">
  <header class="saludo">
    <h1>{nombre ? `Hola, ${nombre}` : 'Hola'}</h1>
    {#if entrada}<p>{entrada}</p>{/if}
  </header>

  {#if app.modo === 'muestra'}
    <p class="muestra">
      Se está mostrando el <strong>contenido de muestra</strong>. Para ver el libro completo, genere
      <code>web/public/libro/</code> con <code>python3 contenido/generar.py</code>.
    </p>
  {/if}

  <div class="columnas">
    <div class="columna">
      <SeguirLeyendo />
      <div class="pareja">
        <Racha />
        <Objetivo />
      </div>
      <RepasoHoy />
      {#if recientes.length}
        <nav class="recientes" aria-label="También leyendo">
          <Rotulo>También leyendo</Rotulo>
          <div class="chips">
            {#each recientes as r (r.id)}
              <Chip href={hrefParte(r.id)} color={colorBloque(r.info.color)}>
                <span class="recorte">{rotuloParte(r.id)}{#if r.sec}{` · ${r.sec.num ?? ''} ${r.sec.titulo}`}{/if}</span>
              </Chip>
            {/each}
          </div>
        </nav>
      {/if}
    </div>

    <CaminoLibro actual={destino?.parte ?? ''} seccion={destino?.seccion?.num ?? ''} />
  </div>

  <ProgresoInicio />

  <nav class="atajos" aria-label="Atajos">
    <Rotulo>Atajos</Rotulo>
    <div class="chips">
      <Chip onclick={abrirBuscador}><Icono nombre="buscar" tam={17} /> Buscar</Chip>
      <Chip href="#/glosario"><Icono nombre="glosario" tam={17} /> Glosario</Chip>
      <Chip href="#/componentes"><Icono nombre="componentes" tam={17} /> Componentes animados</Chip>
      <Chip href="#/conceptos"><Icono nombre="conceptos" tam={17} /> Conceptos animados</Chip>
      <Chip href="#/marcadores"
        ><Icono nombre="marcador" tam={17} /> Marcadores y notas{#if totalPersonal}<span class="cuenta">{totalPersonal}</span>{/if}</Chip
      >
    </div>
    <p class="edicion">Electrónica Práctica Avanzada · edición {indice.edicion}</p>
  </nav>
</div>

<style>
  .inicio {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .inicio {
      padding: 16px 16px 48px;
    }
  }
  .saludo {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 30px;
    font-weight: 700;
    line-height: 1.15;
  }
  .saludo p {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 16px;
  }
  .muestra {
    max-width: 44em;
    margin: 0;
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

  /* the mockup's two flexible columns (330 px minimum each): side by side on tablets and desktops */
  .columnas {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 24px;
  }
  .columnas > :global(*) {
    flex: 1 1 330px;
    min-width: 0;
  }
  .columna {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .pareja {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .pareja > :global(*) {
    flex: 1 1 150px;
    min-width: 0;
  }

  .recientes,
  .atajos {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 8px;
  }
  .recorte {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cuenta {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--linea);
    color: var(--tinta);
    font-size: 12px;
    line-height: 19px;
    text-align: center;
  }
  .edicion {
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 13px;
  }
</style>
