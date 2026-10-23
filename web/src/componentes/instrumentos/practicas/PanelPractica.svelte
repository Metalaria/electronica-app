<script lang="ts">
  // Guided practice: the steps of the book (each one can set up the bench), the checks «tu medida» against
  // the book's expected values (read live from the instruments, or noted), and the table of points with
  // its plot against theory.
  import type { Practica } from './tipos';
  import type { Banco } from '../banco.svelte.ts';
  import { aplicar, cargarVariante } from './aplicar';
  import { Grafica, formatoSI } from '../../grafica';
  import { prepararSalto } from '../../../lib/ruta.svelte';

  let { p, b }: { p: Practica; b: Banco } = $props();

  let paso = $state(0);
  let anotadas = $state<Record<string, number | null>>({});
  let avisoTabla = $state('');

  // Live readings refresh with the instruments (the bench increments `tic` five times per second).
  const vivas = $derived.by(() => {
    void b.tic;
    const r: Record<string, number | null> = {};
    // While the bench is being simulated again the instruments still show the previous circuit.
    const ok = b.vigente;
    for (const c of p.comprobaciones) r[c.id] = ok ? c.medir(b) : null;
    return r;
  });

  function estado(id: string): 'ok' | 'mal' | 'nada' {
    const c = p.comprobaciones.find((x) => x.id === id)!;
    const v = anotadas[id] ?? vivas[id];
    if (v === null || v === undefined) return 'nada';
    const tol = c.tol.abs ?? Math.abs(c.esperado) * (c.tol.rel ?? 0.01);
    return Math.abs(v - c.esperado) <= tol ? 'ok' : 'mal';
  }

  function fmt(v: number | null | undefined, u: string): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return u === '' ? formatoSI(v, '', 3) : formatoSI(v, u, 4);
  }
  function tolTexto(c: Practica['comprobaciones'][number]): string {
    if (c.tol.abs !== undefined) return `± ${formatoSI(c.tol.abs, c.unidad, 2)}`;
    return `± ${String(Math.round((c.tol.rel ?? 0) * 1000) / 10).replace('.', ',')} %`;
  }

  function irA(i: number, aplicarAjustes: boolean) {
    paso = i;
    const a = p.pasos[i]?.aplicar;
    if (aplicarAjustes && a) aplicar(b, p, a);
  }

  function anotar() {
    if (!p.tabla) return;
    const r = p.tabla.anotar(b);
    if (typeof r === 'string') {
      avisoTabla = r;
      return;
    }
    avisoTabla = '';
    b.anotaciones = [...b.anotaciones, r];
  }

  const serieTabla = $derived.by(() => {
    const t = p.tabla?.grafica;
    if (!t || !p.tabla) return null;
    const filas = [...b.anotaciones].filter((r) => Number.isFinite(r[t.x]) && Number.isFinite(r[t.y])).sort((a, c) => a[t.x]! - c[t.x]!);
    const colX = p.tabla.columnas.find((c) => c.id === t.x)!;
    const colY = p.tabla.columnas.find((c) => c.id === t.y)!;
    const series = [];
    if (t.teoria) {
      const xs = filas.map((r) => r[t.x]!);
      let a = xs.length ? Math.min(...xs) : t.xLog ? 100 : 0;
      let z = xs.length ? Math.max(...xs) : t.xLog ? 20000 : 1;
      if (t.xLog) {
        a = a / 2;
        z = z * 2;
      }
      if (a === z) z = a + 1;
      const n = 120;
      const x = new Float64Array(n);
      const y = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        x[i] = t.xLog ? a * (z / a) ** (i / (n - 1)) : a + ((z - a) * i) / (n - 1);
        y[i] = t.teoria(x[i]!);
      }
      series.push({ name: t.nombreTeoria ?? 'Teoría', unit: colY.unidad, x, y, dashed: true });
    }
    if (filas.length) series.push({ name: 'Tus puntos', unit: colY.unidad, x: Float64Array.from(filas.map((r) => r[t.x]!)), y: Float64Array.from(filas.map((r) => r[t.y]!)) });
    return { series, colX, colY, t };
  });

  function volverLibro() {
    prepararSalto({ texto: `Volver a la práctica ${p.n}` });
  }
</script>

<section class="practica" aria-label={`Práctica ${p.n}`}>
  <header>
    <div class="num">Práctica {p.n}</div>
    <h2>{p.titulo}</h2>
    <p class="objetivo">{@html p.objetivo}</p>
    <a class="libro" href={`#/cap22/${p.label}`} onclick={volverLibro}>Leer en el libro →</a>
  </header>

  {#if p.variantes.length > 1}
    <div class="variantes" role="group" aria-label="Montaje">
      {#each p.variantes as v (v.id)}
        <button class="chip" aria-pressed={b.variante === v.id} onclick={() => cargarVariante(b, p, v.id)}>{v.nombre}</button>
      {/each}
    </div>
  {/if}

  <ol class="pasos">
    {#each p.pasos as s, i (i)}
      <li class:actual={i === paso}>
        <button class="cab" onclick={() => irA(i, false)} aria-expanded={i === paso}>
          <span class="n">{i + 1}</span>
        </button>
        <div class="cuerpo">
          <p>{@html s.texto}</p>
          {#if s.aplicar && i === paso}
            <button class="boton primario pequeno" onclick={() => irA(i, true)}>Preparar este paso en el banco</button>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
  <div class="nav">
    <button class="boton" disabled={paso === 0} onclick={() => irA(paso - 1, true)}>← Anterior</button>
    <button class="boton" disabled={paso >= p.pasos.length - 1} onclick={() => irA(paso + 1, true)}>Siguiente →</button>
  </div>

  <h3>Tu medida frente a lo esperado</h3>
  <div class="tabla-envoltura">
    <table class="comprobaciones">
      <thead><tr><th>Magnitud</th><th>Esperado (libro)</th><th>Tu medida</th><th></th></tr></thead>
      <tbody>
        {#each p.comprobaciones as c (c.id)}
          {@const e = estado(c.id)}
          {@const v = anotadas[c.id] ?? vivas[c.id]}
          <tr class={e} data-id={c.id}>
            <td>
              <span class="que">{@html c.que}</span>
              <span class="donde">{c.donde}</span>
            </td>
            <td>
              <span class="valor">{fmt(c.esperado, c.unidad)}</span>
              <span class="donde">{tolTexto(c)} · <span class="cita">{@html c.libro}</span></span>
            </td>
            <td class="medida" title={v === null || v === undefined ? '' : String(v)}>
              <span class="valor">{fmt(v, c.unidad)}</span>
              {#if anotadas[c.id] !== undefined && anotadas[c.id] !== null}<span class="donde">anotada</span>{:else if v !== null && v !== undefined}<span class="donde">en vivo</span>{/if}
            </td>
            <td class="marca">
              {#if e === 'ok'}<span aria-label="Coincide">✓</span>{:else if e === 'mal'}<span aria-label="No coincide">≠</span>{/if}
              <button class="boton pequeno" disabled={vivas[c.id] === null} onclick={() => (anotadas = { ...anotadas, [c.id]: vivas[c.id] ?? null })}>Anotar</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if p.tabla}
    <h3>{p.tabla.titulo}</h3>
    <div class="acciones">
      <button class="boton primario" onclick={anotar}>Anotar punto</button>
      {#if b.anotaciones.length}<button class="boton" onclick={() => (b.anotaciones = [])}>Borrar la tabla</button>{/if}
    </div>
    {#if avisoTabla}<p class="aviso">{avisoTabla}</p>{/if}
    {#if b.anotaciones.length}
      <div class="tabla-envoltura">
        <table class="puntos">
          <thead><tr>{#each p.tabla.columnas as c (c.id)}<th>{@html c.nombre}</th>{/each}<th></th></tr></thead>
          <tbody>
            {#each b.anotaciones as r, i (i)}
              <tr>
                {#each p.tabla.columnas as c (c.id)}<td>{fmt(r[c.id], c.unidad)}</td>{/each}
                <td><button class="quitar" aria-label="Quitar este punto" onclick={() => (b.anotaciones = b.anotaciones.filter((_, k) => k !== i))}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    {#if serieTabla && serieTabla.series.length}
      <Grafica
        series={serieTabla.series}
        xAxis={{ label: serieTabla.colX.nombre.replace(/<[^>]+>/g, ''), unit: serieTabla.colX.unidad, scale: serieTabla.t.xLog ? 'log' : 'linear' }}
        yAxis={{ label: serieTabla.colY.nombre.replace(/<[^>]+>/g, ''), unit: serieTabla.colY.unidad, scale: serieTabla.t.yLog ? 'log' : 'linear' }}
        height={220}
        help={false}
        ariaLabel="Puntos anotados frente a la teoría"
      />
    {/if}
  {/if}

  <p class="leccion">{@html p.leccion}</p>
</section>

<style>
  .practica {
    font-family: var(--sans);
  }
  header .num {
    color: var(--acento);
    font-weight: 700;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h2 {
    margin: 2px 0 6px;
    color: var(--titulos);
    font-size: 21px;
    line-height: 1.2;
  }
  h3 {
    margin: 22px 0 8px;
    color: var(--titulos);
    font-size: 16px;
  }
  .objetivo {
    margin: 0 0 6px;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .libro {
    font-size: 14px;
    font-weight: 600;
  }
  .variantes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 12px 0 4px;
  }
  .chip {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    font-size: 13.5px;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .pasos {
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }
  .pasos li {
    display: flex;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--linea-suave);
  }
  .pasos .cab {
    flex: none;
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    padding: 0;
  }
  .pasos .n {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-weight: 700;
    font-size: 14px;
  }
  .pasos li.actual .n {
    background: var(--acento);
    color: #fff;
  }
  .pasos p {
    margin: 10px 0 6px;
    font-size: 14.5px;
    line-height: 1.45;
    color: var(--tinta-suave);
  }
  .pasos li.actual p {
    color: var(--tinta);
  }
  .nav,
  .acciones {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .boton.pequeno {
    min-height: 32px;
    padding: 0 10px;
    font-size: 13px;
  }
  .boton:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .tabla-envoltura {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    text-align: left;
    font-size: 12.5px;
    color: var(--tinta-suave);
    font-weight: 600;
    padding: 4px 6px;
    border-bottom: 1px solid var(--linea);
  }
  td {
    padding: 6px;
    border-bottom: 1px solid var(--linea-suave);
    vertical-align: top;
  }
  .que,
  .valor {
    display: block;
    font-weight: 600;
  }
  .valor {
    font-family: var(--mono);
    font-size: 13.5px;
    white-space: nowrap;
  }
  .donde {
    display: block;
    color: var(--tinta-tenue);
    font-size: 12px;
  }
  .cita {
    font-style: italic;
  }
  tr.ok .medida .valor {
    color: var(--c-ejemplo);
  }
  tr.mal .medida .valor {
    color: var(--c-precaucion);
  }
  .marca {
    text-align: right;
    white-space: nowrap;
  }
  .marca span {
    margin-right: 6px;
    font-weight: 800;
    font-size: 16px;
  }
  tr.ok .marca span {
    color: var(--c-ejemplo);
  }
  tr.mal .marca span {
    color: var(--c-precaucion);
  }
  .puntos td {
    font-family: var(--mono);
    font-size: 13px;
  }
  .quitar {
    width: 32px;
    height: 32px;
    border: 0;
    background: none;
    color: var(--tinta-tenue);
    font-size: 18px;
  }
  .aviso {
    color: var(--c-importante);
    font-size: 13.5px;
  }
  .leccion {
    margin-top: 20px;
    padding: 10px 12px;
    border-left: 4px solid var(--acento);
    background: var(--acento-tinte);
    font-size: 14px;
    border-radius: 0 8px 8px 0;
  }
</style>
