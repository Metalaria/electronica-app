<script lang="ts">
  // «Calculadoras» page: every catalogued formula of the book, searchable by name, symbol or chapter, with
  // favourites; #/calculadoras/<id> opens one calculator full page.
  import { onMount } from 'svelte';
  import type { CatalogoFormulas, Formula } from './tipos';
  import { calc, cargarCatalogo, cargarFavoritos, alternarFavorita, rutaCalculadora } from './datos.svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { app } from '../../lib/estado.svelte';
  import { normalizar, url, urlCss, infoParte } from '../../lib/datos';
  import Calculadora from './Calculadora.svelte';
  import Icono from '../Icono.svelte';

  let catalogo = $state<CatalogoFormulas | null>(null);
  let fallo = $state(false);
  let consulta = $state('');
  let soloFavoritas = $state(false);
  let capitulo = $state('');
  let familia = $state('');
  // The thumbnails of the families (drawing code) load with the page, not with the reader.
  const miniaturas = import('./ilustraciones/Miniatura.svelte');

  onMount(() => {
    void cargarFavoritos();
    void cargarCatalogo().then((c) => {
      catalogo = c;
      fallo = !c;
    });
  });

  const elegida = $derived(catalogo && ruta.ancla ? (catalogo.formulas.find((f) => f.id === ruta.ancla) ?? null) : null);

  function textoPlano(html: string): string {
    return html.replace(/<[^>]+>/g, '');
  }

  // Search text of each formula: name, keywords, symbols, variable names, section and chapter.
  const indiceBusqueda = $derived(
    catalogo
      ? new Map(
          catalogo.formulas.map((f) => [
            f.id,
            normalizar(
              [f.nombre, f.claves ?? '', f.seccion.num, f.seccion.titulo, f.cap ? `capitulo ${f.cap} cap ${f.cap}` : '', f.id,
                ...f.vars.map((v) => `${textoPlano(v.sim)} ${v.id} ${v.nombre}`)].join(' '),
            ),
          ]),
        )
      : new Map<string, string>(),
  );

  const lista = $derived.by(() => {
    if (!catalogo) return [] as Formula[];
    const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
    return catalogo.formulas.filter((f) => {
      if (soloFavoritas && !calc.favoritos.includes(f.id)) return false;
      if (capitulo && f.parte !== capitulo) return false;
      if (familia && f.familia !== familia) return false;
      const t = indiceBusqueda.get(f.id) ?? '';
      return palabras.every((p) => t.includes(p));
    });
  });

  // Groups in reading order (the catalogue is in book order already).
  const grupos = $derived.by(() => {
    const g: { parte: string; titulo: string; formulas: Formula[] }[] = [];
    for (const f of lista) {
      let ultimo = g[g.length - 1];
      if (!ultimo || ultimo.parte !== f.parte) {
        const info = infoParte(f.parte);
        ultimo = { parte: f.parte, titulo: `${f.cap !== null ? `${f.cap} · ` : ''}${info?.titulo ?? f.parte}`, formulas: [] };
        g.push(ultimo);
      }
      ultimo.formulas.push(f);
    }
    return g;
  });

  const capitulos = $derived.by(() => {
    if (!catalogo) return [] as { parte: string; titulo: string }[];
    const vistos = new Map<string, string>();
    for (const f of catalogo.formulas) {
      if (!vistos.has(f.parte)) vistos.set(f.parte, `${f.cap ?? ''} · ${infoParte(f.parte)?.titulo ?? f.parte}`);
    }
    return [...vistos].map(([parte, titulo]) => ({ parte, titulo }));
  });

  function estiloEc(f: Formula): string {
    const src = url(f.svg);
    const PT = 10.5 / 1.12;
    return `width:${(f.w / PT).toFixed(3)}em;height:${(f.h / PT).toFixed(3)}em;-webkit-mask-image:${urlCss(src)};mask-image:${urlCss(src)}`;
  }

  /** Families with their representative formula (the one drawn by the family's thumbnail template). */
  const familias = $derived.by(() => {
    if (!catalogo?.familias) return [];
    return catalogo.familias.map((fam) => {
      const de = catalogo!.formulas.filter((f) => f.familia === fam.id);
      const rep =
        de.find((f) => (fam.miniatura.tipo === 'esq' ? f.figura?.esquema?.p : f.figura?.grafico?.p) === fam.miniatura.p) ?? de[0];
      return { ...fam, rep };
    });
  });
  const familiaElegida = $derived(familias.find((x) => x.id === familia));

  // Formulas of the same section, under a calculator.
  const vecinas = $derived(elegida && catalogo ? catalogo.formulas.filter((f) => f.seccion.label === elegida.seccion.label && f.id !== elegida.id) : []);
</script>

<div class="pagina-calc" class:movil={app.movil} class:ancha={!!ruta.ancla}>
  {#if fallo}
    <div class="aviso"><h1>Calculadoras</h1><p>El catálogo de fórmulas no está generado (<code>python3 contenido/formulas.py</code>).</p></div>
  {:else if !catalogo}
    <p class="espera">Cargando el catálogo de fórmulas…</p>
  {:else if ruta.ancla}
    <nav class="volver"><a href="#/calculadoras"><Icono nombre="atras" tam={16} /> Todas las calculadoras</a></nav>
    {#if elegida}
      {#key elegida.id}
        <Calculadora formulas={[elegida]} modo="pagina" />
      {/key}
      {#if vecinas.length}
        <section class="vecinas">
          <h2>En la misma sección</h2>
          <ul>
            {#each vecinas as f (f.id)}
              <li><a href={rutaCalculadora(f.id)}>{f.nombre}</a></li>
            {/each}
          </ul>
        </section>
      {/if}
    {:else}
      <p class="espera">No existe la calculadora «{ruta.ancla}».</p>
    {/if}
  {:else}
    <header class="cabecera">
      <h1>Calculadoras</h1>
      <p class="intro">
        {catalogo.total} fórmulas del libro listas para calcular, {catalogo.con_ejemplo} de ellas comprobadas con el ejemplo del propio libro.
        Cada una con su circuito o su curva, controles deslizantes, la cuenta paso a paso y lo que dice el libro de ella.
        Elige una familia o busca por nombre, símbolo o capítulo.
      </p>
    </header>
    <div class="controles">
      <label class="buscar">
        <Icono nombre="buscar" tam={17} />
        <input type="search" placeholder="Nombre, símbolo o capítulo (p. ej. «corte RC», «Q», «cap 33»)" bind:value={consulta} aria-label="Buscar una fórmula" />
      </label>
      <select bind:value={capitulo} aria-label="Capítulo">
        <option value="">Todos los capítulos</option>
        {#each capitulos as c (c.parte)}<option value={c.parte}>{c.titulo}</option>{/each}
      </select>
      <button class="filtro" aria-pressed={soloFavoritas} class:activo={soloFavoritas} onclick={() => (soloFavoritas = !soloFavoritas)}>
        <span aria-hidden="true">{soloFavoritas ? '★' : '☆'}</span> Favoritas ({calc.favoritos.length})
      </button>
    </div>
    <section class="familias" aria-label="Familias de fórmulas">
      <div class="rejilla-familias">
        {#each familias as fam (fam.id)}
          <button class="familia" class:activa={familia === fam.id} aria-pressed={familia === fam.id}
            onclick={() => (familia = familia === fam.id ? '' : fam.id)}>
            <span class="mini">
              {#if fam.rep}
                {#await miniaturas then m}<m.default f={fam.rep} tipo={fam.miniatura.tipo} />{/await}
              {/if}
            </span>
            <span class="fam-texto">
              <span class="fam-nombre">{fam.nombre}</span>
              <span class="fam-resumen">{fam.resumen}</span>
            </span>
            <span class="fam-total">{fam.total}</span>
          </button>
        {/each}
      </div>
    </section>
    {#if familiaElegida}
      <p class="filtro-familia">
        Familia: <strong>{familiaElegida.nombre}</strong>
        <button class="quitar" onclick={() => (familia = '')}>Ver todas</button>
      </p>
    {/if}
    <p class="cuenta" aria-live="polite">{lista.length === catalogo.total ? `${lista.length} fórmulas` : `${lista.length} de ${catalogo.total} fórmulas`}</p>
    {#if !lista.length}
      <p class="espera">{soloFavoritas && !calc.favoritos.length ? 'Aún no hay favoritas: marca la estrella de una calculadora.' : 'Ninguna fórmula coincide.'}</p>
    {/if}
    {#each grupos as g, i (i + g.parte)}
      <section class="grupo">
        <h2>{g.titulo}</h2>
        <ul>
          {#each g.formulas as f (f.id)}
            {@const fav = calc.favoritos.includes(f.id)}
            <li>
              <a class="fila" href={rutaCalculadora(f.id)}>
                <span class="nombre">{f.nombre}</span>
                <span class="ec" aria-hidden="true"><span class="ec-img" style={estiloEc(f)}></span></span>
                <span class="sec">{f.seccion.num}{#if f.ejemplo}<span class="ok" title="Comprobada con el ejemplo del libro">✓</span>{/if}</span>
              </a>
              <button class="estrella" class:activo={fav} aria-pressed={fav} aria-label={fav ? `Quitar ${f.nombre} de favoritas` : `Añadir ${f.nombre} a favoritas`}
                onclick={() => alternarFavorita(f.id)}><span aria-hidden="true">{fav ? '★' : '☆'}</span></button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<style>
  .pagina-calc {
    max-width: 60rem;
    margin: 0 auto;
    padding: 24px 24px 64px;
    font-family: var(--sans);
    color: var(--tinta);
  }
  .ancha {
    max-width: 76rem;
  }
  .movil {
    padding: 16px 16px 56px;
  }
  .cabecera h1 {
    margin: 0 0 6px;
    color: var(--titulos);
    font-size: 30px;
  }
  .intro {
    margin: 0 0 16px;
    color: var(--tinta-suave);
    line-height: 1.45;
  }
  .controles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .buscar {
    flex: 1 1 18rem;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta-suave);
  }
  .buscar:focus-within {
    border-color: var(--acento);
    box-shadow: 0 0 0 3px var(--acento-tinte);
  }
  .buscar input {
    flex: 1;
    min-width: 0;
    height: 44px;
    border: 0;
    background: transparent;
    color: var(--tinta);
    font: inherit;
    font-size: 16px;
    outline: none;
  }
  select {
    flex: 0 1 16rem;
    min-width: 0;
    min-height: 46px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 15px;
  }
  .filtro {
    min-height: 46px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 15px;
    cursor: pointer;
  }
  .filtro.activo {
    border-color: var(--c-tarjeta);
    color: var(--c-tarjeta-texto);
    background: color-mix(in srgb, var(--c-tarjeta) 12%, var(--superficie));
  }
  .familias {
    margin: 18px 0 4px;
  }
  .rejilla-familias {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 228px), 1fr));
    gap: 10px;
  }
  .familia {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 88px;
    padding: 8px 10px 8px 8px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
  }
  .familia:hover {
    border-color: var(--acento-borde);
    background: var(--hover);
  }
  .familia.activa {
    border-color: var(--acento);
    background: var(--acento-tinte);
    box-shadow: 0 0 0 1px var(--acento);
  }
  .mini {
    display: block;
    width: 92px;
    height: 72px;
    overflow: hidden;
    border-radius: 8px;
    background: var(--superficie-2);
    padding: 4px;
  }
  .mini :global(svg) {
    width: 100%;
    height: 64px;
    max-height: 64px;
  }
  .fam-texto {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .fam-nombre {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--titulos);
  }
  .fam-resumen {
    color: var(--tinta-suave);
    font-size: 12.5px;
    line-height: 1.3;
  }
  .fam-total {
    align-self: start;
    min-width: 2em;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .filtro-familia {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 12px 0 0;
    color: var(--tinta-suave);
  }
  .quitar {
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  /* Phones: the families scroll sideways so the list stays close. */
  @media (max-width: 640px) {
    .rejilla-familias {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: 6px;
      margin: 0 -16px;
      padding-left: 16px;
      padding-right: 16px;
      scrollbar-width: none;
    }
    .familia {
      flex: 0 0 236px;
      scroll-snap-align: start;
    }
  }
  .cuenta {
    margin: 10px 0 0;
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  .grupo {
    content-visibility: auto;
    contain-intrinsic-size: auto 400px;
  }
  .grupo h2 {
    margin: 22px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--linea);
    color: var(--titulos);
    font-size: 17px;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--linea-suave);
  }
  .fila {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 4px 14px;
    min-height: 48px;
    padding: 6px 6px;
    border-radius: 8px;
    color: var(--tinta);
    text-decoration: none;
  }
  .fila:hover {
    background: var(--hover);
  }
  .nombre {
    font-size: 15.5px;
    line-height: 1.3;
  }
  .ec {
    max-width: 16rem;
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 13px;
    text-align: right;
  }
  .ec-img {
    display: inline-block;
    vertical-align: middle;
    background: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .sec {
    min-width: 3.6em;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .ok {
    margin-left: 4px;
    color: var(--c-ejemplo);
  }
  .estrella {
    flex: none;
    width: 46px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tinta-tenue);
    font-size: 21px;
    cursor: pointer;
  }
  .estrella:hover {
    background: var(--hover);
  }
  .estrella.activo {
    color: var(--c-tarjeta);
  }
  .volver a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--acento);
    text-decoration: none;
    font-size: 15px;
  }
  .vecinas h2 {
    margin: 26px 0 6px;
    color: var(--titulos);
    font-size: 17px;
  }
  .vecinas li {
    border: 0;
  }
  .vecinas a {
    display: block;
    padding: 9px 0;
    color: var(--acento);
  }
  .espera,
  .aviso {
    color: var(--tinta-suave);
  }
  @media (max-width: 640px) {
    .fila {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .ec {
      grid-column: 1 / -1;
      grid-row: 2;
      max-width: 100%;
      text-align: left;
    }
  }
</style>
