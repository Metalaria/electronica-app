<script lang="ts">
  // Catalogue of the book's netlists, by chapter, with a filter; and the free-form circuit.
  import type { IndiceSpice } from '../../simulador/tipos';
  import { cargarIndiceSpice, rotuloRef, rutaSimulacion } from '../../simulador/datos.svelte';
  import { normalizar, rotuloParte } from '../../lib/datos';
  import { colorBloque } from '../../lib/color';
  import Icono from '../Icono.svelte';
  import PestanasSimulador from './PestanasSimulador.svelte';
  import MiniaturaEsquema from '../miniaturas/MiniaturaEsquema.svelte';

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
      <a class="t09-boton" href="#/simulador/nuevo"><Icono nombre="editar" tam={18} /> Nuevo circuito</a>
      <a class="t09-boton t09-contorno" href="#/editor">Dibujar un esquema</a>
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
          <button class="chip t09-chip" aria-pressed={tipo === k} onclick={() => (tipo = k)}>{t}</button>
        {/each}
      </div>
      <p class="cuenta" aria-live="polite">{total} {total === 1 ? 'netlist' : 'netlists'}</p>
    </div>

    {#each capitulos as { c, ids } (c.parte)}
      <section class="capitulo t09-tarjeta" style:--c={colorBloque(c.color)}>
        <h2><span class="num">{rotuloParte(c.parte)}</span> {c.titulo.split(' — ')[0]}</h2>
        <ul>
          {#each ids as id (id)}
            {@const n = indice.netlists[id]!}
            <li>
              <a href={rutaSimulacion(id)}>
                <MiniaturaEsquema {id} />
                <span class="texto">
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
                </span>
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
  /* 0.9 look (componentes/ui09): serif title, chips, chapters as cards */
  .indice-sim {
    max-width: 980px;
    margin: 0 auto;
    padding: 24px 32px 60px;
    font-family: var(--sans);
  }
  h1 {
    margin: 4px 0 8px;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(26px, 4vw, 30px);
    font-weight: 700;
    line-height: 1.15;
  }
  .intro {
    margin: 0 0 16px;
    max-width: 44em;
    font-size: 16px;
    line-height: 1.5;
    color: var(--tinta-suave);
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
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
    min-height: var(--toque);
    padding: 10px 14px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-boton);
    background: var(--superficie);
    font-size: 15.5px;
  }
  .tipos {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 6px;
  }
  .cuenta {
    margin: 0;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .capitulo {
    margin-top: 16px;
    padding: 16px 10px 10px;
    content-visibility: auto;
    contain-intrinsic-size: auto 400px;
  }
  h2 {
    margin: 0 6px 6px;
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
    /* Thumbnail of the automatic schematic (fixed size: no shift when it arrives) beside the text. */
    --mini-w: 112px;
    --mini-h: 64px;
    --mini-fondo: var(--superficie-2);
    display: flex;
    gap: 14px;
    align-items: flex-start;
    min-height: var(--toque);
    padding: 9px 10px;
    border-radius: var(--radio-boton);
    color: inherit;
    text-decoration: none;
  }
  li a:hover {
    background: var(--hover);
  }
  .texto {
    flex: 1;
    min-width: 0;
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
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    border: 1px solid var(--linea);
  }
  @media (max-width: 599px) {
    .indice-sim {
      padding: 16px 16px 60px;
    }
    li a {
      --mini-w: 84px;
      --mini-h: 52px;
      gap: 10px;
      padding: 9px 6px;
    }
  }
</style>
