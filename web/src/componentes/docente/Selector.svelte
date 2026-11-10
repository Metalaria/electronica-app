<script lang="ts">
  // Chooses book items for an own course or exam: filters by chapter, concept (section), kind and «only what the
  // app checks», a text search, and «Añadir» per item; for exams also «Elegir al azar» (a seeded draw with the same
  // filters, lib/docente/banco.ts); for courses, the chapter's sections as lessons.
  import Plus from '@lucide/svelte/icons/plus';
  import Check from '@lucide/svelte/icons/check';
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import { app } from '../../lib/estado.svelte';
  import { normalizar, rotuloParte } from '../../lib/datos';
  import { filtrar, type EntradaBanco, type TipoEntrada } from '../../lib/docente/banco';
  import InsigniaNuevo from '../aprender/InsigniaNuevo.svelte';
  import type { FiltrosExamen } from '../../lib/docente/tipos';

  let {
    banco,
    modo,
    elegidos,
    filtros = $bindable(),
    onanadir,
    onseccion,
    onazar,
  }: {
    banco: EntradaBanco[];
    modo: 'curso' | 'examen';
    /** Keys «k:ref» (and «seccion:parte/label») already chosen. */
    elegidos: Set<string>;
    filtros: FiltrosExamen;
    onanadir: (e: EntradaBanco) => void;
    onseccion?: (parte: string, label: string) => void;
    onazar?: () => void;
  } = $props();

  let buscar = $state('');
  let limite = $state(40);

  const indice = $derived(app.indice);
  const partesConItems = $derived([...new Set(banco.map((e) => e.parte))]);
  const parte = $derived(filtros.partes[0] ?? '');
  const secciones = $derived(parte && indice ? (indice.partes[parte]?.secciones ?? []).filter((s) => s.num) : []);
  const concepto = $derived(filtros.conceptos[0] ?? '');

  const TIPOS: { id: TipoEntrada; nombre: string }[] = [
    { id: 'ejercicio', nombre: 'Ejercicios' },
    { id: 'problema', nombre: 'Problemas' },
    { id: 'pregunta', nombre: 'Preguntas de test' },
  ];

  const lista = $derived.by(() => {
    const q = normalizar(buscar.trim());
    const l = filtrar(banco, filtros);
    return q ? l.filter((e) => normalizar(`${e.num} ${e.resumen}`).includes(q)) : l;
  });

  function ponerParte(p: string) {
    filtros = { ...filtros, partes: p ? [p] : [], conceptos: [] };
    limite = 40;
  }
  function ponerConcepto(c: string) {
    filtros = { ...filtros, conceptos: c ? [c] : [] };
    limite = 40;
  }
  function alternarTipo(t: TipoEntrada) {
    const s = new Set(filtros.tipos);
    if (s.has(t)) s.delete(t);
    else s.add(t);
    filtros = { ...filtros, tipos: TIPOS.map((x) => x.id).filter((x) => s.has(x)) };
  }

  function nombre(e: EntradaBanco): string {
    if (e.tipo === 'pregunta') return `Pregunta de test ${e.num}`;
    return `${e.tipo === 'problema' ? 'Problema' : 'Ejercicio'} ${e.num}`;
  }
  const corto = (s: string) => (s.length > 160 ? `${s.slice(0, 157).trimEnd()}…` : s);
</script>

<div class="selector" data-selector>
  <div class="filtros">
    <label class="campo">
      <span>Capítulo</span>
      <select class="dc-entrada" value={parte} onchange={(ev) => ponerParte((ev.currentTarget as HTMLSelectElement).value)} data-filtro-parte>
        <option value="">Todos</option>
        {#each partesConItems as p (p)}
          <option value={p}>{rotuloParte(p)} · {indice?.partes[p]?.titulo ?? ''}</option>
        {/each}
      </select>
    </label>
    <label class="campo">
      <span>Concepto (sección)</span>
      <select class="dc-entrada" value={concepto} disabled={!parte} onchange={(ev) => ponerConcepto((ev.currentTarget as HTMLSelectElement).value)} data-filtro-concepto>
        <option value="">{parte ? 'Todas las secciones' : 'Elija antes un capítulo'}</option>
        {#each secciones as s (s.label)}
          <option value={`${parte}/${s.label}`}>{s.num} {s.titulo}</option>
        {/each}
      </select>
    </label>
    <fieldset class="tipos">
      <legend>Tipo</legend>
      {#each TIPOS as t (t.id)}
        <button type="button" class="t09-chip" aria-pressed={filtros.tipos.includes(t.id)} onclick={() => alternarTipo(t.id)} data-filtro-tipo={t.id}>{t.nombre}</button>
      {/each}
    </fieldset>
    <label class="casilla">
      <input type="checkbox" checked={filtros.soloAuto} onchange={(ev) => (filtros = { ...filtros, soloAuto: (ev.currentTarget as HTMLInputElement).checked })} data-filtro-auto />
      Solo lo que la aplicación corrige sola
    </label>
    <label class="campo ancho">
      <span>Buscar en el enunciado</span>
      <input class="dc-entrada" type="search" bind:value={buscar} placeholder="Por ejemplo: zener, rizado, 5.3" data-filtro-texto />
    </label>
  </div>

  {#if modo === 'curso' && parte && onseccion}
    <details class="secciones" open>
      <summary>Secciones del {rotuloParte(parte).toLowerCase()} (lecciones)</summary>
      <ul>
        {#each secciones as s (s.label)}
          {@const ya = elegidos.has(`seccion:${parte}/${s.label}`)}
          <li>
            <span>{s.num} {s.titulo}</span>
            <button type="button" class="t09-boton t09-contorno" disabled={ya} onclick={() => onseccion?.(parte, s.label)} data-anadir-seccion={`${parte}/${s.label}`}>
              {#if ya}<Check size={16} aria-hidden="true" /> Añadida{:else}<Plus size={16} aria-hidden="true" /> Añadir<span class="solo-lector"> la sección {s.num}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <div class="cuenta">
    <p aria-live="polite" data-cuenta-filtro>{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</p>
    {#if modo === 'examen' && onazar}
      <div class="azar">
        <label class="campo corto">
          <span>Cuántos</span>
          <input class="dc-entrada" type="number" min="1" max="100" value={filtros.cantidad} onchange={(ev) => (filtros = { ...filtros, cantidad: Math.max(1, Math.min(100, Number((ev.currentTarget as HTMLInputElement).value) || 1)) })} data-cantidad />
        </label>
        <button type="button" class="t09-boton t09-contorno" onclick={() => onazar?.()} disabled={!lista.length} data-elegir-azar><Shuffle size={16} aria-hidden="true" /> Elegir al azar con estos filtros</button>
      </div>
    {/if}
  </div>

  <ul class="resultados">
    {#each lista.slice(0, limite) as e (`${e.k}:${e.ref}`)}
      {@const ya = elegidos.has(`${e.k}:${e.ref}`)}
      <li data-entrada={`${e.k}:${e.ref}`}>
        <div class="txt">
          <span class="nom">{nombre(e)} <span class="donde">· {rotuloParte(e.parte)}</span></span>
          <span class="res">{corto(e.resumen)}</span>
          <span class="marcas">
            <span class="marca">{e.auto ? 'Se corrige solo' : e.mixto ? 'En parte autoevaluado' : 'Autoevaluación'}</span>
            {#if e.variable}<span class="marca">Valores que cambian</span>{/if}
            {#if e.nuevo}<InsigniaNuevo compacta />{/if}
          </span>
        </div>
        <button type="button" class="t09-boton t09-contorno" disabled={ya} onclick={() => onanadir(e)} data-anadir>
          {#if ya}<Check size={16} aria-hidden="true" /> Añadido{:else}<Plus size={16} aria-hidden="true" /> Añadir<span class="solo-lector"> {nombre(e)}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
  {#if lista.length > limite}
    <button type="button" class="t09-boton t09-contorno mas" onclick={() => (limite += 60)}>Mostrar más ({lista.length - limite} más)</button>
  {/if}
</div>

<style>
  .selector {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: var(--sans);
  }
  .filtros {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
    align-items: flex-end;
  }
  .campo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 200px;
    flex: 1 1 220px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .campo.ancho {
    flex-basis: 100%;
  }
  .campo.corto {
    min-width: 90px;
    flex: 0 0 96px;
  }
  .campo :global(select),
  .campo :global(input) {
    min-height: 44px;
    max-width: 100%;
  }
  .tipos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .tipos legend {
    margin-bottom: 4px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .t09-chip {
    min-height: 44px;
  }
  .casilla {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--tinta);
    font-size: 14.5px;
  }
  .casilla input {
    width: 20px;
    height: 20px;
    accent-color: var(--acento);
  }
  .cuenta {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
  }
  .cuenta p {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .azar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
  }
  .resultados,
  .secciones ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .resultados li,
  .secciones li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  .secciones li span {
    flex: 1;
    color: var(--tinta);
    font-size: 14.5px;
  }
  .secciones summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--titulos);
    font-weight: 700;
    cursor: pointer;
  }
  .txt {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .nom {
    color: var(--titulos);
    font-size: 14.5px;
    font-weight: 700;
  }
  .donde {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .res {
    color: var(--tinta);
    font-size: 14px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .marcas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .marca {
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
  }
  .t09-boton {
    min-height: 44px;
    flex-shrink: 0;
  }
  .mas {
    align-self: flex-start;
  }
  @media (max-width: 600px) {
    .resultados li {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
