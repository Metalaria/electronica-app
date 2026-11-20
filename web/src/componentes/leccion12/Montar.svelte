<script lang="ts">
  // 1.3 (motor13b) «Monte este circuito en la protoboard» (GUIA §13.14): the card's schematic stays above as the
  // reference; under it, the breadboard bench of componentes/protoboard/ (Mesa: the same gestures, precise placement
  // with the finger and the keyboard path by hole name) with a tray of the schematic's own parts and the supply already
  // wired. «guiada»: the guide of «Monta este circuito» lights the holes of each step and explains a misplaced part at
  // once; «libre»: only the tray. After every change the board is diagnosed (lib/leccion12/montar/motor-montar.ts) and,
  // when its topology is the schematic's, run on the app's ngspice and compared node by node with the schematic's own
  // operating point; «Comprobar» (the shell's) then says the first thing wrong and how many remain, or that it is right
  // with what the multimeter reads. «Volver a intentarlo» keeps the board; the ladder's solution can load the automatic
  // placement. The board lives in the card's state (memory only). A list of what the board joins is the text path.
  import { onDestroy, untrack } from 'svelte';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Leccion11, Tarjeta } from '../../lib/leccion11/tipos';
  import type { DiagnosticoMontar, EstadoMontar, Montar } from '../../lib/leccion12/montar/tipos';
  import { compararTensiones, diagnosticarMontaje, lecturaMedir, placaInicial, placaVacia } from '../../lib/leccion12/montar/motor-montar';
  import { Protoboard } from '../protoboard/estado.svelte';
  import Mesa from '../protoboard/Mesa.svelte';
  import Bandeja from '../protoboard/Bandeja.svelte';
  import BarraPieza from '../protoboard/BarraPieza.svelte';
  // explicit .ts: '../protoboard/guia.svelte' resolves to Guia.svelte on case-insensitive file systems (macOS, Windows)
  import { Guia } from '../protoboard/guia.svelte.ts';
  import { planDeMontaje } from '../protoboard/guia';
  import { brillos } from '../protoboard/comprobaciones';
  import { encapsuladoDe, EXTERNOS } from '../protoboard/encapsulados';
  import { leerPuntoTrabajo, netlistPuntoTrabajo } from '../protoboard/simulacion';
  import type { Componente } from '../editor/tipos';
  import type { DocumentoProtoboard, Pieza } from '../protoboard/tipos';
  import type { Pt } from '../protoboard/placa';
  import { SimulacionCancelada } from '../../simulador/cliente.svelte';

  let {
    t,
    a,
    e,
    ea,
    cambiar,
  }: {
    leccion: Leccion11;
    t: Tarjeta;
    a: Montar;
    e: EstadoTarjeta;
    ea: EstadoMontar;
    prefijo: string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  // (the card's own bench: its board is the state's, or the supply alone the first time)
  const pb = new Protoboard();
  const inicial = untrack(() => ea.doc ?? placaInicial(a));
  pb.cargar(copia(inicial), true);
  const plan = untrack(() => planDeMontaje(a.objetivo, a.objetivo.titulo));
  // (the tray is the guide's, in both modes: the very parts of the schematic; only «guiada» lights the holes)
  pb.guia = new Guia(pb, plan, copia(inicial));
  const guiada = $derived(a.ayuda === 'guiada');

  let mesa: Mesa | undefined = $state();
  function arrastre(fase: 'mover' | 'soltar' | 'cancelar', cx: number, cy: number, x: Componente | Pieza, dedo: boolean): boolean {
    if (!mesa) return false;
    if (fase === 'mover') return mesa.fantasma(cx, cy, x, dedo);
    if (fase === 'soltar') return mesa.soltarFantasma(cx, cy, x, dedo);
    mesa.quitarFantasma();
    return false;
  }

  /** What the bench lights for the guide's step (guided only): the holes, the part's silhouette, the wire. */
  const pista = $derived.by(() => {
    if (!guiada) return null;
    const p = pb.guia?.paso;
    if (!p || p.tipo === 'simular') return null;
    if (p.tipo === 'cable') return { puntos: [p.a, p.b] as Pt[], cable: [p.a, p.b] as [Pt, Pt] };
    const puesta = pb.doc.piezas.some((x) => x.comp.nombre.toUpperCase() === p.pieza.comp.nombre.toUpperCase());
    return { puntos: p.pieza.pos.filter((_, i) => !!p.pieza.patas[i]), pieza: puesta ? null : p.pieza };
  });
  const textoGuia = $derived.by(() => {
    if (!guiada || !pb.guia) return '';
    const g = pb.guia;
    if (g.estado.error) return g.estado.error.texto;
    const p = g.paso;
    if (!p || p.tipo === 'simular' || g.montado) return 'Todo puesto: pulse «Comprobar».';
    return p.texto;
  });

  // ---------------------------------------------------------------- the schematic's operating point (once)

  let esquemaOp: Promise<Record<string, number> | null> | null = null;
  async function simular(texto: string): Promise<Record<string, number> | null> {
    const { simularTexto } = await import('../../simulador/cliente.svelte');
    const r = await simularTexto(texto);
    if (r.salida.errores.length) return null;
    return leerPuntoTrabajo(r)?.v ?? null;
  }

  // ---------------------------------------------------------------- diagnosis after every change

  let vivo = true;
  onDestroy(() => (vivo = false));
  let opPlaca = $state.raw<ReturnType<typeof leerPuntoTrabajo>>(null);
  const encendidos = $derived(brillos(pb.doc, pb.con, opPlaca, new Map(pb.nl.instancias.map((i) => [i.comp, i.nombre]))));

  // (the starting board, untouched, is not the reader's doing: the lesson is not «started» by opening the card)
  const versionInicial = pb.version;
  const restaurada = untrack(() => !!ea.doc);
  let local = $state.raw<DiagnosticoMontar | null>(null);
  function publicar(doc: DocumentoProtoboard, d: DiagnosticoMontar) {
    // (a late result after the card was left must not land on another card's state)
    if (!vivo) return;
    local = d;
    if (d.version === versionInicial && !restaurada && d.vacia) return;
    // (the shell's state: the board and its diagnosis; «Comprobar» reads the diagnosis)
    const actual = untrack(() => ea);
    cambiar({ actividad: { ...actual, doc, diagnostico: d } });
  }

  async function diagnosticar(version: number, intentos = 0) {
    const doc = copia($state.snapshot(pb.doc)) as DocumentoProtoboard;
    const vacia = placaVacia(doc);
    const problemas = vacia ? [] : diagnosticarMontaje(a, doc);
    opPlaca = null;
    if (vacia || problemas.length) {
      publicar(doc, { version, vacia, problemas, simulado: 'no' });
      return;
    }
    publicar(doc, { version, vacia, problemas, simulado: 'pendiente' });
    try {
      esquemaOp ??= simular(a.netlist);
      const leds = new Set(doc.piezas.filter((p) => p.enc === 'led').map((p) => p.id));
      const nl = pb.nl;
      const diodos = nl.instancias.filter((i) => leds.has(i.comp) && /^d/i.test(i.nombre)).map((i) => i.nombre);
      // (one run at a time: the app's engine replaces a run with the next one)
      const ve = await esquemaOp;
      const { simularTexto } = await import('../../simulador/cliente.svelte');
      const r = await simularTexto(netlistPuntoTrabajo(nl.texto, diodos));
      if (!vivo || version !== pb.version) return;
      const op = r.salida.errores.length ? null : leerPuntoTrabajo(r);
      if (!op || !ve) {
        publicar(doc, { version, vacia, problemas, simulado: 'fallo' });
        return;
      }
      opPlaca = op;
      const c = compararTensiones(a, op.v, ve);
      const lectura = lecturaMedir(a, op.v);
      publicar(doc, { version, vacia, problemas: c.problemas, simulado: 'si', tensiones: c.tensiones, ...(lectura != null ? { lectura } : {}) });
    } catch (err) {
      if (!vivo || version !== pb.version) return;
      // (another run of the page — the schematic's instrument — replaced this one: again in a moment, a few times)
      if (err instanceof SimulacionCancelada && intentos < 4) {
        esquemaOp = null;
        setTimeout(() => void diagnosticar(version, intentos + 1), 400);
        return;
      }
      publicar(doc, { version, vacia, problemas, simulado: 'fallo' });
    }
  }

  let espera: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const v = pb.version;
    void pb.doc;
    untrack(() => {
      if (espera) clearTimeout(espera);
      // (at once the first time and for the topology; the simulator waits for the finger to rest a moment)
      espera = setTimeout(() => void diagnosticar(v), ea.diagnostico ? 120 : 0);
    });
  });
  onDestroy(() => espera && clearTimeout(espera));

  // ---------------------------------------------------------------- solution, restart

  const verSolucion = $derived((e.pistasVistas ?? 0) > (t.escalera?.length ?? 0) || (e.intentos >= 2 && !e.resuelta));
  function ponerSolucion() {
    pb.cambiar(() => {
      pb.doc = copia(a.objetivo);
    });
    pb.sel = [];
    cambiar({ actividad: { ...untrack(() => ea), solucion: true } });
    mesa?.ajustar();
  }
  function empezarDeNuevo() {
    pb.cambiar(() => {
      pb.doc = copia(placaInicial(a));
    });
    pb.sel = [];
    mesa?.ajustar();
  }

  // ---------------------------------------------------------------- what the board joins (the text path)

  const uniones = $derived.by(() => {
    const con = pb.con;
    const nombre = (p: Pieza, pin: string) => {
      const i = p.patas.indexOf(pin);
      const n = encapsuladoDe(p.comp).nombres[i] ?? '';
      return EXTERNOS.has(p.enc) ? `${p.comp.nombre} ${n}` : n && !/^\d$/.test(n) ? `${p.comp.nombre} (${n})` : p.comp.nombre;
    };
    return con.redes
      .map((r) => {
        const pines = r.pines
          .map((k) => {
            const [pid, pin] = k.split('.') as [string, string];
            const p = pb.doc.piezas.find((x) => x.id === pid);
            return p ? nombre(p, pin) : null;
          })
          .filter((x): x is string => !!x);
        return { nombre: a.redes[r.nombre] ?? null, pines };
      })
      .filter((x) => x.pines.length > 1 || (x.pines.length === 1 && x.nombre));
  });

  const d = $derived(local ?? ea.diagnostico);
  const estadoTexto = $derived(
    !d ? '' : d.vacia ? 'Lleve las piezas de la bandeja a la placa.' : d.simulado === 'pendiente' ? 'Simulando su placa…' : d.problemas.length ? '' : 'Listo para comprobar.',
  );
</script>

<div class="a12-montar" data-montar={a.ayuda} data-diagnostico={d ? (d.vacia ? 'vacia' : d.simulado === 'pendiente' ? 'simulando' : d.problemas.length ? `problemas-${d.problemas.length}` : 'bien') : 'nada'}>
  {#if guiada && textoGuia}
    <p class="a12-montar-paso" aria-live="polite" data-paso-montar>{textoGuia}</p>
  {/if}
  <div class="a12-montar-banco">
    <Mesa bind:this={mesa} {pb} {encendidos} guia={pista} controles vacia="" sinInfo={false}>
      {#snippet flotante(caja)}
        <BarraPieza {pb} {caja} alMas={() => (pb.mensaje = 'En esta tarjeta las piezas son las del esquema: sus valores no se cambian.')} />
      {/snippet}
    </Mesa>
  </div>
  <div class="a12-montar-bandeja"><Bandeja {pb} alArrastrar={arrastre} /></div>
  <div class="a12-fila a12-montar-acciones">
    <button type="button" class="a12-boton" onclick={empezarDeNuevo} data-montar-reiniciar>Empezar de nuevo</button>
    {#if verSolucion}<button type="button" class="a12-boton" onclick={ponerSolucion} data-montar-solucion>Poner la solución en la placa</button>{/if}
  </div>
  <p class="a12-suave" aria-live="polite" data-estado-montar>{estadoTexto}</p>
  <details class="a12-montar-uniones">
    <summary>Lo que une su placa</summary>
    <ul data-uniones>
      {#each uniones as u, k (k)}
        <!-- (the space after the colon written out: Svelte drops a block's trailing whitespace, «Masa:VF −») -->
        <li>{#if u.nombre}<strong>{u.nombre}</strong>:{' '}{/if}{u.pines.join(', ')}</li>
      {/each}
    </ul>
  </details>
</div>

<style>
  .a12-montar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .a12-montar-banco {
    display: flex;
    flex-direction: column;
    height: min(62vh, 440px);
    min-height: 260px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
    overflow: hidden;
  }
  .a12-montar-bandeja {
    min-width: 0;
  }
  .a12-montar-paso {
    margin: 0;
    font-weight: 600;
  }
  .a12-montar-uniones ul {
    margin: 0.25rem 0 0;
    padding-left: 1.2rem;
  }
</style>
