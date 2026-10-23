<script lang="ts">
  // «Ejercicios» page (#/ejercicios): every exercise and problem of the book by chapter, with the reader's
  // state (pending, failed, solved) and filters; a row opens the exercise in place. #/ejercicios/repaso
  // goes through the failed ones one by one.
  import { onMount, tick } from 'svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { infoParte, rotuloParte } from '../../lib/datos';
  import { colorBloque } from '../../lib/color';
  import { cargarEjercicios, ejercicios, type ItemEjercicio } from '../../lib/ejercicios.svelte';
  import { aprendizaje, cargarAprendizaje, estadoDe, type Estado } from '../../lib/aprendizaje.svelte';
  import Icono from '../Icono.svelte';
  import Insignia from '../Insignia.svelte';
  import TarjetaEjercicio from './TarjetaEjercicio.svelte';

  type Filtro = 'todos' | Estado;
  type Tipo = 'todos' | 'ej' | 'prob';

  let filtro = $state<Filtro>('todos');
  let tipo = $state<Tipo>('todos');
  let soloAuto = $state(false);
  let abierto = $state<string | null>(null);
  let capAbiertos = $state<Record<string, boolean>>({});

  const datos = $derived(ejercicios.datos);
  const listo = $derived(!!datos && aprendizaje.listo);
  const repaso = $derived(ruta.ancla === 'repaso');

  const todos = $derived(datos ? Object.keys(datos.items) : []);
  const cuenta = $derived.by(() => {
    const c = { pendiente: 0, fallado: 0, resuelto: 0 };
    if (!listo) return c;
    for (const l of todos) c[estadoDe(l)]++;
    return c;
  });

  function pasa(label: string, it: ItemEjercicio): boolean {
    if (tipo !== 'todos' && it.tipo !== tipo) return false;
    if (soloAuto && it.modo !== 'auto') return false;
    return filtro === 'todos' || estadoDe(label) === filtro;
  }

  const capitulos = $derived.by(() => {
    if (!datos || !listo) return [];
    return datos.capitulos
      .map((c) => {
        const items = c.items.filter((l) => pasa(l, datos.items[l]!));
        const resueltos = c.items.filter((l) => estadoDe(l) === 'resuelto').length;
        return { parte: c.parte, items, total: c.items.length, resueltos, info: infoParte(c.parte) };
      })
      .filter((c) => c.items.length);
  });

  function capAbierto(parte: string): boolean {
    return capAbiertos[parte] ?? filtro !== 'todos';
  }

  // Review: the failed ones when the review starts (solving one does not make the list jump).
  let cola = $state<string[]>([]);
  let pos = $state(0);

  $effect(() => {
    if (repaso && listo) {
      void tick().then(() => {
        cola = todos.filter((l) => estadoDe(l) === 'fallado');
        pos = 0;
      });
    }
  });

  async function ir(k: number) {
    pos = Math.max(0, Math.min(cola.length - 1, k));
    await tick();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function corto(t: string | undefined): string {
    return (t ?? '').split(' — ')[0] ?? '';
  }

  const ETIQUETA: Record<Estado, string> = { pendiente: 'Pendiente', fallado: 'Fallado', resuelto: 'Resuelto' };

  onMount(() => {
    void cargarEjercicios();
    void cargarAprendizaje();
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>Ejercicios · Electrónica Práctica Avanzada</title></svelte:head>

<div class="pagina-ej">
  {#if ejercicios.error && !datos}
    <div class="aviso">
      <h1>Ejercicios</h1>
      <p>No están disponibles los datos de comprobación ({ejercicios.error}). Se generan con
        <code>python3 contenido/ejercicios.py</code>.</p>
    </div>
  {:else if !listo}
    <p class="cargando" aria-live="polite">Cargando los ejercicios…</p>
  {:else if repaso}
    <header class="cabecera">
      <a class="boton" href="#/ejercicios"><Icono nombre="atras" tam={17} /> Todos los ejercicios</a>
      <h1>Repaso de fallados</h1>
      {#if cola.length}
        <p class="sub">{pos + 1} de {cola.length} · {cuenta.fallado} pendientes de acertar</p>
      {/if}
    </header>
    {#if !cola.length}
      <div class="vacio">
        <p><strong>No hay ejercicios fallados.</strong></p>
        <p>Los que no acierte a la primera aparecerán aquí para repasarlos.</p>
      </div>
    {:else}
      {@const label = cola[pos]!}
      {#key label}
        <TarjetaEjercicio {label} />
      {/key}
      <nav class="navegar" aria-label="Repaso">
        <button class="boton" disabled={pos === 0} onclick={() => ir(pos - 1)}><Icono nombre="chevron-izq" tam={17} /> Anterior</button>
        <span class="estado-r estado-{estadoDe(label)}">{ETIQUETA[estadoDe(label)]}</span>
        {#if pos < cola.length - 1}
          <button class="boton primario" onclick={() => ir(pos + 1)}>Siguiente <Icono nombre="chevron" tam={17} /></button>
        {:else}
          <a class="boton primario" href="#/ejercicios">Terminar</a>
        {/if}
      </nav>
    {/if}
  {:else}
    <header class="cabecera">
      <h1>Ejercicios y problemas</h1>
      <p class="sub">
        {todos.length} en el libro · <strong>{cuenta.resuelto}</strong> resueltos · {cuenta.fallado} fallados
      </p>
      <div class="barra-total" aria-hidden="true">
        <span class="r" style:width={`${(cuenta.resuelto / Math.max(1, todos.length)) * 100}%`}></span>
        <span class="f" style:width={`${(cuenta.fallado / Math.max(1, todos.length)) * 100}%`}></span>
      </div>
      {#if cuenta.fallado}
        <a class="boton primario repasar" href="#/ejercicios/repaso"><Icono nombre="repaso" tam={17} /> Repaso de fallados ({cuenta.fallado})</a>
      {/if}
    </header>

    <div class="filtros" role="group" aria-label="Filtros">
      <div class="chips" role="radiogroup" aria-label="Estado">
        {#each [['todos', 'Todos', todos.length], ['pendiente', 'Pendientes', cuenta.pendiente], ['fallado', 'Fallados', cuenta.fallado], ['resuelto', 'Resueltos', cuenta.resuelto]] as [v, t, n] (v)}
          <button
            class="chip"
            role="radio"
            aria-checked={filtro === v}
            onclick={() => {
              filtro = v as Filtro;
              capAbiertos = {};
            }}>{t} <span class="n">{n}</span></button
          >
        {/each}
      </div>
      <div class="chips" role="radiogroup" aria-label="Tipo">
        {#each [['todos', 'Todo'], ['ej', 'Ejercicios'], ['prob', 'Problemas']] as [v, t] (v)}
          <button class="chip" role="radio" aria-checked={tipo === v} onclick={() => (tipo = v as Tipo)}>{t}</button>
        {/each}
        <button class="chip" role="switch" aria-checked={soloAuto} onclick={() => (soloAuto = !soloAuto)}>
          Con comprobación automática
        </button>
      </div>
    </div>

    {#if !capitulos.length}
      <p class="vacio">Ningún ejercicio cumple estos filtros.</p>
    {/if}

    {#each capitulos as c (c.parte)}
      {@const ab = capAbierto(c.parte)}
      <section class="capitulo" style:--c={colorBloque(c.info?.color)}>
        <button
          class="cap-cab"
          aria-expanded={ab}
          onclick={() => (capAbiertos[c.parte] = !ab)}
        >
          <Insignia parte={c.parte} />
          <span class="cap-txt">
            <span class="cap-tit">{rotuloParte(c.parte)} · {corto(c.info?.titulo)}</span>
            <span class="cap-barra" aria-hidden="true"><span style:width={`${(c.resueltos / c.total) * 100}%`}></span></span>
          </span>
          <span class="cap-n">{c.resueltos}/{c.total}</span>
          <span class="chev" class:girado={ab}><Icono nombre="chevron" tam={16} /></span>
        </button>
        {#if ab}
          <ul>
            {#each c.items as l (l)}
              {@const it = datos!.items[l]!}
              {@const e = estadoDe(l)}
              <li class:abierto={abierto === l}>
                <button class="fila" aria-expanded={abierto === l} onclick={() => (abierto = abierto === l ? null : l)}>
                  <span class="num">{it.tipo === 'ej' ? '' : 'P '}{it.num}</span>
                  <span class="res">{it.titulo ?? it.resumen ?? ''}</span>
                  {#if it.modo === 'auto'}<span class="auto" title="Comprobación automática">{it.respuestas.length} {it.respuestas.length === 1 ? 'valor' : 'valores'}</span>{/if}
                  <span class="estado-r estado-{e}" title={ETIQUETA[e]}>{e === 'resuelto' ? '✓' : e === 'fallado' ? '✗' : '·'}</span>
                </button>
                {#if abierto === l}
                  <div class="detalle">
                    <TarjetaEjercicio label={l} />
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .pagina-ej {
    max-width: 920px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) 64px;
    font-family: var(--sans);
  }
  .cabecera {
    padding: clamp(24px, 5vw, 44px) 0 18px;
  }
  h1 {
    margin: 6px 0 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(30px, 5vw, 42px);
    line-height: 1.1;
  }
  .sub {
    margin: 8px 0 0;
    color: var(--tinta-suave);
    font-size: 16px;
  }
  .barra-total {
    display: flex;
    height: 6px;
    margin-top: 12px;
    border-radius: 3px;
    background: var(--linea);
    overflow: hidden;
  }
  .barra-total .r {
    background: var(--c-ejemplo);
  }
  .barra-total .f {
    background: var(--c-precaucion);
    opacity: 0.75;
  }
  .repasar {
    margin-top: 16px;
    min-height: 44px;
  }
  .filtros {
    display: grid;
    gap: 8px;
    margin: 4px 0 18px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-size: 14.5px;
    font-weight: 600;
  }
  .chip[aria-checked='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--tinta);
  }
  .chip .n {
    color: var(--tinta-tenue);
    font-variant-numeric: tabular-nums;
  }
  .capitulo {
    border-bottom: 1px solid var(--linea-suave);
  }
  .cap-cab {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 8px 6px;
    border: 0;
    background: none;
    text-align: left;
  }
  .cap-cab:hover {
    background: var(--hover);
  }
  .cap-txt {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .cap-tit {
    overflow: hidden;
    color: var(--tinta);
    font-size: 15.5px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cap-barra {
    height: 4px;
    border-radius: 2px;
    background: var(--linea);
    overflow: hidden;
  }
  .cap-barra span {
    display: block;
    height: 100%;
    background: var(--c-ejemplo);
  }
  .cap-n {
    flex: none;
    color: var(--tinta-suave);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .chev {
    display: inline-grid;
    color: var(--tinta-tenue);
    transition: transform 0.18s;
  }
  .chev.girado {
    transform: rotate(90deg);
  }
  ul {
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 6px 8px 6px 14px;
    border: 0;
    border-radius: 8px;
    background: none;
    text-align: left;
  }
  .fila:hover,
  li.abierto .fila {
    background: var(--hover);
  }
  .num {
    flex: none;
    min-width: 3.4em;
    color: var(--c);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .res {
    display: -webkit-box;
    flex: 1;
    overflow: hidden;
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.35;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .auto {
    flex: none;
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
  .estado-r {
    display: inline-grid;
    flex: none;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--linea-suave);
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
  }
  .estado-resuelto {
    background: rgb(from var(--c-ejemplo) r g b / 0.16);
    color: var(--c-ejemplo);
  }
  .estado-fallado {
    background: rgb(from var(--c-precaucion) r g b / 0.14);
    color: var(--c-precaucion);
  }
  .detalle {
    margin: 4px 0 14px;
    padding: 14px clamp(10px, 3vw, 18px) 6px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie-2);
  }
  .navegar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--linea);
  }
  .navegar .boton {
    min-height: 44px;
  }
  .navegar .boton:disabled {
    opacity: 0.45;
  }
  .vacio,
  .cargando {
    margin: 30px 0;
    color: var(--tinta-suave);
  }
  .aviso {
    margin: 18vh 0;
  }
  @media (max-width: 520px) {
    .auto {
      display: none;
    }
  }
  :global(.app.movil) .pagina-ej {
    padding-bottom: calc(64px + var(--hueco-inferior));
  }
</style>
