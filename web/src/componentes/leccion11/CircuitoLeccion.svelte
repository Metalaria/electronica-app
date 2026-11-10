<script lang="ts">
  // 1.1 lessons: the live circuit of a card, as the approved mock-up draws it — a schematic (a folder of
  // lib/leccion11/esquemas/: its definition and its drawing, looked up by name) whose pieces show the model's values,
  // the big reading, the split bars, the current that moves (faster with more current; still with «reducir
  // movimiento»), chips with other readings and, if the card has one, the circuit's curves against time or frequency
  // (GraficaLeccion). Everything is computed by the lesson's model (lib/leccion11/modelo.ts); the generator checked
  // the same circuit with the app's ngspice. A prediction hides the readings («¿?») until it is checked. Screen
  // readers get a description of the circuit and, a moment after the values stop changing, the reading in a polite
  // live region.
  import './esquemas11.css';
  import { dibujoDe } from '../../lib/leccion11/esquemas/dibujos';
  import { esquemaDe } from '../../lib/leccion11/esquemas/registro';
  import type { ContextoDibujo } from '../../lib/leccion11/esquemas/tipos';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Valores } from '../../lib/leccion11/modelo';
  import type { Color, Leccion11, Mando, WidgetCircuito } from '../../lib/leccion11/tipos';
  import GraficaLeccion from './GraficaLeccion.svelte';
  import Mandos from './Mandos.svelte';
  import TextoVivo from './TextoVivo.svelte';

  let {
    leccion,
    widget,
    valores,
    propios,
    oculto,
    prefijo,
    valor,
    alMover,
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
  } = $props();

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
        <span class="lectura" data-lectura={widget.lectura.valor}>{ver(widget.lectura.valor)}</span>
      </div>
    {/if}
    {#if Dibujo && def && widget.dibujo !== false}
      <Dibujo c={ctx} {widget} vuelta={duracion} {dur} {descripcion} />
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
  {#if widget.grafica}
    <GraficaLeccion {leccion} widget={{ ...widget.grafica, tipo: 'grafica', mandos: widget.mandos, ocultar: widget.ocultar }} {valores} {propios} {oculto} {prefijo} {valor} {alMover} conMandos={false} />
  {/if}
  {#if widget.mandos.length}
    <Mandos {leccion} mandos={widget.mandos} {valores} {prefijo} {color} {visible} {alMover} {valor} />
  {/if}
  <div class="solo-lector" aria-live="polite">{hablado}</div>
</div>

<style>
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
