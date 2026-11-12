<script lang="ts">
  // 1.2 SQL sandbox (section 17.10): the reader writes a query (or fills its blanks, or puts its clauses in order),
  // runs it on the sample measurements database — SQLite in WebAssembly, in a worker loaded only now — and sees the
  // result table or SQLite's error explained in Spanish; «Comprobar» compares that result with the expected one.
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Texto } from '../../lib/leccion11/tipos';
  import { consultaDe } from '../../lib/leccion12/motor12';
  import type { EstadoSql, Sql } from '../../lib/leccion12/tipos';
  import Ordenar from '../leccion11/Ordenar.svelte';
  import TablaSql from './TablaSql.svelte';

  let { a, e, ea, prefijo, cambiar }: { a: Sql; e: EstadoTarjeta; ea: EstadoSql; prefijo: string; cambiar: (c: Partial<EstadoTarjeta>) => void } = $props();

  const consulta = $derived(consultaDe(a, ea));
  const bloqueado = $derived(e.resuelta);
  let ejecutando = $state(false);
  const piezas = $derived((a.plantilla ?? '').split(/(\[\[\d+\]\])/g));
  const clausulas = $derived((a.clausulas ?? []).map((c): Texto => [{ t: 'txt', s: c }]));
  const actual = $derived(ea.ejecutado && ea.ejecutado.texto === consulta ? ea.ejecutado : null);

  async function ejecutar() {
    if (ejecutando) return;
    ejecutando = true;
    const texto = consulta;
    try {
      const { ejecutarSql } = await import('../../lib/leccion12/sql/cliente');
      const r = await ejecutarSql(texto);
      cambiar({ actividad: { ...ea, ejecutado: { texto, ...r } } });
    } catch (err) {
      cambiar({ actividad: { ...ea, ejecutado: { texto, error: `No se ha podido abrir SQLite (${err instanceof Error ? err.message : String(err)}).` } } });
    } finally {
      ejecutando = false;
    }
  }

  function tecla(ev: KeyboardEvent) {
    // Ctrl/⌘ + Intro runs the query (Intro alone is a new line)
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      ev.stopPropagation();
      void ejecutar();
    }
  }
  const cambiarTexto = (texto: string) => cambiar({ actividad: { ...ea, texto }, comprobado: false, bien: null });
  const cambiarHueco = (k: number, v: string) => cambiar({ actividad: { ...ea, huecos: ea.huecos.map((h, j) => (j === k ? v : h)) }, comprobado: false, bien: null });
</script>

<div class="a12 sql" data-sql={a.modo}>
  <details class="esquema">
    <summary>Las tablas de la base de ejemplo</summary>
    <p class="a12-codigo">sensores(id, nombre, magnitud, unidad)<br />medidas(sensor, t, valor) · clave (sensor, t)<br />horas(sensor, t, media, minimo, maximo, n)</p>
    <p class="a12-suave">Datos de ejemplo generados por la app con el esquema del libro: cuatro sensores cada 10 minutos, del 25 de febrero al 3 de abril de 2026. t es tiempo Unix (s, UTC).</p>
  </details>

  {#if a.modo === 'consulta'}
    <label for={`${prefijo}-sql`} class="etq">Su consulta</label>
    <textarea id={`${prefijo}-sql`} class="a12-campo a12-codigo editor" rows="6" spellcheck="false" autocapitalize="off" autocomplete="off" value={ea.texto} disabled={bloqueado} oninput={(ev) => cambiarTexto((ev.currentTarget as HTMLTextAreaElement).value)} onkeydown={tecla} data-editor-sql></textarea>
  {:else if a.modo === 'rellenar'}
    <p class="etq" id={`${prefijo}-plantilla`}>Complete la consulta</p>
    <pre class="plantilla a12-codigo" aria-labelledby={`${prefijo}-plantilla`}>{#each piezas as p, k (k)}{#if /^\[\[\d+\]\]$/.test(p)}{@const n = Number(p.slice(2, -2)) - 1}{@const h = a.huecos?.[n]}{#if h?.opciones}<select class="hueco" aria-label={`Hueco ${n + 1}`} value={ea.huecos[n]} disabled={bloqueado} onchange={(ev) => cambiarHueco(n, (ev.currentTarget as HTMLSelectElement).value)} data-hueco={n}><option value="">…</option>{#each h.opciones as o (o)}<option value={o}>{o}</option>{/each}</select>{:else}<input class="hueco" aria-label={`Hueco ${n + 1}`} size={Math.max(4, (ea.huecos[n] ?? '').length + 1)} value={ea.huecos[n]} disabled={bloqueado} spellcheck="false" autocapitalize="off" oninput={(ev) => cambiarHueco(n, (ev.currentTarget as HTMLInputElement).value)} data-hueco={n} />{/if}{:else}{p}{/if}{/each}</pre>
  {:else}
    <div class="a12-codigo">
      <Ordenar elementos={clausulas} orden={ea.orden} bloqueado={bloqueado} comprobado={e.comprobado} valor={() => ''} cambiar={(o) => cambiar({ actividad: { ...ea, orden: o }, comprobado: false, bien: null })} />
    </div>
  {/if}

  <div class="a12-fila">
    <button type="button" class="a12-boton a12-primario" onclick={ejecutar} disabled={ejecutando || !consulta.trim()} data-ejecutar>{ejecutando ? 'Ejecutando…' : 'Ejecutar'}</button>
    {#if a.modo === 'consulta'}<span class="a12-suave">o Ctrl + Intro</span>{/if}
  </div>
  <div aria-live="polite" data-salida-sql>
    {#if actual?.error}
      <p class="error" data-error-sql>{actual.error}</p>
    {:else if actual?.resultado}
      <TablaSql resultado={actual.resultado} total={actual.total ?? actual.resultado.filas.length} />
    {:else if ea.ejecutado && !actual}
      <p class="a12-suave">Ha cambiado la consulta: vuelva a ejecutarla.</p>
    {:else if a.modo !== 'ordenar'}
      <p class="a12-suave">Ejecute la consulta para ver el resultado; después, «Comprobar».</p>
    {/if}
  </div>
</div>

<style>
  .etq {
    font-weight: 600;
  }
  .editor {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font-weight: 500;
    line-height: 1.45;
  }
  .plantilla {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
    border-radius: 10px;
    background: var(--v11-fondo);
    white-space: pre-wrap;
    line-height: 3.2;
  }
  .hueco {
    min-width: 44px;
    min-height: 44px;
    box-sizing: border-box;
    padding: 2px 6px;
    border: 2px solid var(--v11-azul);
    border-radius: 6px;
    background: var(--v11-azul-tinte);
    color: var(--v11-tinta);
    font: inherit;
  }
  .esquema summary {
    display: flex;
    align-items: center;
    min-height: 44px;
    cursor: pointer;
    font-weight: 600;
  }
  .esquema p {
    margin: 4px 0;
  }
  .error {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
  }
</style>
