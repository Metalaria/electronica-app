<script lang="ts">
  // 1.0 «Encuentre la avería»: a circuit of the book, already built but with one faulty part. A virtual multimeter
  // measures the voltage between two points or the current through a part; every reading comes from ngspice's
  // operating point of the FAULTY netlist (medir.ts medirAveria, one run per case). The reader names the part and what
  // is wrong with it. Afterwards: the score (fewer measurements, more points) and what each measurement revealed,
  // against the healthy circuit of the book (its stored simulation). Keyboard: the probes are selects; the badges on the
  // figure are a shortcut for the pointer.
  import EnlaceGuia from '../guia/EnlaceGuia.svelte';
  import Tapas from './Tapas.svelte';
  import { onMount, untrack } from 'svelte';
  import Gauge from '@lucide/svelte/icons/gauge';
  import { url } from '../../lib/datos';
  import type { ResultadoOp } from '../figuras-vivas/tipos';
  import type { ItemAveria } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { esquemaDe, medirAveria } from './medir';
  import { NOMBRE_AVERIA, corrienteDe, difiere, puntuacion, tensionEntre, type TipoAveria } from './averias';
  import { formatoValor } from '../calculadoras/unidades';

  let { item, final, listo = $bindable(false) }: { item: ItemAveria; final: boolean; listo?: boolean } = $props();

  interface Medicion {
    k: 'V' | 'A';
    texto: string;
    valor: number;
    sano: number | null;
  }

  const masa = untrack(() => item.puntos.find((p) => p.masa) ?? item.puntos[0]!);
  let modo = $state<'V' | 'A'>('V');
  let roja = $state(untrack(() => item.puntos.find((p) => !p.masa)?.nodo ?? masa.nodo));
  let negra = $state(untrack(() => masa.nodo));
  let rama = $state(untrack(() => item.ramas[0]?.id ?? ''));
  let averiado = $state<ResultadoOp | null>(null);
  let sano = $state<ResultadoOp | null>(null);
  let error = $state('');
  let medidas = $state<Medicion[]>([]);
  let pieza = $state<string | null>(null);
  let tipo = $state<TipoAveria | null>(null);
  /** Wrong diagnoses before the last one (review 10d: a wrong guess then the right one is not worth 100). */
  let fallos = $state(0);
  let desmontado = false;

  const nombrePunto = (n: string) => item.puntos.find((p) => p.nodo === n)?.nombre ?? n;
  const corto = (n: string) => {
    const p = item.puntos.find((x) => x.nodo === n);
    if (!p) return n;
    if (p.masa) return '−';
    const m = /^punto (\S+)$/.exec(p.nombre);
    return m ? m[1]! : p.nombre.split(' =')[0]!.slice(0, 6);
  };
  const tiposPieza = $derived(item.piezas.find((p) => p.id === pieza)?.tipos ?? []);

  $effect(() => {
    listo = !!pieza && !!tipo && !!averiado;
  });
  $effect(() => {
    if (tipo && !tiposPieza.includes(tipo)) tipo = null;
  });

  onMount(() => {
    void (async () => {
      const [m, { esq }] = await Promise.all([medirAveria(item.fuente, item.averia), esquemaDe(item.fuente)]);
      if (desmontado) return;
      if (!m.op) error = `No se pudo simular el circuito: ${m.error ?? 'error desconocido'}.`;
      averiado = m.op ?? null;
      // the healthy circuit: the book's own simulation of the figure
      sano = (esq.simulacion?.op as ResultadoOp | undefined) ?? null;
    })();
    return () => {
      desmontado = true;
    };
  });

  /** As a multimeter shows it: three figures, and zero below its resolution (1 mV, 1 µA). */
  function lectura(v: number, u: 'V' | 'A'): string {
    const r = u === 'V' ? (Math.abs(v) < 5e-4 ? 0 : v) : Math.abs(v) < 5e-7 ? 0 : Math.abs(v);
    if (r === 0) return u === 'V' ? '0,000 V' : '0,000 A';
    return formatoValor(r, u, 3, false);
  }

  function medir() {
    if (!averiado) return;
    if (modo === 'V') {
      const v = tensionEntre(averiado, roja, negra);
      if (v == null) return;
      medidas = [...medidas, { k: 'V', texto: `Entre ${nombrePunto(roja)} y ${nombrePunto(negra)}`, valor: v, sano: tensionEntre(sano, roja, negra) }];
    } else {
      const i = corrienteDe(averiado, rama);
      if (i == null) return;
      const s = sano ? corrienteDe(sano, rama) : null;
      medidas = [...medidas, { k: 'A', texto: `Por ${item.ramas.find((r) => r.id === rama)?.nombre ?? rama}`, valor: i, sano: s }];
    }
  }

  /** A tap on a badge of the figure: the red probe goes there (the black one stays where it is). */
  function tocarPunto(n: string) {
    if (final) return;
    modo = 'V';
    if (n === negra) negra = roja;
    roja = n;
  }

  export function comprobar(): Comprobacion {
    if (!pieza || !tipo) return { bien: false, nula: true, mensaje: 'Elija la pieza y lo que le pasa.' };
    const pb = pieza === item.averia.elemento;
    const tb = tipo === item.averia.tipo;
    if (pb && tb) return { bien: true };
    fallos++;
    if (pb) return { bien: false, mensaje: 'La pieza es esa, pero su avería es otra: con esa avería las medidas serían otras.' };
    return { bien: false, mensaje: `${item.piezas.find((p) => p.id === pieza)?.nombre ?? 'Esa pieza'} no es la pieza averiada. Compare cada medida con la del circuito sano.` };
  }

  export function reintentar(): void {
    pieza = null;
    tipo = null;
  }

  const ultima = $derived(medidas[medidas.length - 1] ?? null);
  const piezaBien = $derived(pieza === item.averia.elemento);
  const tipoBien = $derived(tipo === item.averia.tipo);
  // the last diagnosis, if wrong, is already the verdict: only the earlier wrong ones cost points
  const puntos = $derived(puntuacion(medidas.length, piezaBien, tipoBien, piezaBien && tipoBien ? fallos : Math.max(0, fallos - 1)));
  const rv = $derived(item.fuente.recorte ?? item.fuente.vista);
  const nombreAveriada = $derived(item.piezas.find((p) => p.id === item.averia.elemento)?.nombre ?? '');
  const clave = $derived.by(() => {
    const v = tensionEntre(averiado, item.clave, masa.nodo);
    const s = tensionEntre(sano, item.clave, masa.nodo);
    return v == null || s == null ? null : { v, s };
  });
</script>

<div class="averia" data-averia={item.id} data-medidas={medidas.length} data-listo={averiado ? '' : undefined}>
  <figure class="p10-placa figura">
    <svg viewBox={rv.join(' ')} role="img" aria-label={`Figura ${item.fuente.num}, con los puntos de medida marcados`}>
      <!-- only the drawing's own area: the letterbox of a wider box must not show the rest of the picture -->
      <clipPath id={`rv-${item.id}`}><rect x={rv[0]} y={rv[1]} width={rv[2]} height={rv[3]} /></clipPath>
      <image href={url(item.fuente.src)} x={item.fuente.vista[0]} y={item.fuente.vista[1]} width={item.fuente.vista[2]} height={item.fuente.vista[3]} clip-path={`url(#rv-${item.id})`} />
      <!-- the healthy circuit's readings and the book's notes are hidden: measurements come only from the multimeter -->
      <Tapas cajas={item.fuente.ocultar ?? []} vista={rv} dentro />
      {#each item.puntos as p (p.nodo)}
        {@const activo = p.nodo === roja || p.nodo === negra}
        <g
          class="marca"
          class:roja={p.nodo === roja && modo === 'V'}
          class:negra={p.nodo === negra && modo === 'V'}
          class:activo
          transform={`translate(${p.xy[0]} ${p.xy[1]})`}
          onclick={() => tocarPunto(p.nodo)}
          aria-hidden="true"
          data-punto={p.nodo}
        >
          <circle r="9" />
          <text text-anchor="middle" dominant-baseline="central">{corto(p.nodo)}</text>
        </g>
      {/each}
    </svg>
  </figure>
  <!-- (outside the light plate of the figure: on the page's own background in every theme) -->
  <p class="pie">Figura {item.fuente.num}, montada con una avería. Toque un punto para llevar la punta roja. <EnlaceGuia seccion="practica" apartado="averia" /></p>

  <section class="polimetro" aria-labelledby={`pm-${item.id}`}>
    <h3 id={`pm-${item.id}`}><Gauge size={18} aria-hidden="true" /> Polímetro</h3>
    <div class="modos" role="radiogroup" aria-label="Qué mide">
      <label class="chip"><input type="radio" name={`modo-${item.id}`} value="V" bind:group={modo} disabled={final} /> Tensión</label>
      <label class="chip"><input type="radio" name={`modo-${item.id}`} value="A" bind:group={modo} disabled={final || !item.ramas.length} /> Corriente</label>
    </div>
    {#if modo === 'V'}
      <div class="puntas">
        <label>
          <span>Punta roja (+)</span>
          <select bind:value={roja} disabled={final} data-punta="roja">
            {#each item.puntos as p (p.nodo)}<option value={p.nodo}>{p.nombre}</option>{/each}
          </select>
        </label>
        <label>
          <span>Punta negra (COM)</span>
          <select bind:value={negra} disabled={final} data-punta="negra">
            {#each item.puntos as p (p.nodo)}<option value={p.nodo}>{p.nombre}</option>{/each}
          </select>
        </label>
      </div>
    {:else}
      <div class="puntas">
        <label>
          <span>En serie con</span>
          <select bind:value={rama} disabled={final} data-rama>
            {#each item.ramas as r (r.id)}<option value={r.id}>{r.nombre}</option>{/each}
          </select>
        </label>
      </div>
    {/if}
    <div class="fila-medir">
      <button type="button" class="medir" onclick={medir} disabled={final || !averiado} data-medir>{averiado ? 'Medir' : 'Preparando…'}</button>
      <output class="pantalla" aria-live="polite" data-lectura-polimetro>
        {#if ultima}<span class="cifra">{lectura(ultima.valor, ultima.k)}</span><span class="donde">{ultima.texto}</span>{:else}<span class="cifra">— — —</span>{/if}
      </output>
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if medidas.length}
      <ol class="historial" aria-label="Medidas hechas">
        {#each medidas as m, i (i)}<li>{m.texto}: <strong>{lectura(m.valor, m.k)}</strong></li>{/each}
      </ol>
    {/if}
  </section>

  <fieldset class="diagnostico" disabled={final}>
    <legend>¿Qué pieza está averiada?</legend>
    <div class="opciones">
      {#each item.piezas as p (p.id)}
        <label class="chip" class:sel={pieza === p.id}><input type="radio" name={`pieza-${item.id}`} value={p.id} bind:group={pieza} data-pieza={p.id} /> {p.nombre}</label>
      {/each}
    </div>
  </fieldset>
  {#if pieza}
    <fieldset class="diagnostico" disabled={final}>
      <legend>¿Qué le pasa?</legend>
      <div class="opciones">
        {#each tiposPieza as t (t)}
          <label class="chip" class:sel={tipo === t}><input type="radio" name={`tipo-${item.id}`} value={t} bind:group={tipo} data-tipo={t} /> {NOMBRE_AVERIA[t]}</label>
        {/each}
      </div>
    </fieldset>
  {/if}

  {#if final}
    <div class="p10-solucion" data-desarrollo>
      <span class="rot">La avería</span>
      <p><strong>{nombreAveriada}</strong>: {NOMBRE_AVERIA[item.averia.tipo].toLowerCase()}.</p>
      <p data-puntuacion={puntos}>
        Puntuación: <strong>{puntos}</strong> de 100 · {medidas.length} {medidas.length === 1 ? 'medida' : 'medidas'}{#if fallos}
          · {fallos} {fallos === 1 ? 'diagnóstico fallido' : 'diagnósticos fallidos'}{/if}
      </p>
      {#if medidas.length}
        <ul class="explica">
          {#each medidas as m, i (i)}
            {@const revela = m.sano != null && difiere(m.k === 'A' ? Math.abs(m.sano) : m.sano, m.k === 'A' ? Math.abs(m.valor) : m.valor, m.k)}
            <li class:revela data-revela={revela ? '' : undefined}>
              {m.texto}: {lectura(m.valor, m.k)}; en el circuito sano, {m.sano != null ? lectura(m.sano, m.k) : '—'}.
              <!-- review 10d: a normal reading does not clear a part (the supply reads the same with any fault) -->
              {revela ? 'Esta medida delata la avería.' : 'Igual que en el circuito sano: en esta medida la avería no se nota.'}
            </li>
          {/each}
        </ul>
      {/if}
      {#if clave}
        <p>La medida que más la delata: entre {nombrePunto(item.clave)} y {masa.nombre}, {lectura(clave.v, 'V')} en lugar de {lectura(clave.s, 'V')}.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .averia {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .figura {
    margin: 0;
    align-self: center;
    width: min(100%, 460px);
  }
  .figura svg {
    display: block;
    width: 100%;
    height: auto;
    max-height: 320px;
  }
  .pie {
    margin: -6px 0 0;
    align-self: center;
    text-align: center;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .marca {
    cursor: pointer;
  }
  .marca circle {
    fill: var(--superficie);
    stroke: var(--acento);
    stroke-width: 1.6;
  }
  .marca text {
    fill: var(--tinta);
    font-family: var(--sans);
    font-size: 9px;
    font-weight: 700;
  }
  .marca.roja circle {
    fill: #c0392b;
    stroke: #c0392b;
  }
  .marca.negra circle {
    fill: #1d232b;
    stroke: #1d232b;
  }
  .marca.roja text,
  .marca.negra text {
    fill: #ffffff;
  }
  .polimetro {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  .polimetro h3 {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    color: var(--titulos);
    font-size: 16px;
  }
  .modos,
  .opciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 15px;
    cursor: pointer;
  }
  .chip.sel,
  .chip:has(input:checked) {
    border-color: var(--acento);
    box-shadow: inset 0 0 0 1px var(--acento);
  }
  .chip:has(input:focus-visible) {
    outline: 3px solid var(--acento);
    outline-offset: 2px;
  }
  .puntas {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .puntas label {
    display: flex;
    flex: 1 1 180px;
    flex-direction: column;
    gap: 4px;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  select {
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
    font-size: 16px;
  }
  .fila-medir {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: stretch;
  }
  .medir {
    min-height: 48px;
    padding: 0 22px;
    border: 0;
    border-radius: 12px;
    background: var(--bloque, var(--acento));
    color: var(--sobre-bloque, var(--sobre-acento));
    font-size: 16px;
    font-weight: 700;
  }
  .medir:disabled {
    opacity: 0.5;
  }
  .pantalla {
    display: flex;
    flex: 1 1 200px;
    flex-direction: column;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 10px;
    background: #1f2a24;
    color: #d8f5c8;
  }
  .pantalla .cifra {
    font-family: var(--mono, monospace);
    font-size: 24px;
    font-variant-numeric: tabular-nums;
  }
  .pantalla .donde {
    color: #b9dcaa;
    font-size: 13px;
  }
  .historial {
    margin: 0;
    padding-left: 22px;
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.5;
  }
  .error {
    margin: 0;
    color: var(--mal-texto);
  }
  .diagnostico {
    margin: 0;
    padding: 0;
    border: 0;
  }
  .diagnostico legend {
    margin-bottom: 8px;
    color: var(--titulos);
    font-size: 16px;
    font-weight: 700;
  }
  .explica {
    margin: 0;
    padding-left: 20px;
    font-size: 15.5px;
    line-height: 1.5;
  }
  .explica li.revela {
    font-weight: 600;
  }
  .p10-solucion p {
    margin: 0;
    font-size: 16px;
  }
</style>
