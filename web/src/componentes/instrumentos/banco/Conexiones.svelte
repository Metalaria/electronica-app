<script lang="ts">
  // Leads and probes: pick one, then tap a node on the drawing (or in the list of nodes). Multimeters can
  // also go in series with a terminal of a part, to measure current.
  import type { Banco, Punta } from '../banco.svelte.ts';
  import { NOMBRE_PUNTA } from '../banco.svelte.ts';
  import { COLOR_PUNTA, LETRA_PUNTA } from '../esquema/Plano.svelte';
  import { conexionesDe } from '../motor/circuito.ts';

  let { b, activa = $bindable() }: { b: Banco; activa: Punta | null } = $props();

  const PUNTAS: Punta[] = ['bmRojo', 'bmNegro', 'ch1', 'ch2', 'masa', 'fnRojo', 'fnNegro', 'esc'];

  function nodoDe(p: Punta): string | null {
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

  function tocarNodo(n: string) {
    if (!activa) return;
    b.poner(activa, n);
  }

  // Series insertion: «R1 · terminal 1 (a)».
  const opcionesSerie = $derived(
    b.circuito.elementos
      .filter((e) => e.tipo !== 'K')
      .flatMap((e) => e.terminales.map((t, i) => ({ v: `${e.nombre}#${i}`, t: `${e.nombre} · ${t.nombre} (nodo ${t.nodo})` }))),
  );
  function enSerie(m: 'bm' | 'fn', valor: string) {
    if (!valor) {
      if (m === 'bm') b.bm = { rojo: null, negro: null, serie: null };
      else b.fn = { rojo: null, negro: null, serie: null };
      return;
    }
    const [el, i] = valor.split('#');
    b.enSerie(m, el!, Number(i));
  }
  const valorSerie = (m: 'bm' | 'fn') => {
    const s = (m === 'bm' ? b.bm : b.fn).serie;
    return s ? `${s.elemento}#${s.terminal}` : '';
  };
</script>

<div class="conexiones">
  <div class="puntas" role="radiogroup" aria-label="Punta que se va a colocar">
    {#each PUNTAS as p (p)}
      {@const n = nodoDe(p)}
      <button
        class="punta"
        role="radio"
        aria-checked={activa === p}
        style={`--c:${COLOR_PUNTA[p]}`}
        onclick={() => (activa = activa === p ? null : p)}
        title={NOMBRE_PUNTA[p]}
      >
        <span class="disco">{LETRA_PUNTA[p]}</span>
        <span class="txt">{NOMBRE_PUNTA[p].replace(' · ', ' ')}</span>
        <span class="nodo">{n === null ? '—' : n}</span>
      </button>
    {/each}
  </div>
  {#if activa && nodoDe(activa) !== null}
    <button class="boton quitar" onclick={() => activa && b.poner(activa, null)}>Quitar {NOMBRE_PUNTA[activa].toLowerCase()}</button>
  {/if}

  <div class="nodos" aria-label="Nodos del circuito">
    <span class="et">Nodos:</span>
    {#each b.nodos as n (n)}
      <button class="nodo-chip" disabled={!activa} onclick={() => tocarNodo(n)} title={conexionesDe(b.circuito, n).join(', ')}>{n}</button>
    {/each}
  </div>

  <div class="serie">
    <label>
      <span>Brymen en serie con</span>
      <select value={valorSerie('bm')} onchange={(e) => enSerie('bm', (e.currentTarget as HTMLSelectElement).value)}>
        <option value="">— (en paralelo, entre dos nodos)</option>
        {#each opcionesSerie as o (o.v)}<option value={o.v}>{o.t}</option>{/each}
      </select>
    </label>
    <label>
      <span>Multímetro del FNIRSI en serie con</span>
      <select value={valorSerie('fn')} onchange={(e) => enSerie('fn', (e.currentTarget as HTMLSelectElement).value)}>
        <option value="">— (en paralelo, entre dos nodos)</option>
        {#each opcionesSerie as o (o.v)}<option value={o.v}>{o.t}</option>{/each}
      </select>
    </label>
  </div>
</div>

<style>
  .conexiones {
    font-family: var(--sans);
  }
  .puntas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
  }
  .punta {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 44px;
    padding: 4px 8px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    text-align: left;
    font-size: 12.5px;
  }
  .punta[aria-checked='true'] {
    border-color: var(--c);
    box-shadow: 0 0 0 2px var(--c) inset;
  }
  .disco {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
    font-weight: 800;
    font-size: 13px;
  }
  .txt {
    flex: 1;
    line-height: 1.15;
    color: var(--tinta-suave);
  }
  .nodo {
    font-family: var(--mono);
    font-weight: 700;
    color: var(--tinta);
  }
  .quitar {
    margin-top: 6px;
  }
  .nodos {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-top: 10px;
  }
  .et {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .nodo-chip {
    min-width: 44px;
    min-height: 36px;
    padding: 0 10px;
    border: 1px solid var(--acento-borde);
    border-radius: 8px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-family: var(--mono);
    font-weight: 700;
  }
  .nodo-chip:disabled {
    opacity: 0.55;
  }
  .serie {
    display: grid;
    gap: 6px;
    margin-top: 10px;
  }
  .serie label {
    display: grid;
    gap: 2px;
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
  .serie select {
    min-height: 38px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    padding: 0 8px;
    font-size: 13.5px;
  }
</style>
