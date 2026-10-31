<script lang="ts">
  // The breadboard workbench, shared by «Ver en protoboard» (full-screen sandbox over a schematic) and the
  // «Protoboard» tab (own circuits). 0.11 layout: one action bar with labelled buttons always in the same
  // place (Deshacer, Rehacer, «Monta este circuito», Simular/Detener); the bench as big as possible, with zoom
  // buttons and the floating bar of the selection (BarraPieza.svelte); the parts tray (Bandeja.svelte) always
  // in view — under the bench on touch screens, beside it on wide ones —; and the secondary panels behind
  // tabs: the live schematic (figuras-vivas' CircuitoVivo on the board's netlist), the results (simulador's
  // worker and Resultados), the checks, the selected part (the schematic editor's properties panel) and the
  // instruments. «Monta este circuito» (Guia.svelte) and the first-use tour (Recorrido.svelte) sit on top.
  import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { motor, detener, precalentarMotor, simularTexto, SimulacionCancelada } from '../../simulador/cliente.svelte';
  import type { Simulacion } from '../../simulador/motor/simular.ts';
  import CircuitoVivo from '../figuras-vivas/circuito/CircuitoVivo.svelte';
  import Resultados from '../simulador/Resultados.svelte';
  import Propiedades from '../editor/Propiedades.svelte';
  import Paleta from '../editor/Paleta.svelte';
  import Bandeja from './Bandeja.svelte';
  import BarraPieza from './BarraPieza.svelte';
  import Guia from './Guia.svelte';
  import Recorrido from './Recorrido.svelte';
  import Leccion from './Leccion.svelte';
  import { terminarLeccion } from './leccion.svelte.ts';
  import type { Componente } from '../editor/tipos.ts';
  import type { DocumentoProtoboard, Pieza } from './tipos.ts';
  import type { Pt } from './placa.ts';
  import { formatoSI } from '../grafica/formato.ts';
  import Mesa from './Mesa.svelte';
  import type { Protoboard } from './estado.svelte';
  import { brillos } from './comprobaciones.ts';
  import { encapsuladoDe, EXTERNOS } from './encapsulados.ts';
  import { rotulosChip } from './logica.ts';
  import { CABLE } from './colores.ts';
  import { leerPuntoTrabajo, netlistPuntoTrabajo } from './simulacion.ts';
  import Undo from '@lucide/svelte/icons/undo-2';
  import Redo from '@lucide/svelte/icons/redo-2';
  import Tag from '@lucide/svelte/icons/tag';
  import Play from '@lucide/svelte/icons/play';
  import Square from '@lucide/svelte/icons/square';
  import RefreshCw from '@lucide/svelte/icons/refresh-ccw';
  import Gauge from '@lucide/svelte/icons/gauge';
  import Graduation from '@lucide/svelte/icons/graduation-cap';
  import X from '@lucide/svelte/icons/x';
  import Blocks from '@lucide/svelte/icons/blocks';
  import IconoEsquema from '@lucide/svelte/icons/workflow';
  import IconoSimulacion from '@lucide/svelte/icons/activity';
  import IconoAvisos from '@lucide/svelte/icons/triangle-alert';
  import IconoPieza from '@lucide/svelte/icons/cpu';
  import type { MedidaProtoboard } from './medida.svelte.ts';
  import type MedirProtoboard from './MedirProtoboard.svelte';
  import { emitir } from '../../lib/aprendizaje/eventos';

  let {
    pb,
    pantallaCompleta = false,
    cabecera,
    recorrido = false,
    alGuardar,
    alQuedarse,
  }: {
    pb: Protoboard;
    /** Inside the full-screen view (the wheel pans the bench). */
    pantallaCompleta?: boolean;
    /** Title and buttons above the tools. */
    cabecera?: Snippet;
    /** The first-use tour (own circuits). */
    recorrido?: boolean;
    /** «Guardar en Mis montajes» at the end of a guided circuit (the «Protoboard» page). */
    alGuardar?: () => void;
    /** A guided circuit ends keeping its board (Guia.svelte): the page keeps the montage it replaced as it was. */
    alQuedarse?: (anterior: DocumentoProtoboard, guardar: boolean) => void;
  } = $props();

  // «piezas»: on touch screens, the tray alone (the default); on wide ones the tray is a column of its own.
  type Pestana = 'piezas' | 'esquema' | 'simulacion' | 'avisos' | 'pieza' | 'medir';
  let pestana = $state<Pestana>(untrack(() => (app.movil ? 'piezas' : 'esquema')));
  let mesa: Mesa | undefined = $state();
  let rotulos = $state(true);
  /** The whole palette («Más piezas»). */
  let paleta = $state(false);
  /** The chooser of «Monta este circuito». */
  let eligiendo = $state(false);
  // A wide screen has no «piezas» tab (the tray is beside the bench).
  $effect(() => {
    if (!app.movil && pestana === 'piezas') pestana = 'esquema';
  });

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
      if (p === 'medir') {
        pb.herramienta = 'medir';
        pb.armada = null;
      } else if (pb.herramienta === 'medir') pb.herramienta = 'seleccionar';
    });
  });

  // ---------------------------------------------------------------- simulation

  let resultado = $state.raw<Simulacion | null>(null);
  let versionSimulada = $state(-1);
  let errorSim = $state('');
  /** After the first «Simular», every change re-solves the operating point (LEDs, voltages). */
  let vivo = $state(false);
  /**
   * The engine is shared (0.11 QA): the page under «Ver en protoboard», the live schematic and the instruments
   * run on it too. The bar shows «Detener» and «Simulando…» only for this board's own «Simular», and «Detener»
   * cancels only that run (the one in flight is ours while `propias` > 0: a run started later by someone else
   * rejects ours first). `todas` also counts the live operating point, so closing the board stops only its own.
   */
  let propias = $state(0);
  let todas = 0;
  /** The phase as this board shows it. */
  const fase = $derived(propias > 0 ? motor.fase : motor.fase === 'descargando' ? 'descargando' : 'inactivo');
  /** «Simulando…» and «Detener» appear after 400 ms, so a quick run does not flash them. */
  let largo = $state(false);
  $effect(() => {
    if (fase !== 'simulando' && fase !== 'preparando') {
      largo = false;
      return;
    }
    const k = setTimeout(() => (largo = true), 400);
    return () => clearTimeout(k);
  });
  const ejecutando = $derived(fase === 'simulando' && largo);
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
    todas++;
    try {
      const r = await simularTexto(netlistPuntoTrabajo(nl.texto, diodosLed()));
      if (version === pb.version) pb.op = r.salida.errores.length ? null : leerPuntoTrabajo(r);
    } catch (e) {
      if (!(e instanceof SimulacionCancelada)) pb.op = null;
    } finally {
      todas--;
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
    propias++;
    todas++;
    try {
      await puntoTrabajo();
      const r = await simularTexto(texto);
      resultado = r;
      if (!r.ejecucion.fallo) emitir({ tipo: 'simulacion', origen: 'protoboard' });
      versionSimulada = version;
      vivo = true;
      (globalThis as unknown as { __epaProtoboardSim?: Simulacion }).__epaProtoboardSim = r;
      if (!r.salida.errores.length && !r.ejecucion.fallo && !app.movil && !pb.guia) pestana = 'simulacion';
    } catch (e) {
      if (e instanceof SimulacionCancelada) return;
      errorSim = e instanceof Error ? e.message : String(e);
    } finally {
      propias--;
      todas--;
    }
  }

  /** «Detener»: only this board's own run. */
  function detenerPropia() {
    if (propias > 0) detener();
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
    if (todas > 0 && motor.fase !== 'inactivo') detener();
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
      if (pb.anadir(t)) paleta = false;
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
      if (paleta || eligiendo) {
        paleta = eligiendo = false;
        return;
      }
      if (pb.armada) {
        pb.armada = null;
        return;
      }
      if (mesa?.anularPendiente()) return;
      if (pb.herramienta !== 'seleccionar') pb.herramienta = 'seleccionar';
      else pb.sel = [];
      return;
    } else return;
    ev.preventDefault();
  }

  const COLORES: [string, string][] = Object.entries(CABLE) as [string, string][];

  // ---------------------------------------------------------------- tray and guide (0.11)

  function arrastre(fase: 'mover' | 'soltar' | 'cancelar', cx: number, cy: number, x: Componente | Pieza, dedo: boolean): boolean {
    if (!mesa) return false;
    if (fase === 'mover') return mesa.fantasma(cx, cy, x, dedo);
    if (fase === 'soltar') return mesa.soltarFantasma(cx, cy, x, dedo);
    mesa.quitarFantasma();
    return false;
  }

  /** What the bench lights for the guide's step: the holes, the part's silhouette, the wire. */
  const pistaGuia = $derived.by(() => {
    const l = pb.leccion;
    if (l) return { puntos: l.marcas, luces: l.luces, pieza: l.silueta };
    const p = pb.guia?.paso;
    if (!p || p.tipo === 'simular') return null;
    if (p.tipo === 'cable') return { puntos: [p.a, p.b] as Pt[], cable: [p.a, p.b] as [Pt, Pt] };
    const puesta = pb.doc.piezas.some((x) => x.comp.nombre.toUpperCase() === p.pieza.comp.nombre.toUpperCase());
    return { puntos: p.pieza.pos.filter((_, i) => !!p.pieza.patas[i]), pieza: puesta ? null : p.pieza };
  });

  // The guide's last step: the simulation proves it (the LED lit, the output's voltage, or no errors).
  $effect(() => {
    const g = pb.guia;
    if (!g || !g.montado || !vivo) return;
    const prueba = g.plan.prueba;
    const op = pb.op;
    let ok = false;
    if (prueba.led) {
      const led = pb.doc.piezas.find((p) => p.comp.nombre === prueba.led);
      ok = !!led && (encendidos[led.id] ?? 0) > 0.08;
    } else if (prueba.red) ok = !!op && op.v[prueba.red] != null;
    else ok = !!resultado && vigente && !resultado.salida.errores.length;
    untrack(() => {
      if (ok !== g.probado) g.probado = ok;
    });
  });

  const respuestaGuia = $derived(!!pb.leccion || (!!pb.guia && (!!pb.guia.estado.error || (!!pb.guia.ultimo && pb.version === pb.guia.versionUltimo))));

  // Phones: opening a panel shrinks the bench, so the whole width of the board is shown then.
  let antes: Pestana = untrack(() => pestana);
  $effect(() => {
    const p = pestana;
    untrack(() => {
      // (after the bench has its new size: a frame is not enough for its size to be measured)
      if (app.movil && antes === 'piezas' && p !== 'piezas') setTimeout(() => mesa?.ajustarAncho(), 120);
      antes = p;
    });
  });

  // Each step of the guide comes into view (phones show only part of the board).
  $effect(() => {
    const p = pistaGuia;
    if (!p) return;
    untrack(() => mesa?.mostrar(p.puntos));
  });

  const nombrePestana: Record<Pestana, string> = { piezas: 'Piezas', esquema: 'Esquema', simulacion: 'Resultados', avisos: 'Avisos', pieza: 'Pieza', medir: 'Medir' };
  const vacia = $derived(!pb.guia && !pb.leccion && !pb.doc.piezas.some((p) => !EXTERNOS.has(p.enc)) ? (app.movil ? 'Arrastre aquí una pieza desde la bandeja de abajo' : 'Arrastre aquí una pieza desde la bandeja') : '');
</script>

<svelte:window onkeydown={teclas} />

{#snippet contenidoPanel()}
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
      {#if ejecutando}
        <button class="boton" onclick={detenerPropia}>Detener</button>
      {:else}
        <button class="boton primario" onclick={simular} disabled={fase === 'descargando' || propias > 0}>Simular</button>
      {/if}
      <span class="estado" aria-live="polite">
        {#if fase === 'descargando'}Descargando el simulador…{:else if fase === 'preparando' && largo}Preparando ngspice…{:else if ejecutando}Simulando…{:else if resultado}Simulado en {formatoSI(resultado.ejecucion.ms / 1000, 's', 2)}{/if}
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
      {#if piezaSel.enc === 'electrolitico'}<p class="nota">La franja clara del bote marca la pata negativa (−): «Voltear» la cambia de lado.</p>{/if}
      {#if piezaSel.enc === 'led'}<p class="nota">La pata larga (doblada en el dibujo) es el ánodo, +; el lado plano del borde, el cátodo.</p>{/if}
      <Propiedades ed={pb.edicion} />
    {:else if cableSel}
      <h3 class="titulo-panel">Cable</h3>
      <div class="colores" role="group" aria-label="Color del cable">
        {#each COLORES as [nombre, c] (nombre)}
          <button type="button" class="color" style:background={c} aria-label={`Color ${nombre}`} aria-pressed={cableSel.color === c} onclick={() => pb.colorCable(cableSel.id, c)}></button>
        {/each}
      </div>
      <p class="nota">Arrastre sus extremos para enchufarlo en otro agujero; una pulsación larga lo quita.</p>
      <button type="button" class="boton" onclick={() => pb.borrar()}>Quitar el cable</button>
    {:else if pb.sel.length > 1}
      <p class="nota">{pb.sel.length} elementos elegidos.</p>
    {:else}
      <p class="nota">Toque una pieza o un cable para ver sus datos. Al tocar un agujero se marca su tira y todo lo que está unido a ella.</p>
      <label class="campo-titulo">Título <input type="text" value={pb.doc.titulo} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; pb.cambiar(() => (pb.doc.titulo = v)); }} /></label>
    {/if}
  {/if}
{/snippet}

{#snippet pestanas(lista: Pestana[])}
  <div class="pestanas" role="tablist" aria-label="Paneles de la protoboard">
    {#each lista as k (k)}
      <button type="button" role="tab" data-pestana={k} aria-selected={pestana === k} onclick={() => (k === 'medir' ? (pestana === 'medir' && app.movil ? (pestana = 'piezas') : void abrirMedir()) : (pestana = pestana === k && app.movil ? 'piezas' : k))}>
        {#if k === 'piezas'}<Blocks size={17} aria-hidden="true" />
        {:else if k === 'esquema'}<IconoEsquema size={17} aria-hidden="true" />
        {:else if k === 'simulacion'}<IconoSimulacion size={17} aria-hidden="true" />
        {:else if k === 'avisos'}<span class="ico"><IconoAvisos size={17} aria-hidden="true" />{#if nAvisos}<span class="n" class:mal={avisos.some((a) => a.nivel === 'error')}>{nAvisos}</span>{:else if correcto}<span class="ok" aria-label="correcto">✓</span>{/if}</span>
        {:else if k === 'pieza'}<IconoPieza size={17} aria-hidden="true" />
        {:else}<Gauge size={17} aria-hidden="true" />{/if}
        <span class="et">{nombrePestana[k]}</span>
      </button>
    {/each}
  </div>
{/snippet}

<div class="protoboard" class:completa={pantallaCompleta} class:ancha={!app.movil}>
  {#if cabecera}<div class="cab">{@render cabecera()}</div>{/if}

  <!-- The main actions, always in the same place, with their names. -->
  <div class="herramientas acciones" role="toolbar" aria-label="Acciones de la protoboard">
    <button type="button" class="accion" title="Deshacer (Ctrl Z)" disabled={!pb.puedeDeshacer} onclick={() => pb.deshacer()}><Undo size={19} aria-hidden="true" /><span>Deshacer</span></button>
    <button type="button" class="accion" title="Rehacer (Ctrl Y)" disabled={!pb.puedeRehacer} onclick={() => pb.rehacer()}><Redo size={19} aria-hidden="true" /><span>Rehacer</span></button>
    {#if pb.modificado && pb.doc.origen?.tipo !== 'propio' && !pb.guia}
      <button type="button" class="accion" title="Volver al montaje automático" onclick={() => pb.restaurar()}><RefreshCw size={19} aria-hidden="true" /><span>Original</span></button>
    {/if}
    <button type="button" class="accion" aria-pressed={rotulos} title="Nombres de las piezas" onclick={() => (rotulos = !rotulos)}><Tag size={19} aria-hidden="true" /><span>Nombres</span></button>
    <span class="hueco"></span>
    <button type="button" class="accion guiar" aria-pressed={!!pb.guia} onclick={() => (eligiendo = true)}><Graduation size={19} aria-hidden="true" /><span class="largo">Monta este circuito</span><span class="corto">Guía</span></button>
    {#if ejecutando}
      <button type="button" class="boton simular detener" onclick={detenerPropia}><Square size={15} aria-hidden="true" /> Detener</button>
    {:else}
      <button type="button" class="boton primario simular" onclick={simular} disabled={fase === 'descargando' || propias > 0}><Play size={16} aria-hidden="true" /> Simular</button>
    {/if}
  </div>

  <Guia {pb} bind:eligiendo {alGuardar} {alQuedarse} alSimular={simular} />
  <Leccion {pb} alTerminar={(seguir) => terminarLeccion(pb, seguir)} />

  <div class="cuerpo">
    {#if !app.movil && !pb.leccion}
      <aside class="lado"><Bandeja {pb} lateral alArrastrar={arrastre} alMas={() => (paleta = true)} /></aside>
    {/if}
    <div class="banco">
      <Mesa bind:this={mesa} {pb} {rotulos} {encendidos} {medida} ruedaDesplaza={pantallaCompleta} alTocar={() => (pestana = 'pieza')} guia={pistaGuia} controles {vacia} sinInfo={respuestaGuia}>
        {#snippet flotante(caja)}
          <BarraPieza {pb} {caja} alMas={() => (pestana = 'pieza')} />
        {/snippet}
      </Mesa>
      {#if pb.nota}
        <div class="nota-flotante" role="status">
          <span>{pb.nota.texto}</span>
          {#if pb.nota.deshacer}<button type="button" class="enlace-boton" onclick={() => { pb.deshacer(); pb.nota = null; }}>Deshacer</button>{/if}
          <button type="button" class="cerrar-nota" aria-label="Cerrar" onclick={() => (pb.nota = null)}><X size={16} /></button>
        </div>
      {/if}
      <Guia {pb} parte="respuesta" />
      <Leccion {pb} parte="respuesta" alTerminar={() => {}} />
      {#if recorrido}<Recorrido {pb} />{/if}
    </div>

    {#if !app.movil}
      <section class="panel" aria-label="Panel de la protoboard">
        {@render pestanas(['esquema', 'simulacion', 'avisos', 'pieza', 'medir'])}
        <div class="contenido">{@render contenidoPanel()}</div>
      </section>
    {/if}
  </div>

  {#if app.movil}
    <!-- Touch screens: the tray always under the bench; a panel opens above it (the tray folds away on short screens). -->
    <section class="dock" class:con-panel={pestana !== 'piezas'} class:medir={pestana === 'medir'} aria-label="Panel de la protoboard">
      {@render pestanas(['piezas', 'esquema', 'simulacion', 'avisos', 'pieza', 'medir'])}
      {#if pestana !== 'piezas' || (medida && Medir)}
        <div class="contenido hoja" hidden={pestana === 'piezas'}>{@render contenidoPanel()}</div>
      {/if}
      <div class="caja-bandeja" hidden={!!pb.leccion}><Bandeja {pb} alArrastrar={arrastre} alMas={() => (paleta = true)} /></div>
    </section>
  {/if}

  {#if paleta}
    <div class="velo" role="presentation" onclick={() => (paleta = false)}></div>
    <div class="hoja-paleta" role="dialog" aria-modal="true" aria-labelledby="paleta-titulo">
      <header>
        <h2 id="paleta-titulo">Todas las piezas</h2>
        <button type="button" class="cerrar-nota" aria-label="Cerrar" onclick={() => (paleta = false)}><X size={20} /></button>
      </header>
      <p class="nota">Toque una pieza para ponerla en un hueco libre a la vista; luego arrástrela a su sitio. Las fuentes y los generadores van encima de la placa: lleve sus puntas tocando su borne y luego un agujero.</p>
      <div class="contenido-paleta"><Paleta ed={pb.edicion} horizontal={false} arrastre={() => false} /></div>
    </div>
  {/if}
</div>

<style>
  .protoboard {
    position: relative;
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
  /* ---------------------------------------------------------------- the action bar */
  .acciones {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--linea-suave);
    background: var(--superficie);
    container-type: inline-size;
  }
  .accion {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--tinta);
    font: 600 14px var(--sans);
    white-space: nowrap;
  }
  .accion:hover:not(:disabled) {
    background: var(--hover);
  }
  .accion:disabled {
    color: var(--tinta-tenue);
    opacity: 0.55;
  }
  .accion[aria-pressed='true'] {
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .accion.guiar {
    border: 1px solid var(--acento-borde);
    color: var(--acento);
    border-radius: 999px;
    min-height: 44px;
    margin-right: 6px;
  }
  .corto {
    display: none;
  }
  .hueco {
    flex: 1;
  }
  .simular {
    gap: 6px;
    min-height: 44px;
    padding: 0 18px;
    font-size: 15.5px;
  }
  .detener {
    border-color: var(--c-precaucion);
    color: var(--c-precaucion);
  }
  /* Narrow bars (phones): icons over short names, all in one row. */
  @container (max-width: 600px) {
    .accion {
      flex-direction: column;
      gap: 1px;
      min-width: 54px;
      padding: 3px 4px;
      font-size: 11px;
    }
    .accion.guiar {
      border: 0;
      border-radius: 10px;
      margin-right: 2px;
      min-height: 44px;
    }
    .largo {
      display: none;
    }
    .corto {
      display: inline;
    }
    .simular {
      padding: 0 14px;
    }
  }
  @container (max-width: 380px) {
    .accion {
      min-width: 46px;
    }
  }
  /* ---------------------------------------------------------------- bench, tray, panels */
  .cuerpo {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .banco {
    flex: 1 1 auto;
    min-height: 160px;
    position: relative;
  }
  .ancha .cuerpo {
    flex-direction: row;
  }
  .lado {
    flex: 0 0 auto;
    width: 232px;
    min-height: 0;
    border-right: 1px solid var(--linea);
    background: var(--superficie);
  }
  .panel {
    flex: 0 0 min(400px, 34%);
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--linea);
    background: var(--superficie);
  }
  .dock {
    flex: none;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--linea);
    background: var(--superficie);
    box-shadow: 0 -4px 14px rgba(20, 30, 40, 0.06);
  }
  /* A panel open: the dock takes half the workbench (the bench keeps the other half) and the panel fills it. */
  .dock.con-panel {
    flex: 0 0 52%;
    min-height: 0;
  }
  .dock.con-panel .contenido.hoja {
    flex: 1 1 0;
    min-height: 0;
    border-bottom: 1px solid var(--linea-suave);
  }
  .hoja[hidden],
  .panel-medir[hidden] {
    display: none;
  }
  /* The instruments need the room: the tray folds away while «Medir» is open. */
  .dock.medir .caja-bandeja {
    display: none;
  }
  /* On short screens a panel takes the tray's place while open. */
  @media (max-height: 1000px) {
    .dock.con-panel .caja-bandeja {
      display: none;
    }
  }
  .pestanas {
    flex: none;
    display: flex;
    border-bottom: 1px solid var(--linea-suave);
    container-type: inline-size;
  }
  .pestanas button {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 4px;
    border: 0;
    border-bottom: 2.5px solid transparent;
    background: transparent;
    color: var(--tinta-suave);
    font: 600 13.5px var(--sans);
  }
  .pestanas .et {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ico {
    position: relative;
    display: inline-flex;
  }
  .ico .n,
  .ico .ok {
    position: absolute;
    top: -7px;
    left: 11px;
    margin: 0;
  }
  /* Narrow panels (phones): icon over a small label, six tabs in one row without scrolling. */
  @container (max-width: 540px) {
    .pestanas button {
      flex-direction: column;
      gap: 1px;
      min-height: 48px;
      padding: 4px 1px 3px;
      font-size: 11px;
      letter-spacing: -0.01em;
    }
  }
  .pestanas button[aria-selected='true'] {
    color: var(--acento);
    border-bottom-color: var(--acento);
  }
  .dock .pestanas button[data-pestana='piezas'][aria-selected='true'] {
    border-bottom-color: transparent;
  }
  .nota-flotante {
    position: absolute;
    left: 50%;
    bottom: 56px;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 10px;
    transform: translateX(-50%);
    padding: 6px 6px 6px 14px;
    border-radius: 999px;
    background: var(--tinta);
    color: var(--fondo);
    box-shadow: var(--sombra-alta);
    font-size: 14px;
    white-space: nowrap;
  }
  .enlace-boton {
    min-height: 44px;
    border: 0;
    background: none;
    color: #ffd84a;
    font: 700 14px var(--sans);
  }
  .cerrar-nota {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
  }
  .velo {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: var(--scrim);
  }
  .hoja-paleta {
    position: fixed;
    z-index: 71;
    left: 50%;
    bottom: 0;
    width: min(640px, 100vw);
    max-height: 78dvh;
    display: flex;
    flex-direction: column;
    transform: translateX(-50%);
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
    border-radius: 20px 20px 0 0;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
  }
  .hoja-paleta header {
    display: flex;
    align-items: center;
  }
  .hoja-paleta h2 {
    flex: 1;
    margin: 0;
    color: var(--titulos);
    font-size: 18px;
  }
  .contenido-paleta {
    min-height: 0;
    overflow: auto;
  }
  .contenido-paleta :global(.paleta) {
    max-height: none;
  }
  .n {
    display: inline-block;
    min-width: 1.5em;
    margin-left: 5px;
    padding: 0 4px;
    line-height: 1.35;
    text-align: center;
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
</style>
