<script lang="ts" module>
  let siguiente = 0;
</script>

<script lang="ts">
  // A live calculator for one catalogued formula (or for the several formulas of one equation of the book):
  // choose the variable to compute, type the others with their units, read the result, see how it depends
  // on each input, and go to the book's section. Used inline in the reader (popover / bottom sheet) and on
  // the «Calculadoras» page.
  import { untrack } from 'svelte';
  import type { Formula } from './tipos';
  import type { Entorno } from './expresion';
  import { calcular, objetivosPosibles, entradas, valoresPorDefecto, fueraDeRango, barrido, variable } from './motor';
  import { formatoValor, unidadGrafica } from './unidades';
  import { calc, alternarFavorita, cargarFavoritos, rutaCalculadora } from './datos.svelte';
  import CampoValor from './CampoValor.svelte';
  import Icono from '../Icono.svelte';
  import { Grafica } from '../grafica';
  import { url, urlCss, rutaDeRef, prepararHtml } from '../../lib/datos';

  let {
    formulas,
    inicial = undefined,
    modo = 'emergente',
  }: { formulas: Formula[]; inicial?: string; modo?: 'emergente' | 'pagina' } = $props();

  const idBase = `calc${++siguiente}`;
  void cargarFavoritos();

  let idx = $state(0);
  // Values and target of each formula, kept while switching between the formulas of one equation.
  const memoria = new Map<string, { objetivo: string; valores: Entorno }>();
  let objetivo = $state('');
  let valores = $state<Entorno>({});
  let previo: number | undefined;

  function abrir(i: number) {
    const ant = formulas[idx];
    if (ant && objetivo) memoria.set(ant.id, { objetivo, valores: { ...valores } });
    idx = i;
    const f = formulas[i] as Formula;
    const m = memoria.get(f.id);
    objetivo = m?.objetivo ?? f.resultado;
    valores = m ? { ...m.valores } : valoresPorDefecto(f);
    previo = undefined;
  }

  $effect.pre(() => {
    const fs = formulas;
    const ini = inicial;
    untrack(() => abrir(Math.max(0, fs.findIndex((f) => f.id === ini))));
  });

  const f = $derived(formulas[idx] as Formula);
  const resultado = $derived(calcular(f, objetivo, valores, untrack(() => previo)));
  $effect(() => {
    if (Number.isFinite(resultado.valor)) previo = resultado.valor;
  });
  const vObjetivo = $derived(variable(f, objetivo));
  const posibles = $derived(objetivosPosibles(f));

  function elegirObjetivo(id: string) {
    if (id === objetivo) return;
    if (Number.isFinite(resultado.valor)) valores[objetivo] = resultado.valor;
    objetivo = id;
    previo = valores[id];
  }

  function valoresDelLibro() {
    const e = f.ejemplo;
    if (!e) return;
    valores = { ...e.valores, [f.resultado]: e.resultado };
    objetivo = f.resultado;
    previo = undefined;
  }

  // ---------------------------------------------------------------- sensitivity plot
  let xVar = $state('');
  const candidatosX = $derived(entradas(f, objetivo).filter((v) => !v.entero));
  $effect.pre(() => {
    const ids = candidatosX.map((v) => v.id);
    if (!ids.includes(untrack(() => xVar))) xVar = ids[0] ?? '';
  });
  let verGrafica = $state(false);
  $effect.pre(() => {
    if (modo === 'pagina') verGrafica = true;
  });

  function textoPlano(html: string): string {
    return html.replace(/<[^>]+>/g, '');
  }

  const grafica = $derived.by(() => {
    if (!verGrafica || !xVar || !vObjetivo) return null;
    const vx = variable(f, xVar);
    if (!vx) return null;
    const b = barrido(f, objetivo, xVar, { ...valores, [objetivo]: resultado.valor });
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const y of b.y) {
      if (Number.isFinite(y)) {
        ymin = Math.min(ymin, y);
        ymax = Math.max(ymax, y);
      }
    }
    const actual = valores[xVar] ?? NaN;
    const series = [{ name: textoPlano(vObjetivo.sim), unit: unidadGrafica(vObjetivo.unidad), x: b.x, y: b.y }];
    if (Number.isFinite(actual) && Number.isFinite(ymin) && ymax > ymin) {
      series.push({
        name: 'Valor actual',
        unit: unidadGrafica(vObjetivo.unidad),
        x: new Float64Array([actual, actual]),
        y: new Float64Array([ymin, ymax]),
        dashed: true,
      } as (typeof series)[number]);
    }
    const positivo = Number.isFinite(ymin) && ymin > 0;
    return {
      series,
      xAxis: {
        label: `${textoPlano(vx.sim)} — ${vx.nombre}`,
        unit: unidadGrafica(vx.unidad),
        scale: vx.escala === 'log' && vx.min > 0 ? ('log' as const) : ('linear' as const),
      },
      yAxis: {
        label: `${textoPlano(vObjetivo.sim)} — ${vObjetivo.nombre}`,
        unit: unidadGrafica(vObjetivo.unidad),
        scale: positivo && ymax / ymin > 200 ? ('log' as const) : ('linear' as const),
      },
    };
  });

  const ecEstilo = $derived.by(() => {
    const src = url(f.svg);
    const PT = 10.5 / 1.12;
    return `width:${(f.w / PT).toFixed(3)}em;height:${(f.h / PT).toFixed(3)}em;-webkit-mask-image:${urlCss(src)};mask-image:${urlCss(src)}`;
  });

  const favorita = $derived(calc.favoritos.includes(f.id));
  const enlaceLibro = $derived(rutaDeRef(f.sub ?? f.seccion.label) ?? rutaDeRef(f.seccion.label));

  function descripcionError(e: string | undefined): string {
    if (e === 'falta') return 'Falta algún dato o no se entiende.';
    if (e === 'sin-solucion') return 'Con estos valores no hay solución en un intervalo razonable.';
    if (e === 'no-despejable') return 'Esta variable no se puede despejar.';
    return 'No se puede calcular con estos valores.';
  }
</script>

<div class="calculadora" class:pagina={modo === 'pagina'} data-formula={f.id}>
  {#if formulas.length > 1}
    <div class="pestanas" role="tablist" aria-label="Fórmulas de esta ecuación">
      {#each formulas as g, i (g.id)}
        <button role="tab" aria-selected={i === idx} class:activa={i === idx} onclick={() => abrir(i)}>{g.nombre}</button>
      {/each}
    </div>
  {/if}

  <header>
    <div class="titulo">
      {#if modo === 'pagina'}<h1>{f.nombre}</h1>{:else}<h3>{f.nombre}</h3>{/if}
      <a class="seccion" href={enlaceLibro ?? undefined}>
        <Icono nombre="libro" tam={15} /> {f.seccion.num} · {f.seccion.titulo}
      </a>
    </div>
    <div class="acciones">
      <button class="icono" class:activo={favorita} aria-pressed={favorita} title={favorita ? 'Quitar de favoritas' : 'Añadir a favoritas'}
        aria-label={favorita ? 'Quitar de favoritas' : 'Añadir a favoritas'} onclick={() => alternarFavorita(f.id)}>
        <span aria-hidden="true">{favorita ? '★' : '☆'}</span>
      </button>
      {#if modo === 'emergente'}
        <a class="icono" href={rutaCalculadora(f.id)} title="Abrir en Calculadoras" aria-label="Abrir en Calculadoras"><Icono nombre="ampliar" tam={17} /></a>
      {/if}
    </div>
  </header>

  <div class="ecuacion" class:junto={modo === 'emergente'} role="img" aria-label={f.fuente}><span class="ec-img" style={ecEstilo}></span></div>

  <div class="objetivo" role="radiogroup" aria-label="Variable que se calcula">
    <span class="rotulo">Calcular</span>
    {#each posibles as id (id)}
      {@const v = variable(f, id)}
      {#if v}
        <button role="radio" aria-checked={id === objetivo} class:activo={id === objetivo} title={v.nombre} onclick={() => elegirObjetivo(id)}>
          {@html v.sim}
        </button>
      {/if}
    {/each}
  </div>

  <div class="campos">
    {#each entradas(f, objetivo) as v (f.id + v.id)}
      <CampoValor {v} bind:valor={() => valores[v.id] ?? NaN, (x) => (valores[v.id] = x)} {idBase} />
    {/each}
  </div>

  {#if vObjetivo}
    <output class="resultado" class:error={!Number.isFinite(resultado.valor)} for={entradas(f, objetivo).map((v) => `${idBase}-${v.id}`).join(' ')} aria-live="polite">
      <span class="sim">{@html vObjetivo.sim}</span>
      <span class="igual">=</span>
      <span class="valor">{Number.isFinite(resultado.valor) ? formatoValor(resultado.valor, vObjetivo.unidad, 4) : '—'}</span>
      <span class="nombre">{vObjetivo.nombre}</span>
    </output>
    {#if !Number.isFinite(resultado.valor)}
      <p class="nota-calc">{descripcionError(resultado.error)}</p>
    {:else}
      {#if resultado.numerico}
        <p class="nota-calc">Despejado numéricamente{resultado.raices > 1 ? `: hay ${resultado.raices} soluciones en el intervalo; se muestra la más cercana al valor anterior` : ''}.</p>
      {/if}
      {#if fueraDeRango(vObjetivo, resultado.valor)}
        <p class="nota-calc aviso">El resultado queda fuera de lo habitual en el libro ({formatoValor(vObjetivo.min, vObjetivo.unidad, 3, true)} a {formatoValor(vObjetivo.max, vObjetivo.unidad, 3, true)}).</p>
      {/if}
    {/if}
  {/if}

  {#if f.nota}<p class="nota-libro">{@html prepararHtml(f.nota)}</p>{/if}

  {#if f.ejemplo}
    {@const e = f.ejemplo}
    {@const vr = variable(f, f.resultado)}
    <div class="ejemplo">
      <div class="ejemplo-txt">
        <strong>Ejemplo del libro</strong>{#if e.origen}<span class="origen"> ({e.origen})</span>{/if}:
        {#each f.vars.filter((v) => v.id !== f.resultado) as v, i (v.id)}{i ? ', ' : ''}<span class="par">{@html v.sim} = {formatoValor(e.valores[v.id] ?? NaN, v.unidad, 4, true)}</span>{/each}
        {#if vr}→ <span class="par">{@html vr.sim} = {formatoValor(e.libro, vr.unidad, 4, true)}</span>{/if}
        <span class="ok" title="El generador comprueba que la fórmula reproduce el resultado del libro">✓ comprobado</span>
        {#if e.errata}<span class="errata">{e.errata}</span>{/if}
      </div>
      <button class="secundario" onclick={valoresDelLibro}><Icono nombre="restablecer" tam={15} /> Valores del libro</button>
    </div>
  {/if}

  {#if candidatosX.length}
    <div class="sensibilidad">
      {#if modo === 'emergente'}
        <button class="secundario" aria-expanded={verGrafica} onclick={() => (verGrafica = !verGrafica)}>
          <Icono nombre="simulador" tam={15} /> {verGrafica ? 'Ocultar la gráfica' : 'Ver cómo depende'}
        </button>
      {:else}
        <h2>Sensibilidad</h2>
      {/if}
      {#if verGrafica}
        <div class="eje-x">
          {#if vObjetivo}<span aria-hidden="true">{@html vObjetivo.sim} frente a</span>{/if}
          <select bind:value={xVar} aria-label="Variable del eje horizontal de la gráfica">
            {#each candidatosX as v (v.id)}
              <option value={v.id}>{textoPlano(v.sim)} — {v.nombre}</option>
            {/each}
          </select>
        </div>
        {#if grafica}
          <div class="grafica">
            <Grafica series={grafica.series} xAxis={grafica.xAxis} yAxis={grafica.yAxis} height={modo === 'pagina' ? 280 : 210} animate={false} help={false}
              ariaLabel="Resultado frente a la variable elegida, en el intervalo habitual del libro" />
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .calculadora {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-family: var(--sans);
    color: var(--tinta);
  }
  .pestanas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pestanas button {
    min-height: 36px;
    padding: 4px 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font: inherit;
    font-size: 13.5px;
    cursor: pointer;
  }
  .pestanas button.activa {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 600;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .titulo {
    min-width: 0;
  }
  h1,
  h3 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--sans);
    line-height: 1.25;
  }
  h3 {
    font-size: 17px;
  }
  h1 {
    font-size: 26px;
  }
  .seccion {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
    color: var(--acento);
    font-size: 13.5px;
    text-decoration: none;
  }
  .seccion:hover {
    text-decoration: underline;
  }
  .acciones {
    display: flex;
    gap: 4px;
    flex: none;
  }
  .icono {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--tinta-suave);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    text-decoration: none;
  }
  .icono:hover {
    background: var(--hover);
  }
  .icono.activo {
    color: var(--c-tarjeta);
  }
  .ecuacion {
    overflow-x: auto;
    padding: 6px 0 2px;
    font-size: 19px;
    text-align: center;
  }
  /* Under the book's own equation the copy is redundant, except in the phone sheet that covers it. */
  :global(.emergente:not(.hoja)) .ecuacion.junto {
    display: none;
  }
  .pagina .ecuacion {
    font-size: 23px;
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
  .objetivo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .rotulo {
    margin-right: 4px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .objetivo button {
    min-width: 44px;
    min-height: 40px;
    padding: 2px 10px;
    border: 1px solid var(--linea);
    border-radius: 9px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 17px;
    font-style: italic;
    cursor: pointer;
  }
  .objetivo button :global(sub) {
    font-style: normal;
    font-size: 0.72em;
  }
  .objetivo button.activo {
    border-color: var(--acento);
    background: var(--acento);
    color: var(--superficie);
  }
  .campos {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .resultado {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--acento-tinte);
    border: 1px solid var(--acento-suave);
  }
  .resultado .sim {
    font-family: var(--serif);
    font-size: 21px;
    font-style: italic;
  }
  .resultado .sim :global(sub) {
    font-style: normal;
    font-size: 0.72em;
  }
  .resultado .igual {
    font-size: 19px;
    color: var(--tinta-suave);
  }
  .resultado .valor {
    font-size: 24px;
    font-weight: 700;
    color: var(--acento);
    font-variant-numeric: tabular-nums;
  }
  .resultado .nombre {
    flex-basis: 100%;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .resultado.error .valor {
    color: var(--tinta-tenue);
  }
  .nota-calc,
  .nota-libro {
    margin: 0;
    text-align: left;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.4;
  }
  .nota-calc.aviso {
    color: var(--c-importante);
  }
  .ejemplo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    padding: 9px 12px;
    border-left: 3px solid var(--c-ejemplo);
    border-radius: 0 8px 8px 0;
    background: color-mix(in srgb, var(--c-ejemplo) 8%, transparent);
    font-size: 13.5px;
    line-height: 1.45;
  }
  .ejemplo-txt {
    min-width: 0;
    flex: 1 1 16em;
  }
  .par {
    white-space: nowrap;
  }
  .par :global(sub) {
    font-size: 0.75em;
  }
  .origen {
    color: var(--tinta-suave);
  }
  .ok {
    margin-left: 6px;
    color: var(--c-ejemplo);
    font-weight: 600;
    white-space: nowrap;
  }
  .errata {
    display: block;
    margin-top: 4px;
    color: var(--c-precaucion);
  }
  .secundario {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .secundario:hover {
    background: var(--acento-tinte);
  }
  .sensibilidad {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .grafica {
    align-self: stretch;
  }
  .sensibilidad h2 {
    margin: 8px 0 0;
    color: var(--titulos);
    font-size: 18px;
  }
  .eje-x {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-size: 14px;
    color: var(--tinta-suave);
  }
  .eje-x span :global(sub) {
    font-size: 0.75em;
  }
  select {
    min-height: 40px;
    max-width: 100%;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
  }
  .grafica {
    min-width: 0;
  }
</style>
