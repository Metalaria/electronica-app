<script lang="ts">
  // One input of a calculator: symbol and name, the value as typed («4k7», «100n», «2,2 µ», decimal comma),
  // the unit, and a note when the value is outside the book's typical range. ↑/↓ step the value
  // (×1,1 on log variables, Mayús ×10).
  import type { VarFormula } from './tipos';
  import { leerValor, textoCampo, formatoValor } from './unidades';
  import { fueraDeRango } from './motor';

  let {
    v,
    valor = $bindable(),
    idBase,
    onentrada,
    soloLectura = false,
  }: { v: VarFormula; valor: number; idBase: string; onentrada?: () => void; soloLectura?: boolean } = $props();

  let texto = $state('');
  let enfocado = $state(false);
  let invalido = $state(false);
  let ultimo = NaN;

  // External changes (book values, another variable solved) rewrite the text unless the reader is typing.
  $effect(() => {
    const x = valor;
    if ((!enfocado || soloLectura) && !Object.is(x, ultimo)) {
      texto = textoCampo(x, v.unidad);
      ultimo = x;
      invalido = false;
    }
  });

  function entrada() {
    const x = leerValor(texto, v.unidad);
    invalido = texto.trim() !== '' && !Number.isFinite(x);
    // An unreadable or empty field leaves the variable without a value (the result shows «—»).
    ultimo = Number.isFinite(x) ? x : NaN;
    valor = ultimo;
    onentrada?.();
  }

  function salir() {
    enfocado = false;
    if (Number.isFinite(valor) && !invalido) texto = textoCampo(valor, v.unidad);
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    if (!Number.isFinite(valor)) return;
    ev.preventDefault();
    const sube = ev.key === 'ArrowUp';
    let x: number;
    if (v.escala === 'log' && valor > 0) x = valor * (ev.shiftKey ? 10 : 1.1) ** (sube ? 1 : -1);
    else {
      const paso = 10 ** Math.floor(Math.log10(Math.max(Math.abs(v.max - v.min), 1e-30))) / (ev.shiftKey ? 1 : 10);
      x = valor + (sube ? paso : -paso);
    }
    if (v.entero) x = Math.round(x);
    x = Number(x.toPrecision(6));
    valor = x;
    ultimo = x;
    texto = textoCampo(x, v.unidad);
    onentrada?.();
  }

  const fuera = $derived(fueraDeRango(v, valor));
</script>

<div class="campo" class:invalido class:fuera>
  <label for="{idBase}-{v.id}">
    <span class="sim">{@html v.sim}</span>
    <span class="nombre">{v.nombre}</span>
  </label>
  <div class="marco-valor" class:sin-unidad={!v.unidad}>
    <input
      id="{idBase}-{v.id}"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-invalid={invalido}
      aria-describedby={fuera || invalido ? `${idBase}-${v.id}-aviso` : undefined}
      readonly={soloLectura}
      bind:value={texto}
      oninput={entrada}
      onfocus={() => (enfocado = true)}
      onblur={salir}
      onkeydown={teclas}
    />
    {#if v.unidad}<span class="unidad">{v.unidad}</span>{/if}
  </div>
  {#if invalido}
    <div class="aviso" id="{idBase}-{v.id}-aviso">No se entiende el valor: prueba «4k7», «100n», «2,2 µ» o «1e-3».</div>
  {:else if fuera}
    <div class="aviso" id="{idBase}-{v.id}-aviso">
      Fuera de lo habitual en el libro ({formatoValor(v.min, v.unidad, 3, true)} a {formatoValor(v.max, v.unidad, 3, true)}).
    </div>
  {/if}
</div>

<style>
  .campo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(8.5em, 11em);
    align-items: center;
    gap: 2px 10px;
    padding: 4px 0;
  }
  label {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    font-family: var(--sans);
    font-size: 14.5px;
    line-height: 1.25;
    color: var(--tinta-suave);
  }
  .sim {
    flex: none;
    min-width: 2.2em;
    font-family: var(--serif);
    font-size: 17px;
    font-style: italic;
    color: var(--tinta);
  }
  .sim :global(sub) {
    font-style: normal;
    font-size: 0.72em;
  }
  .nombre {
    overflow-wrap: break-word;
    hyphens: auto;
  }
  .marco-valor {
    display: flex;
    align-items: center;
    min-height: 44px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    transition: border-color 0.12s;
  }
  .marco-valor:focus-within {
    border-color: var(--acento);
    box-shadow: 0 0 0 3px var(--acento-tinte);
  }
  input {
    flex: 1;
    min-width: 0;
    height: 42px;
    padding: 0 2px 0 10px;
    border: 0;
    background: transparent;
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    outline: none;
  }
  .sin-unidad input {
    padding-right: 12px;
  }
  input[readonly] {
    color: var(--acento);
    font-weight: 600;
  }
  .unidad {
    flex: none;
    padding: 0 10px 0 1px;
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 14.5px;
  }
  .aviso {
    grid-column: 1 / -1;
    font-family: var(--sans);
    font-size: 13px;
    color: var(--c-importante);
  }
  .invalido .marco-valor {
    border-color: var(--c-precaucion);
  }
  .invalido .aviso {
    color: var(--c-precaucion);
  }
  .fuera .marco-valor {
    border-color: var(--c-importante);
  }
  /* Phones: the name on its own line, the field full width below it. */
  @media (max-width: 520px) {
    .campo {
      grid-template-columns: minmax(0, 1fr);
      padding: 6px 0 2px;
    }
  }
</style>
