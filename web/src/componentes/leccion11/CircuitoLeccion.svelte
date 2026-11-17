<script lang="ts">
  // 1.1 lessons: the live circuit of a card, as the approved mock-up draws it — a schematic (a folder of
  // lib/leccion11/esquemas/: its definition and its drawing, looked up by name) whose pieces show the model's values,
  // the big reading, the split bars, the current that moves (faster with more current; still with «reducir
  // movimiento»), chips with other readings and, if the card has one, the circuit's curves against time or frequency
  // (GraficaLeccion). Everything is computed by the lesson's model (lib/leccion11/modelo.ts); the generator checked
  // the same circuit with the app's ngspice. A prediction hides the readings («¿?») until it is checked. Screen
  // readers get a description of the circuit and, a moment after the values stop changing, the reading in a polite
  // live region.
  // 1.2: the drawing is wrapped in the living circuit (componentes/leccion12/CircuitoVivo.svelte: particles, wires by
  // voltage with legend and values, direct manipulation of the parts on the drawing) and the big reading pulses when
  // it changes.
  import './esquemas11.css';
  import { dibujoDe } from '../../lib/leccion11/esquemas/dibujos';
  import { esquemaDe } from '../../lib/leccion11/esquemas/registro';
  import type { ContextoDibujo } from '../../lib/leccion11/esquemas/tipos';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Valores } from '../../lib/leccion11/modelo';
  import type { Color, Leccion11, Mando, WidgetCircuito } from '../../lib/leccion11/tipos';
  import { untrack } from 'svelte';
  import GraficaLeccion from './GraficaLeccion.svelte';
  import Mandos from './Mandos.svelte';
  import CircuitoVivo from '../leccion12/CircuitoVivo.svelte';
  import { movimiento } from '../figuras-vivas/carga.svelte';
  import TextoVivo from './TextoVivo.svelte';
  // 1.2.1 (piloto121): the instrument on the drawing and the zones of an «elegir» card (GUIA §13)
  import Instrumento from '../leccion12/Instrumento.svelte';
  import ElegirEsquema from '../leccion12/ElegirEsquema.svelte';
  import { solucionWidget } from '../../lib/leccion12/hacer/medir';
  // (motor121: a non-linear circuit, or one that changes with time, is read on the app's ngspice)
  import { medicionCacheada, medirConSpice, ondaDe, peticionMedida, type Medicion } from '../../lib/leccion12/hacer/punto-trabajo';
  import { tocarZona } from '../../lib/leccion12/hacer/motor-hacer';
  import type { EstadoMedida } from '../../lib/leccion12/hacer/tipos';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Tarjeta } from '../../lib/leccion11/tipos';

  let {
    leccion,
    widget,
    valores,
    propios,
    oculto,
    prefijo,
    valor,
    alMover,
    manipular = true,
    hacer,
  }: {
    leccion: Leccion11;
    widget: WidgetCircuito;
    /** Values and calculations of the model for the card's current state. */
    valores: Valores;
    /** The input values (what the graph's handles vary). */
    propios: Valores;
    oculto: boolean;
    prefijo: string;
    valor: (id: string) => string;
    alMover: (valor: string, x: number) => void;
    /** 1.2: the parts of the drawing whose value a control moves can be dragged / tapped (CircuitoVivo.svelte). */
    manipular?: boolean;
    /** 1.2.1: the card and its state, for the instrument and an «elegir» card's zones (both shells pass them). */
    hacer?: { t: Tarjeta; e: EstadoTarjeta; cambiar: (c: Partial<EstadoTarjeta>) => void };
  } = $props();

  // ---- 1.2.1: the instrument and the zones of «elegir»
  const instr = $derived(widget.instrumento);
  const medida = $derived(hacer?.e.medida);
  // (motor121) what has to be simulated for the instrument in this state (null: the page solves it, cc.ts)
  const peticion = $derived(instr && !oculto ? peticionMedida(widget, valores) : null);
  let medicion = $state.raw<{ netlist: string; m: Medicion } | null>(null);
  $effect(() => {
    const p = peticion;
    if (!p) return;
    const ya = medicionCacheada(p);
    if (ya) {
      medicion = { netlist: p.netlist, m: ya };
      return;
    }
    // (a short wait: a slider being dragged asks for one run when it stops, not one per step)
    let vivo = true;
    let intentos = 0;
    const correr = () =>
      void medirConSpice(p).then((m) => {
        if (!vivo) return;
        // (a run replaced by another simulation of the page is asked again, once)
        if (m.error && /cancel/i.test(m.error) && intentos++ < 2) setTimeout(correr, 300);
        else medicion = { netlist: p.netlist, m };
      });
    const id = setTimeout(correr, 150);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  });
  const medicionActual = $derived(peticion && medicion?.netlist === peticion.netlist ? medicion.m : null);
  const midiendo = $derived(!!peticion && !medicionActual);
  const solucionCC = $derived(instr && instr.tipo === 'multimetro' && !oculto ? (peticion ? (medicionActual?.solucion ?? null) : solucionWidget(widget, valores)) : null);
  const bloqueoMedida = $derived(!!hacer && hacer.t.actividad?.tipo === 'medir' && hacer.e.resuelta);
  const elegir = $derived(hacer?.t.actividad?.tipo === 'elegir' && hacer.e.actividad?.tipo === 'elegir' ? { a: hacer.t.actividad, ea: hacer.e.actividad } : null);
  const dianas = $derived.by(() => {
    if (!hacer) return undefined;
    type D = { id: string; clase: 'punto' | 'rama' | 'pieza'; estado: 'roja' | 'negra' | 'rama' | 'elegida' | 'mal' | 'bien' | null };
    const lista: D[] = [];
    if (instr && medida) {
      if (instr.tipo === 'multimetro' && medida.modo === 'A') for (const b of instr.ramas) lista.push({ id: b.id, clase: 'rama', estado: medida.rama === b.id ? 'rama' : null });
      else for (const q of instr.puntos) lista.push({ id: q.id, clase: 'punto', estado: medida.roja === q.id ? 'roja' : medida.negra === q.id && instr.tipo === 'multimetro' ? 'negra' : null });
    }
    if (elegir) {
      const { a, ea } = elegir;
      for (const z of a.zonas)
        lista.push({ id: z.id, clase: 'pieza', estado: hacer.e.resuelta && a.bien.includes(z.id) ? 'bien' : ea.descartadas.includes(z.id) ? 'mal' : ea.elegidas.includes(z.id) ? 'elegida' : null });
    }
    return lista.length ? { lista, tocar: tocarDiana } : undefined;
  });
  function cambiarMedida(m: EstadoMedida) {
    hacer?.cambiar({ medida: m });
  }
  function tocarDiana(id: string) {
    if (!hacer) return;
    if (elegir && elegir.a.zonas.some((z) => z.id === id)) {
      elegirZona(id);
      return;
    }
    const m = hacer.e.medida;
    if (!instr || !m || bloqueoMedida) return;
    if (instr.tipo === 'osciloscopio') cambiarMedida({ ...m, roja: id });
    else if (m.modo === 'A') cambiarMedida({ ...m, rama: id });
    // (a tap on the black probe picks it up and the next tap puts it down; any other tap moves the red one)
    else if (m.activa === 'negra') cambiarMedida({ ...m, negra: id, activa: 'roja' });
    else if (id === m.negra && m.roja !== id) cambiarMedida({ ...m, activa: 'negra' });
    else cambiarMedida({ ...m, roja: id, activa: m.negra ? 'roja' : 'negra' });
  }
  function elegirZona(id: string) {
    if (!hacer || !elegir || hacer.e.resuelta) return;
    hacer.cambiar({ actividad: tocarZona(elegir.a, elegir.ea, id), comprobado: false, bien: null });
  }
  /**
   * The oscilloscope shows the curve of the probed point only: the graph's curve the author gave that point, or
   * (motor121) the node's waveform from the simulator, drawn as its samples.
   */
  const graficaVista = $derived.by(() => {
    const g = widget.grafica;
    if (!g || instr?.tipo !== 'osciloscopio') return g;
    const k = medida?.roja ? instr.curvas?.[medida.roja] : undefined;
    if (k != null) return { ...g, curvas: [g.curvas[k]!] };
    const onda = medida?.roja && peticion && medicionActual ? ondaDe(peticion, medicionActual.graficas, medida.roja) : null;
    if (!onda) return { ...g, curvas: [] };
    const rot = instr.puntos.find((q) => q.id === medida!.roja)?.rotulo ?? [];
    return { ...g, curvas: [{ expr: '0', color: 'azul' as const, rotulo: rot, discontinua: false, puntos: onda }] };
  });

  const p = $derived(widget.piezas);
  const def = $derived(esquemaDe(widget.esquema));
  const Dibujo = $derived(dibujoDe(widget.esquema));
  const mag = (id: string) => leccion.modelo.valores[id] ?? leccion.modelo.calculos[id];
  const sim = (id: string | undefined) => (id ? textoPlano(mag(id)?.sim) : '');
  const desconocido = (id: string) => {
    const u = mag(id)?.unidad ?? '';
    return u ? `¿? ${u}` : '¿?';
  };
  const ver = (id: string) => (oculto ? desconocido(id) : valor(id));
  const verTexto = (id: string) => (oculto ? '¿?' : valor(id));
  const ctx = $derived<ContextoDibujo>({
    p: (q) => (p[q] ? (valores[p[q]!] ?? 0) : 0),
    tiene: (q) => q in p,
    cerrado: (q) => !p[q] || (valores[p[q]!] ?? 0) !== 0,
    sim: (q) => sim(p[q]),
    simT: (q) => (p[q] ? (mag(p[q]!)?.sim ?? []) : []),
    rot: (q) => (p[q] ? [...(mag(p[q]!)?.sim ?? []), { t: 'txt', s: ` ${valor(p[q]!)}` }] : []),
    val: (q) => (p[q] ? valor(p[q]!) : ''),
    ver,
    id: (q) => p[q],
    n: (id) => valores[id] ?? NaN,
    unidad: (id) => mag(id)?.unidad ?? '',
    oculto,
  });

  /** Colour of each control: the piece it moves (as the schematic says: top/first blue, bottom/second orange, a load green). */
  function color(id: string): Color {
    for (const [q, v] of Object.entries(p)) if (v === id && def?.piezas[q]?.color) return def.piezas[q]!.color!;
    return 'azul';
  }
  // a piece's slider appears once its switch is closed (the mock-up's load)
  const visible = (m: Mando) =>
    !Object.entries(p).some(([q, v]) => {
      const con = def?.piezas[q]?.seVeCon;
      return v === m.valor && !!con && !!p[con] && (valores[p[con]!] ?? 0) === 0;
    });

  const total = $derived((widget.barras ?? []).reduce((a, b) => a + Math.max(0, valores[b.valor] ?? 0), 0));
  const fraccion = (id: string) => (oculto || !(total > 0) ? 100 / (widget.barras?.length || 1) : (Math.max(0, valores[id] ?? 0) / total) * 100);

  /** Seconds per lap of the moving current: 2,5 s at 1 mA, faster with more current (0,4 s at most), 6 s at least. */
  function duracion(i: number | undefined): number {
    if (!(i != null && i > 0)) return 6;
    return Math.min(6, Math.max(0.4, 2.5 - 0.9 * Math.log10(i / 1e-3)));
  }
  const dur = $derived(duracion(widget.corriente ? valores[widget.corriente] : undefined));

  const descripcion = $derived.by(() => {
    const lect = widget.lectura ? `; ${textoPlano(widget.lectura.rotulo).toLowerCase()} ${ver(widget.lectura.valor)}` : '';
    return `${def ? def.describir(ctx) : widget.esquema}${lect}`;
  });

  // 1.2: the big reading gives a short pulse when its value changes (the text is always the final value: the tests and
  // screen readers read it; nothing with «reducir movimiento» or in a prediction)
  const lecturaTexto = $derived(widget.lectura ? ver(widget.lectura.valor) : '');
  let pulso = $state(0);
  let lecturaPrevia = '';
  $effect(() => {
    const x = lecturaTexto;
    untrack(() => {
      if (lecturaPrevia && x !== lecturaPrevia && !oculto && !movimiento.reducido) pulso++;
      lecturaPrevia = x;
    });
  });

  // the reading, spoken once the values settle (not at every step of a slider)
  let hablado = $state('');
  $effect(() => {
    const t = widget.lectura ? `${textoPlano(widget.lectura.rotulo)}: ${ver(widget.lectura.valor)}` : '';
    const id = setTimeout(() => (hablado = t), 700);
    return () => clearTimeout(id);
  });

</script>

<div class="circuito" data-circuito={widget.esquema}>
  {#if widget.dibujo !== false || widget.lectura || widget.barras?.length || widget.datos?.length}
  <div class="panel">
    {#if widget.lectura}
      <div class="cabecera">
        <span class="rot"><TextoVivo texto={widget.lectura.rotulo} {valor} /></span>
        {#key pulso}<span class="lectura" class:pulso={pulso > 0} data-lectura={widget.lectura.valor}>{lecturaTexto}</span>{/key}
      </div>
    {/if}
    {#if Dibujo && def && widget.dibujo !== false}
      <CircuitoVivo {leccion} {widget} {def} {ctx} {valores} {oculto} manipular={manipular && !elegir} {alMover} {dianas} externa={peticion?.analisis === 'op' ? (medicionActual?.solucion ?? null) : null}>
        <Dibujo c={ctx} {widget} vuelta={duracion} {dur} {descripcion} />
      </CircuitoVivo>
    {/if}
    {#if widget.barras?.length}
      <div class="barras">
        <div class="pista" aria-hidden="true">
          {#each widget.barras as b (b.valor)}
            <div class={`barra ${b.color}`} style:width={`${fraccion(b.valor).toFixed(1)}%`}></div>
          {/each}
        </div>
        <div class="leyenda">
          {#each widget.barras as b (b.valor)}
            <span class={`ley ${b.color}`} data-barra={b.valor}><TextoVivo texto={b.rotulo} valor={verTexto} /></span>
          {/each}
        </div>
      </div>
    {/if}
    {#if widget.datos?.length}
      <div class="datos">
        {#each widget.datos as d (d.valor)}
          <span class="dato" data-dato={d.valor}><TextoVivo texto={d.rotulo} valor={verTexto} /></span>
        {/each}
      </div>
    {/if}
  </div>
  {/if}
  {#if instr && medida && hacer}
    <Instrumento i={instr} m={medida} solucion={solucionCC} {midiendo} promedio={peticion?.analisis === 'tran'} {prefijo} bloqueado={bloqueoMedida} cambiar={cambiarMedida} />
  {/if}
  {#if elegir && hacer}
    <ElegirEsquema a={elegir.a} ea={elegir.ea} resuelta={hacer.e.resuelta} tocar={elegirZona} />
  {/if}
  {#if graficaVista}
    {#if instr?.tipo === 'osciloscopio' && !graficaVista.curvas.length}
      <p class="sin-sonda" data-osciloscopio-vacio>{medida?.roja && midiendo ? 'Osciloscopio: midiendo la señal…' : 'Osciloscopio: ponga la sonda en un punto del circuito para ver su señal.'}</p>
    {/if}
    <GraficaLeccion {leccion} widget={{ ...graficaVista, tipo: 'grafica', mandos: widget.mandos, ocultar: widget.ocultar }} {valores} {propios} {oculto} {prefijo} {valor} {alMover} conMandos={false} {hacer} />
  {/if}
  {#if widget.mandos.length}
    <Mandos {leccion} mandos={widget.mandos} {valores} {prefijo} {color} {visible} {alMover} {valor} />
  {/if}
  <div class="solo-lector" aria-live="polite">{hablado}</div>
</div>

<style>
  .sin-sonda {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .circuito {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 14px 12px;
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-panel);
  }
  .cabecera {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .rot {
    color: var(--v11-tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .lectura {
    color: var(--v11-naranja-texto);
    font: 700 34px/1.1 var(--v11-titular);
    font-variant-numeric: tabular-nums;
  }
  /* 1.2: the reading's pulse when it changes */
  .lectura.pulso {
    animation: pulso11 0.32s ease-out;
  }
  @keyframes pulso11 {
    from {
      transform: scale(1.06);
      color: var(--v11-tinta);
    }
  }
  .lectura {
    display: inline-block;
    transform-origin: right center;
  }
  .barras {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pista {
    display: flex;
    height: 14px;
    overflow: hidden;
    border-radius: 7px;
    background: var(--v11-linea);
  }
  .barra {
    transition: width 0.25s ease;
  }
  .barra.azul {
    background: var(--v11-azul);
  }
  .barra.naranja {
    background: var(--v11-naranja);
  }
  .barra.verde {
    background: var(--v11-verde);
  }
  .leyenda {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 2px 12px;
    font-size: 13px;
    font-weight: 500;
  }
  .ley.azul {
    color: var(--v11-azul);
  }
  .ley.naranja {
    color: var(--v11-naranja-texto);
  }
  .ley.verde {
    color: var(--v11-verde);
  }
  .datos {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .dato {
    padding: 6px 12px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 999px;
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font-size: 14px;
    font-weight: 600;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* phones: a little more width for the drawing (its labels then need less enlarging, kit/Lienzo.svelte) */
  @media (max-width: 420px) {
    .panel {
      padding-right: 8px;
      padding-left: 8px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .barra {
      transition: none;
    }
  }
</style>
