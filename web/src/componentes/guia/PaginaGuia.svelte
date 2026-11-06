<script lang="ts">
  // 1.0 «Guía de uso» (#/guia[/<seccion>[/<apartado>]]): the in-app user guide. The content is data
  // (lib/guia/contenido.ts, bundled: it works offline) and the filter searches it (lib/guia/buscar.ts). On every
  // navigation the focus goes to the heading of what is shown (the subsection of a deep link, the section, or the
  // guide's title), so keyboard and screen reader users land on it.
  import { tick } from 'svelte';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { ruta } from '../../lib/ruta.svelte';
  import { GUIA, hrefGuia, seccionGuia, type BloqueGuia } from '../../lib/guia/contenido';
  import { buscarEnGuia } from '../../lib/guia/buscar';
  import Icono from '../Icono.svelte';

  const partes = $derived(ruta.ancla.split('/'));
  const idSeccion = $derived(partes[0] ?? '');
  const idApartado = $derived(partes[1] ?? '');
  const seccion = $derived(idSeccion ? seccionGuia(idSeccion) : undefined);
  const posicion = $derived(seccion ? GUIA.indexOf(seccion) : -1);
  const anterior = $derived(posicion > 0 ? GUIA[posicion - 1] : undefined);
  const siguiente = $derived(posicion >= 0 && posicion < GUIA.length - 1 ? GUIA[posicion + 1] : undefined);

  let consulta = $state('');
  const buscando = $derived(consulta.trim().length > 0);
  const resultados = $derived(buscando ? buscarEnGuia(consulta) : []);

  let titulo: HTMLElement | undefined = $state();

  const idApartadoDom = (s: string, a: string) => `guia-${s}-${a}`;

  // Every navigation inside the guide (and the first one): clear the filter, scroll and move the focus.
  $effect(() => {
    void ruta.n;
    const s = idSeccion;
    const a = idApartado;
    const y = ruta.y;
    consulta = '';
    void tick().then(() => {
      const destino = (a && document.getElementById(idApartadoDom(s, a))) || titulo;
      if (y != null) window.scrollTo(0, y);
      else if (a && destino && destino !== titulo) destino.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
      destino?.focus({ preventScroll: true });
    });
  });
</script>

<svelte:head><title>{seccion ? `${seccion.titulo} · Guía de uso` : 'Guía de uso'} · Electrónica Práctica Avanzada</title></svelte:head>

{#snippet bloque(b: BloqueGuia)}
  {#if b.t === 'p'}
    <p>{b.texto}</p>
  {:else if b.t === 'lista'}
    <ul>
      {#each b.items as it, i (i)}<li>{it}</li>{/each}
    </ul>
  {:else if b.t === 'pasos'}
    <ol class="pasos">
      {#each b.items as it, i (i)}<li>{it}</li>{/each}
    </ol>
  {:else if b.t === 'consejo'}
    <p class="nota consejo"><span class="icono-nota" aria-hidden="true"><Lightbulb size={18} /></span><span><strong>Consejo:</strong> {b.texto}</span></p>
  {:else if b.t === 'aviso'}
    <p class="nota aviso"><span class="icono-nota" aria-hidden="true"><TriangleAlert size={18} /></span><span><strong>Atención:</strong> {b.texto}</span></p>
  {:else if b.t === 'teclas'}
    <table class="teclas">
      <thead><tr><th scope="col">Tecla</th><th scope="col">Acción</th></tr></thead>
      <tbody>
        {#each b.filas as [k, v], i (i)}
          <tr><td><kbd>{k}</kbd></td><td>{v}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/snippet}

<div class="guia" data-guia={seccion?.id ?? (idSeccion ? 'desconocida' : 'indice')}>
  <header class="cab">
    {#if seccion}
      <a class="volver toque-44" href="#/guia"><ArrowLeft size={18} aria-hidden="true" /> Guía de uso</a>
    {:else}
      <h1 tabindex="-1" bind:this={titulo}>Guía de uso</h1>
      <p class="intro">
        Cómo se usa cada parte de la aplicación: qué es, cómo se maneja y algún consejo. Elija una sección o busque una palabra. La guía va dentro de
        la aplicación, así que también se lee sin conexión.
      </p>
    {/if}
    <div class="filtro" role="search" aria-label="En la guía">
      <label for="filtro-guia">Buscar en la guía</label>
      <div class="campo">
        <Icono nombre="buscar" tam={18} />
        <input
          id="filtro-guia"
          type="search"
          bind:value={consulta}
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="search"
          placeholder="Por ejemplo: token, avería, PDF"
          aria-describedby="cuenta-guia"
          data-filtro-guia
        />
      </div>
      <p class="cuenta" id="cuenta-guia" aria-live="polite">
        {#if buscando}{resultados.length === 0 ? 'Nada en la guía con esas palabras.' : resultados.length === 1 ? '1 apartado.' : `${resultados.length} apartados.`}{/if}
      </p>
    </div>
  </header>

  {#if buscando}
    <section class="resultados" aria-label="Resultados en la guía" data-resultados-guia={resultados.length}>
      {#if resultados.length}
        <ul>
          {#each resultados as r (`${r.seccion.id}/${r.apartado.id}`)}
            <li>
              <a class="resultado" href={hrefGuia(r.seccion.id, r.apartado.id)} data-resultado-guia={`${r.seccion.id}/${r.apartado.id}`}>
                <span class="donde">{r.seccion.titulo}</span>
                <span class="que">{r.apartado.titulo}</span>
                <span class="frag">{r.fragmento}</span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="vacio">Pruebe con otra palabra, o con el comienzo de una («sincro», «examen»). La búsqueda del libro está en «Buscar».</p>
      {/if}
    </section>
  {:else if seccion}
    <div class="con-indice">
      <nav class="lateral" aria-label="Secciones de la guía">
        <ol>
          {#each GUIA as s (s.id)}
            <li><a href={hrefGuia(s.id)} aria-current={s.id === seccion.id ? 'page' : undefined}>{s.titulo}</a></li>
          {/each}
        </ol>
      </nav>
      <article class="seccion" aria-labelledby="h-guia-seccion" data-seccion-guia={seccion.id}>
        <h1 id="h-guia-seccion" tabindex="-1" bind:this={titulo}>{seccion.titulo}</h1>
        <p class="resumen">{seccion.resumen}</p>
        {#if seccion.apartados.length > 1}
          <nav class="en-esta" aria-label="En esta sección">
            <ul>
              {#each seccion.apartados as a (a.id)}
                <li><a href={hrefGuia(seccion.id, a.id)}>{a.titulo}</a></li>
              {/each}
            </ul>
          </nav>
        {/if}
        {#each seccion.apartados as a (a.id)}
          <section class="apartado" aria-labelledby={idApartadoDom(seccion.id, a.id)} data-apartado={a.id}>
            <h2 id={idApartadoDom(seccion.id, a.id)} tabindex="-1">{a.titulo}</h2>
            {#each a.bloques as b, i (i)}
              {@render bloque(b)}
            {/each}
          </section>
        {/each}
        {#if seccion.enlaces.length}
          <section class="abrir" aria-labelledby="h-guia-abrir">
            <h2 id="h-guia-abrir">Abrir en la aplicación</h2>
            <ul>
              {#each seccion.enlaces as e (e.ruta + e.texto)}
                <li><a class="chip" href={e.ruta} data-enlace-app={e.ruta}>{e.texto}</a></li>
              {/each}
            </ul>
          </section>
        {/if}
        <nav class="vecinas" aria-label="Sección anterior y siguiente de la guía">
          {#if anterior}
            <a class="vecina" href={hrefGuia(anterior.id)} rel="prev"><ArrowLeft size={18} aria-hidden="true" /><span><small>Anterior</small>{anterior.titulo}</span></a>
          {:else}
            <span></span>
          {/if}
          {#if siguiente}
            <a class="vecina sig" href={hrefGuia(siguiente.id)} rel="next"><span><small>Siguiente</small>{siguiente.titulo}</span><ArrowRight size={18} aria-hidden="true" /></a>
          {/if}
        </nav>
      </article>
    </div>
  {:else}
    {#if idSeccion}
      <p class="vacio" role="status">No hay ninguna sección «{idSeccion}» en la guía. Estas son todas:</p>
    {/if}
    <nav aria-label="Secciones de la guía">
      <ol class="tarjetas">
        {#each GUIA as s, i (s.id)}
          <li>
            <a class="tarjeta t09-tarjeta" href={hrefGuia(s.id)} data-tarjeta-guia={s.id}>
              <span class="num" aria-hidden="true">{i + 1}</span>
              <span class="textos">
                <span class="tit">{s.titulo}</span>
                <span class="res">{s.resumen}</span>
              </span>
            </a>
          </li>
        {/each}
      </ol>
    </nav>
  {/if}
</div>

<style>
  .guia {
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 32px 64px;
    font-family: var(--sans);
    color: var(--tinta);
  }
  @media (max-width: 600px) {
    .guia {
      padding: 16px 16px 48px;
    }
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 30px;
    line-height: 1.2;
    scroll-margin-top: calc(var(--alto-barra) + 16px);
  }
  h2 {
    margin: 0 0 8px;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.25;
    scroll-margin-top: calc(var(--alto-barra) + 16px);
  }
  /* headings take the focus on navigation (tabindex -1) but are not controls: no focus ring on them */
  h1:focus,
  h2:focus {
    outline: none;
  }
  .intro,
  .resumen {
    max-width: 46em;
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 16px;
    line-height: 1.45;
  }
  .volver {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }
  .volver:hover {
    text-decoration: underline;
  }

  /* the filter */
  .filtro {
    max-width: 560px;
    margin-top: 16px;
  }
  .filtro label {
    display: block;
    margin-bottom: 6px;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .campo {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    padding: 0 12px;
    border: 1.5px solid var(--linea);
    border-radius: var(--radio-boton);
    background: var(--superficie);
    color: var(--tinta-suave);
  }
  .campo:focus-within {
    border-color: var(--acento);
    /* the app's focus ring (WCAG 2.4.7 / 2.4.11; QA 1.0: a border colour alone was not enough) */
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  .campo input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--tinta);
    font: inherit;
    font-size: 16px;
    outline: none;
  }
  .campo input::placeholder {
    color: var(--tinta-suave);
    opacity: 0.85;
  }
  .cuenta {
    min-height: 1.4em;
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }

  /* results */
  .resultados ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 760px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .resultado {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 44px;
    padding: 10px 14px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
  }
  .resultado:hover {
    border-color: var(--acento-borde);
  }
  .resultado .donde {
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 600;
  }
  .resultado .que {
    color: var(--titulos);
    font-size: 17px;
    font-weight: 700;
  }
  .resultado .frag {
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.4;
  }
  .vacio {
    max-width: 46em;
    margin: 12px 0;
    color: var(--tinta-suave);
    font-size: 15.5px;
  }

  /* the index */
  .tarjetas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .tarjeta {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    height: 100%;
    box-sizing: border-box;
    color: var(--tinta);
    text-decoration: none;
  }
  .tarjeta:hover {
    border-color: var(--acento-borde);
  }
  .num {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .textos {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tit {
    color: var(--titulos);
    font-size: 17px;
    font-weight: 700;
  }
  .res {
    color: var(--tinta-suave);
    font-size: 15px;
    line-height: 1.4;
  }

  /* a section */
  .con-indice {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 32px;
    margin-top: 8px;
  }
  @media (max-width: 860px) {
    .con-indice {
      grid-template-columns: minmax(0, 1fr);
    }
    .lateral {
      display: none;
    }
  }
  .lateral ol {
    position: sticky;
    top: calc(var(--alto-barra) + 16px);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lateral a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 4px 12px;
    border-radius: 10px;
    color: var(--tinta-suave);
    font-size: 15px;
    line-height: 1.25;
    text-decoration: none;
  }
  .lateral a:hover {
    background: var(--hover);
    color: var(--tinta);
  }
  .lateral a[aria-current='page'] {
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .seccion {
    max-width: 46em;
    font-size: 16.5px;
    line-height: 1.55;
  }
  .en-esta ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }
  .en-esta a,
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }
  .en-esta a:hover,
  .chip:hover {
    border-color: var(--acento-borde);
  }
  .apartado {
    margin-top: 28px;
  }
  .apartado p,
  .apartado ul,
  .apartado ol {
    margin: 0 0 12px;
  }
  .apartado ul,
  .apartado ol {
    padding-left: 1.3em;
  }
  .apartado li + li {
    margin-top: 6px;
  }
  .pasos li::marker {
    color: var(--acento);
    font-weight: 700;
  }
  .nota {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radio-tarjeta-p);
    background: var(--acento-tinte);
    font-size: 15.5px;
    line-height: 1.5;
  }
  .nota.aviso {
    background: var(--ambar-tinte);
  }
  .icono-nota {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--acento);
  }
  .aviso .icono-nota {
    color: var(--ambar);
  }
  .teclas {
    width: 100%;
    margin: 0 0 12px;
    border-collapse: collapse;
    font-size: 15px;
  }
  .teclas th,
  .teclas td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--linea);
    text-align: left;
    vertical-align: top;
  }
  .teclas th {
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
  }
  kbd {
    font-family: var(--mono);
    font-size: 0.92em;
    white-space: normal;
  }
  .abrir {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid var(--linea);
  }
  .abrir ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .vecinas {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 32px;
  }
  .vecina {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    max-width: 48%;
    padding: 8px 14px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    color: var(--titulos);
    font-weight: 600;
    text-decoration: none;
  }
  .vecina:hover {
    border-color: var(--acento-borde);
  }
  .vecina span {
    display: flex;
    flex-direction: column;
  }
  .vecina small {
    color: var(--tinta-tenue);
    font-size: 12.5px;
    font-weight: 600;
  }
  .vecina.sig {
    margin-left: auto;
    text-align: right;
  }
</style>
