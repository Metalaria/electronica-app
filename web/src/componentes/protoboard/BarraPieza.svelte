<script lang="ts">
  // The floating bar of the selected part or wire (0.11), next to it on the bench instead of a distant
  // toolbar: rotate, flip, its value (common values as chips — the resistor's bands change at once — or typed),
  // toggle a switch, more properties, remove; a wire's colour. Placed above the selection (below when there is
  // no room), always inside the bench.
  import { CONMUTABLES } from '../editor/catalogo.ts';
  import { leerValor } from '../editor/valores.ts';
  import { bandas, CABLE, NOMBRES_COLOR, COLOR_CODIGO, ORO, PLATA } from './colores.ts';
  import { EXTERNOS } from './encapsulados.ts';
  import { campoValor, conUnidad, numeroDe, pasoE12, valoresComunes } from './valores.ts';
  import type { Protoboard } from './estado.svelte';
  import { pulsar } from './pulsar.ts';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Sliders from '@lucide/svelte/icons/sliders-horizontal';
  import ToggleRight from '@lucide/svelte/icons/toggle-right';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  let {
    pb,
    caja,
    alMas,
  }: {
    pb: Protoboard;
    caja: { x: number; y: number; w: number; h: number; ancho: number; alto: number };
    /** «Más»: the full properties (the «Pieza» panel). */
    alMas: () => void;
  } = $props();

  // (0 until measured: the bar stays hidden for that first frame instead of jumping under a finger)
  let anchoBarra = $state(0);
  let altoBarra = $state(0);
  let altoPop = $state(0);
  let abierto = $state<'valor' | 'color' | null>(null);
  let texto = $state('');
  let error = $state('');

  const id = $derived(pb.sel[0] ?? '');
  const pieza = $derived(pb.pieza(id));
  const cable = $derived(pb.cable(id));
  const externo = $derived(!!pieza && EXTERNOS.has(pieza.enc));
  const comp = $derived(pieza && !pieza.chip ? pieza.comp : null);
  const campo = $derived(comp ? campoValor(comp) : null);
  const valor = $derived.by(() => {
    if (!comp || !campo) return '';
    if (campo.tipo === 'modelo') return valoresComunes(campo).find(([k]) => k.toLowerCase() === (comp.campos[campo.id] ?? '').toLowerCase())?.[1] ?? comp.campos[campo.id] ?? '';
    const v = numeroDe(comp, campo);
    return v != null ? conUnidad(v, campo.unidad ?? '') : (comp.campos[campo.id] ?? '');
  });
  const ohmios = $derived(comp && campo?.unidad === 'Ω' ? numeroDe(comp, campo) : null);
  const codigo = $derived(comp?.tipo === 'R' && ohmios ? bandas(ohmios) : null);
  const conmutable = $derived(!!comp && CONMUTABLES.has(comp.tipo));

  // A new selection closes the popover.
  $effect(() => {
    void id;
    abierto = null;
    error = '';
  });

  // The bar above the selection (below when there is no room); its popover on the side with more room.
  const pos = $derived.by(() => {
    const m = 8;
    let top = caja.y - altoBarra - 10;
    if (top < m) top = caja.y + caja.h + 10;
    if (top + altoBarra > caja.alto - m) top = Math.max(m, caja.alto - altoBarra - m);
    const left = Math.min(Math.max(m, caja.x + caja.w / 2 - anchoBarra / 2), Math.max(m, caja.ancho - anchoBarra - m));
    const arriba = top - m >= caja.alto - (top + altoBarra) - m;
    let popTop = arriba ? top - altoPop - 6 : top + altoBarra + 6;
    popTop = Math.min(Math.max(m, popTop), Math.max(m, caja.alto - altoPop - m));
    const popLeft = Math.min(Math.max(m, caja.x + caja.w / 2 - 180), Math.max(m, caja.ancho - 368));
    return { top, left, popTop, popLeft };
  });

  function poner(v: string) {
    if (!comp || !campo) return;
    pb.cambiarCampo(comp.id, campo.id, v);
    texto = v;
    error = '';
  }

  function escrito() {
    if (!campo) return;
    const t = texto.trim();
    if (!t) return;
    const l = leerValor(t, campo.unidad ?? '');
    if (!l.ok) {
      error = l.error;
      return;
    }
    poner(t);
  }

  function paso(sentido: 1 | -1) {
    if (!ohmios) return;
    const v = pasoE12(ohmios, sentido);
    const t = conUnidad(v, '').trim().replace(' ', '');
    poner(t);
  }

  const COLORES = Object.entries(CABLE) as [string, string][];
  function leerValorNum(t: string, u: string): number | null {
    const l = leerValor(t, u);
    return l.ok ? l.v : null;
  }
  const colorBanda = (c: string) => (c === ORO ? 'oro' : c === PLATA ? 'plata' : NOMBRES_COLOR[COLOR_CODIGO.indexOf(c)] ?? '');
</script>

<div
  class="barra-pieza"
  bind:clientWidth={anchoBarra}
  bind:clientHeight={altoBarra}
  style:top={`${pos.top}px`}
  style:left={`${pos.left}px`}
  style:visibility={anchoBarra && altoBarra ? 'visible' : 'hidden'}
  role="toolbar"
  aria-label={pieza ? `Acciones de ${pieza.comp.nombre}` : 'Acciones del cable'}
  tabindex="-1"
>
  <div class="botones">
    {#if pieza && !externo && pieza.pos.length >= 2}
      <button type="button" use:pulsar={() => pb.transformar([id], 'girar')}><RotateCw size={18} aria-hidden="true" /><span>Girar</span></button>
      <button type="button" use:pulsar={() => pb.transformar([id], 'reflejar')} title="Dar la vuelta: invierte las patas"><FlipHorizontal size={18} aria-hidden="true" /><span>Voltear</span></button>
    {/if}
    {#if campo && valor}
      <button type="button" class="valor" aria-expanded={abierto === 'valor'} use:pulsar={() => {
        abierto = abierto === 'valor' ? null : 'valor';
        texto = comp?.campos[campo.id] ?? '';
      }}>
        {#if codigo}<span class="bandas" aria-hidden="true">{#each codigo.colores as c, i (i)}<i style:background={c}></i>{/each}</span>{/if}
        <b>{valor}</b><span>Valor</span>
      </button>
    {/if}
    {#if conmutable && comp}
      <button type="button" use:pulsar={() => pb.conmutar(id)}><ToggleRight size={18} aria-hidden="true" /><span>{comp.tipo.startsWith('PUL') ? (comp.campos['pulsado'] === 'si' ? 'Soltar' : 'Pulsar') : 'Conmutar'}</span></button>
    {/if}
    {#if cable}
      <button type="button" aria-expanded={abierto === 'color'} use:pulsar={() => (abierto = abierto === 'color' ? null : 'color')}><span class="muestra" style:background={cable.color} aria-hidden="true"></span><span>Color</span></button>
    {/if}
    {#if pieza}
      <button type="button" use:pulsar={alMas}><Sliders size={18} aria-hidden="true" /><span>Más</span></button>
    {/if}
    <button type="button" class="quitar" use:pulsar={() => pb.borrar([id])}><Trash size={18} aria-hidden="true" /><span>Quitar</span></button>
  </div>
</div>
<div class="pop-caja" bind:clientHeight={altoPop} style:top={`${pos.popTop}px`} style:left={`${pos.popLeft}px`} style:visibility={altoPop ? 'visible' : 'hidden'}>

  {#if abierto === 'valor' && campo && comp}
    <div class="pop" role="group" aria-label={`Valor de ${comp.nombre}`}>
      {#if codigo}
        <div class="bandas-valor">
          <button type="button" class="paso" aria-label="Valor anterior de la serie E12" use:pulsar={() => paso(-1)}><ChevronLeft size={18} /></button>
          <span class="leyenda">{#each codigo.colores as c, i (i)}<span class="banda"><i style:background={c}></i>{colorBanda(c)}</span>{/each}</span>
          <button type="button" class="paso" aria-label="Valor siguiente de la serie E12" use:pulsar={() => paso(1)}><ChevronRight size={18} /></button>
        </div>
      {/if}
      <div class="chips">
        {#each valoresComunes(campo) as [k, etiqueta] (k)}
          <button type="button" class="chip" aria-pressed={(comp.campos[campo.id] ?? '').toLowerCase() === k.toLowerCase() || (campo.tipo !== 'modelo' && numeroDe(comp, campo) === leerValorNum(k, campo.unidad ?? ''))} use:pulsar={() => poner(k)}>{etiqueta}</button>
        {/each}
      </div>
      {#if campo.tipo !== 'modelo'}
        <form class="escribir" onsubmit={(e) => { e.preventDefault(); escrito(); }}>
          <label>Otro valor <input type="text" inputmode="text" bind:value={texto} placeholder={campo.unidad === 'Ω' ? '4,7k' : campo.unidad === 'F' ? '220n' : ''} /></label>
          <button type="submit" class="boton">Poner</button>
        </form>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      {/if}
    </div>
  {:else if abierto === 'color' && cable}
    <div class="pop colores" role="group" aria-label="Color del cable">
      {#each COLORES as [nombre, c] (nombre)}
        <button type="button" class="color" style:background={c} aria-label={`Color ${nombre}`} aria-pressed={cable.color === c} use:pulsar={() => pb.colorCable(cable.id, c)}></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .barra-pieza {
    position: absolute;
    z-index: 4;
    max-width: calc(100% - 16px);
    font-family: var(--sans);
  }
  .pop-caja {
    position: absolute;
    z-index: 5;
    font-family: var(--sans);
  }
  .botones {
    display: flex;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    width: max-content;
    max-width: 100%;
    overflow-x: auto;
  }
  .botones button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 52px;
    min-height: 48px;
    padding: 4px 6px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--tinta);
    font: 600 11.5px var(--sans);
    white-space: nowrap;
  }
  .botones button:hover,
  .botones button[aria-expanded='true'] {
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .botones .quitar {
    color: var(--c-precaucion);
  }
  .valor b {
    font-size: 13.5px;
    color: var(--tinta);
  }
  .valor span:last-child {
    color: var(--tinta-suave);
    font-size: 10.5px;
  }
  .bandas {
    display: flex;
    gap: 2px;
    padding: 2px 5px;
    border-radius: 6px;
    background: #e9d6b0;
  }
  .bandas i {
    display: block;
    width: 4px;
    height: 10px;
    border-radius: 1px;
  }
  .muestra {
    display: block;
    width: 22px;
    height: 8px;
    margin: 5px 0;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.25);
  }
  .pop {
    width: min(360px, calc(100vw - 32px));
    padding: 10px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .bandas-valor {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .leyenda {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 10px;
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
  .banda {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .banda i {
    display: inline-block;
    width: 10px;
    height: 14px;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.2);
  }
  .paso {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 44px;
    padding: 0 11px;
    border: 1px solid var(--linea);
    border-radius: 18px;
    background: var(--fondo);
    color: var(--tinta);
    font: 600 13.5px var(--sans);
  }
  .chip[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .escribir {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-top: 10px;
  }
  .escribir label {
    flex: 1;
    display: grid;
    gap: 3px;
    color: var(--tinta-suave);
    font-size: 12.5px;
  }
  .escribir input {
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
    font: 15px var(--sans);
  }
  .error {
    margin: 6px 0 0;
    color: var(--c-precaucion);
    font-size: 13px;
  }
  /* Phones: the common values in one row that scrolls sideways, so the popover fits above the bar. */
  @media (max-width: 520px) {
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      padding-bottom: 2px;
    }
    .chip {
      flex: none;
    }
    .escribir {
      margin-top: 8px;
    }
  }
  .colores {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: auto;
  }
  .color {
    width: 44px;
    height: 44px;
    border: 2px solid var(--linea);
    border-radius: 50%;
  }
  .color[aria-pressed='true'] {
    border-color: var(--acento);
    box-shadow: 0 0 0 2px var(--acento-tinte);
  }
</style>
