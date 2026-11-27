<script lang="ts">
  // 1.3 (averias13): «Busque la avería» — a console with a hidden fault from its lesson of faults («Consolas por
  // dentro»): the reader puts the simulated Brymen's red and black leads on pads of the real board (the photo of the
  // bare board, or the board in 3D), reads what the fault leaves there, and names the faulty part; found, the fault is
  // explained with the sources the lesson cites. The model, the faults, the values and the sources are the lesson's
  // (lib/averias-placa/modelo.ts); the board's nets of each measurement, definiciones.ts. A list of test points does
  // everything from the keyboard or a screen reader.
  //
  // Embeddable (a lesson card can use it): props `maquina` (or `definicion`), `averia` (the fault's id in the lesson;
  // none: one at random, with «Otra avería»), `objetivo` (the goal's text; none: the lesson card's), `vista` and
  // `alResolver` (called once with the outcome when the reader names the right part).
  import { onMount, untrack } from 'svelte';
  import { leerJSON } from '../../../lib/datos';
  import { averiaPorId, averiasDe } from '../../../lib/averias-placa/definiciones';
  import {
    ajusteAfin,
    ajusteProyectivo,
    aplicarAfin,
    aplicarProyectivo,
    citasDe,
    describirPad,
    diagnosticar,
    evaluarModelo,
    lectura,
    padsDe,
    plano,
    type Afin,
    type Proyectiva,
    type Diagnostico,
    type LeccionJson,
    type Modo,
    type PuntoPad,
    type Resultado,
  } from '../../../lib/averias-placa/modelo';
  import { cargarMaquina, fotosDe, type DatosMaquina } from '../datos';
  import { cargarPlacaConsola, type DatosPlacaConsola } from '../placa/datos';
  import { construirGeometria, type Geometria } from '../../proyectos/geometria';
  import { cargarFotosCaras } from '../../proyectos/fotos-caras';
  import { soporteWebGL2 } from '../../tres/motor/soporte';
  import { app } from '../../../lib/estado.svelte';
  import type { Escena3D } from '../../proyectos/escena3d';
  import { candidatoConHisteresis, elevacion } from '../../colocar/precision';
  import { vibrarAterrizaje, vibrarCambio } from '../../colocar/haptica';
  import { Brymen } from '../../instrumentos/brymen/logica.svelte';
  import BrymenVista from '../../instrumentos/brymen/Brymen.svelte';
  import { BM_POSICIONES } from '../../instrumentos/motor/dmm';
  import FotoAveria, { type PadFoto, type Punta } from './FotoAveria.svelte';
  import ErrorCarga from '../../ErrorCarga.svelte';

  let {
    maquina,
    definicion,
    averia,
    objetivo,
    vista: vistaInicial,
    alResolver,
  }: {
    maquina: string;
    /** A definition's id (default: the console's first). */
    definicion?: string;
    /** The fault's id in the lesson card (default: one at random). */
    averia?: string;
    /** The goal shown (default: the lesson card's text). */
    objetivo?: string;
    vista?: 'foto' | '3d';
    /** Called when the reader names the faulty part. */
    alResolver?: (r: { averia: string; fallo: string; intentos: number; medidas: string[] }) => void;
  } = $props();

  const def = $derived((definicion ? averiaPorId(definicion) : null) ?? averiasDe(maquina)[0] ?? null);

  let leccion = $state.raw<LeccionJson | null>(null);
  let datos = $state.raw<DatosMaquina | null>(null);
  let placa = $state.raw<DatosPlacaConsola | null>(null);
  let geo = $state.raw<Geometria | null>(null);
  let error = $state('');
  let intento = $state(0);
  // (1.3, motor13b: the list of test points starts open on a wide screen and then stays as the reader leaves it — a
  // plain `open={…}` was set again on every reading, so on a phone the list closed after each point chosen)
  let listaAbierta = $state(untrack(() => !app.movil));

  $effect(() => {
    const d = def;
    void intento;
    if (!d) return;
    let vivo = true;
    error = '';
    Promise.all([leerJSON<LeccionJson>(`lecciones11/${d.leccion.parte}/${d.leccion.seccion}.json`), cargarMaquina(d.maquina as DatosMaquina['id']), cargarPlacaConsola(d.placa)])
      .then(async ([l, m, p]) => {
        const g = construirGeometria(p);
        await cargarFotosCaras(p, g);
        if (!vivo) return;
        leccion = l;
        datos = m;
        placa = p;
        geo = g;
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  const tarjeta = $derived(leccion && def ? (leccion.tarjetas.find((t) => t.id === def.leccion.tarjeta) ?? null) : null);
  const act = $derived(tarjeta?.actividad ?? null);
  const pads = $derived(placa ? padsDe(placa) : []);
  const porId = $derived(new Map(pads.map((p) => [p.id, p])));

  // ---------------------------------------------------------------- the hidden fault
  let falloId = $state<string | null>(null);
  $effect(() => {
    const a = act;
    if (!a || untrack(() => falloId)) return;
    untrack(() => (falloId = averia && a.fallos.some((f) => f.id === averia) ? averia : a.fallos[Math.floor(Math.random() * a.fallos.length)]!.id));
  });
  const fallo = $derived(act?.fallos.find((f) => f.id === falloId) ?? null);
  const valores = $derived(leccion && fallo ? evaluarModelo(leccion.modelo, fallo.con) : null);

  function otraAveria() {
    const a = act;
    if (!a) return;
    const otras = a.fallos.filter((f) => f.id !== falloId);
    falloId = otras[Math.floor(Math.random() * otras.length)]?.id ?? falloId;
    medidas = new Set();
    diag = null;
    intentos = 0;
    resuelta = false;
    puntas = { roja: null, negra: null };
    anuncio = 'Otra avería escondida: empiece a medir.';
  }

  // ---------------------------------------------------------------- the leads, the console, the meter
  let puntas = $state<Record<Punta, string | null>>({ roja: null, negra: null });
  let activa = $state<Punta>('roja');
  let encendida = $state(true);
  const bm = new Brymen();
  const POS_V = BM_POSICIONES.findIndex((p) => p.id === 'vdc');
  const POS_OHM = BM_POSICIONES.findIndex((p) => p.id === 'ohm');
  const posicion = $derived(BM_POSICIONES[bm.pos]?.id ?? 'off');
  const modo = $derived<Modo | null>(posicion === 'vdc' ? 'V' : posicion === 'ohm' ? 'Ω' : null);

  function poner(p: Punta, pad: string) {
    puntas = { ...puntas, [p]: pad };
    // the other lead goes in hand next (the tap–tap flow: red, then black)
    if (p === activa && !puntas[p === 'roja' ? 'negra' : 'roja']) activa = p === 'roja' ? 'negra' : 'roja';
    const x = porId.get(pad);
    if (x && def) anuncio = `${p === 'roja' ? 'Punta roja' : 'Punta negra'}: ${describirPad(def, x)}.`;
  }

  const red = (p: Punta) => (puntas[p] ? (porId.get(puntas[p]!)?.red ?? null) : null);
  const resultado = $derived.by((): Resultado | null => {
    if (!def || !leccion || !valores || !modo) return null;
    return lectura(def, leccion, valores, red('roja'), red('negra'), modo, encendida);
  });

  let medidas = $state(new Set<string>());
  $effect(() => {
    const r = resultado;
    if (r?.tipo === 'valor' && r.sonda && puntas.roja && puntas.negra && !medidas.has(r.sonda)) untrack(() => (medidas = new Set([...medidas, r.sonda!])));
  });

  // the meter reads five times a second (with its own last-digit noise)
  onMount(() => {
    const t = setInterval(() => {
      const r = untrack(() => resultado);
      if (posicion === 'off') return bm.leer(null);
      if (!r) return bm.leer({ v: 0, i: 0 });
      if (r.tipo !== 'valor') {
        bm.pantalla = { principal: null, secundaria: null, barra: null, marcas: [], mensaje: '------', pitido: false };
        return;
      }
      if (r.unidad === 'V') bm.leer({ v: r.valor, i: 0 });
      else bm.leer(Number.isFinite(r.valor) ? { v: r.valor * 1e-3, i: -1e-3 } : { v: 0, i: 0 });
    }, 200);
    return () => clearInterval(t);
  });

  function fmt(x: number, u: string): string {
    if (u === 'Ω' || u === 'Ω') return !Number.isFinite(x) || x >= 1e8 ? 'OL (abierto)' : `${x.toLocaleString('es-ES', { maximumFractionDigits: 2 })} Ω`;
    return `${(Math.abs(x) < 1e-9 ? 0 : x).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('-', '−')} ${u}`;
  }

  const textoLectura = $derived.by(() => {
    if (!def) return '';
    if (posicion === 'off') return 'El polímetro está apagado: gire el selector a V⎓ o a Ω.';
    if (!modo) return 'Para esta avería se mide en V⎓ (tensión continua) o en Ω (resistencia): gire el selector.';
    const r = resultado;
    if (!puntas.roja || !puntas.negra) return `Ponga las dos puntas: ${!puntas.roja ? 'la roja' : 'la negra'} todavía no toca la placa.`;
    if (!r) return '';
    const sitio = (p: Punta) => describirPad(def, porId.get(puntas[p]!)!);
    const base = `Roja en ${sitio('roja')}; negra en ${sitio('negra')}`;
    if (r.tipo === 'aviso') return `${base}. ${r.texto}`;
    if (r.tipo === 'sin-dato') return `${base}: sin dato. ${r.motivo}`;
    const s = r.sonda ? act?.sondas.find((x) => x.id === r.sonda) : null;
    const estado = r.unidad === 'V' && !encendida ? ' (consola apagada)' : '';
    return `${base}: ${fmt(r.valor, r.unidad)}${estado}.${s ? ` Es la medida «${plano(s.rotulo)}» de la lección.` : ''}`;
  });
  /** Why a net reads what it reads (the definition's note on the red lead's net). */
  const porQue = $derived.by(() => {
    const n = red('roja');
    return n && def?.tensiones?.[n] && encendida && modo === 'V' ? def.tensiones[n]!.porque : '';
  });

  // ---------------------------------------------------------------- the diagnosis
  let diag = $state<(Diagnostico & { sospechoso: string }) | null>(null);
  let intentos = $state(0);
  let resuelta = $state(false);
  function senalar(id: string) {
    if (!def || !leccion || !tarjeta || !fallo) return;
    if (!medidas.size) {
      diag = { bien: false, texto: 'Mida antes de señalar: ponga las dos puntas en un punto de la lista o de la placa.', sospechoso: id };
      return;
    }
    intentos++;
    const d = diagnosticar(def, leccion, tarjeta, fallo, id, medidas, fmt);
    diag = { ...d, sospechoso: id };
    if (d.bien && !resuelta) {
      resuelta = true;
      alResolver?.({ averia: def.id, fallo: fallo.id, intentos, medidas: [...medidas] });
    }
  }
  const citas = $derived(leccion && tarjeta ? citasDe(leccion, tarjeta) : []);

  // ---------------------------------------------------------------- the views
  const webgl = soporteWebGL2();
  const fotoDatos = $derived(def?.foto && datos ? (fotosDe(datos).find((f) => f.id === def.foto!.id) ?? null) : null);
  let vista = $state<'foto' | '3d'>(untrack(() => vistaInicial ?? 'foto'));
  $effect(() => {
    if (datos && !fotoDatos && vista === 'foto') vista = '3d';
  });

  const paresFoto = $derived.by((): [[number, number], [number, number]][] => {
    const f = fotoDatos;
    if (!f?.posiciones || !placa) return [];
    const pares: [[number, number], [number, number]][] = [];
    for (const [r, q] of Object.entries(f.posiciones)) {
      const h = placa.huellas.find((x) => x.r === r);
      if (h) pares.push([[h.x, h.y], q]);
    }
    return pares;
  });
  // (the affine map gives the pads' size; the positions use a projective map, 1.4: the Super Nintendo's PAL photos
  // are iFixit's, taken at a slight angle, where an affine map leaves pads several pixels off)
  const afin = $derived.by((): Afin | null => ajusteAfin(paresFoto));
  const proyectiva = $derived.by((): Proyectiva | null => ajusteProyectivo(paresFoto));
  const enLaFoto = (x: number, y: number): [number, number] => (proyectiva ? aplicarProyectivo(proyectiva, x, y) : aplicarAfin(afin!, x, y));
  const padsFoto = $derived.by((): PadFoto[] => {
    const a = afin;
    const lado = def?.foto?.lado ?? 'F';
    if (!a) return [];
    return pads.filter((p) => p[lado] && p.red).map((p) => {
      const [x, y] = enLaFoto(p.x, p.y);
      return { id: p.id, x, y };
    });
  });
  function cajaRefs(refs: string[]): [number, number, number, number] | null {
    const ps = pads.filter((p) => refs.includes(p.ref));
    if (!ps.length) return null;
    return [Math.min(...ps.map((p) => p.x)), Math.min(...ps.map((p) => p.y)), Math.max(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.y))];
  }
  function enFoto(b: [number, number, number, number], margen: number): [number, number, number, number] | null {
    const a = afin;
    if (!a) return null;
    const p = [enLaFoto(b[0], b[1]), enLaFoto(b[2], b[3])];
    return [Math.min(p[0]![0], p[1]![0]) - margen, Math.min(p[0]![1], p[1]![1]) - margen, Math.max(p[0]![0], p[1]![0]) + margen, Math.max(p[0]![1], p[1]![1]) + margen];
  }
  const encuadreFoto = $derived.by((): [number, number, number, number] => {
    const b = def ? cajaRefs(def.encuadre) : null;
    return (b && enFoto(b, 60)) ?? [0, 0, fotoDatos?.ancho ?? 100, fotoDatos?.alto ?? 100];
  });
  const pasoFoto = $derived(afin ? Math.hypot(afin[0], afin[3]) * 254 : 21);
  const piezasMarcadas = $derived(resuelta && fallo && def ? (def.piezas[fallo.pieza] ?? []) : []);
  const marcadasFoto = $derived.by(() => {
    const b = piezasMarcadas.length ? cajaRefs(piezasMarcadas) : null;
    const f = b && enFoto(b, 18);
    return f ? [f] : [];
  });

  const nombrePad = (id: string) => {
    const p = porId.get(id);
    return p && def ? describirPad(def, p) : id;
  };

  // ---------------------------------------------------------------- 3D: the leads as 3D tips, dragged on the board
  let escena = $state.raw<Escena3D | null>(null);
  let marco: HTMLDivElement | undefined = $state();
  let cuadro = $state(0);
  const opciones3d = $state({ capas: { F: true, B: true, mascara: true, serigrafia: true, componentes: true }, acabado: 'hasl' as const, explosion: 0, rayosX: false, tensiones: false });
  const COLOR: Record<Punta, string> = { roja: '#d93025', negra: '#1d1d1f' };
  const lienzo = () => marco?.querySelector('canvas') ?? null;

  function enCara(p: PuntoPad, e: Escena3D): boolean {
    return p[e.caraArriba];
  }
  /** Client px of a pad in 3D (relative to the canvas). */
  function proyectado(p: PuntoPad, e: Escena3D): [number, number] | null {
    const c = lienzo();
    if (!c) return null;
    return e.proyectarPunto(p.x, p.y, e.caraArriba, c.clientWidth, c.clientHeight);
  }
  function cercanos3D(x: number, y: number, radio: number): { id: string; x: number; y: number }[] {
    const e = escena;
    if (!e) return [];
    const res: { id: string; x: number; y: number }[] = [];
    for (const p of pads) {
      if (!p.red || !enCara(p, e)) continue;
      const q = proyectado(p, e);
      if (q && Math.abs(q[0] - x) <= radio && Math.abs(q[1] - y) <= radio) res.push({ id: p.id, x: q[0], y: q[1] });
    }
    return res;
  }
  let info3d = $state('');
  /** A single tap on the 3D board: the pad under it gets the lead in hand (pads too close for a finger: zoom in). */
  function toque3D(x: number, y: number, tipo: string): boolean {
    const e = escena;
    const c = lienzo();
    if (!e || !c) return false;
    const radio = tipo === 'mouse' ? 10 : 22;
    const cs = cercanos3D(x, y, radio * 2).map((q) => ({ ...q, d: Math.hypot(q.x - x, q.y - y) })).sort((a, b) => a.d - b.d);
    const q = cs[0];
    if (!q || q.d > radio) return false;
    const minimo = tipo === 'mouse' ? 8 : 18;
    if (cs[1] && cs[1].d - q.d < minimo / 2 && Math.hypot(cs[1].x - q.x, cs[1].y - q.y) < minimo) {
      e.acercar(x, y, c.clientWidth, c.clientHeight);
      info3d = 'Acercado: los pads eran muy pequeños para el dedo. Toque otra vez el que quiera.';
      return true;
    }
    poner(activa, q.id);
    info3d = nombrePad(q.id);
    return true;
  }
  // the 3D tips follow the leads (and the face turned up)
  $effect(() => {
    const e = escena;
    void cuadro;
    if (!e) return;
    for (const p of ['roja', 'negra'] as const) {
      const g = arrastre3d;
      const id = g && g.p === p ? g.pad : puntas[p];
      const pad = id ? porId.get(id) : null;
      if (pad) e.marcar(p, pad.x, pad.y, pad[e.caraArriba] ? e.caraArriba : pad.F ? 'F' : 'B', COLOR[p]);
      else e.marcar(p, null, 0, 'F', '');
    }
  });
  const asas = $derived.by(() => {
    void cuadro;
    const e = escena;
    if (!e) return [];
    const res: { p: Punta; x: number; y: number }[] = [];
    for (const p of ['roja', 'negra'] as const) {
      const pad = puntas[p] ? porId.get(puntas[p]!) : null;
      const q = pad ? proyectado(pad, e) : null;
      if (q) res.push({ p, x: q[0], y: q[1] });
    }
    return res;
  });
  let arrastre3d = $state<{ p: Punta; pad: string | null; id: number; dedo: { x: number; y: number } | null; desde: [number, number]; movido: boolean } | null>(null);
  function agarrar3D(ev: PointerEvent, p0: Punta) {
    ev.stopPropagation();
    // (two handles overlapping, a lead on each contact of a jack: the one whose centre is nearer the finger)
    const c = lienzo()?.getBoundingClientRect();
    const p = c ? ([...asas].sort((u, v) => Math.hypot(u.x + c.left - ev.clientX, u.y + c.top - ev.clientY) - Math.hypot(v.x + c.left - ev.clientX, v.y + c.top - ev.clientY))[0]?.p ?? p0) : p0;
    try {
      (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic */
    }
    arrastre3d = { p, pad: puntas[p], id: ev.pointerId, dedo: null, desde: [ev.clientX, ev.clientY], movido: false };
  }
  function mover3D(ev: PointerEvent) {
    const g = arrastre3d;
    const c = lienzo();
    if (!g || ev.pointerId !== g.id || !c) return;
    if (!g.movido && Math.hypot(ev.clientX - g.desde[0], ev.clientY - g.desde[1]) < (ev.pointerType === 'mouse' ? 4 : 9)) return;
    g.movido = true;
    const r = c.getBoundingClientRect();
    const t = { x: ev.clientX - r.left, y: ev.clientY - r.top - elevacion(ev.pointerType) };
    const cand = candidatoConHisteresis(cercanos3D(t.x, t.y, 60), t, g.pad, ev.pointerType === 'touch' ? 10 : 4, 40);
    if (cand && cand.id !== g.pad) vibrarCambio();
    g.pad = cand?.id ?? null;
    g.dedo = t;
    info3d = cand ? nombrePad(cand.id) : 'Fuera de los pads: al soltar se queda donde estaba.';
  }
  function soltar3D(ev: PointerEvent) {
    const g = arrastre3d;
    if (!g || ev.pointerId !== g.id) return;
    arrastre3d = null;
    if (!g.movido) {
      // a tap on a lead's handle: on its own pad it takes that lead in hand; on a pad next to it (the handle is a
      // finger wide), the lead in hand goes there
      const c = lienzo();
      if (c) {
        const r = c.getBoundingClientRect();
        const x = ev.clientX - r.left;
        const y = ev.clientY - r.top;
        const q = cercanos3D(x, y, 30).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        if (q && q.id !== puntas[g.p]) {
          poner(activa, q.id);
          info3d = nombrePad(q.id);
          return;
        }
      }
      activa = g.p;
      info3d = `En la mano: la punta ${g.p}. Arrástrela, o toque un pad para ponerla.`;
      return;
    }
    if (g.pad) {
      poner(g.p, g.pad);
      if (ev.pointerType === 'touch') vibrarAterrizaje();
    } else info3d = 'Se queda donde estaba.';
  }
  const etiqueta3d = $derived.by(() => {
    const g = arrastre3d;
    if (!g?.dedo) return null;
    return { x: g.dedo.x, y: g.dedo.y, t: g.pad ? nombrePad(g.pad) : 'Fuera de los pads', mal: !g.pad };
  });
  const res3d = $derived.by(() => {
    if (!placa) return { huella: null, red: null, pad: null };
    const h = piezasMarcadas[0] ? placa.huellas.findIndex((x) => x.r === piezasMarcadas[0]) : -1;
    const n = red('roja');
    const ri = n ? placa.redes.findIndex((x) => x.n === n) : -1;
    return { huella: h >= 0 ? h : null, red: ri >= 0 ? ri : null, pad: null };
  });
  let enfocada = false;
  $effect(() => {
    const e = escena;
    if (!e || enfocada || !def) return;
    const b = cajaRefs(def.encuadre);
    if (!b) return;
    enfocada = true;
    // (after the board's first frame and its first sizing, which frames the whole board; not once the reader moved it)
    // (Escena3D.enfocar shows about 3,2 times the box: a box of 0,4 of the parts' one leaves them filling the view)
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    const rx = (b[2] - b[0]) * 0.2 + 300;
    const ry = (b[3] - b[1]) * 0.2 + 300;
    void e.placaLista.then(() => setTimeout(() => !e.tocada && e.enfocar([cx - rx, cy - ry, cx + rx, cy + ry]), 400));
  });

  // ---------------------------------------------------------------- keyboard and screen reader: the test points
  let anuncio = $state('');
  function elegirPunto(p: Punta, pad: string) {
    if (!pad) {
      puntas = { ...puntas, [p]: null };
      return;
    }
    poner(p, pad);
  }

  // (tests: the state and the pads' screen points)
  const gl = globalThis as unknown as { __epaAveriaPlaca?: unknown };
  $effect(() => {
    gl.__epaAveriaPlaca = {
      fallo: () => falloId,
      puntas: () => ({ ...puntas }),
      resultado: () => resultado,
      vista: () => vista,
      pad3D: (id: string) => {
        const e = escena;
        const c = lienzo();
        const p = porId.get(id);
        const q = e && p ? proyectado(p, e) : null;
        if (!q || !c) return null;
        const r = c.getBoundingClientRect();
        return [r.left + q[0], r.top + q[1]];
      },
    };
    return () => delete gl.__epaAveriaPlaca;
  });
</script>

{#if !def}
  <p class="sin-averia">Esta consola no tiene una avería documentada con números: no hay modo «Busque la avería».</p>
{:else if error}
  <ErrorCarga titulo="No se pudo preparar la avería." {error} reintentar={() => intento++} />
{:else if !leccion || !placa || !geo || !tarjeta || !act || !fallo}
  <div class="cargando">Cargando la placa y la avería…</div>
{:else}
  {@const g = geo}
  {@const x = placa}
  <section class="averia-placa" aria-labelledby="averia-titulo" data-averia-placa={def.id}>
    <header>
      <p class="fase">Busque la avería</p>
      <h2 id="averia-titulo">{plano(tarjeta.titulo)}</h2>
      <p class="objetivo" data-objetivo-averia>{objetivo ?? plano(tarjeta.texto)}</p>
    </header>
    <div class="rejilla">
      <div class="placa">
        <div class="vistas" role="group" aria-label="Vista de la placa">
          {#if fotoDatos}<button type="button" aria-pressed={vista === 'foto'} onclick={() => (vista = 'foto')} data-vista-averia="foto">Foto</button>{/if}
          {#if webgl}<button type="button" aria-pressed={vista === '3d'} onclick={() => (vista = '3d')} data-vista-averia="3d">Placa en 3D</button>{/if}
        </div>
        <div class="lienzo">
          {#if vista === 'foto' && fotoDatos}
            <FotoAveria src={fotoDatos.src} ancho={fotoDatos.ancho} alto={fotoDatos.alto} pads={padsFoto} {puntas} {activa} {poner} elegir={(p) => (activa = p)} nombre={nombrePad} encuadre={encuadreFoto} marcadas={marcadasFoto} paso={pasoFoto} />
          {:else if webgl}
            {#await import('../../proyectos/Vista3D.svelte')}
              <div class="cargando">Preparando la vista 3D…</div>
            {:then m}
              <div class="tres" bind:this={marco}>
                <m.default datos={x} geo={g} res={res3d} oscuro={app.tema === 'oscuro'} opciones={opciones3d} alElegir={() => {}} alEscena={(e) => (escena = e)} alToque={toque3D} alCuadro={() => cuadro++}>
                  {#snippet encima()}
                    {#each asas as a (a.p)}
                      <button
                        type="button"
                        class="asa-3d"
                        class:activa={activa === a.p}
                        style:left={`${a.x}px`}
                        style:top={`${a.y}px`}
                        style:--c={COLOR[a.p]}
                        aria-label={`Punta ${a.p}: arrástrela a otro pad`}
                        data-asa-3d={a.p}
                        onpointerdown={(e) => agarrar3D(e, a.p)}
                        onpointermove={mover3D}
                        onpointerup={soltar3D}
                        onpointercancel={() => (arrastre3d = null)}
                      ></button>
                    {/each}
                    {#if etiqueta3d}
                      <p class="etiqueta-3d" class:mal={etiqueta3d.mal} style:left={`${etiqueta3d.x}px`} style:top={`${etiqueta3d.y}px`} data-destino={etiqueta3d.t}>{etiqueta3d.t}</p>
                    {/if}
                    {#if info3d}<p class="info-3d" aria-live="polite">{info3d}</p>{/if}
                  {/snippet}
                </m.default>
              </div>
            {:catch e}
              <ErrorCarga titulo="No se pudo abrir la vista 3D." error={e} />
            {/await}
          {:else}
            <p class="nota">Este equipo no ofrece WebGL 2: use la lista de puntos de prueba.</p>
          {/if}
        </div>
      </div>

      <div class="mando">
        <div class="fila">
          <div class="segmentos" role="radiogroup" aria-label="La consola">
            <button type="button" role="radio" aria-checked={encendida} onclick={() => (encendida = true)} data-encendida="si">Enchufada y encendida</button>
            <button type="button" role="radio" aria-checked={!encendida} onclick={() => (encendida = false)} data-encendida="no">Apagada y desenchufada</button>
          </div>
        </div>
        <div class="fila puntas" role="group" aria-label="Punta en la mano">
          <button type="button" class="punta roja" aria-pressed={activa === 'roja'} onclick={() => (activa = 'roja')} data-mano="roja">Punta roja{puntas.roja ? ` · ${puntas.roja}` : ''}</button>
          <button type="button" class="punta negra" aria-pressed={activa === 'negra'} onclick={() => (activa = 'negra')} data-mano="negra">Punta negra{puntas.negra ? ` · ${puntas.negra}` : ''}</button>
        </div>
        <div class="medidor">
          <div class="brymen"><BrymenVista m={bm} /></div>
          <div class="lado-medidor">
            <div class="funciones" role="group" aria-label="Función del polímetro">
              <button type="button" aria-pressed={posicion === 'vdc'} onclick={() => bm.girar(POS_V)} data-funcion="V">V⎓</button>
              <button type="button" aria-pressed={posicion === 'ohm'} onclick={() => bm.girar(POS_OHM)} data-funcion="Ω">Ω</button>
            </div>
            <p class="lectura" aria-live="polite" data-lectura-averia>{textoLectura}</p>
            {#if porQue}<p class="porque">{porQue}</p>{/if}
          </div>
        </div>

        <details class="puntos" bind:open={listaAbierta}>
          <summary>Puntos de prueba (también con el teclado)</summary>
          <label>
            <span>Punta roja</span>
            <select value={puntas.roja ?? ''} onchange={(e) => elegirPunto('roja', (e.currentTarget as HTMLSelectElement).value)} data-select-punta="roja">
              <option value="">Sin poner</option>
              {#each def.puntos as p (p.pad)}<option value={p.pad}>{p.rotulo}</option>{/each}
            </select>
          </label>
          <label>
            <span>Punta negra</span>
            <select value={puntas.negra ?? ''} onchange={(e) => elegirPunto('negra', (e.currentTarget as HTMLSelectElement).value)} data-select-punta="negra">
              <option value="">Sin poner</option>
              {#each def.puntos as p (p.pad)}<option value={p.pad}>{p.rotulo}</option>{/each}
            </select>
          </label>
          {#if def.notas?.length}
            <ul class="notas">{#each def.notas as n (n)}<li>{n}</li>{/each}</ul>
          {/if}
        </details>

        <section class="diagnostico" aria-labelledby="averia-pieza">
          <h3 id="averia-pieza">¿Qué pieza falla?</h3>
          <div class="sospechosos">
            {#each act.sospechosos as s (s.id)}
              <button type="button" class:bien={resuelta && diag?.sospechoso === s.id} onclick={() => senalar(s.id)} data-sospechoso={s.id}>{plano(s.rotulo)}</button>
            {/each}
          </div>
          {#if diag}
            <p class="resultado" class:bien={diag.bien} role="status" data-diagnostico={diag.bien ? 'bien' : 'mal'}>{diag.bien ? '¡Encontrada! ' : ''}{diag.texto}</p>
          {/if}
          {#if resuelta}
            <div class="fuentes" data-fuentes-averia>
              <p>Fuentes:</p>
              <ul>
                {#each citas as c (c.clave)}
                  <li>
                    {#if c.url && /^https?:/.test(c.url)}<a href={c.url} target="_blank" rel="noopener noreferrer">{c.titulo}</a>{:else if c.url}<a href={c.url}>{c.titulo}</a>{:else}{c.titulo}{/if}: «{c.cita}»
                  </li>
                {/each}
              </ul>
              <p class="leccion">De la lección <a href={`#/leccion/${def.leccion.parte}/${def.leccion.seccion}`}>«{plano(leccion.titulo) || def.leccion.seccion}»</a>.</p>
            </div>
            {#if !averia}<button type="button" class="boton" onclick={otraAveria} data-otra-averia>Otra avería</button>{/if}
          {/if}
        </section>
        <p class="solo-lector" aria-live="polite">{anuncio}</p>
      </div>
    </div>
  </section>
{/if}

<style>
  .averia-placa {
    display: grid;
    gap: 10px;
    font-family: var(--sans);
  }
  header .fase {
    margin: 0;
    color: var(--acento);
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  header h2 {
    margin: 2px 0 4px;
    color: var(--titulos);
    font-size: 22px;
  }
  .objetivo {
    margin: 0;
    color: var(--tinta);
  }
  .rejilla {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    gap: 14px;
    align-items: start;
  }
  .placa {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    height: min(72vh, 720px);
    min-height: 340px;
  }
  .lienzo,
  .tres {
    min-height: 0;
    height: 100%;
    position: relative;
  }
  .vistas,
  .segmentos,
  .funciones,
  .sospechosos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .vistas button,
  .segmentos button,
  .funciones button,
  .sospechosos button,
  .puntas button {
    min-height: 48px;
    /* (1.3.1: «Ω» alone was 42 px wide, under a finger's 44) */
    min-width: 48px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-weight: 600;
  }
  .vistas button[aria-pressed='true'],
  .segmentos button[aria-checked='true'],
  .funciones button[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .mando {
    display: grid;
    gap: 10px;
  }
  .puntas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .punta.roja[aria-pressed='true'] {
    border: 2px solid #d93025;
    background: color-mix(in srgb, #d93025 10%, var(--superficie));
  }
  .punta.negra[aria-pressed='true'] {
    border: 2px solid var(--tinta);
    background: color-mix(in srgb, var(--tinta) 8%, var(--superficie));
  }
  .medidor {
    display: grid;
    grid-template-columns: 130px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
  }
  .brymen :global(svg) {
    width: 100%;
    height: auto;
    max-height: 280px;
  }
  .lado-medidor {
    display: grid;
    gap: 8px;
  }
  .lectura {
    margin: 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--superficie-2);
    font-size: 14.5px;
    line-height: 1.35;
  }
  .porque {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .puntos summary {
    min-height: 48px;
    display: flex;
    align-items: center;
    font-weight: 700;
    cursor: pointer;
  }
  .puntos label {
    display: grid;
    gap: 3px;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .puntos select {
    min-height: 48px;
    min-width: 0;
    max-width: 100%;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 15px;
  }
  .notas {
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--tinta-suave);
    font-size: 12.5px;
  }
  .diagnostico h3 {
    margin: 0 0 6px;
    font-size: 16px;
    color: var(--titulos);
  }
  .sospechosos button.bien {
    border-color: var(--c-ejemplo, #1e8449);
    color: var(--c-ejemplo, #1e8449);
  }
  .resultado {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-left: 4px solid var(--c-precaucion);
    border-radius: 6px;
    background: var(--superficie-2);
  }
  .resultado.bien {
    border-left-color: var(--c-ejemplo, #1e8449);
  }
  .fuentes {
    font-size: 13.5px;
  }
  .fuentes p {
    margin: 8px 0 2px;
    font-weight: 700;
  }
  .fuentes ul {
    margin: 0;
    padding-left: 18px;
  }
  .fuentes .leccion {
    font-weight: 400;
  }
  .asa-3d {
    position: absolute;
    width: 48px;
    height: 48px;
    margin: -22px 0 0 -22px;
    padding: 0;
    border: 2px solid var(--c);
    border-radius: 50%;
    background: color-mix(in srgb, var(--c) 14%, transparent);
    touch-action: none;
    cursor: grab;
    z-index: 3;
  }
  .asa-3d.activa {
    box-shadow: 0 0 0 3px #ffd84a;
  }
  .etiqueta-3d {
    position: absolute;
    transform: translate(-50%, calc(-100% - 18px));
    margin: 0;
    padding: 4px 10px;
    border: 2px solid #f2b705;
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: 700 14px/1.25 var(--sans);
    white-space: nowrap;
    pointer-events: none;
    z-index: 4;
  }
  .etiqueta-3d.mal {
    border-color: #d93025;
    /* 1.3.1 (qa131-temas): the theme's red — a fixed #b3261e was 2.4:1 on the dark theme's surface */
    color: var(--v11-rojo, #b3261e);
  }
  .info-3d {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 44px;
    margin: 0;
    padding: 6px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--superficie) 92%, transparent);
    font-size: 13.5px;
    pointer-events: none;
    z-index: 3;
  }
  .cargando,
  .sin-averia {
    padding: 24px;
    color: var(--tinta-suave);
  }
  @media (max-width: 899px) {
    .rejilla {
      grid-template-columns: minmax(0, 1fr);
    }
    .placa {
      height: 58vh;
      min-height: 320px;
    }
  }
  @media (max-width: 599px) {
    .medidor {
      grid-template-columns: 104px minmax(0, 1fr);
    }
    .segmentos button {
      flex: 1 1 0;
      padding: 0 8px;
      font-size: 14px;
    }
  }
</style>
