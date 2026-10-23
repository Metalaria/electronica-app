<script lang="ts">
  // «Kit FM7303»: the FM receiver kit of printed chapter 15, complete and alive. Route:
  // #/fm7303[/<pestana>[/<seleccion>]] with pestana = esquema | senal | alineacion | averias and an optional part
  // designator (R13), block (b4) or stage. Data: web/public/fm7303/ (contenido/fm7303.py).
  import { onMount, untrack } from 'svelte';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import { ruta } from '../../lib/ruta.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { pagina, movimiento, enPantalla } from '../figuras-vivas/carga.svelte';
  import type { Caja } from '../figuras-vivas/tipos';
  import { EstadoKit, alineado, nodoEn, type Pestana } from './estado.svelte';
  import type { Kit } from './tipos';
  import Visor from './Visor.svelte';
  import PanelEsquema from './PanelEsquema.svelte';
  import PanelSenal from './PanelSenal.svelte';
  import PanelAlineacion from './PanelAlineacion.svelte';
  import PanelAverias from './PanelAverias.svelte';

  const PESTANAS: { id: Pestana; titulo: string }[] = [
    { id: 'esquema', titulo: 'Esquema y tensiones' },
    { id: 'senal', titulo: 'Señal' },
    { id: 'alineacion', titulo: 'Alineación' },
    { id: 'averias', titulo: 'Averías' },
  ];

  let k = $state.raw<EstadoKit | null>(null);
  let svg = $state('');
  let error = $state('');

  onMount(() => {
    let vivo = true;
    Promise.all([
      fetch(new URL('fm7303/kit.json', document.baseURI)).then((r) => {
        if (!r.ok) throw new Error(`kit.json: ${r.status}`);
        return r.json() as Promise<Kit>;
      }),
      fetch(new URL('fm7303/esquema.svg', document.baseURI)).then((r) => {
        if (!r.ok) throw new Error(`esquema.svg: ${r.status}`);
        return r.text();
      }),
    ])
      .then(([kit, texto]) => {
        if (!vivo) return;
        svg = texto.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
        const e = new EstadoKit(kit);
        e.c = alineado();
        k = e;
        (globalThis as unknown as { __epaKit?: EstadoKit }).__epaKit = e;
      })
      .catch((x: unknown) => {
        if (vivo) error = x instanceof Error ? x.message : String(x);
      });
    return () => {
      vivo = false;
    };
  });

  // ---------------------------------------------------------------- route
  const partes = $derived(ruta.ancla.split('/').filter(Boolean));
  const pestana = $derived((PESTANAS.some((p) => p.id === partes[0]) ? partes[0] : 'esquema') as Pestana);
  let alineacionIniciada = false;
  $effect(() => {
    const kk = k;
    const p = pestana;
    const sel = partes[1] ?? null;
    void ruta.n;
    if (!kk) return;
    untrack(() => {
      if (kk.pestana !== p) kk.limpiarSeleccion();
      kk.pestana = p;
      kk.modo = 'normal';
      if (p === 'alineacion' && !alineacionIniciada) {
        alineacionIniciada = true;
        kk.reiniciar(false);
      }
      if (p !== 'averias' && kk.averia) kk.inyectar(null);
      if (sel) {
        const b = /^b(\d)$/.exec(sel);
        if (b) setTimeout(() => kk.enfocarBloque(Number(b[1])), 60);
        else if (kk.kit.componentes[sel]) setTimeout(() => kk.elegirPieza(sel), 60);
        else if (kk.kit.etapas.some((e) => e.id === sel)) setTimeout(() => kk.elegirEtapa(sel), 60);
        else if (/^TP\d$/.test(sel)) kk.verTP(sel);
      }
    });
  });

  // ---------------------------------------------------------------- DC operating point (debounced)
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const kk = k;
    if (!kk) return;
    void kk.valoresDC;
    untrack(() => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => void kk.actualizarDC(), kk.dc ? 220 : 0);
    });
  });

  // The selection of the live overlay drives the part card.
  $effect(() => {
    const kk = k;
    if (!kk) return;
    const s = kk.est.seleccion;
    untrack(() => {
      if (s?.k === 'elem') {
        const ref = kk.refDeElem.get(s.id);
        if (ref && kk.kit.componentes[ref] && kk.pieza !== ref) kk.pieza = ref;
      }
    });
  });

  // ---------------------------------------------------------------- visibility (animations)
  let zonaVisor: HTMLElement | undefined = $state();
  let visible = $state(true);
  $effect(() => {
    const el = zonaVisor;
    if (!el) return;
    return enPantalla.observar(el, (d) => (visible = d));
  });
  const activo = $derived(visible && pagina.visible);

  // ---------------------------------------------------------------- taps in the capture modes
  let xyRoja = $state.raw<{ nodo: string; xy: [number, number] } | null>(null);
  let xyNegra = $state.raw<{ nodo: string; xy: [number, number] } | null>(null);
  let respuesta = $state<{ ref: string; n: number } | null>(null);
  let n = 0;
  function tocar(X: number, Y: number, radio: number) {
    const kk = k;
    if (!kk) return;
    if (kk.modo === 'multimetro') {
      const nodo = nodoEn(kk, X, Y, radio * 1.6);
      if (!nodo) return;
      if (kk.siguiente === 'roja') xyRoja = { nodo, xy: [X, Y] };
      else xyNegra = { nodo, xy: [X, Y] };
      kk.ponerPunta(nodo);
    } else if (kk.modo === 'senalar') {
      const s = kk.est.buscar(X, Y, radio * 1.4);
      const id = s?.k === 'elem' ? s.id : null;
      const ref = id ? kk.refDeElem.get(id) : null;
      if (ref) respuesta = { ref, n: ++n };
    }
  }

  /** Where to draw a probe: where it was placed, or a point of its node. */
  function puntoDe(kk: EstadoKit, nodo: string | null, puesto: typeof xyRoja): [number, number] | null {
    if (!nodo) return null;
    if (puesto && puesto.nodo === nodo) return puesto.xy;
    const m = kk.kit.mapa.find((x) => x.nodo === nodo);
    if (m?.pieza) {
      const el = kk.kit.esquema.elementos.find((e) => e.designador === m.pieza);
      const a = el && m.pin ? el.anclas[m.pin] : null;
      if (a) return [a[0], a[1]];
    }
    const tp = kk.kit.tps.find((t) => t.nodo === nodo);
    if (tp) return tp.xy;
    const p = kk.kit.esquema.puntos.find((x) => x.nodo === nodo);
    return p ? [p.xy[0], p.xy[1]] : null;
  }

  // ---------------------------------------------------------------- signal path animation
  let fase = $state(0);
  $effect(() => {
    const kk = k;
    if (!kk || kk.pestana !== 'senal' || !activo || movimiento.reducido) return;
    let raf = 0;
    let t0 = 0;
    const paso = (t: number) => {
      const dt = t0 ? Math.min(0.1, (t - t0) / 1000) : 0;
      t0 = t;
      fase = (fase + dt) % 1000;
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  });

  let piezasPaso = $state<string[]>([]);
  const cajasPaso = $derived.by(() => {
    const kk = k;
    if (!kk || kk.pestana !== 'alineacion') return [];
    return piezasPaso
      .map((r) => kk.kit.esquema.elementos.find((e) => e.designador === r)?.caja)
      .filter((c): c is [number, number, number, number] => !!c);
  });

  const puntosTP = $derived(k?.kit.tps ?? []);
  const pts = (p: [number, number][]) => p.map((q) => `${q[0]},${q[1]}`).join(' ');
</script>

<svelte:head><title>Kit FM7303 · Electrónica Práctica Avanzada</title></svelte:head>

<div class="kit" data-kit-fm7303>
  <header class="cab">
    <div class="titulo">
      <h1>Kit FM7303</h1>
      <p>Receptor de FM estéreo V3.0r7, completo y vivo: esquema, tensiones, señal, alineación y averías del capítulo 15.</p>
    </div>
    <a class="volver" href="#/cap16" onclick={() => prepararSalto({ texto: 'Volver al kit FM7303' })}><ArrowLeft size={16} /> Capítulo 15</a>
  </header>
  <nav class="pestanas" aria-label="Capa">
    {#each PESTANAS as p (p.id)}
      <a href={`#/fm7303/${p.id}`} aria-current={pestana === p.id ? 'page' : undefined} data-pestana={p.id}>{p.titulo}</a>
    {/each}
  </nav>

  {#if error}
    <p class="error">No se pudo cargar el kit: {error}</p>
  {:else if !k || !svg}
    <p class="cargando">Cargando el esquema del kit…</p>
  {:else}
    {@const kk = k}
    <div class="cuerpo">
      <div class="zona-visor" bind:this={zonaVisor}>
        <div class="bloques" role="toolbar" aria-label="Bloques del receptor">
          <span class="rotulo">Bloques</span>
          {#each Object.entries(kk.kit.bloques) as [nb, b] (nb)}
            <button type="button" style:--c={b.color} title={b.nombre} aria-label={`Bloque ${nb}: ${b.nombre}`} aria-pressed={kk.bloque === Number(nb)}
              onclick={() => kk.enfocarBloque(Number(nb))}>{nb}</button>
          {/each}
        </div>
        <Visor
          {svg}
          total={kk.kit.vista as Caja}
          est={kk.est}
          viva={kk.pestana !== 'senal'}
          {activo}
          captura={kk.modo !== 'normal'}
          alTocar={tocar}
          enfoque={kk.enfoque}
        >
          {#snippet capas(z: number)}
            {#if kk.bloque != null && kk.kit.bloques[String(kk.bloque)]}
              {@const b = kk.kit.bloques[String(kk.bloque)]!}
              <rect x={b.caja[0]} y={b.caja[1]} width={b.caja[2] - b.caja[0]} height={b.caja[3] - b.caja[1]} rx="8" fill="none" stroke={b.color} stroke-width={3 / z} />
            {/if}
            {#if kk.pestana === 'senal'}
              {#each kk.kit.etapas as e (e.id)}
                {@const b = kk.kit.bloques[String(e.bloque)]}
                {@const sel = kk.etapa === e.id}
                {#each e.trazos as t, i (i)}
                  <polyline points={pts(t)} fill="none" stroke={b?.color ?? '#2e6ea6'} stroke-opacity={kk.etapa && !sel ? 0.25 : 0.55}
                    stroke-width={(sel ? 9 : 6) / z} stroke-linecap="round" stroke-linejoin="round" />
                  <polyline class="flujo" points={pts(t)} fill="none" stroke="#fff" stroke-width={(sel ? 3.4 : 2.4) / z}
                    stroke-dasharray={`${4 / z} ${14 / z}`} stroke-dashoffset={-(fase * (sel ? 46 : 30)) / z} stroke-linecap="round"
                    opacity={kk.etapa && !sel ? 0.35 : 0.95} />
                {/each}
              {/each}
            {/if}
            {#each cajasPaso as c, i (i)}
              <rect x={c[0] - 8 / z} y={c[1] - 8 / z} width={c[2] - c[0] + 16 / z} height={c[3] - c[1] + 16 / z} rx={6 / z}
                fill="none" stroke="#e08a00" stroke-width={3 / z} class="pulso" />
            {/each}
            {#each puntosTP as t (t.id)}
              <g class="tp" class:activo={kk.tp === t.id}>
                <circle cx={t.xy[0]} cy={t.xy[1]} r={9 / z} />
                <text x={t.xy[0]} y={t.xy[1] - 13 / z} font-size={12 / z} text-anchor="middle">{t.id}</text>
              </g>
            {/each}
            {#if kk.modo === 'multimetro' || kk.roja || kk.pestana === 'esquema'}
              {@const pr = puntoDe(kk, kk.roja, xyRoja)}
              {@const pn = kk.negra !== 'N0' ? puntoDe(kk, kk.negra, xyNegra) : null}
              {#if pr}
                <g class="punta-r"><circle cx={pr[0]} cy={pr[1]} r={7 / z} /><line x1={pr[0]} y1={pr[1]} x2={pr[0] + 22 / z} y2={pr[1] - 30 / z} stroke-width={4 / z} /></g>
              {/if}
              {#if pn}
                <g class="punta-n"><circle cx={pn[0]} cy={pn[1]} r={7 / z} /><line x1={pn[0]} y1={pn[1]} x2={pn[0] - 22 / z} y2={pn[1] - 30 / z} stroke-width={4 / z} /></g>
              {/if}
            {/if}
          {/snippet}
        </Visor>
        {#if kk.modo !== 'normal'}
          <div class="aviso-modo" role="status">
            {kk.modo === 'multimetro' ? `Toque el esquema para colocar la punta ${kk.siguiente}` : 'Toque la pieza que cree averiada'}
            <button type="button" onclick={() => (kk.modo = 'normal')}>Cancelar</button>
          </div>
        {/if}
        {#if kk.dcEstado === 'simulando'}<span class="sim" aria-live="polite">simulando…</span>{/if}
      </div>
      <aside class="panel" aria-label="Panel">
        {#if pestana === 'esquema'}
          <PanelEsquema k={kk} />
        {:else if pestana === 'senal'}
          <PanelSenal k={kk} />
        {:else if pestana === 'alineacion'}
          <PanelAlineacion k={kk} alPaso={(p) => (piezasPaso = p)} />
        {:else}
          <PanelAverias k={kk} {respuesta} />
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .kit {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 16px;
    font-family: var(--sans);
    color: var(--tinta);
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px 16px;
  }
  h1 {
    margin: 0;
    font-size: 24px;
    color: var(--titulos);
  }
  .titulo p {
    margin: 2px 0 0;
    font-size: 14px;
    color: var(--tinta-suave);
  }
  .volver {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    color: var(--acento);
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 600;
  }
  .pestanas {
    display: flex;
    gap: 4px;
    margin: 10px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .pestanas a {
    display: inline-flex;
    align-items: center;
    flex: none;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 10px;
    color: var(--tinta);
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    border: 1px solid var(--linea);
    background: var(--superficie);
  }
  .pestanas a[aria-current='page'] {
    border-color: var(--acento);
    background: var(--acento);
    color: #fff;
  }
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 390px;
    gap: 12px;
    height: calc(100dvh - var(--alto-barra) - 150px);
    min-height: 460px;
  }
  .zona-visor {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--linea);
    border-radius: 12px;
    overflow: hidden;
    background: var(--superficie);
  }
  .zona-visor > :global(.visor) {
    flex: 1;
    min-height: 0;
    border-radius: 0;
  }
  .panel {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 2px 4px 12px 2px;
  }
  @container (max-width: 600px) {
    .titulo p {
      display: none;
    }
    h1 {
      font-size: 21px;
    }
    .pestanas a {
      padding: 0 11px;
      font-size: 13.5px;
    }
  }
  @container (max-width: 860px) {
    .cuerpo {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }
    .zona-visor {
      height: min(56dvh, 560px);
      min-height: 300px;
    }
    .panel {
      overflow: visible;
    }
  }
  .bloques {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--linea);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .rotulo {
    margin-right: 4px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--tinta-suave);
  }
  .bloques button {
    flex: none;
    width: 32px;
    height: 32px;
    border: 2px solid var(--c);
    border-radius: 50%;
    background: color-mix(in srgb, var(--c) 18%, #fff);
    color: #1b2733;
    font: 700 13px var(--sans);
    cursor: pointer;
  }
  .bloques button[aria-pressed='true'] {
    background: var(--c);
    color: #fff;
  }
  @media (pointer: coarse) {
    .bloques button {
      width: 40px;
      height: 40px;
    }
  }
  .aviso-modo {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: calc(100% - 24px);
    padding: 6px 6px 6px 12px;
    border-radius: 999px;
    background: #1b2733;
    color: #fff;
    font-size: 13px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  }
  .aviso-modo button {
    min-height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 999px;
    background: #fff;
    color: #1b2733;
    font: 600 13px var(--sans);
    cursor: pointer;
  }
  .sim {
    position: absolute;
    top: 52px;
    right: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--superficie) 85%, transparent);
    color: var(--tinta-suave);
    font-size: 12px;
  }
  .tp circle {
    fill: #fff;
    stroke: #b03a2e;
    stroke-width: 2.4px;
    vector-effect: non-scaling-stroke;
  }
  .tp text {
    fill: #b03a2e;
    font-weight: 700;
    paint-order: stroke;
    stroke: #fff;
    stroke-width: 3px;
    vector-effect: non-scaling-stroke;
  }
  .tp.activo circle {
    fill: #b03a2e;
  }
  .punta-r circle,
  .punta-r line {
    fill: #d63a2f;
    stroke: #d63a2f;
  }
  .punta-n circle,
  .punta-n line {
    fill: #222;
    stroke: #222;
  }
  .pulso {
    animation: pulso 1.4s ease-in-out infinite;
  }
  @keyframes pulso {
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulso {
      animation: none;
    }
  }
  .error,
  .cargando {
    padding: 30px 0;
    color: var(--tinta-suave);
  }
</style>
