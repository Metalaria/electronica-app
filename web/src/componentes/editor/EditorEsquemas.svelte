<script lang="ts">
  // The schematic editor page (#/editor, #/editor/<id>, #/editor/libro/<netlist>, #/editor/importar): draw a
  // circuit with the book's symbols, choose the analyses, simulate it in the simulator's worker, see the
  // results on the plots and on the drawing itself, and keep the circuit on the device.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { motor, detener, precalentarMotor, simularTexto, SimulacionCancelada } from '../../simulador/cliente.svelte';
  import type { Simulacion } from '../../simulador/motor/simular.ts';
  import { cargarIndiceSpice, cargarNetlist } from '../../simulador/datos.svelte';
  import type { DibujoConNetlist } from '../figuras-vivas/tipos';
  import { formatoSI } from '../grafica/formato.ts';
  import Resultados from '../simulador/Resultados.svelte';
  import PestanasSimulador from '../simulador/PestanasSimulador.svelte';
  import { Editor } from './estado.svelte';
  import Lienzo from './Lienzo.svelte';
  import Paleta from './Paleta.svelte';
  import Propiedades from './Propiedades.svelte';
  import VistaViva from './VistaViva.svelte';
  import MisCircuitos from './MisCircuitos.svelte';
  import { disponerNetlist, importarNetlist } from './importar.ts';
  import { CONMUTABLES, conmutado, tipoDe } from './catalogo.ts';
  import { cajaMundo } from './geometria.ts';
  import Mando from './Mando.svelte';
  import { aplicarArreglo, arreglos, noConverge, revisarCircuito, TITULO_ARREGLO, type Arreglo } from './erc.ts';
  import { barridoPorDefecto, camposBarribles, documentoConValor, MAX_VALORES, partesBarribles, unirBarrido, valoresBarrido } from './barrido.ts';
  import { generarNetlist } from './netlist.ts';
  import { netlistParaOrdenar, ordenarDocumento } from './ordenar.ts';
  import { leerValor } from './valores.ts';
  import type { Alineacion } from './estado.svelte';
  import { abrirProtoboard } from '../../lib/protoboard.svelte';
  import { dibujoVivo } from './vivo.ts';
  import { svgDocumento } from './svg.ts';
  import { documentoVacio, type DocumentoEsquema } from './tipos.ts';
  import {
    actualizar,
    cargarCircuitos,
    circuito,
    dejarNetlist,
    escribirBorrador,
    guardarNuevo,
    leerBorrador,
    tomarTraspaso,
  } from './circuitos.svelte';
  import MousePointer from '@lucide/svelte/icons/mouse-pointer-2';
  import Spline from '@lucide/svelte/icons/spline';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Undo from '@lucide/svelte/icons/undo-2';
  import Redo from '@lucide/svelte/icons/redo-2';
  import Copy from '@lucide/svelte/icons/copy';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import Maximize from '@lucide/svelte/icons/scan';
  import Route from '@lucide/svelte/icons/route';
  import Ordenar from '@lucide/svelte/icons/wand-sparkles';
  import AlinearIcono from '@lucide/svelte/icons/align-start-vertical';

  let { ruta }: { ruta: string } = $props();

  const ed = new Editor();
  let lienzo: ReturnType<typeof Lienzo> | undefined = $state();
  let cargando = $state(true);
  let errorCarga = $state('');
  /** Saved circuit open (#/editor/<id>), or null for the working draft. */
  let idGuardado = $state<string | null>(null);
  let estadoGuardado = $state<'guardado' | 'borrador' | 'guardando'>('borrador');
  let verCircuitos = $state(false);
  let modo = $state<'editar' | 'resultados'>('editar');
  let verNetlist = $state(false);
  let verDirectivas = $state(false);
  let menu = $state<{ x: number; y: number; id: string | null } | null>(null);
  let aviso = $state('');
  let verArchivo = $state(false);

  // ---------------------------------------------------------------- opening

  async function abrir(r: string) {
    cargando = true;
    errorCarga = '';
    resultado = null;
    vivo = null;
    modo = 'editar';
    try {
      await cargarCircuitos();
      const resto = r.replace(/^editor\/?/, '');
      if (resto.startsWith('libro/')) {
        const id = resto.slice(6);
        const indice = await cargarIndiceSpice();
        const n = indice?.netlists[id];
        if (!n) throw new Error('No existe esa netlist del libro.');
        const texto = await cargarNetlist(n);
        const doc = await importarNetlist(texto, { tipo: 'libro', id });
        if (!doc) throw new Error('Esta netlist no tiene nada que se pueda dibujar.');
        if (n.titulo && (!doc.titulo || doc.titulo.length > 70)) doc.titulo = n.titulo;
        empezarBorrador(doc);
        history.replaceState(history.state, '', '#/editor');
      } else if (resto === 'importar') {
        const t = tomarTraspaso();
        if (t) {
          const doc = await importarNetlist(t.texto, t.origen);
          if (!doc) throw new Error('Esta netlist no tiene nada que se pueda dibujar.');
          empezarBorrador(doc);
        } else cargarBorrador();
        history.replaceState(history.state, '', '#/editor');
      } else if (resto) {
        const c = circuito(resto);
        if (!c) throw new Error('Ese circuito ya no está guardado en este dispositivo.');
        idGuardado = resto;
        ed.cargar(JSON.parse(JSON.stringify(c.doc)) as DocumentoEsquema);
        estadoGuardado = 'guardado';
      } else cargarBorrador();
    } catch (e) {
      errorCarga = e instanceof Error ? e.message : String(e);
    } finally {
      cargando = false;
      ultimaVersion = ed.version;
      queueMicrotask(() => lienzo?.reajustar());
      if (simularAlAbrir) {
        simularAlAbrir = false;
        queueMicrotask(() => void simular(true));
      }
    }
  }
  /** A copy made by the convergence help is simulated as soon as it opens. */
  let simularAlAbrir = false;

  function cargarBorrador() {
    idGuardado = null;
    ed.cargar(leerBorrador() ?? documentoVacio());
    estadoGuardado = 'borrador';
  }

  /** A new working draft; an unsaved draft with parts in it is kept in «Mis circuitos» first. */
  function empezarBorrador(doc: DocumentoEsquema) {
    const viejo = leerBorrador();
    if (viejo && viejo.componentes.length && (viejo as DocumentoEsquema & { modificado?: boolean }).modificado)
      void guardarNuevo(`${viejo.titulo || 'Circuito'} (borrador)`, viejo);
    idGuardado = null;
    ed.cargar(doc);
    escribirBorrador(doc);
    estadoGuardado = 'borrador';
  }

  $effect(() => {
    const r = ruta;
    untrack(() => void abrir(r));
  });

  // ---------------------------------------------------------------- saving

  let ultimaVersion = 0;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const v = ed.version;
    if (cargando || v === ultimaVersion) return;
    untrack(() => {
      ultimaVersion = v;
      if (temporizador) clearTimeout(temporizador);
      if (idGuardado) estadoGuardado = 'guardando';
      temporizador = setTimeout(() => {
        temporizador = null;
        const doc = $state.snapshot(ed.doc) as DocumentoEsquema;
        if (idGuardado) void actualizar(idGuardado, doc).then(() => (estadoGuardado = 'guardado'));
        else escribirBorrador({ ...doc, modificado: true } as DocumentoEsquema);
      }, 500);
    });
  });

  /** «Ver en protoboard»: the drawing as it is now, full screen; the drawing itself does not change. */
  function verProtoboard() {
    const doc = JSON.parse(JSON.stringify($state.snapshot(ed.doc))) as DocumentoEsquema;
    abrirProtoboard({ tipo: 'documento', doc, titulo: doc.titulo || 'Circuito del editor' });
  }

  /** «Medir» (0.10): the bench with the editor's netlist and its own drawing (tap its nodes to place leads). */
  async function medir() {
    const nl = ed.nl;
    const doc = $state.snapshot(ed.doc) as DocumentoEsquema;
    const v = dibujoVivo(doc, nl);
    const { medirCircuitoEditor } = await import('../instrumentos/editor.ts');
    medirCircuitoEditor({
      texto: nl.texto,
      titulo: doc.titulo || 'Circuito del editor',
      plano: v.esquemas[0] ? { tipo: 'auto', svg: v.svg, vista: v.vista, esquema: v.esquemas[0], mapa: v.correspondencia[0]?.nodos ?? {} } : null,
      volver: idGuardado ? `#/editor/${idGuardado}` : '#/editor',
    });
  }

  async function guardar() {
    if (idGuardado) return;
    const doc = $state.snapshot(ed.doc) as DocumentoEsquema;
    const id = await guardarNuevo(doc.titulo || 'Circuito', doc);
    escribirBorrador(null);
    location.hash = `#/editor/${id}`;
  }

  function nuevo() {
    if (!idGuardado && ed.doc.componentes.length && !confirm('¿Empezar un circuito nuevo? El que está dibujando no se ha guardado y se perderá.')) return;
    escribirBorrador(null);
    if (idGuardado) location.hash = '#/editor';
    else {
      ed.cargar(documentoVacio());
      resultado = null;
      vivo = null;
      modo = 'editar';
      lienzo?.reajustar();
    }
  }

  onDestroy(() => {
    if (temporizador) {
      clearTimeout(temporizador);
      const doc = $state.snapshot(ed.doc) as DocumentoEsquema;
      if (idGuardado) void actualizar(idGuardado, doc);
      else escribirBorrador({ ...doc, modificado: true } as DocumentoEsquema);
    }
    if (motor.fase === 'simulando') detener();
  });

  // ---------------------------------------------------------------- simulation

  let resultado = $state.raw<Simulacion | null>(null);
  let vivo = $state.raw<DibujoConNetlist | null>(null);
  let textoSimulado = $state('');
  let versionSimulada = $state(-1);
  let errorSim = $state('');
  let sondasSimuladas = $state<string[]>([]);
  const ejecutando = $derived(motor.fase !== 'inactivo');
  const desfasado = $derived(!!resultado && versionSimulada !== ed.version);

  /** The drawing behind the live view (switches to tap, knobs). */
  let docVivo = $state.raw<DocumentoEsquema | null>(null);
  /** The live view solves only the operating point (a knob moving, a switch just toggled). */
  let soloOp = $state(false);
  let esperaVivo: (() => void) | null = null;
  /** The last result is a parameter sweep. */
  let esBarrido = $state(false);
  let progresoBarrido = $state('');
  /** Electrical rule check of the drawing, and whether «Simular» stopped on it. */
  const erc = $derived(revisarCircuito(ed.nl, ed.doc));
  const ercErrores = $derived(erc.filter((p) => p.nivel === 'error'));
  let paradoPorErc = $state(false);
  let seccionErc: HTMLElement | undefined = $state();
  /** Ranges of the source knobs, fixed at the last full simulation (so they do not move under the finger). */
  let rangos = $state<Record<string, [number, number]>>({});

  async function simular(forzar = false) {
    menu = null;
    const nl = ed.nl;
    errorSim = '';
    if (nl.errores.length) {
      errorSim = 'Corrija lo que se indica antes de simular.';
      return;
    }
    if (!forzar && ercErrores.length) {
      paradoPorErc = true;
      queueMicrotask(() => seccionErc?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return;
    }
    paradoPorErc = false;
    const doc = $state.snapshot(ed.doc) as DocumentoEsquema;
    if (doc.barrido?.activo) return simularBarrido(doc, nl);
    const version = ed.version;
    try {
      const r = await simularTexto(nl.texto);
      resultado = r;
      esBarrido = false;
      // For the tests: the last result of the editor.
      (globalThis as unknown as { __epaEditorSim?: Simulacion }).__epaEditorSim = r;
      textoSimulado = nl.texto;
      versionSimulada = version;
      sondasSimuladas = nl.sondas;
      soloOp = false;
      docVivo = doc;
      vivo = dibujoVivo(doc, nl);
      fijarRangos(doc);
      if (!r.salida.errores.length && !r.ejecucion.fallo) modo = 'resultados';
    } catch (e) {
      if (e instanceof SimulacionCancelada) return;
      errorSim = e instanceof Error ? e.message : String(e);
    }
  }

  /** «.step»: one run per value, merged into one result whose curves are overlaid. */
  async function simularBarrido(doc: DocumentoEsquema, nl: typeof ed.nl) {
    const b = doc.barrido!;
    const vs = valoresBarrido(doc, b);
    if ('error' in vs) {
      errorSim = vs.error;
      return;
    }
    const version = ed.version;
    const corridas: { etiqueta: string; sim: Simulacion }[] = [];
    try {
      for (const [k, v] of vs.valores.entries()) {
        const n = generarNetlist(documentoConValor(doc, b, v.texto));
        if (n.errores.length) {
          errorSim = `${v.etiqueta}: ${n.errores[0]!.texto}`;
          return;
        }
        progresoBarrido = `Barrido: ${k + 1} de ${vs.valores.length} (${v.etiqueta})`;
        const r = await simularTexto(n.texto);
        if (r.salida.errores.length || r.ejecucion.fallo) {
          resultado = r;
          esBarrido = false;
          errorSim = `Con ${v.etiqueta} ngspice no ha podido simular el circuito.`;
          return;
        }
        corridas.push({ etiqueta: v.etiqueta, sim: r });
      }
    } catch (e) {
      if (e instanceof SimulacionCancelada) return;
      errorSim = e instanceof Error ? e.message : String(e);
      return;
    } finally {
      progresoBarrido = '';
    }
    const r = unirBarrido(corridas);
    resultado = r;
    esBarrido = true;
    (globalThis as unknown as { __epaEditorSim?: Simulacion }).__epaEditorSim = r;
    textoSimulado = nl.texto;
    versionSimulada = version;
    sondasSimuladas = nl.sondas;
    soloOp = false;
    docVivo = doc;
    vivo = dibujoVivo(doc, nl);
    modo = 'resultados';
  }

  // ---------------------------------------------------------------- switches and knobs while simulating

  /** The live view with the drawing as it is now, operating point only (fast). */
  function vivoAlMomento(): Promise<void> {
    const nl = ed.nl;
    if (nl.errores.length || !vivo) return Promise.resolve();
    const doc = $state.snapshot(ed.doc) as DocumentoEsquema;
    docVivo = doc;
    vivo = dibujoVivo(doc, nl);
    textoSimulado = nl.texto;
    sondasSimuladas = nl.sondas;
    soloOp = true;
    versionSimulada = ed.version;
    return new Promise((r) => {
      esperaVivo?.();
      esperaVivo = r;
    });
  }
  function vivoResuelto() {
    const r = esperaVivo;
    esperaVivo = null;
    r?.();
  }
  let vivoEnCurso = false;
  let vivoPendiente = false;
  async function refrescarVivo() {
    if (vivoEnCurso) {
      vivoPendiente = true;
      return;
    }
    vivoEnCurso = true;
    try {
      do {
        vivoPendiente = false;
        await vivoAlMomento();
      } while (vivoPendiente);
    } finally {
      vivoEnCurso = false;
    }
  }

  let toast = $state('');
  let toastTemporizador: ReturnType<typeof setTimeout> | null = null;
  function avisar(t: string) {
    toast = t;
    if (toastTemporizador) clearTimeout(toastTemporizador);
    toastTemporizador = setTimeout(() => (toast = ''), 2200);
  }

  /** A tap on a switch of the results: toggled, the operating point at once, then the whole simulation again. */
  async function conmutarSimulando(id: string) {
    if (!ed.conmutar(id)) return;
    const c = ed.componente(id);
    if (c) avisar(`${c.nombre}: ${estadoConmutable(c)}`);
    await refrescarVivo();
    await simular(true);
  }

  function estadoConmutable(c: { tipo: string; campos: Record<string, string> }): string {
    if (c.tipo === 'SW') return c.campos['estado'] === 'abierto' ? 'abierto' : 'cerrado';
    if (c.tipo === 'CONM') return c.campos['posicion'] === 'b' ? 'posición 2' : 'posición 1';
    return c.campos['pulsado'] === 'si' ? 'pulsado' : 'sin pulsar';
  }

  const conmutables = $derived.by(() => {
    const d = docVivo;
    const v = vivo;
    if (!d || !v?.esquemas[0]) return [];
    const A = v.esquemas[0].dibujo_a_svg;
    const m = 4;
    return d.componentes
      .filter((c) => CONMUTABLES.has(c.tipo))
      .map((c) => {
        const b = cajaMundo(c);
        const x0 = A.sx * b[0] + A.tx;
        const y0 = A.sy * -b[1] + A.ty;
        return { id: c.id, x: x0 - m, y: y0 - m, w: A.sx * (b[2] - b[0]) + 2 * m, h: -A.sy * (b[3] - b[1]) + 2 * m, nombre: c.nombre, estado: estadoConmutable(c) };
      });
  });

  /** Knobs of the results: potentiometers, sensors and sources (DC value, sine amplitude). */
  interface MandoSim {
    id: string;
    campo: string;
    etiqueta: string;
    unidad: string;
    min: number;
    max: number;
    log?: boolean;
    paso?: number;
  }
  function valorCampo(c: { campos: Record<string, string> }, campo: string, u: string): number | null {
    const l = leerValor(c.campos[campo] ?? '', u);
    return l.ok && l.v != null ? l.v : null;
  }
  function campoFuente(c: { tipo: string; campos: Record<string, string> }): [string, string] | null {
    if (!['V', 'VSIN', 'VPULSE', 'I'].includes(c.tipo)) return null;
    const f = c.campos['forma'] ?? 'dc';
    if (f === 'dc') return ['dc', c.tipo === 'I' ? 'A' : 'V'];
    if (f === 'sin') return ['va', 'V'];
    return null;
  }
  function fijarRangos(doc: DocumentoEsquema) {
    const r: Record<string, [number, number]> = {};
    for (const c of doc.componentes) {
      const cf = campoFuente(c);
      if (!cf) continue;
      const v = valorCampo(c, cf[0], cf[1]);
      if (v == null) continue;
      r[`${c.id}.${cf[0]}`] = v > 0 ? [0, 2 * v] : v < 0 ? [2 * v, 0] : [-5, 5];
    }
    rangos = r;
  }
  const mandos = $derived.by((): MandoSim[] => {
    const res: MandoSim[] = [];
    for (const c of ed.doc.componentes) {
      const t = tipoDe(c);
      for (const f of t.campos)
        if (f.mando && (!f.si || f.si(c))) res.push({ id: c.id, campo: f.id, etiqueta: `${c.nombre} · ${f.etiqueta.replace(/\s*\(.*\)$/, '').toLowerCase()}`, unidad: f.unidad ?? '', ...f.mando });
      const cf = campoFuente(c);
      const rg = cf ? rangos[`${c.id}.${cf[0]}`] : undefined;
      if (cf && rg) res.push({ id: c.id, campo: cf[0], etiqueta: `${c.nombre} · ${cf[0] === 'va' ? 'amplitud' : 'valor'}`, unidad: cf[1], min: rg[0], max: rg[1] });
    }
    return res;
  });
  let mandoMoviendo = $state<string | null>(null);
  async function moverMando(m: MandoSim, texto: string, fin: boolean) {
    const k = `${m.id}.${m.campo}`;
    ed.cambiarCampo(m.id, m.campo, texto, mandoMoviendo === k);
    mandoMoviendo = fin ? null : k;
    if (!fin) {
      void refrescarVivo();
      return;
    }
    // Released: the operating point, then the transient and the plots.
    await refrescarVivo();
    await simular(true);
  }

  // ---------------------------------------------------------------- convergence help

  const convergencia = $derived(resultado ? noConverge(resultado.salida.errores, resultado.ejecucion.fallo) : null);
  const listaArreglos = $derived(convergencia ? arreglos(convergencia, ed.doc) : []);
  async function probarArreglo(a: Arreglo) {
    const doc = aplicarArreglo($state.snapshot(ed.doc) as DocumentoEsquema, a.id);
    doc.titulo = `${(ed.doc.titulo || 'Circuito').replace(/\s*\((más iteraciones|con [^)]*)\)$/, '')} (${TITULO_ARREGLO[a.id]})`;
    const id = await guardarNuevo(doc.titulo, doc);
    simularAlAbrir = true;
    location.hash = `#/editor/${id}`;
  }

  // ---------------------------------------------------------------- tidying up

  let ordenando = $state(false);
  async function ordenar() {
    menu = null;
    if (!ed.doc.componentes.length || ordenando) return;
    ordenando = true;
    try {
      const doc = $state.snapshot(ed.doc) as DocumentoEsquema;
      const nl = generarNetlist(doc);
      const { texto, alias } = netlistParaOrdenar(doc, nl);
      const e = await disponerNetlist(texto);
      if (!e) {
        aviso = 'No se ha podido ordenar este esquema.';
        return;
      }
      const r = ordenarDocumento(doc, nl, e, alias, texto);
      if ('error' in r) aviso = r.error;
      else {
        ed.reemplazar(r.doc);
        lienzo?.reajustar();
        avisar('Esquema ordenado: «Deshacer» lo deja como estaba.');
      }
    } catch (x) {
      aviso = x instanceof Error ? x.message : String(x);
    } finally {
      ordenando = false;
    }
  }
  let verAlinear = $state(false);
  const partesSel = $derived(ed.sel.filter((id) => ed.doc.componentes.some((c) => c.id === id)).length);
  function alinear(m: Alineacion | 'dist-h' | 'dist-v') {
    verAlinear = false;
    menu = null;
    if (m === 'dist-h') ed.distribuir('h');
    else if (m === 'dist-v') ed.distribuir('v');
    else ed.alinear(m);
  }
  const ALINEACIONES: [Alineacion | 'dist-h' | 'dist-v', string][] = [
    ['izquierda', 'Alinear a la izquierda'],
    ['centro-h', 'Centrar en horizontal'],
    ['derecha', 'Alinear a la derecha'],
    ['arriba', 'Alinear arriba'],
    ['centro-v', 'Centrar en vertical'],
    ['abajo', 'Alinear abajo'],
    ['dist-h', 'Repartir en horizontal'],
    ['dist-v', 'Repartir en vertical'],
  ];

  // ---------------------------------------------------------------- sweep settings

  const barrido = $derived(ed.doc.barrido ?? barridoPorDefecto());
  const barribles = $derived(partesBarribles(ed.doc));
  const compBarrido = $derived(ed.doc.componentes.find((c) => c.id === barrido.comp));
  function cambiarBarrido(fn: (b: NonNullable<DocumentoEsquema['barrido']>) => void) {
    ed.cambiar(() => {
      ed.doc.barrido ??= barridoPorDefecto();
      fn(ed.doc.barrido);
    });
  }
  /** The part a new sweep starts with: a passive part or a sensor rather than a source. */
  function parteBarridoInicial(): string | undefined {
    return (barribles.find((c) => !['V', 'VSIN', 'VPULSE', 'I'].includes(c.tipo)) ?? barribles[0])?.id;
  }
  function elegirParteBarrido(id: string) {
    cambiarBarrido((b) => {
      b.comp = id;
      const c = ed.doc.componentes.find((x) => x.id === id);
      const f = c ? camposBarribles(c)[0] : undefined;
      b.campo = f?.id ?? '';
      if (c && f && !b.lista.trim()) {
        const v = leerValor(c.campos[f.id] ?? '', f.unidad ?? '');
        if (v.ok && v.v != null && v.v !== 0) b.lista = [0.5, 1, 2].map((k) => String(Number((v.v! * k).toPrecision(3))).replace('.', ',')).join('; ');
      }
    });
  }

  onMount(precalentarMotor);

  // ---------------------------------------------------------------- import / export

  let selectorFichero: HTMLInputElement | undefined = $state();

  async function importarFichero(ev: Event) {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0];
    (ev.currentTarget as HTMLInputElement).value = '';
    if (!f) return;
    const texto = await f.text();
    try {
      const doc = await importarNetlist(texto, { tipo: 'texto' });
      if (!doc) {
        aviso = 'Ese fichero no tiene ningún componente que se pueda dibujar.';
        return;
      }
      if (!doc.titulo || doc.titulo === 'Circuito importado') doc.titulo = f.name.replace(/\.[^.]+$/, '');
      if (idGuardado) {
        escribirBorrador(doc);
        location.hash = '#/editor';
      } else {
        empezarBorrador(doc);
        lienzo?.reajustar();
      }
      resultado = null;
      vivo = null;
      modo = 'editar';
    } catch (e) {
      aviso = e instanceof Error ? e.message : String(e);
    }
  }

  function nombreFichero(ext: string): string {
    const base = (ed.doc.titulo || 'circuito')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
    return `${base || 'circuito'}.${ext}`;
  }

  async function descargar(nombre: string, texto: string, tipo: string) {
    const blob = new Blob([texto], { type: tipo });
    // Android (and phones in general): the system share sheet saves or sends the file.
    const fichero = typeof File !== 'undefined' ? new File([blob], nombre, { type: tipo }) : null;
    if (app.movil && fichero && navigator.canShare?.({ files: [fichero] })) {
      try {
        await navigator.share({ files: [fichero], title: nombre });
        return;
      } catch {
        /* cancelled: fall back to a download */
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function exportarCir() {
    void descargar(nombreFichero('cir'), ed.nl.texto, 'text/plain;charset=utf-8');
  }

  async function exportarSvg() {
    const { reglasFuentes } = await import('../esquema-auto/index.ts');
    const s = svgDocumento($state.snapshot(ed.doc) as DocumentoEsquema, ed.con, { paleta: 'libro', fuentes: await reglasFuentes() });
    void descargar(nombreFichero('svg'), s.svg.replace('<svg ', '<svg style="background:#fff" '), 'image/svg+xml');
  }

  function verComoNetlist() {
    dejarNetlist({ texto: ed.nl.texto, titulo: ed.doc.titulo, volver: idGuardado ? `#/editor/${idGuardado}` : '#/editor' });
    location.hash = '#/simulador/esquema';
  }

  let copiado = $state(false);
  async function copiarNetlist() {
    try {
      await navigator.clipboard.writeText(ed.nl.texto);
      copiado = true;
      setTimeout(() => (copiado = false), 1600);
    } catch {
      aviso = 'No se ha podido copiar: seleccione el texto y cópielo a mano.';
    }
  }

  // ---------------------------------------------------------------- keyboard

  function teclas(ev: KeyboardEvent) {
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (verCircuitos) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key.toLowerCase();
    let hecho = true;
    if (mod && k === 'z' && !ev.shiftKey) ed.deshacer();
    else if (mod && (k === 'y' || (k === 'z' && ev.shiftKey))) ed.rehacer();
    else if (mod && k === 'c') ed.copiar();
    else if (mod && k === 'x') {
      ed.copiar();
      ed.borrar();
    } else if (mod && k === 'v') ed.pegar();
    else if (mod && k === 'd') ed.duplicar();
    else if (mod && k === 'a') ed.seleccionarTodo();
    else if (mod && k === 's') void guardar();
    else if (mod || ev.altKey) hecho = false;
    else if (k === 'r') ed.transformar(ed.sel, 'girar');
    else if (k === 'x' || k === 'm') ed.transformar(ed.sel, 'reflejar');
    else if (k === 'delete' || k === 'backspace' || k === 'supr') ed.borrar();
    else if (k === 'escape') {
      menu = null;
      if (!lienzo?.cancelar()) ed.sel = [];
    } else if (k === 'w') ed.herramienta = 'cable';
    else if (k === 'a') ed.herramienta = 'ruta';
    else if (k === 's' || k === 'v') {
      ed.herramienta = 'seleccionar';
      ed.colocando = null;
    } else if (k === 'f' || k === '0') lienzo?.ajustar();
    else if (k === '+' || k === '=') lienzo?.zoom(1.25);
    else if (k === '-') lienzo?.zoom(0.8);
    else if (k === 'g') {
      if (modo === 'editar') {
        const c = lienzo?.centro();
        if (c) ed.colocar('GND', c[0], c[1]);
      }
    } else hecho = false;
    if (hecho) ev.preventDefault();
  }

  // ---------------------------------------------------------------- context menu

  function accionMenu(fn: () => void) {
    fn();
    menu = null;
  }

  let enfocarPropiedades = $state(0);
  function propiedades(id: string) {
    ed.sel = [id];
    enfocarPropiedades++;
  }
  let panelProp: HTMLElement | undefined = $state();
  $effect(() => {
    if (!enfocarPropiedades) return;
    untrack(() => {
      if (app.movil) panelProp?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => panelProp?.querySelector<HTMLInputElement>('input[name="valor"], input, select')?.focus(), 60);
    });
  });

  // ---------------------------------------------------------------- analyses

  const fuentes = $derived(
    ed.doc.componentes
      .filter((c) => ['V', 'VSIN', 'VPULSE', 'I'].includes(c.tipo) || (c.tipo === 'GEN' && /^[VI]$/.test(c.spice?.letra ?? '')))
      .map((c) => (/^[VI]/i.test(c.nombre) ? c.nombre : `${c.tipo === 'I' ? 'I' : 'V'}${c.nombre}`)),
  );
  const a = $derived(ed.doc.analisis);
  function cambiarAnalisis(fn: () => void) {
    ed.cambiar(fn);
  }

  const estado = $derived.by(() => {
    switch (motor.fase) {
      case 'descargando':
        return `Cargando el simulador${motor.descarga != null ? ` · ${Math.round(motor.descarga * 100)} %` : '…'}`;
      case 'preparando':
        return 'Preparando ngspice…';
      case 'simulando':
        return 'Simulando…';
      default:
        return resultado ? `Simulado en ${formatoSI(resultado.ejecucion.ms / 1000, 's', 2)}` : '';
    }
  });

  const anchoLateral = $derived(!app.movil);
</script>

<svelte:window onkeydown={teclas} />
<svelte:head><title>Editor de esquemas · Electrónica Práctica Avanzada</title></svelte:head>

<div class="editor-pagina">
  <PestanasSimulador />

  {#if errorCarga}
    <div class="aviso error">
      <p>{errorCarga}</p>
      <a class="boton" href="#/editor">Abrir el editor</a>
    </div>
  {/if}

  <header class="cab">
    <div class="titulo">
      <h1>{ed.doc.titulo || 'Circuito nuevo'}</h1>
      <span class="estado-guardado" aria-live="polite">
        {#if idGuardado}{estadoGuardado === 'guardando' ? 'Guardando…' : 'Guardado en este dispositivo'}{:else}Sin guardar{/if}
        {#if ed.doc.origen?.tipo === 'libro'} · dibujado a partir de la netlist del libro{/if}
      </span>
    </div>
    <div class="botones">
      {#if !idGuardado}<button type="button" class="boton primario" onclick={guardar} disabled={!ed.doc.componentes.length}>Guardar</button>{/if}
      <button type="button" class="boton" onclick={() => (verCircuitos = true)}>Mis circuitos</button>
      <button type="button" class="boton" onclick={verProtoboard} disabled={!ed.doc.componentes.length} title="Montar este circuito en una protoboard virtual (una prueba: el esquema no cambia)">Ver en protoboard</button>
      <button type="button" class="boton" onclick={() => void medir()} disabled={!ed.doc.componentes.length || ed.nl.errores.length > 0} title="Medir este circuito con el polímetro, el osciloscopio y el generador (las puntas en los nodos del dibujo)">Medir</button>
      <button type="button" class="boton" onclick={nuevo}>Nuevo</button>
      {#if app.movil}
        <button type="button" class="boton" aria-haspopup="menu" aria-expanded={verArchivo} onclick={() => (verArchivo = !verArchivo)}>Archivo ▾</button>
      {/if}
      {#if !app.movil || verArchivo}
        <div class="archivo" class:desplegado={app.movil}>
          <button type="button" class="boton" onclick={() => { verArchivo = false; selectorFichero?.click(); }}>Importar .cir</button>
          <button type="button" class="boton" onclick={() => { verArchivo = false; exportarCir(); }} disabled={!ed.doc.componentes.length}>Exportar .cir</button>
          <button type="button" class="boton" onclick={() => { verArchivo = false; void exportarSvg(); }} disabled={!ed.doc.componentes.length}>Exportar SVG</button>
          <button type="button" class="boton" onclick={() => { verArchivo = false; verComoNetlist(); }} disabled={!ed.doc.componentes.length}>Ver como netlist</button>
        </div>
      {/if}
      <input bind:this={selectorFichero} type="file" accept=".cir,.net,.sp,.spi,.txt,.ckt" hidden onchange={importarFichero} />
    </div>
  </header>
  {#if aviso}<div class="aviso" role="alert">{aviso} <button class="enlace" onclick={() => (aviso = '')}>Cerrar</button></div>{/if}

  <div class="mesa" class:lateral={anchoLateral}>
    {#if anchoLateral}
      <aside class="col-paleta"><Paleta {ed} arrastre={(t, x, y, f) => lienzo?.arrastreExterno(t, x, y, f) ?? false} /></aside>
    {/if}
    <div class="centro">
      <div class="herramientas" role="toolbar" aria-label="Herramientas del esquema">
        <div class="modo" role="group" aria-label="Vista">
          <button type="button" class="chip" aria-pressed={modo === 'editar'} onclick={() => (modo = 'editar')}>Editar</button>
          <button type="button" class="chip" aria-pressed={modo === 'resultados'} disabled={!vivo} onclick={() => (modo = 'resultados')}>Resultados</button>
        </div>
        {#if modo === 'editar'}
          <span class="sep"></span>
          <button type="button" class="hb" aria-pressed={ed.herramienta === 'seleccionar'} title="Seleccionar y mover (S)" aria-label="Seleccionar" onclick={() => { ed.herramienta = 'seleccionar'; ed.colocando = null; }}><MousePointer size={19} /></button>
          <button type="button" class="hb" aria-pressed={ed.herramienta === 'cable'} title="Dibujar cables (W): toque o arrastre de punto a punto" aria-label="Cable" onclick={() => (ed.herramienta = 'cable')}><Spline size={19} /></button>
          <button type="button" class="hb" aria-pressed={ed.herramienta === 'ruta'} title="Ruta automática (A): toque dos patillas y el cable se traza solo, esquivando los componentes" aria-label="Ruta automática" onclick={() => (ed.herramienta = ed.herramienta === 'ruta' ? 'seleccionar' : 'ruta')}><Route size={19} /></button>
          <span class="sep"></span>
          <button type="button" class="hb" title="Girar 90° (R)" aria-label="Girar" disabled={!ed.sel.length} onclick={() => ed.transformar(ed.sel, 'girar')}><RotateCw size={19} /></button>
          <button type="button" class="hb" title="Reflejar (X)" aria-label="Reflejar" disabled={!ed.sel.length} onclick={() => ed.transformar(ed.sel, 'reflejar')}><FlipHorizontal size={19} /></button>
          <button type="button" class="hb" title="Borrar (Supr)" aria-label="Borrar" disabled={!ed.sel.length} onclick={() => ed.borrar()}><Trash size={19} /></button>
          <span class="sep"></span>
          <button type="button" class="hb" title="Deshacer (Ctrl Z)" aria-label="Deshacer" disabled={!ed.puedeDeshacer} onclick={() => ed.deshacer()}><Undo size={19} /></button>
          <button type="button" class="hb" title="Rehacer (Ctrl Y)" aria-label="Rehacer" disabled={!ed.puedeRehacer} onclick={() => ed.rehacer()}><Redo size={19} /></button>
          <span class="sep"></span>
          <button type="button" class="hb" title="Duplicar (Ctrl D; Ctrl C y Ctrl V para copiar y pegar)" aria-label="Duplicar" disabled={!ed.sel.length} onclick={() => ed.duplicar()}><Copy size={19} /></button>
          <span class="alinear-caja">
            <button type="button" class="hb" title="Alinear o repartir la selección (dos componentes o más)" aria-label="Alinear" aria-haspopup="menu" aria-expanded={verAlinear} disabled={partesSel < 2} onclick={() => (verAlinear = !verAlinear)}><AlinearIcono size={19} /></button>
            {#if verAlinear && partesSel >= 2}
              <div class="menu-alinear" role="menu">
                {#each ALINEACIONES as [m, t] (m)}
                  <button type="button" role="menuitem" disabled={m.startsWith('dist') && partesSel < 3} onclick={() => alinear(m)}>{t}</button>
                {/each}
              </div>
            {/if}
          </span>
          <button type="button" class="hb" title="Ordenar el esquema: colocar y cablear todo de nuevo como los esquemas automáticos" aria-label="Ordenar el esquema" disabled={!ed.doc.componentes.length || ordenando} onclick={() => void ordenar()}><Ordenar size={19} /></button>
          <span class="sep"></span>
          {#if !app.movil}
            <button type="button" class="hb" title="Alejar (−)" aria-label="Alejar" onclick={() => lienzo?.zoom(0.8)}><ZoomOut size={19} /></button>
            <button type="button" class="hb" title="Acercar (+)" aria-label="Acercar" onclick={() => lienzo?.zoom(1.25)}><ZoomIn size={19} /></button>
          {/if}
          <button type="button" class="hb" title="Ver todo (F)" aria-label="Ver todo" onclick={() => lienzo?.ajustar()}><Maximize size={19} /></button>
        {/if}
      </div>
      {#if !anchoLateral && modo === 'editar'}
        <Paleta {ed} horizontal arrastre={(t, x, y, f) => lienzo?.arrastreExterno(t, x, y, f) ?? false} />
      {/if}
      <div class="zona" class:oculta={modo !== 'editar'}>
        {#if !cargando}
          <Lienzo bind:this={lienzo} {ed} alPropiedades={propiedades} alMenu={(m) => (menu = m)} alAviso={(t) => (aviso = t)} />
        {:else}
          <p class="cargando">Dibujando el circuito…</p>
        {/if}
      </div>
      {#if modo === 'resultados' && vivo}
        {#if desfasado}<p class="nota aviso-desfase">El esquema ha cambiado desde la última simulación: pulse «Simular» para verlo al día.</p>{/if}
        {#if conmutables.length}<p class="nota">Toque un interruptor o un pulsador del esquema (recuadro naranja) para cambiarlo: el punto de trabajo se recalcula al momento y después el resto de la simulación.</p>{/if}
        <VistaViva dibujo={vivo} texto={textoSimulado} {resultado} alto={app.movil ? 0 : 560} {soloOp} alResuelto={vivoResuelto} {conmutables} alConmutar={(id) => void conmutarSimulando(id)} />
        {#if mandos.length && !esBarrido}
          <section class="mandos" aria-label="Mandos">
            <h3>Mandos</h3>
            <p class="nota">Al mover un mando el punto de trabajo se recalcula al momento; el transitorio y las gráficas, al soltarlo.</p>
            <div class="lista-mandos">
              {#each mandos as m (`${m.id}.${m.campo}`)}
                {@const c = ed.componente(m.id)}
                {#if c}
                  <Mando etiqueta={m.etiqueta} nombre={`mando-${c.nombre}-${m.campo}`} texto={c.campos[m.campo] ?? ''} unidad={m.unidad} min={m.min} max={m.max} log={m.log} paso={m.paso} alCambiar={(t, fin) => void moverMando(m, t, fin)} />
                {/if}
              {/each}
            </div>
          </section>
        {/if}
      {/if}
      {#if toast}<p class="toast" role="status">{toast}</p>{/if}
    </div>
    <aside class="col-prop" bind:this={panelProp}>
      <Propiedades {ed} />
    </aside>
  </div>

  <section class="analisis" aria-label="Análisis">
    <h3>Análisis</h3>
    <div class="tarjetas">
      <label class="an"><input type="checkbox" checked={a.op} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.op = (e.currentTarget as HTMLInputElement).checked))} /> Punto de trabajo <code>.op</code></label>
      <div class="an">
        <label><input type="checkbox" checked={a.tran.activo} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.tran.activo = (e.currentTarget as HTMLInputElement).checked))} /> Transitorio <code>.tran</code></label>
        {#if a.tran.activo}
          <div class="params">
            <label>Paso <input name="tran-paso" value={a.tran.paso} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.tran.paso = (e.currentTarget as HTMLInputElement).value))} /></label>
            <label>Hasta <input name="tran-fin" value={a.tran.fin} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.tran.fin = (e.currentTarget as HTMLInputElement).value))} /></label>
            <label class="ch"><input type="checkbox" checked={a.tran.uic} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.tran.uic = (e.currentTarget as HTMLInputElement).checked))} /> Condiciones iniciales (UIC)</label>
          </div>
        {/if}
      </div>
      <div class="an">
        <label><input type="checkbox" checked={a.ac.activo} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.ac.activo = (e.currentTarget as HTMLInputElement).checked))} /> Alterna <code>.ac</code></label>
        {#if a.ac.activo}
          <div class="params">
            <label>Barrido <select value={a.ac.tipo} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.ac.tipo = (e.currentTarget as HTMLSelectElement).value as 'dec'))}><option value="dec">por décadas</option><option value="oct">por octavas</option><option value="lin">lineal</option></select></label>
            <label>Puntos <input name="ac-puntos" value={a.ac.puntos} inputmode="numeric" onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.ac.puntos = (e.currentTarget as HTMLInputElement).value))} /></label>
            <label>Desde <input name="ac-fini" value={a.ac.fini} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.ac.fini = (e.currentTarget as HTMLInputElement).value))} /></label>
            <label>Hasta <input name="ac-ffin" value={a.ac.ffin} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.ac.ffin = (e.currentTarget as HTMLInputElement).value))} /></label>
          </div>
        {/if}
      </div>
      <div class="an">
        <label><input type="checkbox" checked={a.dc.activo} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.dc.activo = (e.currentTarget as HTMLInputElement).checked))} /> Barrido DC <code>.dc</code></label>
        {#if a.dc.activo}
          <div class="params">
            <label>Fuente <select value={a.dc.fuente} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.dc.fuente = (e.currentTarget as HTMLSelectElement).value))}>
              <option value="">—</option>
              {#each fuentes as f (f)}<option value={f}>{f}</option>{/each}
            </select></label>
            <label>Desde <input name="dc-ini" value={a.dc.ini} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.dc.ini = (e.currentTarget as HTMLInputElement).value))} /></label>
            <label>Hasta <input name="dc-fin" value={a.dc.fin} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.dc.fin = (e.currentTarget as HTMLInputElement).value))} /></label>
            <label>Paso <input name="dc-paso" value={a.dc.paso} onchange={(e) => cambiarAnalisis(() => (ed.doc.analisis.dc.paso = (e.currentTarget as HTMLInputElement).value))} /></label>
          </div>
        {/if}
      </div>
      <div class="an barrido">
        <label><input type="checkbox" name="barrido-activo" checked={barrido.activo} disabled={!barribles.length} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).checked; cambiarBarrido((b) => (b.activo = v)); const p = parteBarridoInicial(); if (v && !barrido.comp && p) elegirParteBarrido(p); }} /> Barrido de un valor <code>.step</code></label>
        {#if barrido.activo}
          <div class="params">
            <label>Componente <select name="barrido-comp" value={barrido.comp} onchange={(e) => elegirParteBarrido((e.currentTarget as HTMLSelectElement).value)}>
              {#each barribles as c (c.id)}<option value={c.id}>{c.nombre || tipoDe(c).nombre}</option>{/each}
            </select></label>
            {#if compBarrido}
              <label>Valor <select name="barrido-campo" value={barrido.campo} onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value; cambiarBarrido((b) => (b.campo = v)); }}>
                {#each camposBarribles(compBarrido) as f (f.id)}<option value={f.id}>{f.etiqueta}</option>{/each}
              </select></label>
            {/if}
            <label>Valores <select name="barrido-modo" value={barrido.modo} onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value as 'lista'; cambiarBarrido((b) => (b.modo = v)); }}><option value="lista">una lista</option><option value="rango">un rango</option></select></label>
          </div>
          {#if barrido.modo === 'lista'}
            <div class="params"><label class="ancho">Lista <input name="barrido-lista" placeholder="1k; 2,2k; 4,7k" value={barrido.lista} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; cambiarBarrido((b) => (b.lista = v)); }} /></label></div>
          {:else}
            <div class="params">
              <label>Desde <input name="barrido-desde" value={barrido.desde} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; cambiarBarrido((b) => (b.desde = v)); }} /></label>
              <label>Hasta <input name="barrido-hasta" value={barrido.hasta} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; cambiarBarrido((b) => (b.hasta = v)); }} /></label>
              <label>N.º <input name="barrido-pasos" inputmode="numeric" value={barrido.pasos} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; cambiarBarrido((b) => (b.pasos = v)); }} /></label>
              <label>Escala <select name="barrido-escala" value={barrido.escala} onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value as 'lin'; cambiarBarrido((b) => (b.escala = v)); }}><option value="lin">lineal</option><option value="log">logarítmica</option></select></label>
            </div>
          {/if}
          {@const vb = valoresBarrido(ed.doc, barrido)}
          <p class="nota-barrido">{'error' in vb ? vb.error : `${vb.valores.length} simulaciones: ${vb.valores.map((x) => x.etiqueta.replace(/^.*? = /, '')).join(', ')} (hasta ${MAX_VALORES}).`}</p>
        {/if}
      </div>
    </div>
    {#if ed.doc.directivas.trim() && /^\s*\.(tran|ac|dc|op|noise)|^\s*\.control/im.test(ed.doc.directivas)}
      <p class="nota">Las directivas de la netlist importada traen sus propios análisis; los que marque aquí se añaden a ellos.</p>
    {/if}
    <div class="mando">
      {#if ejecutando && motor.fase === 'simulando'}
        <button class="boton" onclick={detener}>Detener</button>
      {:else}
        <button class="boton primario simular" onclick={() => void simular()} disabled={cargando || motor.fase === 'descargando'}>Simular</button>
      {/if}
      <span class="estado" aria-live="polite">{progresoBarrido || estado}</span>
    </div>
    {#if erc.length}
      <section class="erc" class:parado={paradoPorErc} bind:this={seccionErc} aria-label="Revisión eléctrica">
        <h4>{paradoPorErc ? 'Revisión eléctrica antes de simular' : 'Revisión eléctrica'}</h4>
        {#if paradoPorErc}<p class="nota">Esto suele impedir que ngspice resuelva el circuito. Corríjalo o simule igualmente para ver qué dice.</p>{/if}
        <ul>
          {#each erc as p, i (i)}
            <li class={p.nivel}>
              <strong>{p.titulo}</strong>
              <span>{p.texto}</span>
              {#if p.ids.length}<button class="enlace" onclick={() => (ed.sel = p.ids.filter((x) => ed.existe(x)))}>Señalar en el esquema</button>{/if}
            </li>
          {/each}
        </ul>
        {#if paradoPorErc}<button class="boton" onclick={() => void simular(true)}>Simular de todos modos</button>{/if}
      </section>
    {/if}
    {#if ed.nl.errores.length || ed.nl.avisos.length}
      <ul class="problemas">
        {#each ed.nl.errores as e, i (i)}
          <li class="err"><button class="enlace" onclick={() => e.id && propiedades(e.id)} disabled={!e.id}>{e.texto}</button></li>
        {/each}
        {#each ed.nl.avisos.slice(0, 8) as e, i (i)}
          <li class="av"><button class="enlace" onclick={() => e.id && propiedades(e.id)} disabled={!e.id}>{e.texto}</button></li>
        {/each}
      </ul>
    {/if}
    {#if errorSim}<div class="aviso error" role="alert">{errorSim}</div>{/if}
    {#if resultado?.ejecucion.fallo}<div class="aviso error" role="alert">{resultado.ejecucion.fallo}</div>{/if}
    {#if resultado?.salida.errores.length}
      <div class="aviso error" role="alert">
        <strong>ngspice ha dado errores.</strong>
        {#each resultado.salida.explicaciones as x, k (k)}<p>{x}</p>{/each}
        <ul>{#each resultado.salida.errores.slice(0, 5) as x, k (k)}<li><code>{x}</code></li>{/each}</ul>
      </div>
    {/if}
    {#if convergencia}
      <section class="convergencia" aria-label="Ayuda para la convergencia">
        <h4>ngspice no ha conseguido {convergencia === 'tran' ? 'avanzar en el transitorio' : 'calcular el punto de trabajo'}</h4>
        {#if convergencia === 'op'}
          <p>El punto de trabajo se calcula resolviendo las ecuaciones del circuito por aproximaciones sucesivas (Newton–Raphson). No converge cuando hay nodos sin camino de continua a masa (solo condensadores o entradas), lazos de fuentes de tensión y bobinas, realimentación positiva que admite varias soluciones (biestables, osciladores) o modelos muy no lineales que empiezan lejos de la solución.</p>
        {:else}
          <p>En el transitorio ngspice reduce el paso de tiempo cuando algo cambia muy deprisa; si lo reduce por debajo del mínimo se rinde («timestep too small»). Suele pasar con conmutaciones ideales y bruscas, bobinas que se abren de golpe sin diodo de libre circulación o condensadores grandes cargados al instante.</p>
        {/if}
        <p>Pruebe uno de estos arreglos: cada uno crea una copia del circuito con el cambio (en «Mis circuitos») y la simula; el original no cambia.</p>
        <div class="arreglos">
          {#each listaArreglos as x (x.id)}
            <button class="arreglo" data-arreglo={x.id} onclick={() => void probarArreglo(x)}><strong>{x.titulo}</strong><span>{x.texto}</span></button>
          {/each}
        </div>
      </section>
    {/if}
  </section>

  {#if resultado}
    <section class="resultados" class:viejo={ejecutando} aria-label="Resultados">
      <h3>Resultados</h3>
      {#if sondasSimuladas.length}<p class="nota">Las sondas del esquema eligen las curvas: {sondasSimuladas.join(', ')}.</p>{/if}
      {#if esBarrido}<p class="nota">Barrido: una curva por valor (la leyenda dice cuál); el punto de trabajo, una columna por valor.</p>{/if}
      <Resultados {resultado} preferidos={sondasSimuladas} barrido={esBarrido} />
    </section>
  {/if}

  <section class="netlist">
    <details bind:open={verNetlist}>
      <summary>Netlist generada</summary>
      <div class="netlist-acc">
        <button class="boton" onclick={copiarNetlist}>{copiado ? 'Copiada' : 'Copiar'}</button>
        <button class="boton" onclick={verComoNetlist}>Abrir en el simulador</button>
      </div>
      <pre class="texto-netlist">{ed.nl.texto}</pre>
    </details>
    <details bind:open={verDirectivas}>
      <summary>Directivas SPICE (modelos, parámetros, medidas…)</summary>
      <p class="nota">Texto que se copia tal cual al final de la netlist: <code>.model</code>, <code>.subckt</code>, <code>.param</code>, <code>.meas</code>, <code>.options</code> o un bloque <code>.control</code>.</p>
      <textarea
        class="directivas"
        rows="8"
        spellcheck="false"
        value={ed.doc.directivas}
        onchange={(e) => {
          const v = (e.currentTarget as HTMLTextAreaElement).value;
          ed.cambiar(() => (ed.doc.directivas = v));
        }}
      ></textarea>
    </details>
  </section>
</div>

{#if menu}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="capa-menu" onclick={() => (menu = null)} oncontextmenu={(e) => { e.preventDefault(); menu = null; }}>
    <div class="menu" role="menu" style:left={`${Math.min(menu.x, innerWidth - 230)}px`} style:top={`${Math.min(menu.y, innerHeight - 320)}px`}>
      {#if menu.id}
        {#if ed.unico && CONMUTABLES.has(ed.unico.tipo)}
          {@const u = ed.unico}
          <button role="menuitem" onclick={() => accionMenu(() => { const x = conmutado(u); if (x) ed.cambiarCampo(u.id, x[0], x[1]); })}>{u.tipo.startsWith('PUL') ? (u.campos['pulsado'] === 'si' ? 'Soltar' : 'Pulsar') : 'Conmutar'}</button>
        {/if}
        <button role="menuitem" onclick={() => accionMenu(() => ed.transformar(ed.sel, 'girar'))}>Girar 90° <kbd>R</kbd></button>
        <button role="menuitem" onclick={() => accionMenu(() => ed.transformar(ed.sel, 'reflejar'))}>Reflejar <kbd>X</kbd></button>
        <button role="menuitem" onclick={() => accionMenu(() => ed.duplicar())}>Duplicar <kbd>Ctrl D</kbd></button>
        <button role="menuitem" onclick={() => accionMenu(() => ed.copiar())}>Copiar <kbd>Ctrl C</kbd></button>
        {#if ed.unico}<button role="menuitem" onclick={() => accionMenu(() => propiedades(ed.unico!.id))}>Propiedades…</button>{/if}
        {#if partesSel >= 2}
          {#each ALINEACIONES.slice(0, partesSel >= 3 ? 8 : 6) as [m, t] (m)}<button role="menuitem" onclick={() => alinear(m)}>{t}</button>{/each}
        {/if}
        <button role="menuitem" class="peligro" onclick={() => accionMenu(() => ed.borrar())}>Borrar <kbd>Supr</kbd></button>
      {:else}
        <button role="menuitem" disabled={!ed.hayPortapapeles} onclick={() => accionMenu(() => ed.pegar())}>Pegar <kbd>Ctrl V</kbd></button>
        <button role="menuitem" onclick={() => accionMenu(() => ed.seleccionarTodo())}>Seleccionar todo <kbd>Ctrl A</kbd></button>
        <button role="menuitem" onclick={() => accionMenu(() => lienzo?.ajustar())}>Ver todo <kbd>F</kbd></button>
        <button role="menuitem" disabled={!ed.doc.componentes.length} onclick={() => void ordenar()}>Ordenar el esquema</button>
      {/if}
    </div>
  </div>
{/if}

{#if verCircuitos}
  <MisCircuitos cerrar={() => (verCircuitos = false)} actual={idGuardado} />
{/if}

<style>
  .editor-pagina {
    max-width: 1600px;
    margin: 0 auto;
    padding: 6px 16px 60px;
    font-family: var(--sans);
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin: 10px 0 8px;
  }
  .titulo {
    min-width: 0;
  }
  h1 {
    margin: 0;
    font-size: clamp(20px, 2.6vw, 26px);
    line-height: 1.2;
    color: var(--titulos);
    overflow-wrap: anywhere;
  }
  .estado-guardado {
    font-size: 13px;
    color: var(--tinta-tenue);
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .botones .boton {
    min-height: 40px;
  }
  .archivo {
    display: contents;
  }
  .archivo.desplegado {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
  }
  .mesa {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .mesa.lateral {
    grid-template-columns: 184px minmax(0, 1fr) 264px;
    align-items: start;
  }
  .col-paleta,
  .col-prop {
    position: sticky;
    top: calc(var(--alto-barra) + 8px);
    max-height: calc(100vh - var(--alto-barra) - 24px);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .col-prop {
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 8px 10px;
    border: 1px solid var(--linea-suave);
    border-radius: 12px;
    background: var(--superficie);
  }
  .centro {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .herramientas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 2px;
  }
  .modo {
    display: flex;
    gap: 4px;
  }
  .chip {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font: 600 13.5px var(--sans);
  }
  .chip[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .chip:disabled {
    opacity: 0.45;
  }
  .sep {
    width: 1px;
    height: 26px;
    margin: 0 4px;
    background: var(--linea-suave);
  }
  .hb {
    display: grid;
    place-items: center;
    width: 40px;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: none;
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
  .zona {
    height: clamp(360px, calc(100vh - var(--alto-barra) - 190px), 900px);
    border: 1px solid var(--linea-suave);
    border-radius: 12px;
    overflow: hidden;
  }
  .zona.oculta {
    display: none;
  }
  .cargando {
    padding: 40px;
    text-align: center;
    color: var(--tinta-tenue);
  }
  .analisis,
  .resultados,
  .netlist {
    margin-top: 18px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: var(--titulos);
  }
  .tarjetas {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .an {
    display: grid;
    gap: 6px;
    align-content: start;
    padding: 8px 12px;
    border: 1px solid var(--linea-suave);
    border-radius: 10px;
    background: var(--superficie);
    font-size: 14px;
  }
  .an label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
  }
  .an input[type='checkbox'] {
    width: 18px;
    height: 18px;
  }
  .params {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
  }
  .params label {
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .params input,
  .params select {
    width: 84px;
    min-height: 36px;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta);
    font: 14px var(--sans);
  }
  .params select {
    width: auto;
  }
  .params .ch input {
    width: 18px;
  }
  code {
    font-family: var(--mono);
    font-size: 0.92em;
    color: var(--tinta-suave);
  }
  .mando {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }
  .simular {
    min-width: 120px;
    justify-content: center;
  }
  .estado {
    font-size: 13.5px;
    color: var(--tinta-suave);
  }
  .problemas {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: 13.5px;
  }
  .problemas .enlace {
    padding: 2px 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .problemas .err .enlace {
    color: var(--c-precaucion);
  }
  .problemas .av .enlace {
    color: var(--c-importante);
  }
  .problemas .enlace:disabled {
    cursor: default;
  }
  .aviso {
    margin: 10px 0;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--c-importante) 45%, transparent);
    background: color-mix(in srgb, var(--c-importante) 9%, var(--superficie));
    font-size: 14px;
  }
  .aviso.error {
    border-color: color-mix(in srgb, var(--c-precaucion) 45%, transparent);
    background: color-mix(in srgb, var(--c-precaucion) 8%, var(--superficie));
  }
  .enlace {
    border: 0;
    background: none;
    color: var(--acento);
    font-weight: 600;
  }
  .nota {
    margin: 6px 0;
    font-size: 13.5px;
    color: var(--tinta-suave);
  }
  .aviso-desfase {
    color: var(--c-importante);
  }
  .alinear-caja {
    position: relative;
  }
  .menu-alinear {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 30;
    display: grid;
    min-width: 220px;
    padding: 6px;
    border: 1px solid var(--linea-suave);
    border-radius: 12px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .menu-alinear button {
    min-height: 40px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta);
    font: 14px var(--sans);
    text-align: left;
  }
  .menu-alinear button:hover:not(:disabled) {
    background: var(--hover);
  }
  .menu-alinear button:disabled {
    opacity: 0.4;
  }
  .mandos {
    padding: 10px 12px;
    border: 1px solid var(--linea-suave);
    border-radius: 12px;
    background: var(--superficie);
  }
  .lista-mandos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 6px 16px;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 60;
    transform: translateX(-50%);
    max-width: min(90vw, 420px);
    margin: 0;
    padding: 8px 16px;
    border-radius: 999px;
    background: var(--tinta);
    color: var(--superficie);
    font: 600 14px var(--sans);
    box-shadow: var(--sombra-alta);
    pointer-events: none;
  }
  .barrido .params .ancho {
    flex: 1 1 220px;
  }
  .barrido .params .ancho input {
    width: 100%;
    min-width: 160px;
  }
  .nota-barrido {
    margin: 0;
    max-width: 520px;
    font-size: 12.5px;
    color: var(--tinta-tenue);
  }
  .erc,
  .convergencia {
    margin-top: 12px;
    padding: 10px 14px;
    border: 1px solid var(--linea-suave);
    border-radius: 12px;
    background: var(--superficie);
    font-size: 14px;
  }
  .erc.parado {
    border-color: color-mix(in srgb, var(--c-precaucion) 55%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-precaucion) 12%, transparent);
  }
  .erc h4,
  .convergencia h4 {
    margin: 0 0 6px;
    font-size: 14.5px;
    color: var(--titulos);
  }
  .erc ul {
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }
  .erc li {
    display: grid;
    gap: 2px;
    padding: 6px 10px;
    border-left: 4px solid var(--linea);
    border-radius: 6px;
    background: var(--fondo);
    line-height: 1.4;
  }
  .erc li.error {
    border-left-color: var(--c-precaucion);
  }
  .erc li.aviso {
    border-left-color: var(--c-importante);
  }
  .erc li .enlace {
    justify-self: start;
    padding: 2px 0;
    font-size: 13px;
  }
  .convergencia p {
    margin: 4px 0;
    line-height: 1.45;
  }
  .arreglos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .arreglo {
    display: grid;
    align-content: start;
    gap: 3px;
    padding: 8px 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 10px;
    background: var(--acento-tinte);
    color: var(--tinta);
    font: 13px/1.4 var(--sans);
    text-align: left;
    cursor: pointer;
  }
  .arreglo strong {
    color: var(--acento);
    font-size: 14px;
  }
  .resultados.viejo {
    opacity: 0.6;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 14.5px;
    color: var(--tinta-suave);
    padding: 8px 0;
  }
  .netlist-acc {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }
  .texto-netlist,
  .directivas {
    width: 100%;
    box-sizing: border-box;
    max-height: 420px;
    overflow: auto;
    margin: 0;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: var(--codigo-fondo);
    color: var(--tinta);
    font-family: var(--mono);
    font-size: 12.5px;
    line-height: 1.45;
    white-space: pre;
    user-select: text;
  }
  .directivas {
    border: 1px solid var(--linea);
    resize: vertical;
  }
  .capa-menu {
    position: fixed;
    inset: 0;
    z-index: 55;
  }
  .menu {
    position: fixed;
    min-width: 210px;
    padding: 6px;
    border: 1px solid var(--linea-suave);
    border-radius: 12px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    display: grid;
  }
  .menu button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta);
    font: 14.5px var(--sans);
    text-align: left;
  }
  .menu button:hover:not(:disabled) {
    background: var(--hover);
  }
  .menu button:disabled {
    opacity: 0.4;
  }
  .menu .peligro {
    color: var(--c-precaucion);
  }
  kbd {
    font: 12px var(--mono);
    color: var(--tinta-tenue);
  }
  /* Tablets in portrait and phones: canvas, then the properties under it. */
  @media (max-width: 1023px) {
    .zona {
      height: clamp(320px, 58vh, 720px);
    }
    .col-prop {
      position: static;
      max-height: none;
    }
  }
  @media (max-width: 599px) {
    .editor-pagina {
      padding: 4px 10px 60px;
    }
    .botones .boton {
      min-height: 38px;
      padding: 0 11px;
      font-size: 13.5px;
    }
    .hb {
      width: 42px;
      height: 42px;
    }
    .sep {
      display: none;
    }
  }
</style>
