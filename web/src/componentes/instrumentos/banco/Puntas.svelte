<script lang="ts" module>
  import type { Banco, Punta } from '../banco.svelte.ts';

  /** 2.1: every lead and probe of the bench, in the order of the list. */
  export const PUNTAS_BANCO: Punta[] = ['bmRojo', 'bmNegro', 'ch1', 'ch2', 'masa', 'fnRojo', 'fnNegro', 'esc'];

  /** The names of the 2.1 list («Brymen, punta roja»). */
  export const NOMBRE_FILA: Record<Punta, string> = {
    bmRojo: 'Brymen, punta roja',
    bmNegro: 'Brymen, COM',
    ch1: 'FNIRSI, sonda CH1',
    ch2: 'FNIRSI, sonda CH2',
    masa: 'FNIRSI, pinza de masa',
    fnRojo: 'FNIRSI multímetro, roja',
    fnNegro: 'FNIRSI multímetro, negra',
    esc: 'Auricular (escuchar)',
  };

  /** Short names for the phone's one-line summary («roja en a7, COM en 0»). */
  const CORTO: Record<Punta, string> = {
    bmRojo: 'roja',
    bmNegro: 'COM',
    ch1: 'CH1',
    ch2: 'CH2',
    masa: 'masa',
    fnRojo: 'roja del multímetro',
    fnNegro: 'negra del multímetro',
    esc: 'auricular',
  };

  /** The node a lead or probe is on (null: not placed, or its meter is in series). */
  export function nodoDePunta(b: Banco, p: Punta): string | null {
    switch (p) {
      case 'bmRojo':
        return b.bm.serie ? null : b.bm.rojo;
      case 'bmNegro':
        return b.bm.serie ? null : b.bm.negro;
      case 'fnRojo':
        return b.fn.serie ? null : b.fn.rojo;
      case 'fnNegro':
        return b.fn.serie ? null : b.fn.negro;
      case 'ch1':
        return b.sondas.ch1;
      case 'ch2':
        return b.sondas.ch2;
      case 'masa':
        return b.sondas.ch1 || b.sondas.ch2 ? b.sondas.masa : null;
      case 'esc':
        return b.auricular;
    }
  }

  /** The leads of one instrument for the phone's summary row: «roja en a7, COM en 0» (dot colours with it). */
  export function resumenPuntas(b: Banco, aparato: 'brymen' | 'fnirsi'): { texto: { nombre: string; nodo: string }[]; serie: string | null; puntas: Punta[] } {
    const lista: Punta[] = aparato === 'brymen' ? ['bmRojo', 'bmNegro'] : b.fnirsi.modo === 'dmm' ? ['fnRojo', 'fnNegro'] : ['ch1', 'ch2', 'masa'];
    const s = aparato === 'brymen' ? b.bm.serie : b.fnirsi.modo === 'dmm' ? b.fn.serie : null;
    const puestas = lista.filter((p) => nodoDePunta(b, p) !== null);
    return {
      texto: puestas.map((p) => ({ nombre: CORTO[p], nodo: nodoDePunta(b, p)! })),
      serie: s ? `${s.elemento}` : null,
      puntas: puestas,
    };
  }
</script>

<script lang="ts">
  // 2.1 «Puntas puestas»: only the leads and probes placed, one hairline row each (colour, name, node). The row picked is
  // the one a tap on the schematic moves («Toque un nodo para mover»); its editor under it holds the keyboard and
  // screen-reader way to place it (a list of the circuit's nodes) and «Quitar». «Poner otra punta (N libres)» picks one
  // of the free ones, which then waits in the list for a node. Replaces 2.0's eight chips and twelve node buttons.
  import { tick, untrack } from 'svelte';
  import { abrirEncima } from '../../../lib/encima';
  import { NOMBRE_PUNTA } from '../banco.svelte.ts';
  import { COLOR_PUNTA } from '../puntas';
  import { conexionesDe } from '../motor/circuito.ts';

  let { b, activa = $bindable(), id = 'puntas' }: { b: Banco; activa: Punta | null; /** Prefix of the element ids (two lists may be on one page). */ id?: string } = $props();

  const nodoDe = (p: Punta) => nodoDePunta(b, p);
  /** A meter in series has neither lead on a node: it is listed once, with what it is in series with. */
  const series = $derived(
    [
      b.bm.serie ? { m: 'bm' as const, nombre: 'Brymen, en serie', s: b.bm.serie } : null,
      b.fn.serie ? { m: 'fn' as const, nombre: 'FNIRSI multímetro, en serie', s: b.fn.serie } : null,
    ].filter((x) => !!x),
  );
  const bloqueadas = $derived(new Set<Punta>([...(b.bm.serie ? (['bmRojo', 'bmNegro'] as Punta[]) : []), ...(b.fn.serie ? (['fnRojo', 'fnNegro'] as Punta[]) : [])]));
  const puestas = $derived(PUNTAS_BANCO.filter((p) => nodoDe(p) !== null));
  /** The rows: the placed ones, and the one picked to be placed (waiting for a node). */
  const filas = $derived(PUNTAS_BANCO.filter((p) => nodoDe(p) !== null || p === activa));
  const libres = $derived(PUNTAS_BANCO.filter((p) => nodoDe(p) === null && !bloqueadas.has(p) && p !== activa));
  let menu = $state(false);
  /** The row whose editor (node list, «Quitar») is open: picking a row opens it, picking it again closes it. */
  let editando = $state<Punta | null>(null);

  // 2.2: the open row editor and the «add a lead» menu are on top: the system's back closes them first (lib/encima.ts)
  $effect(() => {
    // (the editor on show: its row is the active one)
    const e = editando && activa === editando ? editando : null;
    if (!e) return;
    const quitar = abrirEncima('editor-punta', () => {
      if (editando === e) editando = null;
    });
    return () => untrack(quitar);
  });
  $effect(() => {
    if (!menu) return;
    const quitar = abrirEncima('menu-puntas', () => (menu = false));
    return () => untrack(quitar);
  });

  const pista = $derived(activa ? (nodoDe(activa) !== null ? 'Toque un nodo para mover' : 'Toque un nodo para ponerla') : 'Elija una punta para moverla');

  function elegir(p: Punta) {
    if (activa === p && editando === p) editando = null;
    else {
      activa = p;
      editando = p;
    }
  }
  async function poner(p: Punta) {
    menu = false;
    activa = p;
    editando = p;
    await tick();
    document.getElementById(`${id}-nodo-${p}`)?.focus();
  }
  function aNodo(p: Punta, n: string) {
    if (n) b.poner(p, n);
  }
  function quitar(p: Punta) {
    b.poner(p, null);
    if (activa === p) activa = null;
  }
  const colorPunto = (p: Punta) => (p === 'bmNegro' ? 'var(--v11-tinta)' : COLOR_PUNTA[p]);
  const textoSerie = (s: { elemento: string; terminal: number }) => {
    const e = b.circuito.elementos.find((x) => x.nombre === s.elemento);
    const t = e?.terminales[s.terminal];
    return t ? `${s.elemento} · ${t.nombre}` : s.elemento;
  };
</script>

<section class="puntas21" aria-labelledby="{id}-titulo" data-puntas-puestas>
  <div class="cab">
    <h2 class="etiqueta21" id="{id}-titulo">Puntas puestas</h2>
    <span class="pista" aria-live="polite">{pista}</span>
  </div>
  <!-- (a radio group, not a list: a <ul> with that role leaves its <li> without a list) -->
  <div class="filas" role="radiogroup" aria-label="Punta que se mueve al tocar un nodo">
    {#each filas as p (p)}
      {@const n = nodoDe(p)}
      <div class="fila-punta" class:activa={activa === p}>
        <button type="button" class="fila" role="radio" aria-checked={activa === p} data-punta={p} onclick={() => elegir(p)} title={NOMBRE_PUNTA[p]}>
          <span class="punto" style:background={colorPunto(p)} aria-hidden="true"></span>
          <span class="nombre">{NOMBRE_FILA[p]}</span>
          <span class="nodo" class:vacio={n === null}>{n ?? 'sin poner'}</span>
        </button>
        {#if activa === p && editando === p}
          <div class="editor" data-editor-punta={p}>
            <label>
              <span>Nodo</span>
              <select id="{id}-nodo-{p}" value={n ?? ''} onchange={(e) => aNodo(p, (e.currentTarget as HTMLSelectElement).value)}>
                {#if n === null}<option value="">— elija un nodo —</option>{/if}
                {#each b.nodos as x (x)}
                  {@const c = conexionesDe(b.circuito, x)}
                  <option value={x}>{x === '0' ? '0 (masa)' : x}{c.length ? ` · ${c.slice(0, 4).join(', ')}${c.length > 4 ? '…' : ''}` : ''}</option>
                {/each}
              </select>
            </label>
            {#if n !== null}
              <button type="button" class="boton fantasma" onclick={() => quitar(p)} aria-label="Quitar {NOMBRE_PUNTA[p].toLowerCase()}">Quitar</button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
    {#each series as s (s.m)}
      <div class="fila-punta">
        <div class="fila fija" data-serie-fila={s.m}>
          <span class="punto" style:background={s.m === 'bm' ? COLOR_PUNTA.bmRojo : COLOR_PUNTA.fnRojo} aria-hidden="true"></span>
          <span class="nombre">{s.nombre}</span>
          <span class="nodo">{textoSerie(s.s)}</span>
        </div>
      </div>
    {/each}
  </div>
  {#if !puestas.length && !series.length && !activa}
    <p class="vacia">Ninguna punta puesta todavía.</p>
  {/if}
  {#if libres.length}
    <button type="button" class="boton fantasma otra" data-recorrido="banco-otra" aria-expanded={menu} aria-controls="{id}-libres" onclick={() => (menu = !menu)}>Poner otra punta ({libres.length} {libres.length === 1 ? 'libre' : 'libres'})</button>
    {#if menu}
      <ul class="libres" id="{id}-libres" aria-label="Puntas libres">
        {#each libres as p (p)}
          <li>
            <button type="button" class="libre" onclick={() => void poner(p)} data-poner-punta={p}>
              <span class="punto" style:background={colorPunto(p)} aria-hidden="true"></span>{NOMBRE_FILA[p]}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .puntas21 {
    display: flex;
    flex-direction: column;
    font-family: var(--sans);
  }
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-bottom: 8px;
  }
  .pista {
    color: var(--v11-azul);
    font-size: 14px;
  }
  .filas {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .filas > .fila-punta {
    border-bottom: 1px solid var(--v11-linea);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    width: calc(100% + 16px);
    min-height: 48px;
    padding: 12px 8px;
    margin: 0 -8px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--v11-tinta);
    font: inherit;
    text-align: left;
  }
  button.fila {
    cursor: pointer;
  }
  button.fila:hover .nombre {
    color: var(--v11-azul);
  }
  .activa > .fila {
    background: var(--v11-azul-tinte);
  }
  .fila:focus-visible {
    outline: 2px solid var(--v11-foco);
    outline-offset: 0;
  }
  .punto {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--v11-tinta) 25%, transparent);
  }
  .nombre {
    flex: 1;
    min-width: 0;
    font-size: 16px;
  }
  .nodo {
    flex: none;
    font-family: var(--mono);
    font-size: 15px;
    color: var(--v11-azul);
  }
  .nodo.vacio {
    font-family: var(--sans);
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .editor {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px 16px;
    padding: 8px 0 16px 26px;
  }
  .editor label {
    display: grid;
    gap: 4px;
    flex: 1 1 180px;
    min-width: 0;
    color: var(--v11-tinta-suave);
    font-size: 13px;
  }
  .editor select {
    min-width: 0;
    max-width: 100%;
    min-height: 48px;
    padding: 0 10px;
    border: 1px solid var(--v11-linea);
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta);
    font-size: 15px;
  }
  .vacia {
    margin: 8px 0 0;
    color: var(--v11-tinta-suave);
    font-size: 15px;
  }
  .otra {
    align-self: flex-start;
    margin-top: 8px;
    padding: 0;
  }
  .otra:hover {
    background: none;
    text-decoration: underline;
  }
  .libres {
    margin: 0;
    padding: 0 0 0 4px;
    list-style: none;
  }
  .libre {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--v11-tinta);
    font: inherit;
    font-size: 15px;
    text-align: left;
  }
  .libre:hover {
    color: var(--v11-azul);
  }
</style>
