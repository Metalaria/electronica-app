<script lang="ts">
  // The circuit of a netlist, drawn and alive, for the simulator page. The drawing is the book's figure
  // when the netlist checks a figure whose schematic matches it (same parts and connections), or else the
  // automatic schematic of the netlist (componentes/esquema-auto/, when present). After each simulation of
  // the page, the circuit is solved once more with 0 V ammeters on every drawn pin (operating point, and
  // the netlist's own transient), and the overlay shows those voltages and currents.
  import { untrack } from 'svelte';
  import type { Simulacion } from '../../../simulador/motor/simular.ts';
  import type { Caja, DatosFigura, DibujoConNetlist, Esquema } from '../tipos';
  import { cargarDatos, enPantalla, pagina } from '../carga.svelte';
  import { url } from '../../../lib/datos';
  import { EstadoEsquema } from '../esquema/modelo.svelte';
  import { EstadoGraficas } from '../grafica/estado.svelte';
  import { emparejar, instrumentar, resultados } from './netlist.ts';
  import Escenario from '../Escenario.svelte';
  import PanelEsquema from '../esquema/PanelEsquema.svelte';
  import Grande from '../Grande.svelte';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Maximize from '@lucide/svelte/icons/maximize-2';

  let {
    texto,
    refs = [],
    resultado,
    pesada = false,
  }: {
    /** The netlist as it is now (sliders and edits included). */
    texto: string;
    /** Book labels the netlist checks (its figures are tried first). */
    refs?: string[];
    /** The page's latest simulation: each new one re-solves the drawn circuit. */
    resultado: Simulacion | null;
    /** Heavy netlist: only the operating point is solved for the drawing. */
    pesada?: boolean;
  } = $props();

  // The automatic generator is another module; it is used only if it exists in this build.
  type Generador = { generarDibujo?: (netlist: string) => DibujoConNetlist | null | Promise<DibujoConNetlist | null> };
  const autos = import.meta.glob<Generador>('../../esquema-auto/index.ts');

  let dibujo = $state.raw<DibujoConNetlist | null>(null);
  let vistaMostrada = $state.raw<Caja | null>(null);
  const mostrada = $derived(vistaMostrada ?? dibujo?.vista ?? ([0, 0, 1, 1] as Caja));
  /** Part of a book figure that holds the schematic (the figure may also hold plots or other drawings). */
  let recorte: Caja | null = null;

  function recorteDe(d: DatosFigura, esq: Esquema, vista: Caja): Caja | null {
    const ej = d.ejes[esq.eje];
    if (!ej) return null;
    const [x, y, w, h] = ej.pos_svg;
    const m = 6;
    const x0 = Math.max(vista[0], x - m);
    const y0 = Math.max(vista[1], y - m);
    const x1 = Math.min(vista[0] + vista[2], x + w + m);
    const y1 = Math.min(vista[1] + vista[3], y + h + m);
    // Only worth it when the schematic is clearly smaller than the figure.
    if ((x1 - x0) * (y1 - y0) > vista[2] * vista[3] * 0.8) return null;
    return [x0, y0, x1 - x0, y1 - y0];
  }
  let est = $state.raw<EstadoEsquema | null>(null);
  const estadoG = new EstadoGraficas();
  let grande = $state(false);

  // ---------------------------------------------------------------- zoom and pan inside the plate
  // The drawing is laid out larger (not CSS-scaled), so it stays sharp and the overlay stays aligned; the
  // particle canvas covers only the part on screen, so the animation costs the same at any zoom.
  const MAX = 8;
  let ventana: HTMLDivElement | undefined = $state();
  let anchoV = $state(0);
  let s = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  const altoV = $derived(anchoV / (mostrada[2] / mostrada[3] || 1));

  function limitar() {
    tx = Math.min(0, Math.max(anchoV - anchoV * s, tx));
    ty = Math.min(0, Math.max(altoV - altoV * s, ty));
  }

  function zoom(n: number, px = anchoV / 2, py = altoV / 2) {
    const s2 = Math.min(MAX, Math.max(1, n));
    tx = px - (px - tx) * (s2 / s);
    ty = py - (py - ty) * (s2 / s);
    s = s2;
    limitar();
  }

  /** Part of the drawing on screen, in SVG units. */
  const enPantallaSvg = $derived.by((): Caja => {
    const k = (anchoV * s) / mostrada[2] || 1;
    return [mostrada[0] - tx / k, mostrada[1] - ty / k, anchoV / k, altoV / k];
  });

  const punteros = new Map<number, { x: number; y: number }>();
  let pinza: { d: number; s: number; c: [number, number]; t: [number, number] } | null = null;
  let arrastre: { id: number; x: number; y: number; movido: boolean } | null = null;

  function rel(x: number, y: number): [number, number] {
    const r = ventana!.getBoundingClientRect();
    return [x - r.left, y - r.top];
  }

  function abajo(ev: PointerEvent) {
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      pinza = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, s, c: rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2), t: [tx, ty] };
      arrastre = null;
      return;
    }
    if (s > 1 && (ev.pointerType !== 'mouse' || ev.button === 0)) arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, movido: false };
  }

  function mover(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    p.x = ev.clientX;
    p.y = ev.clientY;
    if (pinza && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      const c = rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      const n = Math.min(MAX, Math.max(1, (pinza.s * d) / pinza.d));
      tx = c[0] - (pinza.c[0] - pinza.t[0]) * (n / pinza.s);
      ty = c[1] - (pinza.c[1] - pinza.t[1]) * (n / pinza.s);
      s = n;
      limitar();
    } else if (arrastre?.id === ev.pointerId) {
      if (!arrastre.movido && Math.hypot(ev.clientX - arrastre.x, ev.clientY - arrastre.y) > 6) arrastre.movido = true;
      if (arrastre.movido) {
        tx += dx;
        ty += dy;
        limitar();
      }
    }
  }

  function arriba(ev: PointerEvent) {
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinza = null;
    if (arrastre?.id === ev.pointerId) arrastre = null;
  }

  $effect(() => {
    const v = ventana;
    if (!v) return;
    // Ctrl/⌘ + wheel (and trackpad pinch, which arrives as ctrl+wheel) zooms; a plain wheel scrolls the page.
    const rueda = (ev: WheelEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      const [px, py] = rel(ev.clientX, ev.clientY);
      zoom(s * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0022)), px, py);
    };
    v.addEventListener('wheel', rueda, { passive: false });
    return () => v.removeEventListener('wheel', rueda);
  });
  $effect(() => {
    void anchoV;
    untrack(limitar);
  });

  // A part chosen on the drawing brings up its slider on the page (Pagina.svelte listens to this event).
  let elegido: string | null = null;
  $effect(() => {
    const sel = est?.seleccion;
    const id = sel?.k === 'elem' ? sel.id : null;
    untrack(() => {
      if (id === elegido) return;
      elegido = id;
      const nombre = id ? dibujo?.correspondencia[0]?.elementos[id]?.nombre : null;
      if (nombre) window.dispatchEvent(new CustomEvent('epa:elegir-componente', { detail: { nombre } }));
    });
  });
  let raiz: HTMLElement | undefined = $state();
  let visible = $state(true);

  /** Book figure whose schematic matches the netlist, if any. */
  async function deLibro(t: string): Promise<DibujoConNetlist | null> {
    for (const r of refs) {
      if (!r.startsWith('fig-')) continue;
      const ruta = `datos/${r.slice(4)}.json`;
      let d: DatosFigura;
      try {
        d = await cargarDatos(ruta);
      } catch {
        continue;
      }
      for (const esq of d.esquemas ?? []) {
        const c = emparejar(esq, t);
        if (c) {
          const vista: Caja = [0, 0, d.lienzo.svg.ancho, d.lienzo.svg.alto];
          recorte = recorteDe(d, esq, vista);
          return { origen: 'libro', figura: r, svg: url(`fig/${r.slice(4)}.svg`), vista, esquemas: [esq], correspondencia: [c] };
        }
      }
    }
    return null;
  }

  async function automatico(t: string): Promise<DibujoConNetlist | null> {
    const cargar = Object.values(autos)[0];
    if (!cargar) return null;
    try {
      const m = await cargar();
      return (await m.generarDibujo?.(t)) ?? null;
    } catch {
      return null;
    }
  }

  // Which drawing: re-decided (shortly after typing stops) when the netlist changes its parts.
  let firma = '';
  let espera: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const t = texto;
    untrack(() => {
      // Values change with every slider move; only the element names and nodes decide the drawing.
      const f = t
        .split('\n')
        .map((l) => l.trim().split(/\s+/).slice(0, 4).join(' '))
        .join('\n');
      if (f === firma) return;
      firma = f;
      if (espera) clearTimeout(espera);
      espera = setTimeout(async () => {
        recorte = null;
        const d = (await deLibro(t)) ?? (await automatico(t));
        if (f !== firma) return;
        vistaMostrada = d ? (recorte ?? d.vista) : null;
        dibujo = d;
        est = d && d.esquemas[0] ? new EstadoEsquema(d.esquemas[0], 0, true) : null;
        if (resultado) void resolver();
      }, dibujo ? 400 : 0);
    });
  });

  // Each page result: solve the drawn circuit with ammeters on its pins.
  let ultimo: Simulacion | null = null;
  $effect(() => {
    const r = resultado;
    untrack(() => {
      if (r && r !== ultimo && est) void resolver();
    });
  });

  async function resolver() {
    const e = est;
    const d = dibujo;
    if (!e || !d) return;
    ultimo = resultado;
    const corr = d.correspondencia[0];
    if (!corr) return;
    const ins = instrumentar(texto, [corr], !pesada);
    e.estadoSim = 'simulando';
    e.mensaje = '';
    const { simularTexto, SimulacionCancelada } = await import('../../../simulador/cliente.svelte');
    try {
      const sim = await simularTexto(ins.texto);
      if (e !== est) return;
      const r = resultados(e.esq, corr, ins, sim.ejecucion.graficas);
      if (!r.op && !r.tran) {
        e.estadoSim = 'error';
        e.mensaje = 'ngspice no ha podido resolver el punto de trabajo del circuito dibujado.';
        return;
      }
      e.op = r.op;
      e.tran = r.tran;
      e.estadoSim = 'libro';
    } catch (x) {
      if (x instanceof SimulacionCancelada) {
        // The page started another run: its result will bring us back.
        e.estadoSim = 'libro';
        ultimo = null;
        return;
      }
      e.estadoSim = 'error';
      e.mensaje = x instanceof Error ? x.message : String(x);
    }
  }

  const datos = $derived.by((): DatosFigura | null => {
    const d = dibujo;
    if (!d) return null;
    return {
      version: 1,
      nombre: d.figura ?? 'auto',
      tipo: 'esquema',
      lienzo: { svg: { ancho: d.vista[2], alto: d.vista[3], fig_a_svg: { sx: 1, tx: 0, sy: 1, ty: 0 } } },
      ejes: [],
      esquemas: d.esquemas,
    };
  });
  const src = $derived(
    dibujo ? (dibujo.svg.trimStart().startsWith('<') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dibujo.svg)}` : dibujo.svg) : '',
  );

  $effect(() => {
    const el = raiz;
    if (!el) return;
    return enPantalla.observar(el, (d) => (visible = d));
  });
</script>

{#if dibujo && est && datos}
  <section class="circuito-vivo" aria-label="Circuito" bind:this={raiz}>
    <div class="cab">
      <h3>Circuito</h3>
      <span class="origen">
        {#if dibujo.origen === 'libro'}Dibujo de la figura del libro{:else}Dibujado automáticamente a partir de la netlist{/if}
      </span>
      <span class="hueco"></span>
      <div class="zoom" role="group" aria-label="Zoom del circuito">
        <button type="button" class="b" aria-label="Alejar" title="Alejar (Ctrl + rueda)" disabled={s <= 1} onclick={() => zoom(s / 1.5)}><ZoomOut size={18} /></button>
        <button type="button" class="b" aria-label="Acercar" title="Acercar (Ctrl + rueda, pellizco)" disabled={s >= MAX} onclick={() => zoom(s * 1.5)}><ZoomIn size={18} /></button>
        <button type="button" class="b" aria-label="Ver todo el circuito" title="Ver todo" disabled={s === 1} onclick={() => zoom(1)}><RotateCcw size={16} /></button>
        <button type="button" class="b" aria-label="Abrir el circuito en grande" title="Abrir en grande" onclick={() => (grande = true)}><Maximize size={17} /></button>
      </div>
    </div>
    <div class="placa" style:--proporcion={mostrada[2] / mostrada[3]}>
      <div
        class="ventana"
        class:ampliada={s > 1}
        bind:this={ventana}
        bind:clientWidth={anchoV}
        onpointerdown={abajo}
        onpointermove={mover}
        onpointerup={arriba}
        onpointercancel={arriba}
        role="presentation"
      >
        <div class="contenido" style:width={`${anchoV * s}px`} style:transform={`translate(${tx}px, ${ty}px)`}>
          <Escenario
            {src}
            alt="Esquema del circuito"
            vista={mostrada}
            imagen={mostrada === dibujo.vista ? undefined : dibujo.vista}
            {datos}
            grupos={[]}
            esquemas={[est]}
            {estadoG}
            activo={visible && pagina.visible && !grande}
            visible={s > 1 ? enPantallaSvg : null}
          />
        </div>
        {#if s > 1}<span class="nivel" aria-hidden="true">{Math.round(s * 100)} %</span>{/if}
      </div>
    </div>
    <PanelEsquema {est} />
  </section>
  {#if grande}
    <Grande
      {src}
      alt="Esquema del circuito"
      num={null}
      pie={null}
      credito={null}
      vista={dibujo.vista}
      {datos}
      grupos={[]}
      esquemas={[est]}
      {estadoG}
      titulo="Circuito"
      cerrar={() => (grande = false)}
    />
  {/if}
{/if}

<style>
  .circuito-vivo {
    margin: 0 0 18px;
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin-bottom: 6px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    color: var(--titulos);
  }
  .origen {
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
  .hueco {
    flex: 1;
  }
  .zoom {
    display: flex;
    gap: 2px;
  }
  .b {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--tinta-suave);
  }
  .b:hover:not(:disabled) {
    background: var(--hover);
    color: var(--tinta);
  }
  .b:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .ventana {
    position: relative;
    width: 100%;
    aspect-ratio: var(--proporcion);
    overflow: hidden;
    touch-action: pan-y;
  }
  .ventana.ampliada {
    touch-action: none;
    cursor: grab;
  }
  .contenido {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
  }
  .nivel {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(20, 28, 36, 0.6);
    color: #fff;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .placa {
    /* As large as the column allows, but never taller than about half the screen. */
    width: min(100%, calc(52vh * var(--proporcion)));
    margin: 0 auto;
    padding: 12px;
    border: 1px solid var(--linea-suave);
    border-radius: 10px;
    background: var(--placa);
    box-sizing: border-box;
  }
  .circuito-vivo :global(.panel-e) {
    max-width: none;
  }
</style>
