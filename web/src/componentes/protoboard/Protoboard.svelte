<script lang="ts">
  // The breadboard workbench, shared by «Ver en protoboard» (full-screen sandbox over a schematic) and the
  // «Protoboard» tab (own circuits): the tools, the bench (Mesa.svelte) and a panel with the live schematic
  // (figuras-vivas' CircuitoVivo on the board's netlist: it changes with every wire), the simulation
  // (simulador's worker and results), the checks, the selected part (the schematic editor's properties
  // panel) and the palette to add parts (the editor's palette).
  import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { motor, detener, precalentarMotor, simularTexto, SimulacionCancelada } from '../../simulador/cliente.svelte';
  import type { Simulacion } from '../../simulador/motor/simular.ts';
  import CircuitoVivo from '../figuras-vivas/circuito/CircuitoVivo.svelte';
  import Resultados from '../simulador/Resultados.svelte';
  import Propiedades from '../editor/Propiedades.svelte';
  import Paleta from '../editor/Paleta.svelte';
  import { formatoSI } from '../grafica/formato.ts';
  import Mesa from './Mesa.svelte';
  import type { Protoboard } from './estado.svelte';
  import { brillos } from './comprobaciones.ts';
  import { encapsuladoDe, EXTERNOS } from './encapsulados.ts';
  import { rotulosChip } from './logica.ts';
  import { CABLE } from './colores.ts';
  import { leerPuntoTrabajo, netlistPuntoTrabajo } from './simulacion.ts';
  import MousePointer from '@lucide/svelte/icons/mouse-pointer-2';
  import Cable from '@lucide/svelte/icons/cable';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Undo from '@lucide/svelte/icons/undo-2';
  import Redo from '@lucide/svelte/icons/redo-2';
  import Maximize from '@lucide/svelte/icons/scan';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import Tag from '@lucide/svelte/icons/tag';
  import Play from '@lucide/svelte/icons/play';
  import RefreshCw from '@lucide/svelte/icons/refresh-ccw';
  import ToggleRight from '@lucide/svelte/icons/toggle-right';
  import Gauge from '@lucide/svelte/icons/gauge';
  import type { MedidaProtoboard } from './medida.svelte.ts';
  import type MedirProtoboard from './MedirProtoboard.svelte';

  let {
    pb,
    pantallaCompleta = false,
    cabecera,
  }: {
    pb: Protoboard;
    /** Inside the full-screen view (the wheel pans the bench). */
    pantallaCompleta?: boolean;
    /** Title and buttons above the tools. */
    cabecera?: Snippet;
  } = $props();

  type Pestana = 'esquema' | 'simulacion' | 'avisos' | 'pieza' | 'anadir' | 'medir';
  let pestana = $state<Pestana>('esquema');
  let mesa: Mesa | undefined = $state();
  let rotulos = $state(true);

  // ---------------------------------------------------------------- instruments (0.10)
  // Loaded the first time «Medir» opens; then they stay (leads on the board, instruments reading) while the
  // other tabs are used.
  let medida = $state.raw<MedidaProtoboard | null>(null);
  let Medir = $state.raw<typeof MedirProtoboard | null>(null);
  async function abrirMedir() {
    pestana = 'medir';
    if (medida) return;
    const [m, c] = await Promise.all([import('./medida.svelte.ts'), import('./MedirProtoboard.svelte')]);
    medida ??= new m.MedidaProtoboard(pb);
    Medir = c.default;
  }
  // The «medir» tool goes with the tab.
  $effect(() => {
    const p = pestana;
    untrack(() => {
      if (p === 'medir') pb.herramienta = 'medir';
      else if (pb.herramienta === 'medir') pb.herramienta = 'seleccionar';
    });
  });

  // ---------------------------------------------------------------- simulation

  let resultado = $state.raw<Simulacion | null>(null);
  let versionSimulada = $state(-1);
  let errorSim = $state('');
  /** After the first «Simular», every change re-solves the operating point (LEDs, voltages). */
  let vivo = $state(false);
  const ejecutando = $derived(motor.fase !== 'inactivo');
  const vigente = $derived(!!resultado && versionSimulada === pb.version);
  const encendidos = $derived(brillos(pb.doc, pb.con, pb.op, new Map(pb.nl.instancias.map((i) => [i.comp, i.nombre]))));

  function diodosLed(): string[] {
    const leds = new Set(pb.doc.piezas.filter((p) => p.enc === 'led').map((p) => p.id));
    return pb.nl.instancias.filter((i) => leds.has(i.comp) && /^d/i.test(i.nombre)).map((i) => i.nombre);
  }

  async function puntoTrabajo(): Promise<void> {
    const nl = pb.nl;
    if (nl.errores.length) {
      pb.op = null;
      return;
    }
    const version = pb.version;
    try {
      const r = await simularTexto(netlistPuntoTrabajo(nl.texto, diodosLed()));
      if (version === pb.version) pb.op = r.salida.errores.length ? null : leerPuntoTrabajo(r);
    } catch (e) {
      if (!(e instanceof SimulacionCancelada)) pb.op = null;
    }
  }

  async function simular() {
    errorSim = '';
    const nl = pb.nl;
    if (nl.errores.length) {
      errorSim = 'Corrija lo que se indica antes de simular.';
      pestana = 'avisos';
      return;
    }
    const version = pb.version;
    const texto = nl.texto;
    try {
      await puntoTrabajo();
      const r = await simularTexto(texto);
      resultado = r;
      versionSimulada = version;
      vivo = true;
      (globalThis as unknown as { __epaProtoboardSim?: Simulacion }).__epaProtoboardSim = r;
      if (!r.salida.errores.length && !r.ejecucion.fallo && !app.movil) pestana = 'simulacion';
    } catch (e) {
      if (e instanceof SimulacionCancelada) return;
      errorSim = e instanceof Error ? e.message : String(e);
    }
  }

  // Live operating point after the first simulation (debounced, only when the engine is idle).
  let espera: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    void pb.version;
    // (with the instruments on, they simulate the board: the engine is theirs)
    if (!vivo || medida) return;
    untrack(() => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => {
        espera = null;
        if (motor.fase === 'inactivo') void puntoTrabajo();
      }, 650);
    });
  });
  onDestroy(() => {
    if (espera) clearTimeout(espera);
    if (motor.fase !== 'inactivo') detener();
  });
  onMount(precalentarMotor);

  // The schematic follows the board: its netlist, with the results only while they are current.
  const textoEsquema = $derived(pb.nl.texto);

  // A part chosen on the live schematic selects it on the board.
  onMount(() => {
    const oir = (ev: Event) => {
      const n = (ev as CustomEvent<{ nombre?: string }>).detail?.nombre?.toLowerCase();
      if (!n) return;
      const i = pb.nl.instancias.find((x) => x.nombre === n || x.nombre.replace(/[ab]$/, '') === n);
      if (i) pb.sel = [i.comp];
    };
    window.addEventListener('epa:elegir-componente', oir);
    return () => window.removeEventListener('epa:elegir-componente', oir);
  });

  // ---------------------------------------------------------------- palette and selection

  // The editor's palette sets the kind to place: the board adds it at once near the centre of the view.
  $effect(() => {
    const t = pb.colocando;
    if (!t) return;
    untrack(() => {
      pb.colocando = null;
      pb.herramienta = 'seleccionar';
      if (pb.anadir(t) && app.movil) pestana = 'pieza';
    });
  });

  const piezaSel = $derived(pb.piezaSel);
  const cableSel = $derived(pb.sel.length === 1 ? pb.cable(pb.sel[0]!) : undefined);
  const encSel = $derived(piezaSel ? encapsuladoDe(piezaSel.comp) : null);
  const puertasSel = $derived(piezaSel?.chip ? pb.puertasDe(piezaSel) : []);
  /** Pinout of the selected chip: rows of [left leg, right leg] as the chip is seen from above, notch up. */
  const patillaje = $derived.by(() => {
    if (!piezaSel?.chip) return null;
    const r = rotulosChip(piezaSel, pb.puertasDe(piezaSel));
    const n = r.length;
    return Array.from({ length: n / 2 }, (_, i) => ({ izq: { n: i + 1, t: r[i]! }, der: { n: n - i, t: r[n - 1 - i]! } }));
  });

  const avisos = $derived([
    ...pb.nl.errores.map((e) => ({ nivel: 'error' as const, texto: e.texto, piezas: e.id ? [e.id] : [] })),
    ...pb.obs,
    ...pb.nl.avisos.map((e) => ({ nivel: 'info' as const, texto: e.texto, piezas: e.id ? [e.id] : [] })),
  ]);
  const nAvisos = $derived(avisos.filter((a) => a.nivel === 'error' || a.nivel === 'aviso').length);
  const correcto = $derived(avisos.some((a) => a.nivel === 'bien'));

  function teclas(ev: KeyboardEvent) {
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key.toLowerCase();
    if (mod && k === 'z' && !ev.shiftKey) pb.deshacer();
    else if (mod && (k === 'y' || (k === 'z' && ev.shiftKey))) pb.rehacer();
    else if (!mod && (ev.key === 'Delete' || ev.key === 'Backspace') && pb.sel.length) pb.borrar();
    else if (!mod && k === 'r' && pb.sel.length) pb.transformar(pb.sel, 'girar');
    else if (!mod && (k === 'f' || k === 'x') && pb.sel.length) pb.transformar(pb.sel, 'reflejar');
    else if (!mod && k === 'w') pb.herramienta = pb.herramienta === 'cable' ? 'seleccionar' : 'cable';
    else if (!mod && (k === '+' || k === '=')) mesa?.zoom(1.25);
    else if (!mod && k === '-') mesa?.zoom(0.8);
    else if (!mod && k === '0') mesa?.ajustar();
    else if (ev.key === 'Escape') {
      if (mesa?.anularPendiente()) return;
      if (pb.herramienta !== 'seleccionar') pb.herramienta = 'seleccionar';
      else pb.sel = [];
      return;
    } else return;
    ev.preventDefault();
  }

  const COLORES: [string, string][] = Object.entries(CABLE) as [string, string][];
</script>

<svelte:window onkeydown={teclas} />

<div class="protoboard" class:completa={pantallaCompleta} class:ancha={!app.movil}>
  {#if cabecera}<div class="cab">{@render cabecera()}</div>{/if}

  <div class="herramientas" role="toolbar" aria-label="Herramientas de la protoboard">
    <button type="button" class="hb" aria-pressed={pb.herramienta === 'seleccionar'} title="Elegir y mover (Esc)" aria-label="Elegir y mover" onclick={() => (pb.herramienta = 'seleccionar')}><MousePointer size={19} /></button>
    <button type="button" class="hb" aria-pressed={pb.herramienta === 'cable'} title="Cable (W): de agujero a agujero" aria-label="Cable" onclick={() => (pb.herramienta = pb.herramienta === 'cable' ? 'seleccionar' : 'cable')}><Cable size={19} /></button>
    <span class="sep"></span>
    <button type="button" class="hb" title="Girar 90° (R)" aria-label="Girar" disabled={!pb.sel.length} onclick={() => pb.transformar(pb.sel, 'girar')}><RotateCw size={19} /></button>
    <button type="button" class="hb" title="Dar la vuelta (F): invierte las patas" aria-label="Dar la vuelta" disabled={!pb.sel.length} onclick={() => pb.transformar(pb.sel, 'reflejar')}><FlipHorizontal size={19} /></button>
    {#if piezaSel?.comp.tipo === 'SW'}
      <button type="button" class="hb" title="Conmutar el interruptor" aria-label="Conmutar" onclick={() => pb.conmutar(piezaSel.id)}><ToggleRight size={19} /></button>
    {/if}
    <button type="button" class="hb" title="Quitar (Supr)" aria-label="Quitar" disabled={!pb.sel.length} onclick={() => pb.borrar()}><Trash size={19} /></button>
    <button type="button" class="hb" aria-pressed={pestana === 'medir'} title="Medir: multímetro, osciloscopio, generador y auricular" aria-label="Medir" onclick={() => (pestana === 'medir' ? (pestana = 'esquema') : void abrirMedir())}><Gauge size={19} /></button>
    <span class="sep"></span>
    <button type="button" class="hb" title="Deshacer (Ctrl Z)" aria-label="Deshacer" disabled={!pb.puedeDeshacer} onclick={() => pb.deshacer()}><Undo size={19} /></button>
    <button type="button" class="hb" title="Rehacer (Ctrl Y)" aria-label="Rehacer" disabled={!pb.puedeRehacer} onclick={() => pb.rehacer()}><Redo size={19} /></button>
    <span class="sep"></span>
    {#if !app.movil}
      <button type="button" class="hb" title="Alejar (−)" aria-label="Alejar" onclick={() => mesa?.zoom(0.8)}><ZoomOut size={19} /></button>
      <button type="button" class="hb" title="Acercar (+)" aria-label="Acercar" onclick={() => mesa?.zoom(1.25)}><ZoomIn size={19} /></button>
    {/if}
    <button type="button" class="hb" title="Ver todo (0)" aria-label="Ver todo" onclick={() => mesa?.ajustar()}><Maximize size={19} /></button>
    <button type="button" class="hb" aria-pressed={rotulos} title="Nombres de las piezas" aria-label="Nombres de las piezas" onclick={() => (rotulos = !rotulos)}><Tag size={19} /></button>
    {#if pb.modificado && pb.doc.origen?.tipo !== 'propio'}
      <button type="button" class="hb" title="Volver al montaje automático" aria-label="Volver al montaje automático" onclick={() => pb.restaurar()}><RefreshCw size={19} /></button>
    {/if}
    <span class="hueco"></span>
    {#if ejecutando && motor.fase === 'simulando'}
      <button type="button" class="boton" onclick={detener}>Detener</button>
    {:else}
      <button type="button" class="boton primario simular" onclick={simular} disabled={motor.fase === 'descargando'}><Play size={16} /> Simular</button>
    {/if}
  </div>

  <div class="cuerpo">
    <div class="banco">
      <Mesa bind:this={mesa} {pb} {rotulos} {encendidos} {medida} ruedaDesplaza={pantallaCompleta} alTocar={() => (pestana = 'pieza')} />
    </div>

    <section class="panel" aria-label="Panel de la protoboard">
      <div class="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'esquema'} onclick={() => (pestana = 'esquema')}>Esquema</button>
        <button type="button" role="tab" aria-selected={pestana === 'simulacion'} onclick={() => (pestana = 'simulacion')}>Simulación</button>
        <button type="button" role="tab" aria-selected={pestana === 'avisos'} onclick={() => (pestana = 'avisos')}>
          Avisos{#if nAvisos}<span class="n" class:mal={avisos.some((a) => a.nivel === 'error')}>{nAvisos}</span>{:else if correcto}<span class="ok" aria-label="correcto">✓</span>{/if}
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'pieza'} onclick={() => (pestana = 'pieza')}>Pieza</button>
        <button type="button" role="tab" aria-selected={pestana === 'anadir'} onclick={() => (pestana = 'anadir')}>Añadir</button>
        <button type="button" role="tab" aria-selected={pestana === 'medir'} onclick={() => void abrirMedir()}>Medir</button>
      </div>

      <div class="contenido">
        {#if medida && Medir}
          <div class="panel-medir" hidden={pestana !== 'medir'}><Medir {pb} {medida} /></div>
        {/if}
        {#if pestana === 'medir'}
          {#if !medida || !Medir}<p class="nota">Cargando los instrumentos…</p>{/if}
        {:else if pestana === 'esquema'}
          <p class="nota">El esquema sale de lo que hay montado: cambia con cada pieza y cada cable.{#if vivo && !vigente} Pulse «Simular» para ver de nuevo sus tensiones y corrientes.{/if}</p>
          <div class="esquema-vivo">
            <CircuitoVivo texto={textoEsquema} refs={pb.doc.refs ?? []} resultado={vigente ? resultado : null} />
          </div>
        {:else if pestana === 'simulacion'}
          <div class="mando">
            {#if ejecutando && motor.fase === 'simulando'}
              <button class="boton" onclick={detener}>Detener</button>
            {:else}
              <button class="boton primario" onclick={simular} disabled={motor.fase === 'descargando'}>Simular</button>
            {/if}
            <span class="estado" aria-live="polite">
              {#if motor.fase === 'descargando'}Descargando el simulador…{:else if motor.fase === 'preparando'}Preparando ngspice…{:else if motor.fase === 'simulando'}Simulando…{:else if resultado}Simulado en {formatoSI(resultado.ejecucion.ms / 1000, 's', 2)}{/if}
            </span>
          </div>
          {#if resultado && !vigente}<p class="nota aviso">El montaje ha cambiado desde la última simulación: pulse «Simular» para verlo al día.</p>{/if}
          {#if vivo}<p class="nota">Con cada cambio se recalcula el punto de trabajo: los LED se encienden y, al tocar un agujero, se ve su tensión.</p>{/if}
          {#if errorSim}<div class="aviso-caja error" role="alert">{errorSim}</div>{/if}
          {#if resultado?.ejecucion.fallo}<div class="aviso-caja error" role="alert">{resultado.ejecucion.fallo}</div>{/if}
          {#if resultado?.salida.errores.length}
            <div class="aviso-caja error" role="alert">
              <strong>ngspice ha dado errores.</strong>
              {#each resultado.salida.explicaciones as x, k (k)}<p>{x}</p>{/each}
              <ul>{#each resultado.salida.errores.slice(0, 4) as x, k (k)}<li><code>{x}</code></li>{/each}</ul>
            </div>
          {/if}
          {#if resultado}
            <div class="resultados" class:viejo={!vigente}><Resultados {resultado} /></div>
          {:else}
            <p class="nota">Simula el circuito tal como está montado, con los análisis del original. Los errores de montaje también se simulan: así se ve qué pasa.</p>
          {/if}
        {:else if pestana === 'avisos'}
          {#if !avisos.length}<p class="nota">Nada que señalar.</p>{/if}
          <ul class="avisos">
            {#each avisos as a, i (i)}
              <li class={a.nivel}>
                <button type="button" class="enlace" disabled={!a.piezas.length} onclick={() => (pb.sel = a.piezas.filter((x) => pb.existe(x)))}>{a.texto}</button>
              </li>
            {/each}
          </ul>
          <details class="netlist">
            <summary>Netlist del montaje</summary>
            <pre>{pb.nl.texto}</pre>
          </details>
        {:else if pestana === 'pieza'}
          {#if piezaSel && encSel}
            {#if piezaSel.chip && patillaje}
              <p class="paquete">{piezaSel.comp.nombre}: {encSel.descripcion}.</p>
              <div class="dip" role="table" aria-label={`Patillaje del ${piezaSel.comp.campos['modelo']}`}>
                {#each patillaje as f, i (i)}
                  <div class="fila-dip" role="row">
                    <span class="t izq" role="cell">{f.izq.t}</span><span class="n" role="cell">{f.izq.n}</span>
                    {#if i === 0}<span class="cuerpo-dip" role="cell" style:grid-row={`span ${patillaje.length}`}><span>{piezaSel.comp.campos['modelo']}</span></span>{/if}
                    <span class="n" role="cell">{f.der.n}</span><span class="t" role="cell">{f.der.t}</span>
                  </div>
                {/each}
              </div>
              <p class="nota">Las entradas que el circuito no usa van a un carril con un cable: una entrada CMOS no puede quedar al aire.</p>
              {#if Object.values(piezaSel.chip.ataduras).some((t) => typeof t === 'object' && 'interna' in t)}
                <p class="nota">Cada biestable T se monta con un biestable D del 74HC74 y una XOR del 74HC86: la XOR recibe T y Q y su salida va a D (D = T ⊕ Q), así cambia en cada flanco de subida del reloj cuando T = 1. Esos cables son solo de la placa: el simulador usa el biestable T del esquema.</p>
              {/if}
              {#if puertasSel.length > 1}
                <div class="puertas" role="group" aria-label="Puerta del chip">
                  {#each puertasSel as g (g.id)}
                    <button type="button" class="chip-puerta" aria-pressed={pb.unico?.id === g.id} onclick={() => (pb.puerta = g.id)}>{g.nombre}</button>
                  {/each}
                </div>
              {/if}
            {:else}
              <p class="paquete">{encSel.descripcion}{#if piezaSel.pos.length > 1 && !EXTERNOS.has(piezaSel.enc)}. Patas: {encSel.nombres.join(' · ')}{/if}.</p>
            {/if}
            {#if piezaSel.enc === 'electrolitico'}<p class="nota">La franja clara del bote marca la pata negativa (−): «Dar la vuelta» la cambia de lado.</p>{/if}
            {#if piezaSel.enc === 'led'}<p class="nota">La pata larga (doblada en el dibujo) es el ánodo, +; el lado plano del borde, el cátodo.</p>{/if}
            <Propiedades ed={pb.edicion} />
          {:else if cableSel}
            <h3 class="titulo-panel">Cable</h3>
            <div class="colores" role="group" aria-label="Color del cable">
              {#each COLORES as [nombre, c] (nombre)}
                <button type="button" class="color" style:background={c} aria-label={`Color ${nombre}`} aria-pressed={cableSel.color === c} onclick={() => pb.colorCable(cableSel.id, c)}></button>
              {/each}
            </div>
            <p class="nota">Arrastre sus extremos para enchufarlo en otro agujero.</p>
            <button type="button" class="boton" onclick={() => pb.borrar()}>Quitar el cable</button>
          {:else if pb.sel.length > 1}
            <p class="nota">{pb.sel.length} elementos elegidos.</p>
          {:else}
            <p class="nota">Toque una pieza o un cable para ver sus datos. Al tocar un agujero se marca su tira y todo lo que está unido a ella.</p>
            <label class="campo-titulo">Título <input type="text" value={pb.doc.titulo} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; pb.cambiar(() => (pb.doc.titulo = v)); }} /></label>
          {/if}
        {:else if pestana === 'anadir'}
          <p class="nota">Toque una pieza para añadirla en un hueco libre a la vista; luego arrástrela a su sitio. Las fuentes y los generadores quedan encima de la placa: lleve sus puntas con la herramienta Cable.</p>
          <Paleta ed={pb.edicion} horizontal={false} arrastre={() => false} />
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .protoboard {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--fondo);
    font-family: var(--sans);
  }
  .cab {
    flex: none;
  }
  .herramientas {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--linea-suave);
    background: var(--superficie);
  }
  .hb {
    display: inline-grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--tinta-suave);
  }
  .hb:hover:not(:disabled) {
    background: var(--hover);
    color: var(--tinta);
  }
  .hb[aria-pressed='true'] {
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .hb:disabled {
    opacity: 0.35;
  }
  .sep {
    width: 1px;
    height: 24px;
    margin: 0 4px;
    background: var(--linea);
  }
  .hueco {
    flex: 1;
  }
  .simular {
    gap: 6px;
  }
  .cuerpo {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .banco {
    flex: 1 1 55%;
    min-height: 240px;
    position: relative;
  }
  .panel {
    flex: 1 1 45%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--linea);
    background: var(--superficie);
  }
  .ancha .cuerpo {
    flex-direction: row;
  }
  .ancha .banco {
    flex: 1 1 auto;
  }
  .ancha .panel {
    flex: 0 0 min(420px, 38%);
    border-top: 0;
    border-left: 1px solid var(--linea);
  }
  .pestanas {
    flex: none;
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--linea-suave);
  }
  .pestanas button {
    flex: 1 0 auto;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-bottom: 2.5px solid transparent;
    background: transparent;
    color: var(--tinta-suave);
    font: 600 14px var(--sans);
  }
  .pestanas button[aria-selected='true'] {
    color: var(--acento);
    border-bottom-color: var(--acento);
  }
  .n {
    display: inline-block;
    min-width: 1.5em;
    margin-left: 5px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--ambar-tinte);
    color: var(--ambar);
    font-size: 12px;
  }
  .n.mal {
    background: color-mix(in srgb, var(--c-precaucion) 15%, transparent);
    color: var(--c-precaucion);
  }
  .ok {
    margin-left: 5px;
    color: var(--c-ejemplo);
  }
  .contenido {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 10px 12px 16px;
    overscroll-behavior: contain;
  }
  .nota {
    margin: 0 0 8px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.4;
  }
  .nota.aviso {
    color: var(--ambar);
    font-weight: 600;
  }
  /* A small circuit is not drawn huge: the drawing keeps a reasonable width. */
  .esquema-vivo {
    min-width: 0;
    max-width: 560px;
    margin: 0 auto;
  }
  .mando {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .estado {
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .aviso-caja {
    margin: 8px 0;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 13.5px;
  }
  .aviso-caja.error {
    border: 1px solid color-mix(in srgb, var(--c-precaucion) 45%, transparent);
    background: color-mix(in srgb, var(--c-precaucion) 8%, var(--superficie));
  }
  .resultados.viejo {
    opacity: 0.6;
  }
  .avisos {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }
  .avisos li {
    margin: 0 0 6px;
    padding: 8px 10px 8px 12px;
    border-left: 4px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    font-size: 14px;
    line-height: 1.4;
  }
  .avisos li.error {
    border-left-color: var(--c-precaucion);
  }
  .avisos li.aviso {
    border-left-color: var(--ambar-relleno);
  }
  .avisos li.info {
    border-left-color: var(--acento-borde);
  }
  .avisos li.bien {
    border-left-color: var(--c-ejemplo);
    color: var(--c-ejemplo);
    font-weight: 600;
  }
  .enlace {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .enlace:not(:disabled) {
    cursor: pointer;
  }
  .enlace:not(:disabled):hover {
    text-decoration: underline;
  }
  .netlist pre {
    max-height: 40vh;
    overflow: auto;
    padding: 8px;
    border-radius: 8px;
    background: var(--codigo-fondo);
    font: 12.5px/1.45 var(--mono);
    white-space: pre;
  }
  .netlist summary {
    color: var(--tinta-suave);
    font-size: 13.5px;
    cursor: pointer;
  }
  .paquete {
    margin: 0 0 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--tinta);
  }
  .dip {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 2.4em 3.2em 2.4em minmax(0, 1fr);
    column-gap: 4px;
    margin: 4px 0 8px;
    font-size: 13px;
    line-height: 1.6;
  }
  .fila-dip {
    display: contents;
  }
  .dip .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--tinta);
  }
  .dip .t.izq {
    text-align: right;
  }
  .dip .n {
    margin: 2px 0;
    white-space: nowrap;
    text-align: center;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.5;
    color: var(--tinta-suave);
    border: 1px solid var(--linea);
    border-radius: 3px;
    background: var(--superficie-2);
  }
  .cuerpo-dip {
    grid-column: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    margin: 2px 0;
    background: #1f2023;
    border: 1px solid var(--linea);
    color: #e2e2e2;
    position: relative;
  }
  .cuerpo-dip::before {
    content: '';
    position: absolute;
    top: -7px;
    left: calc(50% - 7px);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--superficie);
  }
  .cuerpo-dip span {
    writing-mode: vertical-rl;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .puertas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .chip-puerta {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 18px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
  }
  .chip-puerta[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .titulo-panel {
    margin: 4px 0 8px;
    font-size: 16px;
  }
  .colores {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .color {
    width: 36px;
    height: 36px;
    border: 2px solid var(--linea);
    border-radius: 50%;
  }
  .color[aria-pressed='true'] {
    border-color: var(--acento);
    box-shadow: 0 0 0 2px var(--acento-tinte);
  }
  .campo-titulo {
    display: grid;
    gap: 4px;
    font-size: 13.5px;
    color: var(--tinta-suave);
  }
  .campo-titulo input {
    min-height: 40px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
  }
  .contenido :global(.paleta) {
    max-height: none;
  }
</style>
