<script lang="ts">
  // One input of a calculator: symbol and name; a slider (logarithmic where the quantity spans decades,
  // snapping to E12/E24 for R, C and L on request) that updates everything while it is dragged; the value as
  // typed («4k7», «100n», «2,2 µ», decimal comma) with a prefix selector (typing «4,7» with «k» selected means
  // 4,7 k); and a note in words when the value is outside the book's typical range. ↑/↓ step the value
  // (×1,1 on log variables, Mayús ×10).
  import type { VarFormula } from './tipos';
  import { leerValor, textoCampo, formatoValor, partesValor, conPrefijo } from './unidades';
  import { fueraDeRango } from './motor';
  import { aSerie, normalizable, type Serie } from './eseries';

  let {
    v,
    valor = $bindable(),
    idBase,
    onentrada,
    soloLectura = false,
    deslizador = true,
    serie = 'libre',
    libro = undefined,
    onmover,
  }: {
    v: VarFormula;
    valor: number;
    idBase: string;
    onentrada?: () => void;
    soloLectura?: boolean;
    deslizador?: boolean;
    serie?: Serie;
    /** The book's example value (a tick on the slider). */
    libro?: number;
    /** Called when the reader moves this input (slider, keys or typing). */
    onmover?: (id: string) => void;
  } = $props();

  const PREF: [string, number][] = [['p', 1e-12], ['n', 1e-9], ['µ', 1e-6], ['m', 1e-3], ['', 1], ['k', 1e3], ['M', 1e6], ['G', 1e9]];
  const multi = (p: string): number => PREF.find(([q]) => q === p)?.[1] ?? 1;

  const prefijable = $derived(conPrefijo(v.unidad) && v.unidad !== '');
  let texto = $state('');
  let prefijo = $state('');
  let enfocado = $state(false);
  let invalido = $state(false);
  let ultimo = NaN;

  function escribir(x: number) {
    if (!Number.isFinite(x)) {
      texto = '';
      return;
    }
    if (prefijable) {
      // tenths of the unit read better without a prefix: «0,7» V rather than «700» mV
      const a = Math.abs(x);
      if (a >= 0.1 && a < 1) {
        texto = String(Number(x.toPrecision(6))).replace('.', ',').replace('-', '−');
        prefijo = '';
      } else {
        const p = partesValor(x, v.unidad, 6, true);
        texto = p.numero;
        prefijo = p.prefijo;
      }
    } else texto = textoCampo(x, v.unidad);
  }

  // External changes (book values, another variable solved, the slider) rewrite the text unless typing.
  $effect(() => {
    const x = valor;
    if ((!enfocado || soloLectura) && !Object.is(x, ultimo)) {
      escribir(x);
      ultimo = x;
      invalido = false;
    }
  });

  const SIMPLE = /^[-+−]?\s*(?:\d{1,3}(?:[  ]\d{3})+|\d*)(?:[.,]\d+)?(?:[eE][-+]?\d+)?$/;

  function entrada() {
    const t = texto.trim();
    let x: number;
    if (prefijable && t && SIMPLE.test(t)) {
      // a bare number: the prefix comes from the selector
      x = leerValor(t, v.unidad) * multi(prefijo);
    } else {
      x = leerValor(t, v.unidad);
      if (prefijable && Number.isFinite(x)) prefijo = partesValor(x, v.unidad, 6, true).prefijo;
    }
    invalido = t !== '' && !Number.isFinite(x);
    // An unreadable or empty field leaves the variable without a value (the result shows «—»).
    ultimo = Number.isFinite(x) ? x : NaN;
    valor = ultimo;
    onentrada?.();
    onmover?.(v.id);
  }

  function salir() {
    enfocado = false;
    if (Number.isFinite(valor) && !invalido) escribir(valor);
  }

  function fijar(x: number) {
    valor = x;
    ultimo = x;
    escribir(x);
    invalido = false;
    onentrada?.();
    onmover?.(v.id);
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
    fijar(Number(x.toPrecision(6)));
  }

  function cambiarPrefijo(nuevo: string) {
    const anterior = prefijo;
    prefijo = nuevo;
    if (!Number.isFinite(valor)) return;
    fijar(Number(((valor / multi(anterior)) * multi(nuevo)).toPrecision(12)));
  }

  /** Prefixes whose decade range meets the variable's typical range (and the current one). */
  const opciones = $derived.by(() => {
    if (!prefijable) return [] as string[];
    const out = PREF.filter(([, m]) => m * 1000 > v.min * 0.999 && m <= v.max * 1.001).map(([p]) => p);
    if (!out.includes(prefijo)) out.push(prefijo);
    return PREF.map(([p]) => p).filter((p) => out.includes(p));
  });

  // ---------------------------------------------------------------- slider
  const N = 1000;
  const log = $derived(v.escala === 'log' && v.min > 0);
  // The range is the book's, widened when the value leaves it (so the thumb never sticks to an end).
  const lo = $derived(log ? Math.min(v.min, Number.isFinite(valor) && valor > 0 ? valor : v.min) : Math.min(v.min, Number.isFinite(valor) ? valor : v.min));
  const hi = $derived(Math.max(v.max, Number.isFinite(valor) ? valor : v.max));

  function aPos(x: number): number {
    if (!Number.isFinite(x)) return 0;
    if (log) return x > 0 ? (N * Math.log(x / lo)) / Math.log(hi / lo) : 0;
    return hi > lo ? (N * (x - lo)) / (hi - lo) : 0;
  }

  function dePos(p: number): number {
    let x: number;
    if (log) x = lo * (hi / lo) ** (p / N);
    else x = lo + ((hi - lo) * p) / N;
    if (v.entero) return Math.round(x);
    if (normalizable(v.unidad) && serie !== 'libre') return aSerie(x, serie);
    if (log) return Number(x.toPrecision(3));
    const paso = 10 ** (Math.floor(Math.log10(Math.max(hi - lo, 1e-30))) - 2);
    return Number((Math.round(x / paso) * paso).toPrecision(10));
  }

  const pos = $derived(aPos(valor));
  const marcaLibro = $derived(libro !== undefined && Number.isFinite(libro) ? Math.max(0, Math.min(N, aPos(libro))) / N : null);

  function deslizar(ev: Event) {
    const p = Number((ev.currentTarget as HTMLInputElement).value);
    const x = dePos(p);
    if (!Object.is(x, valor)) fijar(x);
  }

  const fuera = $derived(fueraDeRango(v, valor));

  /** Why a value is unusual, in words: how far from the book's range, and a hint at a wrong prefix. */
  const explicacion = $derived.by(() => {
    if (!fuera) return '';
    const rango = `${formatoValor(v.min, v.unidad, 3, true)} a ${formatoValor(v.max, v.unidad, 3, true)}`;
    if (v.escala === 'log' && valor <= 0) return `debe ser mayor que cero (el libro usa de ${rango}).`;
    const r = valor > v.max ? valor / v.max : v.min / valor;
    const veces = r >= 1.5 && Number.isFinite(r) && v.min > 0 ? `es unas ${formatoValor(r, '', 2, true)} veces ${valor > v.max ? 'mayor que lo más alto' : 'menor que lo más bajo'} que usa el libro` : '';
    const prefijoMal = prefijable && r >= 300 ? '; ¿sobra o falta un prefijo?' : '.';
    return veces ? `${veces} (${rango})${prefijoMal}` : `el libro usa de ${rango}.`;
  });
</script>

<div class="campo" class:invalido class:fuera class:con-deslizador={deslizador && !soloLectura}>
  <label for="{idBase}-{v.id}">
    <span class="sim">{@html v.sim}</span>
    <span class="nombre">{v.nombre}</span>
  </label>
  {#if deslizador && !soloLectura}
    <div class="pista-deslizador">
      <input
        class="deslizador"
        type="range"
        min="0"
        max={N}
        step="1"
        value={pos}
        aria-label="Deslizador de {v.nombre}"
        aria-valuetext={formatoValor(valor, v.unidad, 4, true)}
        oninput={deslizar}
      />
      {#if marcaLibro !== null}<span class="marca-libro" style="left: calc(14px + {marcaLibro} * (100% - 28px))" title="Valor del ejemplo del libro"></span>{/if}
    </div>
  {/if}
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
    {#if prefijable && !soloLectura}
      <select class="prefijo" aria-label="Prefijo de {v.nombre}" value={prefijo} onchange={(e) => cambiarPrefijo(e.currentTarget.value)}>
        {#each opciones as p (p)}<option value={p}>{p}{v.unidad}</option>{/each}
      </select>
    {:else if v.unidad}
      <span class="unidad">{prefijable ? prefijo : ''}{v.unidad}</span>
    {/if}
  </div>
  {#if invalido}
    <div class="aviso" id="{idBase}-{v.id}-aviso">No se entiende el valor: prueba «4k7», «100n», «2,2 µ» o «1e-3».</div>
  {:else if fuera}
    <div class="aviso" id="{idBase}-{v.id}-aviso">Fuera de lo habitual en el libro: {explicacion}</div>
  {/if}
</div>

<style>
  .campo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(8.5em, 11.5em);
    grid-template-areas: 'lab val' 'aviso aviso';
    align-items: center;
    gap: 2px 10px;
    padding: 4px 0;
  }
  .campo.con-deslizador {
    grid-template-areas: 'lab lab' 'des val' 'aviso aviso';
  }
  /* Wide calculators: name, slider and value on one row. */
  @container campos (min-width: 560px) {
    .campo.con-deslizador {
      grid-template-columns: minmax(9em, 0.9fr) minmax(0, 1.4fr) minmax(8.5em, 10.5em);
      grid-template-areas: 'lab des val' 'aviso aviso aviso';
    }
  }
  label {
    grid-area: lab;
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
    grid-area: val;
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
  input[type='text'] {
    flex: 1;
    min-width: 0;
    height: 42px;
    padding: 0 6px 0 10px;
    border: 0;
    background: transparent;
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    outline: none;
  }
  .sin-unidad input[type='text'] {
    padding-right: 12px;
  }
  input[readonly] {
    color: var(--acento);
    font-weight: 600;
  }
  .prefijo {
    flex: none;
    width: auto;
    min-width: 3.4em;
    height: 42px;
    padding: 0 18px 0 8px;
    background-image: linear-gradient(45deg, transparent 50%, var(--tinta-suave) 50%), linear-gradient(135deg, var(--tinta-suave) 50%, transparent 50%);
    background-position: calc(100% - 11px) 19px, calc(100% - 7px) 19px;
    background-size: 4px 4px, 4px 4px;
    background-repeat: no-repeat;
    border: 0;
    border-left: 1px solid var(--linea-suave);
    border-radius: 0 8px 8px 0;
    background-color: transparent;
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 14.5px;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }
  .prefijo:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: -2px;
  }
  .unidad {
    flex: none;
    padding: 0 10px 0 1px;
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 14.5px;
  }
  .aviso {
    grid-area: aviso;
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
  /* ---------------------------------------------------------------- slider (44 px touch target) */
  .pista-deslizador {
    grid-area: des;
    position: relative;
    min-width: 0;
    height: 44px;
  }
  .deslizador {
    display: block;
    width: 100%;
    height: 44px;
    margin: 0;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
    touch-action: pan-y;
  }
  .deslizador:focus {
    outline: none;
  }
  .deslizador::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: var(--linea);
  }
  .deslizador::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--linea);
  }
  .deslizador::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 28px;
    height: 28px;
    margin-top: -11px;
    border: 2px solid var(--acento);
    border-radius: 50%;
    background: var(--superficie);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .deslizador::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border: 2px solid var(--acento);
    border-radius: 50%;
    background: var(--superficie);
  }
  .deslizador:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px var(--acento-suave);
  }
  .deslizador:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 4px var(--acento-suave);
  }
  .deslizador:active::-webkit-slider-thumb {
    background: var(--acento-tinte);
  }
  .marca-libro {
    position: absolute;
    top: 29px;
    width: 2px;
    height: 7px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--c-ejemplo);
    pointer-events: none;
  }
</style>
