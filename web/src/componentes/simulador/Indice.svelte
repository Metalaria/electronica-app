<script lang="ts">
  // Catalogue of the book's netlists, by chapter, with a filter; and the free-form circuit.
  import type { IndiceSpice } from '../../simulador/tipos';
  import { cargarIndiceSpice, rotuloRef, rutaSimulacion } from '../../simulador/datos.svelte';
  import { normalizar, rotuloParte } from '../../lib/datos';
  import { colorBloque } from '../../lib/color';
  import Icono from '../Icono.svelte';
  import PestanasSimulador from './PestanasSimulador.svelte';

  let indice = $state<IndiceSpice | null>(null);
  let cargado = $state(false);
  let filtro = $state('');
  let tipo = $state<string>('');

  $effect(() => {
    cargarIndiceSpice().then((d) => {
      indice = d;
      cargado = true;
    });
  });

  const TIPOS = [
    ['', 'Todas'],
    ['op', 'Punto de trabajo'],
    ['dc', 'Continua'],
    ['ac', 'Alterna'],
    ['tran', 'Transitorio'],
    ['noise', 'Ruido'],
  ] as const;

  const textoBusqueda = $derived.by(() => {
    const m = new Map<string, string>();
    if (!indice) return m;
    for (const [id, n] of Object.entries(indice.netlists)) {
      m.set(id, normalizar(`${n.nombre} ${n.titulo} ${n.refs.map(rotuloRef).join(' ')} ${n.descripcion} ${rotuloParte(n.parte)}`));
    }
    return m;
  });

  const capitulos = $derived.by(() => {
    if (!indice) return [];
    const q = normalizar(filtro.trim()).split(/\s+/).filter(Boolean);
    return indice.capitulos
      .map((c) => ({
        c,
        ids: c.netlists.filter((id) => {
          const n = indice!.netlists[id]!;
          if (tipo && !n.analisis.includes(tipo as never)) return false;
          const t = textoBusqueda.get(id) ?? '';
          return q.every((w) => t.includes(w));
        }),
      }))
      .filter((x) => x.ids.length);
  });
  const total = $derived(capitulos.reduce((s, x) => s + x.ids.length, 0));

  function resumen(d: string): string {
    // The first sentence of the header, without the «Capítulo N, sección…» preamble when there is more.
    const una = d.replace(/\s*\n\s*/g, ' ');
    return una.length > 190 ? una.slice(0, 186).replace(/\s+\S*$/, '') + '…' : una;
  }
</script>

<div class="indice-sim">
  <PestanasSimulador />
  <header>
    <h1>Simulador de circuitos</h1>
    <p class="intro">
      Las {indice?.total ?? 309} netlists de ngspice que comprueban los circuitos y los números del libro, listas para
      simular aquí mismo, sin conexión: gráficas interactivas, medidas, punto de trabajo y controles deslizantes para
      cambiar los valores de los componentes.
    </p>
    <div class="acciones">
      <a class="boton primario" href="#/simulador/nuevo"><Icono nombre="editar" tam={17} /> Nuevo circuito</a>
      <a class="boton" href="#/editor">Dibujar un esquema</a>
    </div>
  </header>

  {#if !cargado}
    <p class="nota">Cargando la lista…</p>
  {:else if !indice}
    <div class="aviso">
      <p>Este contenido no incluye las netlists del libro (falta <code>libro/spice.json</code>; se genera con
        <code>python3 contenido/spice.py</code>). Puede escribir su propio circuito con «Nuevo circuito».</p>
    </div>
  {:else}
    <div class="filtros">
      <input type="search" placeholder="Buscar: filtro rc, zener, figura 41.5, 555…" bind:value={filtro} aria-label="Buscar netlists" />
      <div class="tipos" role="group" aria-label="Tipo de análisis">
        {#each TIPOS as [k, t] (k)}
          <button class="chip" aria-pressed={tipo === k} onclick={() => (tipo = k)}>{t}</button>
        {/each}
      </div>
      <p class="cuenta" aria-live="polite">{total} {total === 1 ? 'netlist' : 'netlists'}</p>
    </div>

    {#each capitulos as { c, ids } (c.parte)}
      <section class="capitulo" style:--c={colorBloque(c.color)}>
        <h2><span class="num">{rotuloParte(c.parte)}</span> {c.titulo.split(' — ')[0]}</h2>
        <ul>
          {#each ids as id (id)}
            {@const n = indice.netlists[id]!}
            <li>
              <a href={rutaSimulacion(id)}>
                <span class="linea1">
                  {#if n.ref}<span class="ref">{rotuloRef(n.ref)}</span>{/if}
                  <span class="tit">{n.titulo || n.nombre}</span>
                  {#each n.analisis as a (a)}<span class="etq">.{a}</span>{/each}
                  {#if n.motor.estado === 'no-disponible'}<span class="marca no" title={n.motor.nota}>no disponible</span>
                  {:else if n.motor.pesada}<span class="marca" title="Tarda en simular">pesada</span>{/if}
                  {#if n.motor.xspice}<span class="marca" title="Usa dispositivos digitales XSPICE">XSPICE</span>
                  {:else if n.motor.original}<span class="marca" title="Versión analógica de un circuito XSPICE">analógica</span>{/if}
                </span>
                <span class="desc">{resumen(n.descripcion)}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="nota">Ninguna netlist coincide con la búsqueda.</p>
    {/each}
  {/if}
</div>

<style>
  .indice-sim {
    max-width: 980px;
    margin: 0 auto;
    padding: 18px 20px 60px;
    font-family: var(--sans);
  }
  h1 {
    margin: 4px 0 8px;
    font-size: clamp(24px, 3.4vw, 32px);
    color: var(--titulos);
  }
  .intro {
    margin: 0 0 14px;
    max-width: 44em;
    font-size: 15.5px;
    line-height: 1.5;
    color: var(--tinta-suave);
  }
  .acciones {
    margin-bottom: 18px;
  }
  .filtros {
    position: sticky;
    top: calc(var(--alto-barra) + env(safe-area-inset-top));
    z-index: 4;
    display: grid;
    gap: 8px;
    padding: 10px 0 8px;
    background: var(--fondo);
    border-bottom: 1px solid var(--linea-suave);
  }
  input[type='search'] {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-size: 15.5px;
  }
  .tipos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .chip[aria-pressed='true'] {
    background: var(--acento-tinte);
    border-color: var(--acento-borde);
    color: var(--acento);
  }
  .cuenta {
    margin: 0;
    font-size: 13px;
    color: var(--tinta-tenue);
  }
  .capitulo {
    margin-top: 22px;
    content-visibility: auto;
    contain-intrinsic-size: auto 400px;
  }
  h2 {
    margin: 0 0 6px;
    padding-left: 10px;
    border-left: 4px solid var(--c);
    font-size: 17px;
    color: var(--titulos);
  }
  h2 .num {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li a {
    display: block;
    padding: 9px 10px;
    border-radius: 10px;
    color: inherit;
    text-decoration: none;
  }
  li a:hover {
    background: var(--hover);
  }
  .linea1 {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: baseline;
  }
  .ref {
    color: var(--acento);
    font-weight: 700;
    font-size: 14px;
  }
  .tit {
    font-weight: 600;
    font-size: 15px;
    color: var(--tinta);
  }
  .etq {
    padding: 0 6px;
    border-radius: 5px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-family: var(--mono);
    font-size: 11.5px;
  }
  .marca {
    padding: 0 7px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--c-importante) 14%, transparent);
    color: var(--c-importante);
    font-size: 11.5px;
    font-weight: 700;
  }
  .marca.no {
    background: color-mix(in srgb, var(--c-precaucion) 12%, transparent);
    color: var(--c-precaucion);
  }
  .desc {
    display: block;
    margin-top: 2px;
    font-size: 13.5px;
    line-height: 1.4;
    color: var(--tinta-suave);
  }
  .nota {
    color: var(--tinta-suave);
  }
  .aviso {
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--superficie);
    border: 1px solid var(--linea);
  }
  @media (max-width: 599px) {
    .indice-sim {
      padding: 12px 14px 60px;
    }
  }
</style>
