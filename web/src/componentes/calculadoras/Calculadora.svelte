<script lang="ts" module>
  let siguiente = 0;
</script>

<script lang="ts">
  // A live calculator for one catalogued formula (or for the several formulas of one equation of the book).
  // Visual: the circuit or curve of the formula with every quantity on it. Intuitive: sliders, tap a quantity
  // (in the formula or the drawing) to solve for it, «¿Qué pasa si…?». Explanatory: «Paso a paso» with units
  // and «Qué significa» from the book. Used inline in the reader (popover / bottom sheet) and on the
  // «Calculadoras» page.
  import { untrack } from 'svelte';
  import type { Formula } from './tipos';
  import type { Entorno } from './expresion';
  import { calcular, objetivosPosibles, entradas, valoresPorDefecto, fueraDeRango, barrido, variable } from './motor';
  import { formatoValor, unidadGrafica } from './unidades';
  import { normalizable, type Serie } from './eseries';
  import { calc, alternarFavorita, cargarFavoritos, rutaCalculadora } from './datos.svelte';
  import CampoValor from './CampoValor.svelte';
  import FormulaViva from './FormulaViva.svelte';
  import PasoAPaso from './PasoAPaso.svelte';
  import QuePasa from './QuePasa.svelte';
  import Significa from './Significa.svelte';
  import Icono from '../Icono.svelte';
  import { Grafica } from '../grafica';
  import { rutaDeRef, prepararHtml } from '../../lib/datos';

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
  /** The input the reader moved last: the horizontal axis of the generic plot. */
  let movida = $state('');
  let serie = $state<Serie>('libre');

  function abrir(i: number) {
    const ant = formulas[idx];
    if (ant && objetivo) memoria.set(ant.id, { objetivo, valores: { ...valores } });
    idx = i;
    const f = formulas[i] as Formula;
    const m = memoria.get(f.id);
    objetivo = m?.objetivo ?? f.resultado;
    valores = m ? { ...m.valores } : valoresPorDefecto(f);
    previo = undefined;
    movida = '';
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
  const conResultado = $derived({ ...valores, [objetivo]: resultado.valor });

  // The drawing, «¿Qué pasa si…?» and the sensitivity plot follow the values at most once per frame, so a
  // slider drag never queues work (144 Hz input on the tablet).
  let lentos = $state<Entorno>({});
  let ultimo: Entorno = {};
  let marco = 0;
  $effect(() => {
    ultimo = conResultado;
    if (!marco) {
      marco = requestAnimationFrame(() => {
        marco = 0;
        lentos = ultimo;
      });
    }
  });
  $effect(() => () => cancelAnimationFrame(marco));
  const lentosListos = $derived(Object.keys(lentos).length ? lentos : conResultado);

  function elegirObjetivo(id: string) {
    if (id === objetivo || !posibles.includes(id)) return;
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

  function probar(id: string, x: number) {
    valores[id] = x;
    movida = id;
  }

  const hayNormalizables = $derived(entradas(f, objetivo).some((v) => normalizable(v.unidad)));

  // ---------------------------------------------------------------- sections
  type Seccion = 'pasos' | 'quepasa' | 'significa' | 'grafica';
  let seccion = $state<Seccion>('pasos');
  const verGrafica = $derived(modo === 'pagina' || seccion === 'grafica');

  // ---------------------------------------------------------------- sensitivity plot
  let xVar = $state('');
  const candidatosX = $derived(entradas(f, objetivo).filter((v) => !v.entero));
  $effect.pre(() => {
    const ids = candidatosX.map((v) => v.id);
    if (!ids.includes(untrack(() => xVar))) xVar = ids[0] ?? '';
  });

  function textoPlano(html: string): string {
    return html.replace(/<[^>]+>/g, '');
  }

  const grafica = $derived.by(() => {
    if (!verGrafica || !xVar || !vObjetivo) return null;
    const vx = variable(f, xVar);
    if (!vx) return null;
    const vals = lentosListos;
    const b = barrido(f, objetivo, xVar, vals);
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const y of b.y) {
      if (Number.isFinite(y)) {
        ymin = Math.min(ymin, y);
        ymax = Math.max(ymax, y);
      }
    }
    const actual = vals[xVar] ?? NaN;
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


  const favorita = $derived(calc.favoritos.includes(f.id));
  const enlaceLibro = $derived(rutaDeRef(f.sub ?? f.seccion.label) ?? rutaDeRef(f.seccion.label));

  function descripcionError(e: string | undefined): string {
    if (e === 'falta') return 'Falta algún dato o no se entiende.';
    if (e === 'sin-solucion') return 'Con estos valores no hay solución en un intervalo razonable.';
    if (e === 'no-despejable') return 'Esta variable no se puede despejar.';
    return 'No se puede calcular con estos valores.';
  }

  const SECCIONES: [Seccion, string][] = [
    ['pasos', 'Paso a paso'],
    ['quepasa', '¿Qué pasa si…?'],
    ['significa', 'Qué significa'],
    ['grafica', 'Ver cómo depende'],
  ];
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

  <div class="cuerpo-calc">
    <div class="visual">
      {#await import('./ilustraciones/Ilustracion.svelte')}
        <div class="ilus-espera" aria-hidden="true"></div>
      {:then m}
        <m.default {f} {objetivo} valores={lentosListos} {posibles} onelegir={elegirObjetivo} xResp={movida} />
      {/await}
    </div>

    <div class="control">
      <div class="ecuacion">
        <FormulaViva {f} {objetivo} {posibles} onelegir={elegirObjetivo} />
        <p class="pista-toque">Toca una magnitud de la fórmula o del dibujo para calcularla.</p>
      </div>

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
            <p class="nota-calc aviso">El resultado queda fuera de lo habitual en el libro ({formatoValor(vObjetivo.min, vObjetivo.unidad, 3, true)} a {formatoValor(vObjetivo.max, vObjetivo.unidad, 3, true)}): revisa los datos y sus prefijos.</p>
          {/if}
        {/if}
      {/if}

      {#if hayNormalizables}
        <div class="series" role="group" aria-label="Valores normalizados de los deslizadores">
          <span class="rotulo-serie">Deslizadores de R, C y L</span>
          {#each ['libre', 'E12', 'E24'] as const as s (s)}
            <button aria-pressed={serie === s} class:activo={serie === s} onclick={() => (serie = s)}>{s === 'libre' ? 'Continuo' : s}</button>
          {/each}
        </div>
      {/if}

      <div class="campos">
        {#each entradas(f, objetivo) as v (f.id + v.id)}
          <CampoValor {v} bind:valor={() => valores[v.id] ?? NaN, (x) => (valores[v.id] = x)} {idBase} {serie}
            libro={f.ejemplo ? (f.ejemplo.valores[v.id] ?? (v.id === f.resultado ? f.ejemplo.resultado : undefined)) : undefined}
            onmover={(id) => (movida = id)} />
        {/each}
      </div>

      {#if f.ejemplo}
        {@const e = f.ejemplo}
        {@const vr = variable(f, f.resultado)}
        <div class="ejemplo">
          <div class="ejemplo-txt">
            <strong>Ejemplo del libro</strong>{#if e.origen}{' '}<span class="origen">({e.origen})</span>{/if}:
            {#each f.vars.filter((v) => v.id !== f.resultado) as v, i (v.id)}{i ? ', ' : ''}<span class="par">{@html v.sim} = {formatoValor(e.valores[v.id] ?? NaN, v.unidad, 4, true)}</span>{/each}
            {#if vr}→ <span class="par">{@html vr.sim} = {formatoValor(e.libro, vr.unidad, 4, true)}</span>{/if}
            <span class="ok" title="El generador comprueba que la fórmula reproduce el resultado del libro">✓ comprobado</span>
            {#if e.errata}<span class="errata">{e.errata}</span>{/if}
          </div>
          <button class="secundario" onclick={valoresDelLibro}><Icono nombre="restablecer" tam={15} /> Valores del libro</button>
        </div>
      {/if}
    </div>
  </div>

  {#if modo === 'emergente'}
    <div class="selector" role="group" aria-label="Explicaciones">
      {#each SECCIONES as [id, nombre] (id)}
        {#if id !== 'grafica' || candidatosX.length}
          <button aria-pressed={seccion === id} class:activo={seccion === id} onclick={() => (seccion = id)}>{nombre}</button>
        {/if}
      {/each}
    </div>
  {/if}

  {#if modo === 'pagina' || seccion === 'significa'}
    <section class="bloque-calc">
      {#if modo === 'pagina'}<h2>Qué significa</h2>{/if}
      <Significa {f} />
    </section>
  {/if}
  {#if modo === 'pagina' || seccion === 'pasos'}
    <section class="bloque-calc">
      {#if modo === 'pagina'}<h2>Paso a paso</h2>{/if}
      <PasoAPaso {f} {objetivo} {valores} resultado={resultado.valor} />
    </section>
  {/if}
  {#if modo === 'pagina' || seccion === 'quepasa'}
    <section class="bloque-calc">
      {#if modo === 'pagina'}<h2>¿Qué pasa si…?</h2>{/if}
      <QuePasa {f} {objetivo} valores={lentosListos} onprobar={probar} />
    </section>
  {/if}
  {#if verGrafica && candidatosX.length}
    <section class="bloque-calc sensibilidad">
      {#if modo === 'pagina'}<h2>Cómo depende de cada dato</h2>{/if}
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
    </section>
  {/if}
  {#if f.nota && modo === 'emergente' && seccion !== 'significa' && !f.explicacion}<p class="nota-libro">{@html prepararHtml(f.nota)}</p>{/if}
</div>

<style>
  .calculadora {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: var(--sans);
    color: var(--tinta);
    container-type: inline-size;
    container-name: calculadora;
  }
  .pestanas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pestanas button {
    min-height: 40px;
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
  /* ---------------------------------------------------------------- body: drawing | controls */
  .cuerpo-calc {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  @container calculadora (min-width: 660px) {
    .cuerpo-calc {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
      align-items: start;
      gap: 20px;
    }
    .visual {
      position: sticky;
      top: calc(var(--alto-barra) + 12px);
    }
  }
  .visual {
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--linea-suave);
    border-radius: 12px;
    background: var(--superficie);
  }
  .ilus-espera {
    aspect-ratio: 16 / 10;
  }
  .control {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .ecuacion {
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .pista-toque {
    margin: 0;
    padding: 0 10px 8px;
    color: var(--tinta-tenue);
    font-size: 12.5px;
    text-align: center;
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
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .objetivo button {
    min-width: 44px;
    min-height: 44px;
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
    container-type: inline-size;
    container-name: campos;
  }
  .series {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .rotulo-serie {
    margin-right: 2px;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .series button,
  .selector button {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .series button {
    min-height: 36px;
    padding: 0 12px;
    font-size: 13px;
  }
  /* The visible pill is 36 px; the touch target reaches 44 px. */
  .series button {
    position: relative;
  }
  .series button::after {
    content: '';
    position: absolute;
    inset: -4px 0;
  }
  .series button.activo,
  .selector button.activo {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 600;
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
    font-size: 22px;
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
    font-size: 26px;
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
    min-height: 44px;
    padding: 0 14px;
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
  /* ---------------------------------------------------------------- explanations */
  .selector {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px 0 4px;
    border-top: 1px solid var(--linea-suave);
    padding-top: 12px;
    scrollbar-width: none;
  }
  .selector button {
    flex: none;
  }
  .bloque-calc h2 {
    margin: 10px 0 8px;
    padding-top: 12px;
    border-top: 1px solid var(--linea-suave);
    color: var(--titulos);
    font-size: 18px;
  }
  .sensibilidad {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .grafica {
    min-width: 0;
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
    min-height: 44px;
    max-width: 100%;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
  }
  .pagina .ecuacion :global(.formula-viva) {
    font-size: 26px;
  }
</style>
