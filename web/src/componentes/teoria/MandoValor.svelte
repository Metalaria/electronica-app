<script lang="ts">
  // 1.0 «Teoría que se mueve»: one quantity of a formula as a slider over its list of values (E12, round steps…).
  // Slider semantics: role="slider" with aria-valuenow / min / max in the quantity's own units and aria-valuetext with
  // its prefix and unit («4,7 kΩ»); arrows move one value, Page Up / Page Down a tenth of the range, Home / End the
  // ends; the track is dragged with the mouse or a finger (vertical page scrolling keeps working). 44 px tall.
  // aria-valuemin / max / now are plain decimals (never «2.2e-7»: axe and some screen readers reject the exponent);
  // aria-valuetext says the value in words, prefix and unit included («220 nanofaradios»). With `nombres` (1.1: a
  // list whose positions have names, such as the colours of the colour code) each position reads «rojo (2)».
  import { formatoValor } from '../calculadoras/unidades';
  import { ariaNumero, teclaMando } from '../../lib/teoria-viva';
  import { leerUnidades } from '../../lib/habla-matematicas';

  let {
    id,
    sim,
    nombre,
    unidad,
    valores,
    nombres,
    pos,
    alMover,
  }: { id: string; sim: string; nombre: string; unidad: string; valores: number[]; nombres?: string[]; pos: number; alMover: (k: number) => void } = $props();

  let pista: HTMLDivElement | undefined = $state();
  let arrastrando = false;
  const n = $derived(valores.length);
  const valor = $derived(valores[pos]!);
  // enough significant figures that two positions never read the same («2,1 V» was both 2,1 and 2,105: review 10e)
  const cifras = $derived.by(() => {
    for (let c = 3; c <= 6; c++) {
      const t = valores.map((v) => formatoValor(v, unidad, c, true));
      if (new Set(t).size === t.length) return c;
    }
    return 6;
  });
  const numero = $derived(formatoValor(valor, unidad, cifras, true));
  const texto = $derived(nombres?.[pos] ? `${nombres[pos]} (${numero})` : numero);
  const hablado = $derived(leerUnidades(texto));
  const fraccion = $derived(n > 1 ? pos / (n - 1) : 0);

  function tecla(ev: KeyboardEvent) {
    const k = teclaMando(ev.key, pos, n);
    if (k == null) return;
    ev.preventDefault();
    if (k !== pos) alMover(k);
  }
  function desde(ev: PointerEvent) {
    if (!pista) return;
    const r = pista.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (ev.clientX - r.left) / Math.max(1, r.width)));
    const k = Math.round(f * (n - 1));
    if (k !== pos) alMover(k);
  }
  function bajar(ev: PointerEvent) {
    if (ev.button !== 0) return;
    arrastrando = true;
    pista?.setPointerCapture(ev.pointerId);
    pista?.focus();
    desde(ev);
  }
  function mover(ev: PointerEvent) {
    if (arrastrando) desde(ev);
  }
  function soltar(ev: PointerEvent) {
    arrastrando = false;
    if (pista?.hasPointerCapture(ev.pointerId)) pista.releasePointerCapture(ev.pointerId);
  }
</script>

<div class="mando" class:con-nombres={!!nombres?.length}>
  <span class="et" id={`${id}-et`}><span class="sim">{@html sim}</span> <span class="nom">{nombre}</span></span>
  <div
    class="pista"
    role="slider"
    tabindex="0"
    bind:this={pista}
    aria-labelledby={`${id}-et`}
    aria-valuemin={ariaNumero(valores[0] ?? 0)}
    aria-valuemax={ariaNumero(valores[n - 1] ?? 0)}
    aria-valuenow={ariaNumero(valor)}
    aria-valuetext={hablado}
    data-mando={id}
    onkeydown={tecla}
    onpointerdown={bajar}
    onpointermove={mover}
    onpointerup={soltar}
    onpointercancel={soltar}
  >
    <span class="riel" aria-hidden="true"><span class="lleno" style:width={`${fraccion * 100}%`}></span></span>
    <span class="pomo" aria-hidden="true" style:left={`${fraccion * 100}%`}></span>
  </div>
  <span class="val" aria-hidden="true">{texto}</span>
</div>

<style>
  .mando {
    display: grid;
    grid-template-columns: minmax(7.5em, auto) minmax(0, 1fr) 6.2em;
    align-items: center;
    gap: 4px 12px;
  }
  /* a named position («amarillo (4)», «nicromo (1,1 µΩ·m)») takes the room it needs */
  .mando.con-nombres {
    grid-template-columns: minmax(7.5em, auto) minmax(0, 1fr) auto;
  }
  .et {
    color: var(--tinta);
    font-size: 15px;
  }
  .sim {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 600;
  }
  .nom {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .pista {
    position: relative;
    height: 44px;
    margin: 0 11px;
    cursor: pointer;
    touch-action: pan-y;
    border-radius: 8px;
  }
  .pista:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  .riel {
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    height: 6px;
    border-radius: 3px;
    background: var(--linea);
    transform: translateY(-50%);
  }
  .lleno {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--acento);
  }
  .pomo {
    position: absolute;
    top: 50%;
    width: 22px;
    height: 22px;
    border: 2px solid var(--acento);
    border-radius: 50%;
    background: var(--superficie);
    transform: translate(-50%, -50%);
  }
  .val {
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  @media (max-width: 520px) {
    .mando,
    .mando.con-nombres {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .et {
      grid-column: 1;
    }
    .val {
      grid-column: 2;
      grid-row: 1;
    }
    .pista {
      grid-column: 1 / -1;
    }
  }
</style>
