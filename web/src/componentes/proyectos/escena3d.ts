// The 3D board: FR-4 core with its real thickness and holes, the two faces as textures painted from the
// board vectors (solder mask, copper under the mask, tinned/gold pads, silkscreen; a second map makes the
// exposed pads metallic), plated barrels in every plated hole (one instanced mesh), and the component bodies
// of the model library merged per material (a few draw calls whatever the part count). Layers can be
// exploded apart or seen through (X-ray: both copper layers through a translucent laminate).
// Rendered on demand only; everything created here is disposed by liberar().

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LinearMipmapLinearFilter,
  LinearFilter,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  Box3,
  WebGLRenderer,
  type Material,
  type Texture,
  Box3Helper,
} from 'three';
import { PAD_NPTH, type DatosPlaca, type Huella } from './datos';
import { crearEstudio, type Estudio } from '../tres/motor/estudio';
import { Orbita, type EstadoOrbita } from '../tres/motor/orbita';
import { ResolucionAdaptable, REPOSO, type EstadoResolucion } from '../tres/motor/resolucion';
import type { Geometria, Lado } from './geometria';
import { coloresTension, MASCARAS, pintarLado, pintarRed, type Acabado } from './pintar';
import { datosParaCaras, pintarMapa, type MensajeTrabajador, type PedidoCara, type RespuestaTrabajador, type TipoMapa } from './caras';
import { pintarDirecto, pintarPorBandas, subirPorFranjas, texturaDePixeles, texturaVacia, type Subida } from './texturas-caras';
import { cargarBiblioteca, claveBiblioteca, CON_MARCADO_FIJO, cuerpoSimple, liberarMateriales, marcadoCoincide } from './modelos3d';

export interface Estadisticas {
  ms: number[];
  llamadas: number;
  triangulos: number;
  textura: number;
  piezas: { biblioteca: number; propias: number };
  /** Whether the core's top and bottom are drawn (only with the layers apart: under the faces they fought
   *  with them on GPUs with less depth precision). */
  tapasNucleo?: boolean;
  /** Face shown by the inclined view (the one with most parts). */
  ladoComponentes?: 'F' | 'B';
  /** Where the load time goes (ms): building the models, merging them, the first frame with them (shader
   *  compilation and uploads), and the whole load of the parts; `modelosUnicos`: models built (equal parts
   *  share one). */
  fases?: { modelos: number; fusion: number; compilar: number; primerCuadro: number; piezas: number; modelosUnicos: number; inicio?: number; maxTramo?: number };
  /** Frames drawn since the view opened. */
  cuadros: number;
  /** Shader programs in use after the first frame with the parts (each one is compiled by the GPU driver). */
  programas?: number;
  /** ms from the scene's creation to the full-resolution faces (the first pass is a quick low-resolution one). */
  carasFinas?: number;
  /** Where the faces' time goes (0.8): see FasesCaras. */
  fasesCaras?: FasesCaras;
  /** Adaptive resolution while the view moves (0.8): base and current pixel ratio, lowest used, changes. */
  resolucion?: EstadoResolucion;
  /** 0.8: ms compiling the board's own programs (core, faces, barrels, studio) before its first frame, and
   *  from the scene's creation to that frame. */
  compilarPlaca?: number;
  primerCuadroPlaca?: number;
  /** 0.9: the check of the parts' geometry made while they load (see RevisionPiezas). */
  revision?: RevisionPiezas;
  /** 0.9: programs compiled one per task (no KHR_parallel_shader_compile) and the longest of them (ms). */
  compilacion?: { programas: number; paralela: boolean; maxPrograma: number };
}

/**
 * What cargarPiezas() found while building the parts (0.9). Templates with a NaN or an infinite coordinate, or an
 * absurd vertex count, are refused (the part gets a simple body); so are library models whose pin count is not
 * the footprint's (a 3-lead TO-220 on a 5-pad footprint) or whose leads land off the footprint's pads. Kept in
 * the stats so the tests (and the diagnostic) can assert a board is clean.
 */
export interface RevisionPiezas {
  /** Distinct templates built and the vertices / triangles of the merged meshes. */
  plantillas: number;
  vertices: number;
  triangulos: number;
  /** References whose template had non-finite positions or normals (refused). */
  noFinitas: string[];
  /** References whose template had an absurd size (refused). */
  enormes: string[];
  /** «REF (modelo n patillas, huella m pads)»: library models refused for their pin count. */
  pinesDistintos: string[];
  /** «REF (x,x mm)»: library models refused because a lead landed that far beyond its pad. */
  patasFuera: string[];
  /** Largest distance (mm) a library model's lead lands beyond its footprint pad, over the accepted parts. */
  maxDesvio: number;
  /** Non-finite values found in the merged buffers (always 0 once the templates are checked). */
  fusionNoFinitos: number;
}

/** Callbacks of cargarPiezas(): progress (parts placed / total) and the phase about to start (diagnostic). */
export interface AvisosCarga {
  alProgreso?: (hechas: number, total: number) => void;
  /** «pieza 237: R1», «uniendo», «compilando 2/9», called before each step starts. */
  alFase?: (fase: string) => void;
}

/** A lead this far (mm) beyond its footprint pad means the model does not fit the footprint. */
const TOLERANCIA_PATA = 0.5;
/** More vertices than this in one part's template is a broken model, not a component. */
const MAX_VERTICES_PLANTILLA = 400_000;

/**
 * How the full-resolution faces are painted (0.8). 'directo': as in 0.7 — a canvas of the page per map, uploaded
 * with texImage2D(canvas), one face per task: right where the canvas is rasterised by the GPU and uploaded GPU to
 * GPU (Chromium on the desktop: WebView2), where it costs the page a few ms; Android left it in 0.9.1 (see
 * modoCarasPorDefecto). 'trabajador': painted by a worker
 * (OffscreenCanvas) and uploaded as plain pixels in strips (WebKit: WKWebView, WebKitGTK, where the page's
 * thread rasterised and converted the 4096 px faces for over a second). 'franjas': the same, painted in bands on
 * the page's thread (WebKit without OffscreenCanvas in workers).
 */
export type ModoCaras = 'directo' | 'trabajador' | 'franjas';

/** The mode for this WebView (the key «epa-caras» of localStorage forces one, for tests and comparisons). */
export function modoCarasPorDefecto(): ModoCaras {
  try {
    const m = globalThis.localStorage?.getItem('epa-caras');
    if (m === 'directo' || m === 'trabajador' || m === 'franjas') return m;
  } catch {
    /* no storage */
  }
  // WebKit: the page's thread rasterises and converts a large canvas itself (0.8). Android (0.9.1): the full
  // faces of the Neo Geo and Super Nintendo boards, painted directly on an accelerated canvas, closed the app on
  // the Xiaomi Pad 6 right at «caras a resolución completa» (the WebView's GPU work runs in the app's own process,
  // so a GPU failure takes the app down); the worker paints on a software canvas (willReadFrequently) and the
  // page uploads plain pixels in strips, so the GPU never rasterises those faces.
  return esWebKit() || esAndroid() ? 'trabajador' : 'directo';
}

/** WKWebView, WebKitGTK, Safari (not Chromium-based browsers that say AppleWebKit too). */
export function esWebKit(): boolean {
  const ua = globalThis.navigator?.userAgent ?? '';
  return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/i.test(ua);
}

/** Android's WebView (and Chrome for Android). */
export function esAndroid(): boolean {
  return /Android/i.test(globalThis.navigator?.userAgent ?? '');
}

/**
 * Phases of the faces (ms). `cuarto`: the quick quarter-resolution pass on the page's thread (both faces: drawing
 * calls, read back, upload). `completa`: the full resolution — `modo` 'trabajador' (painted by a worker) or
 * 'franjas' (bands painted on the page's thread, when the WebView has no OffscreenCanvas in workers; `motivo`
 * says why); `geometria`, `pintar`, `leer` (raster flush and copy of the pixels), `voltear`: painting work (in
 * the worker or on the page); `espera`: from asking the worker to having the first face's pixels; `subir`:
 * page-thread time uploading strips (`franjas` of them), `maxTarea`: longest page-thread slice of all this;
 * `total`: from the start of the pass to both faces on screen.
 */
export interface FasesCaras {
  /** The mode used for the full resolution. */
  modo: ModoCaras;
  cuarto: { pintar: number; leer: number; subir: number };
  completa?: {
    modo: ModoCaras;
    motivo?: string;
    geometria: number;
    pintar: number;
    leer: number;
    voltear: number;
    espera: number;
    subir: number;
    /** Waiting, between tasks, for the GPU to take the previous strips (the page is free meanwhile). */
    gpu: number;
    franjas: number;
    maxTarea: number;
    total: number;
  };
}

export interface CapasEscena {
  F: boolean;
  B: boolean;
  mascara: boolean;
  serigrafia: boolean;
  componentes: boolean;
}

type Vista = 'iso' | 'arriba' | 'abajo' | 'lado';

const EPS = 0.035;

export class Escena3D {
  readonly renderer: WebGLRenderer;
  private estudio: Estudio;
  private camara = new PerspectiveCamera(32, 1, 0.1, 4000);
  private orbita: Orbita;
  private placa = new Group();
  private nucleo: Mesh;
  private matNucleo: MeshStandardMaterial;
  /** The core's top and bottom: only drawn with the layers apart (aplicarCapas). */
  private matNucleoTapas: MeshStandardMaterial;
  private caras: Record<Lado, Mesh>;
  private matCaras: Record<Lado, MeshStandardMaterial>;
  private texCaras: Partial<Record<Lado, { color: Texture; pbr: Texture }>> = {};
  private realce: Record<Lado, Mesh>;
  private texRealce: Record<Lado, Texture | null> = { F: null, B: null };
  /** The worker that paints the full-resolution faces (null: not started, or none in this WebView). */
  private trabajador: Worker | null = null;
  private trabajadorOk: Promise<string | null> | null = null;
  private respuestas = new Map<number, (r: RespuestaTrabajador | null) => void>();
  private nPedido = 0;
  /** Generation of the full-resolution faces: a newer pass (or liberar) stops an older one. */
  private generacion = 0;
  /** Version of the faces' options (layers, finish; one per quick pass): maps of an older one are dropped. */
  private versionCaras = 0;
  /** Per face: the version and level (0 placeholder, 1 quick, 2 full) of the maps it shows. */
  private nivelCara: Record<Lado, { v: number; n: number }> = { F: { v: -1, n: 0 }, B: { v: -1, n: 0 } };
  private modo: ModoCaras;
  private barriles: InstancedMesh | null = null;
  private piezas = new Group();
  private cajas: { h: number; caja: Box3 }[] = [];
  private seleccion: Box3Helper | null = null;
  private capasX: Mesh[] = [];
  private liberables: { dispose(): void }[] = [];
  private W: number;
  private H: number;
  private t: number;
  private raf = 0;
  private sucio = true;
  private vivo = true;
  private ladoArriba: Lado = 'F';
  /** The face the inclined view shows: the one with the parts (the CGB-CPU-04 carries nearly all of them on the
   *  bottom, the buttons' face up, and looked empty from the top). */
  readonly ladoComponentes: Lado;
  private giro = { de: 0, a: 0, t0: 0 };
  private explosion = 0;
  private explosionObjetivo = 0;
  private opc: { capas: CapasEscena; acabado: Acabado; rayosX: boolean; tensiones: boolean; red: number | null } = {
    capas: { F: true, B: true, mascara: true, serigrafia: true, componentes: true },
    acabado: 'hasl',
    rayosX: false,
    tensiones: false,
    red: null,
  };
  readonly stats: Estadisticas = { ms: [], llamadas: 0, triangulos: 0, textura: 0, piezas: { biblioteca: 0, propias: 0 }, cuadros: 0 };
  private ladoTextura: number;
  private recursos: { liberar(): void } | null = null;
  /** The faces are the quick low-resolution pass; `refino`: the timer of the full one. */
  private provisional = false;
  private refino = 0;
  private refinarTrasCuadro = false;
  private creada = performance.now();
  private ajustada = false;
  /** Height of the tallest part (mm), for framing. */
  private altoMax = 6;
  /** Set by the view on the first pointer or wheel interaction: then the camera is the user's. */
  tocada = false;
  private blindajes: { o: Object3D; caja: Box3; mat: MeshStandardMaterial }[] = [];
  /** Fewer pixels while the camera moves on a GPU that cannot keep 60 frames per second (0.8). */
  private res: ResolucionAdaptable;
  private despertar = 0;
  /** The camera changed since the last frame (its frame belongs to the movement, however late it comes). */
  private movido = false;
  /** At rest again? Checked in an animation frame: pointer events come aligned with the frames, so while the GPU
   *  stalls a moving camera must not look still. */
  private revisarReposo = (): void => {
    requestAnimationFrame((ts) => {
      if (!this.vivo) return;
      if (this.movido || this.orbita.moviendo(ts, REPOSO) || this.orbita.moviendo(performance.now(), REPOSO)) {
        this.despertar = window.setTimeout(this.revisarReposo, REPOSO);
        return;
      }
      if (this.res.enReposo()) this.pedir();
    });
  };
  /** The board's programs are compiled: no frame before (it would compile them on the spot, blocking). */
  private preparado = false;
  private placaDibujada: () => void = () => {};
  /** Resolves with the board's first frame (0.9: the view without its parts is ready then). */
  readonly placaLista = new Promise<void>((r) => (this.placaDibujada = r));
  alCambiar: () => void = () => {};

  constructor(
    lienzo: HTMLCanvasElement,
    private d: DatosPlaca,
    private g: Geometria,
    oscuro: boolean,
    /** 0.8: how to paint the full-resolution faces (default: modoCarasPorDefecto()). */
    opciones: { modoCaras?: ModoCaras } = {},
  ) {
    this.modo = opciones.modoCaras ?? modoCarasPorDefecto();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new WebGLRenderer({ canvas: lienzo, antialias: dpr < 2, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.res = new ResolucionAdaptable((k) => this.renderer.setPixelRatio(k));
    this.stats.resolucion = this.res.estado;
    this.estudio = crearEstudio(this.renderer);
    this.estudio.ponerFondo(oscuro ? '#15191e' : '#e9e6de', oscuro);
    this.W = d.placa.ancho / 100;
    this.H = d.placa.alto / 100;
    this.t = d.placa.grosor;
    let enF = 0;
    let enB = 0;
    for (const h of d.huellas) if (h.t !== 'mec' && !h.dnp) h.lado === 'B' ? enB++ : enF++;
    this.ladoComponentes = d.placa.lado_componentes ?? (enB > 2 * enF ? 'B' : 'F');
    this.stats.ladoComponentes = this.ladoComponentes;
    const max = this.renderer.capabilities.maxTextureSize;
    // texture resolution: up to 4096 px on the long side (about 21–37 px/mm on these boards)
    this.ladoTextura = Math.min(4096, max);
    this.estudio.raiz.add(this.placa);
    this.estudio.ajustarSombra(this.W * 1.05, this.H * 1.05, -this.t - 0.6);

    // faces: flat outline with UVs over the board, holes from the texture's alpha
    const geoC = new ShapeGeometry(this.formaContorno(), 1);
    this.uvPlaca(geoC);
    this.liberables.push(geoC);

    // Core: the walls of the outline and of every hole, built directly. Until 0.8.0 it was the outline with
    // every hole extruded (ExtrudeGeometry): triangulating its top and bottom with thousands of holes (earcut
    // bridges each hole to the outline) took 2,3 s of the page's thread here for the Neo Geo board and far
    // longer on a tablet, which froze the app on «Preparando la vista 3D…» (0.8.1). Those top and bottom also
    // lay EPS under the faces and fought with them when zooming in on GPUs with less depth precision (the tan
    // core showing through as broken streaks along the tracks).
    const geoN = this.paredesNucleo();
    this.matNucleo = new MeshStandardMaterial({ color: '#cdbb84', roughness: 0.75, metalness: 0, side: DoubleSide });
    this.nucleo = new Mesh(geoN, this.matNucleo);
    this.placa.add(this.nucleo);
    // Its top and bottom, only seen with the layers apart (aplicarCapas): the outline without holes (no
    // triangulation to speak of) with the holes cut by a texture painted when they are first shown.
    this.matNucleoTapas = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, metalness: 0, alphaTest: 0.5, side: DoubleSide });
    this.matNucleoTapas.visible = false;
    for (const z of [-EPS, -this.t + EPS]) {
      const tapa = new Mesh(geoC, this.matNucleoTapas);
      tapa.position.z = z;
      this.placa.add(tapa);
    }
    this.liberables.push(geoN, this.matNucleo, this.matNucleoTapas);
    const cara = (lado: Lado): [Mesh, MeshStandardMaterial] => {
      const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 1, alphaTest: 0.5, side: lado === 'F' ? 0 : 1 });
      const me = new Mesh(geoC, m);
      me.position.z = lado === 'F' ? 0 : -this.t;
      this.placa.add(me);
      this.liberables.push(m);
      return [me, m];
    };
    const [mf, matf] = cara('F');
    const [mb, matb] = cara('B');
    this.caras = { F: mf, B: mb };
    this.matCaras = { F: matf, B: matb };
    // highlight overlays (selected net, voltages), just above each face
    const overlay = (lado: Lado): Mesh => {
      const m = new MeshBasicMaterial({ transparent: true, depthWrite: false, side: lado === 'F' ? 0 : 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const me = new Mesh(geoC, m);
      me.position.z = lado === 'F' ? 0.01 : -this.t - 0.01;
      me.visible = false;
      me.renderOrder = 2;
      this.placa.add(me);
      this.liberables.push(m);
      return me;
    };
    this.realce = { F: overlay('F'), B: overlay('B') };
    this.construirBarriles();
    this.placa.add(this.piezas);

    this.orbita = new Orbita(this.camara, lienzo, () => ((this.movido = true), this.pedir()), () => matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.orbita.maxDist = Math.max(this.W, this.H) * 6;
    this.orbita.minDist = 6;
    this.orbita.alReiniciar = () => this.vista('iso');
    this.vista('iso', false);
    // A quarter of the resolution first (a few ms): the board is on screen at once; the full one follows when
    // the parts are placed (or after a few seconds if nobody loads them), painted by a worker.
    if (this.modo === 'trabajador') this.iniciarTrabajador();
    else if (this.modo === 'franjas') this.trabajadorOk = Promise.resolve('modo franjas');
    // The unpack parameters the strip uploads change, known to three's state cache from now on: its first
    // copyTextureToTexture would otherwise read them with gl.getParameter, a synchronous round trip that waits
    // for every frame queued in the GPU process (seconds with a software GPU).
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    for (const k of [gl.UNPACK_ROW_LENGTH, gl.UNPACK_IMAGE_HEIGHT, gl.UNPACK_SKIP_PIXELS, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_IMAGES]) this.renderer.state.pixelStorei(k, 0);
    this.pintarCaras(0.25);
    this.stats.fasesCaras!.modo = this.modo;
    void this.prepararPlaca();
    this.refino = window.setTimeout(() => void this.refinarCaras(), 4000);
  }

  /**
   * 0.8: the programs of the board itself compiled before its first frame with compileAsync (in parallel and
   * without blocking the page where KHR_parallel_shader_compile exists), as cargarPiezas() already did for
   * the parts; 0.9: without that extension, one program per task (prepararPorPartes).
   */
  private async prepararPlaca(): Promise<void> {
    const t0 = performance.now();
    await this.prepararPorPartes(this.estudio.escena);
    if (!this.vivo) return;
    this.stats.compilarPlaca = performance.now() - t0;
    this.preparado = true;
    this.pedir();
  }

  // ---------------------------------------------------------------- geometry

  /** Board point (u) → model coordinates (mm, y up, origin at the board centre). */
  private p(x: number, y: number): [number, number] {
    return [x / 100 - this.W / 2, this.H / 2 - y / 100];
  }

  /** Holes through the core (plated barrels and unplated drills): centre and radius in board millimetres. */
  private taladrosNucleo(): [number, number, number][] {
    const r: [number, number, number][] = [];
    for (const [x, y, w, h] of this.g.barriles) r.push([...this.p(x, y), Math.max(w, h) / 200]);
    for (const p of this.d.pads) if (p[11] & 8 && p[9] > 0) r.push([...this.p(p[3], p[4]), p[9] / 200]);
    return r;
  }

  /** The core's walls: one band of quads along the outline and around every hole (no caps, no triangulation). */
  private paredesNucleo(): BufferGeometry {
    const z0 = -this.t + EPS;
    const z1 = -EPS;
    const lazos: number[][] = [];
    const pts = this.g.contornoPts;
    const contorno: number[] = [];
    for (let i = 0; i < pts.length; i += 2) contorno.push(...this.p(pts[i]!, pts[i + 1]!));
    lazos.push(contorno);
    for (const [x, y, r] of this.taladrosNucleo()) {
      const n = r > 1 ? 20 : 10;
      const l: number[] = [];
      for (let k = 0; k < n; k++) l.push(x + r * Math.cos((2 * Math.PI * k) / n), y + r * Math.sin((2 * Math.PI * k) / n));
      lazos.push(l);
    }
    let quads = 0;
    for (const l of lazos) quads += l.length / 2;
    const pos = new Float32Array(quads * 18);
    const nor = new Float32Array(quads * 18);
    let o = 0;
    for (const l of lazos) {
      const n = l.length / 2;
      for (let i = 0; i < n; i++) {
        const ax = l[2 * i]!;
        const ay = l[2 * i + 1]!;
        const bx = l[(2 * i + 2) % l.length]!;
        const by = l[(2 * i + 3) % l.length]!;
        // horizontal normal (its sign does not matter: the walls are drawn double-sided)
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const nx = (by - ay) / len;
        const ny = -(bx - ax) / len;
        for (const [x, y, z] of [[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z0], [bx, by, z1], [ax, ay, z1]] as const) {
          pos[o] = x;
          pos[o + 1] = y;
          pos[o + 2] = z;
          nor[o] = nx;
          nor[o + 1] = ny;
          nor[o + 2] = 0;
          o += 3;
        }
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('normal', new BufferAttribute(nor, 3));
    return geo;
  }

  /** Texture of the core's top and bottom: the laminate's colour with every hole punched out (alpha 0). */
  private texturaTapasNucleo(): CanvasTexture {
    const lado = Math.min(2048, this.ladoTextura);
    const k = lado / Math.max(this.W, this.H);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.W * k));
    c.height = Math.max(1, Math.round(this.H * k));
    const x = c.getContext('2d')!;
    x.fillStyle = '#cdbb84';
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-out';
    x.beginPath();
    for (const [X, Y, r] of this.taladrosNucleo()) {
      // board millimetres (centred, y up) to canvas pixels (y down), as uvPlaca maps the outline
      const px = (X + this.W / 2) * k;
      const py = (this.H / 2 - Y) * k;
      x.moveTo(px + r * k, py);
      x.arc(px, py, r * k, 0, 2 * Math.PI);
    }
    x.fill();
    return this.textura(c, true);
  }

  /** The board's outline (the holes are cut by the faces' alpha and drawn by the core's walls). */
  private formaContorno(): Shape {
    const pts = this.g.contornoPts;
    const s = new Shape();
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = this.p(pts[i]!, pts[i + 1]!);
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    return s;
  }

  private uvPlaca(geo: BufferGeometry): void {
    const pos = geo.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[2 * i] = (pos.getX(i) + this.W / 2) / this.W;
      uv[2 * i + 1] = (pos.getY(i) + this.H / 2) / this.H;
    }
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
  }

  private construirBarriles(): void {
    const n = this.g.barriles.length;
    if (!n) return;
    const geo = new CylinderGeometry(1, 1, 1, 14, 1, true);
    geo.rotateX(Math.PI / 2);
    const mat = new MeshStandardMaterial({ color: '#cfd3d6', roughness: 0.3, metalness: 1, side: DoubleSide });
    const im = new InstancedMesh(geo, mat, n);
    const m = new Matrix4();
    this.g.barriles.forEach(([x, y, w, h], i) => {
      const [X, Y] = this.p(x, y);
      const r = Math.max(w, h) / 200;
      m.makeScale(r, r, this.t);
      m.setPosition(X, Y, -this.t / 2);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    this.barriles = im;
    this.placa.add(im);
    this.liberables.push(geo, mat);
  }

  // ---------------------------------------------------------------- textures

  private get anisotropia(): number {
    return Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
  }

  private pedidoCara(lado: Lado): PedidoCara {
    const cap = this.opc.capas;
    return { lado, capas: { F: cap.F, B: cap.B, mascara: cap.mascara, serigrafia: cap.serigrafia }, acabado: this.opc.acabado, mascara: this.d.placa.mascara };
  }

  /** A map of the page's own painting (overlays, exploded layers) as a texture: `escala` of the faces' size. */
  private texturaPintada(pintar: (ctx: CanvasRenderingContext2D, s: number) => void, escala: number): Texture {
    if (this.modo === 'directo') {
      const { c, ctx, s } = this.lienzoTextura(escala);
      pintar(ctx, s);
      return this.textura(c, true);
    }
    const r = pintarDirecto(pintar, this.d, Math.round(this.ladoTextura * escala));
    return texturaDePixeles(this.renderer, r.px, r.w, r.h, true, this.anisotropia);
  }

  // 'directo' (the 0.7 path): a canvas of the page, uploaded with texImage2D(canvas).

  private lienzoTextura(escala = 1): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; s: number } {
    const lado = Math.round(this.ladoTextura * escala);
    const s = lado / Math.max(this.d.placa.ancho, this.d.placa.alto);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.d.placa.ancho * s));
    c.height = Math.max(1, Math.round(this.d.placa.alto * s));
    const ctx = c.getContext('2d')!;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    return { c, ctx, s };
  }

  /** Texture uploaded to the GPU at once, then the canvas is released (its memory is not kept twice). */
  private textura(c: HTMLCanvasElement, srgb: boolean): CanvasTexture {
    const t = new CanvasTexture(c);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = this.anisotropia;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    this.renderer.initTexture(t);
    c.width = c.height = 0;
    return t;
  }

  /** Both maps of a face the 0.7 way; returns the ms of drawing and of upload. */
  private pintarCaraDirecta(lado: Lado, escala: number, nivel: number): { pintar: number; subir: number } {
    const p = this.pedidoCara(lado);
    const a = this.lienzoTextura(escala);
    const b = this.lienzoTextura(0.5 * escala);
    const t0 = performance.now();
    pintarMapa(a.ctx, this.d, this.g, p, 'color', a.s);
    pintarMapa(b.ctx, this.d, this.g, p, 'pbr', b.s);
    const t1 = performance.now();
    const color = this.textura(a.c, true);
    const pbr = this.textura(b.c, false);
    const t2 = performance.now();
    this.ponerCara(lado, color, pbr, nivel);
    return { pintar: t1 - t0, subir: t2 - t1 };
  }

  /** Puts a face's maps on its material (the previous ones are released); `nivel`: 0 placeholder, 1 quick, 2 full. */
  private ponerCara(lado: Lado, color: Texture, pbr: Texture, nivel = 2): void {
    const viejo = this.texCaras[lado];
    viejo?.color.dispose();
    viejo?.pbr.dispose();
    this.texCaras[lado] = { color, pbr };
    this.nivelCara[lado] = { v: this.versionCaras, n: nivel };
    const m = this.matCaras[lado];
    m.map = color;
    m.roughnessMap = pbr;
    m.metalnessMap = pbr;
    m.needsUpdate = true;
  }

  /**
   * Paints both faces (colour and metal/roughness maps). `escala` < 1: the quick low-resolution pass, so the
   * board shows (or reacts to a layer change) at once — on the page's thread, or by the worker in 'trabajador'
   * mode —; 1: the full resolution, progressively (refinarCaras()); the final look is the same.
   */
  pintarCaras(escala = 1): void {
    if (escala < 1) this.pintarRapido(escala);
    else {
      this.provisional = true;
      void this.refinarCaras();
    }
    this.pintarRealce();
    this.pedir();
  }

  private pintarRapido(escala: number): void {
    // Any full-resolution pass in flight is now out of date.
    this.generacion++;
    this.provisional = true;
    const v = ++this.versionCaras;
    const f = { pintar: 0, leer: 0, subir: 0 };
    this.stats.fasesCaras = { ...this.stats.fasesCaras, modo: this.modo, cuarto: f };
    if (this.modo === 'trabajador' && this.trabajador) {
      // The worker paints this pass too (WebKit: the page's thread stays free). Until its maps arrive the faces
      // show the board's plain colours (first view: 1 px maps, so the faces' shader is the final one) or keep
      // their previous maps (a layer change).
      if (!this.texCaras.F) {
        const base = MASCARAS[this.d.placa.mascara] ?? MASCARAS.verde!;
        for (const lado of ['F', 'B'] as const) this.ponerCara(lado, this.pixel(base.base, true), this.pixel('#005c00', false), 0);
      }
      const mapas = [
        { tipo: 'color' as const, lado: Math.round(this.ladoTextura * escala) },
        { tipo: 'pbr' as const, lado: Math.round(this.ladoTextura * 0.5 * escala) },
      ];
      for (const lado of ['F', 'B'] as const) {
        void this.pedirMapas(this.pedidoCara(lado), mapas).then((r) => {
          if (!this.vivo || v !== this.versionCaras) return;
          if (!r || r.tipo !== 'mapas') {
            // No worker after all: this face on the page's thread.
            this.pintarRapidoPagina(lado, escala, f);
            this.pedir();
            return;
          }
          // The full maps of this version may already be there.
          if (this.nivelCara[lado].v === v && this.nivelCara[lado].n >= 2) return;
          const a = performance.now();
          const tex = r.mapas.map((m) => texturaDePixeles(this.renderer, new Uint8Array(m.px), m.w, m.h, m.tipo === 'color', this.anisotropia));
          f.subir += performance.now() - a;
          for (const m of r.mapas) {
            f.pintar += m.t.pintar;
            f.leer += m.t.leer + m.t.voltear;
          }
          this.ponerCara(lado, tex[0]!, tex[1]!, 1);
          this.pedir();
        });
      }
      return;
    }
    for (const lado of ['F', 'B'] as const) this.pintarRapidoPagina(lado, escala, f);
  }

  /** The quick pass of one face on the page's thread ('directo': the 0.7 way; else plain pixels). */
  private pintarRapidoPagina(lado: Lado, escala: number, f: { pintar: number; leer: number; subir: number }): void {
    if (this.modo === 'directo') {
      const r = this.pintarCaraDirecta(lado, escala, 1);
      f.pintar += r.pintar;
      f.subir += r.subir;
      return;
    }
    const p = this.pedidoCara(lado);
    const mapa = (tipo: TipoMapa, k: number): Texture => {
      const r = pintarDirecto((ctx, s) => pintarMapa(ctx, this.d, this.g, p, tipo, s), this.d, Math.round(this.ladoTextura * k));
      const t0 = performance.now();
      const t = texturaDePixeles(this.renderer, r.px, r.w, r.h, tipo === 'color', this.anisotropia);
      f.pintar += r.t.pintar;
      f.leer += r.t.leer;
      f.subir += performance.now() - t0;
      return t;
    };
    this.ponerCara(lado, mapa('color', escala), mapa('pbr', 0.5 * escala), 1);
  }

  /** A 1 × 1 map of one colour (the faces' placeholder until the worker's first maps). */
  private pixel(color: string, srgb: boolean): Texture {
    const c = new Color(color);
    // Colour gives linear components; the map stores sRGB bytes when `srgb`.
    if (srgb) c.convertLinearToSRGB();
    const px = new Uint8Array([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255]);
    return texturaDePixeles(this.renderer, px, 1, 1, srgb, 1);
  }

  // ---------------------------------------------------------------- the painting worker

  private iniciarTrabajador(): void {
    if (this.trabajador || this.trabajadorOk) return;
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      this.trabajadorOk = Promise.resolve('sin OffscreenCanvas');
      return;
    }
    let w: Worker;
    try {
      w = new Worker(new URL('./caras.trabajador.ts', import.meta.url), { type: 'module', name: 'caras-placa' });
    } catch (e) {
      this.trabajadorOk = Promise.resolve(e instanceof Error ? e.message : String(e));
      return;
    }
    this.trabajador = w;
    this.trabajadorOk = new Promise<string | null>((resolver) => {
      // Only a worker that hangs (one that fails to load raises «error»); a busy machine may take long to start it.
      const plazo = setTimeout(() => resolver('el trabajador no respondió'), 60_000);
      w.onerror = (e) => {
        clearTimeout(plazo);
        resolver(e.message || 'error del trabajador');
      };
      w.onmessage = (ev: MessageEvent<RespuestaTrabajador>) => {
        const r = ev.data;
        if (r.tipo === 'listo') {
          clearTimeout(plazo);
          resolver(r.ok ? null : (r.motivo ?? 'sin OffscreenCanvas 2D en el trabajador'));
          return;
        }
        const f = this.respuestas.get(r.n);
        this.respuestas.delete(r.n);
        f?.(r);
      };
    });
    void this.trabajadorOk.then((motivo) => {
      if (motivo) this.cerrarTrabajador(motivo);
    });
    // The geometry is rebuilt there while the page builds the parts.
    w.postMessage({ tipo: 'placa', datos: datosParaCaras(this.d) } satisfies MensajeTrabajador);
  }

  /** Stops the worker; whatever was asked of it is answered with null (painted on the page instead). */
  private cerrarTrabajador(motivo: string): void {
    this.trabajador?.terminate();
    this.trabajador = null;
    this.trabajadorOk = Promise.resolve(motivo);
    const pendientes = [...this.respuestas.values()];
    this.respuestas.clear();
    for (const r of pendientes) r(null);
  }

  private pedirMapas(pedido: PedidoCara, mapas: { tipo: TipoMapa; lado: number }[]): Promise<RespuestaTrabajador | null> {
    const w = this.trabajador;
    if (!w) return Promise.resolve(null);
    const n = ++this.nPedido;
    return new Promise((resolver) => {
      this.respuestas.set(n, resolver);
      w.postMessage({ tipo: 'pintar', n, pedido, mapas } satisfies MensajeTrabajador);
    });
  }

  /**
   * The full-resolution faces after the quick first pass (no-op when already done): painted by the worker —
   * both faces asked at once, so it paints the bottom while the page uploads the top — or, without one, in
   * bands on the page's thread; uploaded in strips (see texturas-caras.ts). The quarter-resolution faces stay on
   * screen until each full one is complete.
   */
  async refinarCaras(): Promise<void> {
    if (this.refino) clearTimeout(this.refino);
    this.refino = 0;
    if (!this.vivo || !this.provisional) return;
    this.provisional = false;
    const gen = ++this.generacion;
    const sigue = () => this.vivo && gen === this.generacion;
    const t0 = performance.now();
    if (this.modo === 'directo') {
      // As in 0.7: one face per task.
      const f = { modo: 'directo' as const, geometria: 0, pintar: 0, leer: 0, voltear: 0, espera: 0, subir: 0, gpu: 0, franjas: 0, maxTarea: 0, total: 0 };
      for (const lado of ['F', 'B'] as const) {
        const r = this.pintarCaraDirecta(lado, 1, 2);
        f.pintar += r.pintar;
        f.subir += r.subir;
        f.maxTarea = Math.max(f.maxTarea, r.pintar + r.subir);
        this.pedir();
        await new Promise<void>((r) => setTimeout(r, 0));
        if (!sigue()) return;
      }
      f.total = performance.now() - t0;
      this.stats.fasesCaras = { modo: this.modo, cuarto: this.stats.fasesCaras?.cuarto ?? { pintar: 0, leer: 0, subir: 0 }, completa: f };
      this.stats.textura = f.pintar + f.subir;
      this.stats.carasFinas = performance.now() - this.creada;
      return;
    }
    const motivo = (await this.trabajadorOk) ?? null;
    if (!sigue()) return;
    const f: NonNullable<FasesCaras['completa']> = {
      modo: motivo ? 'franjas' : 'trabajador',
      motivo: motivo ?? undefined,
      geometria: 0,
      pintar: 0,
      leer: 0,
      voltear: 0,
      espera: 0,
      subir: 0,
      gpu: 0,
      franjas: 0,
      maxTarea: 0,
      total: 0,
    };
    const lado = this.ladoTextura;
    const mapas = [
      { tipo: 'color' as const, lado },
      { tipo: 'pbr' as const, lado: Math.round(lado * 0.5) },
    ];
    const pedidos = (['F', 'B'] as const).map((l) => this.pedidoCara(l));
    const sub: Subida = { ms: 0, max: 0, franjas: 0, gpu: 0 };
    if (!motivo) {
      const respuestas = pedidos.map((p) => this.pedirMapas(p, mapas));
      for (let i = 0; i < 2; i++) {
        const r = await respuestas[i]!;
        if (!sigue()) return;
        if (!r || r.tipo !== 'mapas') {
          // The worker failed: the page paints this pass itself.
          this.provisional = true;
          this.cerrarTrabajador(r && r.tipo === 'error' ? r.motivo : 'el trabajador falló');
          return this.refinarCaras();
        }
        if (i === 0) f.espera = performance.now() - t0;
        f.geometria += r.geometria;
        const tex: Texture[] = [];
        for (const m of r.mapas) {
          f.pintar += m.t.pintar;
          f.leer += m.t.leer;
          f.voltear += m.t.voltear;
          const a = performance.now();
          const t = texturaVacia(this.renderer, m.w, m.h, m.tipo === 'color', this.anisotropia);
          sub.ms += performance.now() - a;
          const ok = await subirPorFranjas(this.renderer, t, new Uint8Array(m.px), m.w, m.h, sigue, sub);
          if (!ok) {
            t.dispose();
            for (const x of tex) x.dispose();
            return;
          }
          tex.push(t);
        }
        this.ponerCara(pedidos[i]!.lado, tex[0]!, tex[1]!);
        this.pedir();
      }
    } else {
      const en = { ...sub, pintar: 0, leer: 0 };
      for (const p of pedidos) {
        const tex: Texture[] = [];
        for (const m of mapas) {
          const t = await pintarPorBandas(this.renderer, this.d, this.g, p, m.tipo, m.lado, this.anisotropia, sigue, en);
          if (!t) {
            for (const x of tex) x.dispose();
            return;
          }
          tex.push(t);
        }
        if (!sigue()) return;
        this.ponerCara(p.lado, tex[0]!, tex[1]!);
        this.pedir();
      }
      f.pintar = en.pintar;
      f.leer = en.leer;
      Object.assign(sub, { ms: en.ms, max: en.max, franjas: en.franjas, gpu: en.gpu });
    }
    f.subir = sub.ms;
    f.gpu = sub.gpu;
    f.franjas = sub.franjas;
    f.maxTarea = sub.max;
    f.total = performance.now() - t0;
    this.stats.fasesCaras = { modo: this.modo, cuarto: this.stats.fasesCaras?.cuarto ?? { pintar: 0, leer: 0, subir: 0 }, completa: f };
    // Page-thread time of the full faces (0.7: painting and upload, all of it on the page's thread).
    this.stats.textura = f.modo === 'trabajador' ? f.subir : f.pintar + f.leer + f.subir;
    this.stats.carasFinas = performance.now() - this.creada;
  }

  /** Selected net (orange) and DC voltages (colours) over each face. */
  pintarRealce(): void {
    const colores = this.opc.tensiones ? coloresTension(this.d) : null;
    for (const lado of ['F', 'B'] as const) {
      const red = this.opc.red;
      const me = this.realce[lado];
      this.texRealce[lado]?.dispose();
      this.texRealce[lado] = null;
      if ((red === null || red < 0) && !colores) {
        me.visible = false;
        continue;
      }
      const vis = { F: lado === 'F', B: lado === 'B', mascara: true, serigrafia: false, fab: false, areas: false };
      const t = this.texturaPintada((ctx) => {
        if (colores) for (const [r, col] of colores) pintarRed(ctx, this.g, r, { lado, aspecto: 'real', visibles: vis }, col);
        if (red !== null && red >= 0) pintarRed(ctx, this.g, red, { lado, aspecto: 'real', visibles: vis }, '#ffb02e');
      }, 0.5);
      this.texRealce[lado] = t;
      const m = me.material as MeshBasicMaterial;
      m.map = t;
      m.opacity = 0.92;
      m.needsUpdate = true;
      me.visible = true;
    }
    this.pedir();
  }

  // ---------------------------------------------------------------- components

  /**
   * Builds the parts and adds them to the board without freezing the page: equal parts (same library model and
   * parameters, or the same simple body) are built once and their triangles copied for each footprint; the
   * copies are written straight into one buffer per material, in slices of a few milliseconds between which
   * the page stays responsive (`alProgreso(hechas, total)`); the shaders are compiled before the parts are shown
   * (in parallel where the GPU driver allows). The result is the same as building every part: one mesh per
   * material for the whole board.
   */
  async cargarPiezas(avisos: AvisosCarga | ((hechas: number, total: number) => void) = {}): Promise<void> {
    // Loaded once (the «Componentes» toggle may ask again).
    this.cargaPiezas ??= this.cargarPiezasUnaVez(typeof avisos === 'function' ? { alProgreso: avisos } : avisos);
    return this.cargaPiezas;
  }

  /** Whether the parts were asked for (cargarPiezas() called). */
  get piezasPedidas(): boolean {
    return !!this.cargaPiezas;
  }

  private cargaPiezas: Promise<void> | null = null;

  private async cargarPiezasUnaVez({ alProgreso, alFase }: AvisosCarga): Promise<void> {
    const tA = performance.now();
    // The full-resolution faces now wait for the frame with the parts (see frame()).
    if (this.refino) clearTimeout(this.refino);
    this.refino = 0;
    const lib = await cargarBiblioteca();
    if (!this.vivo) return;
    const tB = performance.now();
    const rec = lib ? new lib.Recursos() : null;
    const disponibles = new Set(lib?.tiposDisponibles?.() ?? []);
    const plantillas = new Map<string, Plantilla | null>();
    const copias: { pl: Plantilla; m: Matrix4; h: number }[] = [];
    const huellas = this.d.huellas.map((h, i) => [h, i] as const).filter(([h]) => h.t !== 'mec' && !h.dnp);
    const rev: RevisionPiezas = { plantillas: 0, vertices: 0, triangulos: 0, noFinitas: [], enormes: [], pinesDistintos: [], patasFuera: [], maxDesvio: 0, fusionNoFinitos: 0 };
    this.stats.revision = rev;
    // Short slices (0.9: 6 ms, was 12): with a 4× slower CPU a slice and the part that ends it stay near 50 ms
    // (the longest single step left is building one library model, a DIP with its marking: 10–25 ms here).
    const pausa = crearPausa(6);
    let hechas = 0;
    for (const [h, i] of huellas) {
      alFase?.(`pieza ${hechas + 1}: ${h.r}`);
      const c = this.colocar(h, lib, rec, disponibles, plantillas, rev);
      hechas++;
      if (c) {
        const caja = c.pl.caja.clone().applyMatrix4(c.m);
        if (!caja.isEmpty()) this.cajas.push({ h: i, caja });
        if (h.m.tipo === 'blindaje') this.blindaje(c.pl, c.m, caja);
        else copias.push({ pl: c.pl, m: c.m, h: i });
      }
      if (await pausa()) {
        if (!this.vivo) return;
        alProgreso?.(hechas, huellas.length);
      }
    }
    rev.plantillas = [...plantillas.values()].filter(Boolean).length;
    const tC = performance.now();
    alFase?.('uniendo');
    const grupo = await this.unir(copias, pausa, rev);
    if (!this.vivo) return;
    const tD = performance.now();
    // Shaders before the first frame with the parts: in parallel where KHR_parallel_shader_compile exists, else
    // one program per task (each one blocks the page while the driver compiles it).
    // (the end of the merge is a stretch of its own too)
    await pausa();
    if (!this.vivo) return;
    alFase?.('compilando');
    this.stats.compilacion = await this.prepararPorPartes(grupo, alFase);
    if (!this.vivo) return;
    const tE = performance.now();
    this.piezas.add(grupo);
    // (`inicio`: performance.now() when the parts were asked for, to place the phases on a timeline; `maxTramo`:
    // the longest stretch of the parts' own work between two yields — building, merging, one program —, ms)
    this.stats.fases = {
      modelos: tC - tB,
      fusion: tD - tC,
      compilar: tE - tD,
      primerCuadro: 0,
      piezas: tE - tA,
      modelosUnicos: plantillas.size,
      inicio: tA,
      maxTramo: Math.max(pausa.max, this.stats.compilacion.maxPrograma),
    };
    for (const c of this.cajas) this.altoMax = Math.max(this.altoMax, c.caja.max.z);
    this.ajustarProfundidad();
    if (!this.tocada) this.vista('iso', false);
    // the library's shared resources (materials, label textures) stay in use by the merged meshes
    this.recursos = rec;
    alProgreso?.(huellas.length, huellas.length);
    this.pedir();
    // Then the faces at full resolution, once the frame with the parts is on screen (their uploads would
    // otherwise queue in front of the parts' shaders and delay that frame).
    this.refinarTrasCuadro = true;
  }

  /**
   * Compiles the programs that `objeto` needs and uploads its textures before it is drawn. With
   * KHR_parallel_shader_compile: compileAsync (the driver compiles in the background). Without it (Adreno 650 of
   * the Xiaomi Pad 6, SwiftShader) every program blocks the page until the driver has compiled and linked it, so
   * they go one per task: compile one material, force its link status to be read now (three would read it at the
   * first frame, all programs in one task), upload its textures, yield. Returns how many programs were built.
   */
  private async prepararPorPartes(objeto: Object3D, alFase?: (fase: string) => void): Promise<{ programas: number; paralela: boolean; maxPrograma: number }> {
    const r = this.renderer;
    const paralela = r.extensions.has('KHR_parallel_shader_compile');
    if (paralela) {
      try {
        await r.compileAsync(objeto, this.camara, this.estudio.escena);
      } catch {
        /* compiled at the first frame instead */
      }
      return { programas: 0, paralela, maxPrograma: 0 };
    }
    const porMaterial = new Map<Material, Object3D>();
    objeto.traverse((o) => {
      const m = (o as Mesh).material;
      if (!(o as Mesh).isMesh || !m) return;
      for (const x of Array.isArray(m) ? m : [m]) if (!porMaterial.has(x)) porMaterial.set(x, o);
    });
    const vistos = new Set<unknown>();
    let n = 0;
    let max = 0;
    let k = 0;
    for (const [mat, o] of porMaterial) {
      k++;
      alFase?.(`compilando ${k}/${porMaterial.size}`);
      const t0 = performance.now();
      try {
        // compile() of this object alone (with the scene's lights) builds its material's program
        r.compile(o, this.camara, this.estudio.escena);
        const prog = (r.properties.get(mat) as { currentProgram?: { getUniforms?: () => unknown } }).currentProgram;
        if (prog && !vistos.has(prog)) {
          vistos.add(prog);
          n++;
          // reading the uniforms makes three check the link status now, in this task
          prog.getUniforms?.();
        }
        for (const t of texturasDe(mat)) r.initTexture(t);
      } catch {
        /* compiled at the first frame instead */
      }
      max = Math.max(max, performance.now() - t0);
      await ceder();
      if (!this.vivo) break;
    }
    return { programas: n, paralela, maxPrograma: max };
  }

  /** The part of a footprint: its template (built once per model and parameters) and its board matrix. */
  private colocar(
    h: Huella,
    lib: Awaited<ReturnType<typeof cargarBiblioteca>>,
    rec: unknown,
    disp: Set<string>,
    plantillas: Map<string, Plantilla | null>,
    rev?: RevisionPiezas,
  ): { pl: Plantilla; m: Matrix4 } | null {
    const [X, Y] = this.p(h.x, h.y);
    const raiz = new Object3D();
    raiz.position.set(X, Y, h.lado === 'F' ? 0 : -this.t);
    // A bottom footprint is the library one mirrored (KiCad keeps its local y flipped and its angle as seen from
    // above): turned over about x, its model must turn by −a to land on its pads (0.8.2; before, the bottom
    // parts at 90° and 270° faced the other way and their pad 1 missed by 2·y).
    raiz.rotation.z = ((h.lado === 'B' ? -h.a : h.a) * Math.PI) / 180;
    if (h.lado === 'B') raiz.rotation.x = Math.PI;
    raiz.updateMatrix();
    const clave = lib ? claveBiblioteca(h) : null;
    if (lib && clave && (!disp.size || disp.has(clave.tipo))) {
      // Parts whose marking comes from the library's table also depend on the value printed.
      const k = `b|${clave.tipo}|${JSON.stringify(clave.p)}${CON_MARCADO_FIJO.has(clave.tipo) ? `|${h.v}` : ''}`;
      let pl = plantillas.get(k);
      if (pl === undefined) {
        pl = null;
        try {
          const m = lib.crearModelo(clave.tipo, clave.p, { recursos: rec, detalle: 'bajo', grosorPlaca: this.t });
          // never show someone else's marking (the library knows a fixed set of discrete parts)
          if (!CON_MARCADO_FIJO.has(clave.tipo) || marcadoCoincide(m.userData.marcado, h.v)) pl = plantilla(m, m.userData.huella as HuellaModelo | undefined);
        } catch {
          pl = null;
        }
        if (pl && !this.plantillaSana(pl, h, rev)) pl = null;
        plantillas.set(k, pl);
      }
      // a model with another number of leads than the footprint has pads is another package (0.9: the 3-lead
      // TO-220 on the Neo Geo's 5-lead LM2576T-5): a simple body instead
      const pinesModelo = pl?.huella?.pads?.length ? new Set(pl.huella.pads.map((p) => p.n)).size : 0;
      const pinesHuella = numerosPads(this.d, h).size;
      if (pl && pinesModelo && pinesModelo !== pinesHuella) {
        rev?.pinesDistintos.push(`${h.r} (modelo ${pinesModelo} patillas, huella ${pinesHuella} pads)`);
        pl = null;
      }
      if (pl) {
        const local = new Matrix4();
        const hu = pl.huella;
        if (hu) {
          // put the model's pad 1 on the footprint's pad 1 (or use its KiCad origin)
          let ox = hu.origenKicad?.[0] ?? 0;
          let oy = hu.origenKicad?.[1] ?? 0;
          const [a] = h.pads;
          const p1 = this.d.pads[a];
          const m1 = hu.pads?.find((p) => p.n === '1');
          if (p1 && m1 && h.pads[1] > 0) {
            // footprint-local position of pad 1 (u, KiCad axes) from its board position
            const an = (-h.a * Math.PI) / 180;
            const dx = p1[3] - h.x;
            const dy = p1[4] - h.y;
            const lx = (dx * Math.cos(an) + dy * Math.sin(an)) / 100;
            const ly = (-dx * Math.sin(an) + dy * Math.cos(an)) / 100;
            // (the model's y points up: KiCad's local y flipped on top, the file's own local y on the bottom)
            ox = m1.x - lx;
            oy = h.lado === 'B' ? m1.y - ly : m1.y + ly;
          }
          // a model much smaller or larger than the footprint body (other package size): scale it to fit
          const [x0, y0, x1, y1] = h.m.caja;
          const fw = x1 - x0;
          const fd = y1 - y0;
          let f = 1;
          if (hu.ancho > 0 && hu.fondo > 0 && fw > 0 && fd > 0) {
            const k2 = Math.sqrt((fw * fd) / (hu.ancho * hu.fondo));
            if (k2 > 1.35 || k2 < 0.7) f = k2;
          }
          local.makeTranslation(-ox, -oy, 0).multiply(new Matrix4().makeScale(f, f, f));
        }
        const m = raiz.matrix.clone().multiply(local);
        // every lead on its pad (same number): no more than half a millimetre beyond the pad's copper
        const desvio = hu?.pads?.length ? this.desvioPatas(h, hu, m) : 0;
        if (desvio <= TOLERANCIA_PATA) {
          if (rev) rev.maxDesvio = Math.max(rev.maxDesvio, desvio);
          this.stats.piezas.biblioteca++;
          return { pl, m };
        }
        rev?.patasFuera.push(`${h.r} (${desvio.toFixed(1).replace('.', ',')} mm)`);
      }
    }
    // Simple bodies built here: also one per distinct footprint description.
    // (the pads' local positions count for the bodies that draw leads, e.g. a 5-lead TO-220)
    const locales = padsLocales(this.d, h);
    const k = `s|${JSON.stringify(h.m)}|${h.v}|${h.l}|${h.mpn ?? ''}|${h.m.tipo === 'to' || h.m.tipo === 'dip' ? JSON.stringify(locales) : ''}`;
    let pl = plantillas.get(k);
    if (pl === undefined) {
      pl = plantilla(cuerpoSimple(h, locales), undefined);
      if (pl && !this.plantillaSana(pl, h, rev)) pl = null;
      plantillas.set(k, pl);
    }
    this.stats.piezas.propias++;
    return pl ? { pl, m: raiz.matrix.clone() } : null;
  }

  /** A template with finite numbers and a sane size; else it is recorded and refused. */
  private plantillaSana(pl: Plantilla, h: Huella, rev?: RevisionPiezas): boolean {
    let n = 0;
    let malos = 0;
    for (const p of pl.piezas) {
      n += p.n;
      if (p.n % 3) malos++;
      for (const a of [p.pos, p.nor]) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i]!)) malos++;
    }
    if (malos) {
      rev?.noFinitas.push(h.r);
      return false;
    }
    if (n > MAX_VERTICES_PLANTILLA) {
      rev?.enormes.push(`${h.r} (${n} vértices)`);
      return false;
    }
    return true;
  }

  /**
   * How far (mm) a model's leads land beyond the footprint pads with their numbers, once placed by `m`: the
   * distance from each lead to its pad's centre less the pad's half size (0 when every lead is on its pad).
   */
  private desvioPatas(h: Huella, hu: HuellaModelo, m: Matrix4): number {
    const [a, n] = h.pads;
    let max = 0;
    const v = new Vector3();
    for (const q of hu.pads ?? []) {
      v.set(q.x, q.y, 0).applyMatrix4(m);
      let mejor = Infinity;
      for (let i = a; i < a + n; i++) {
        const p = this.d.pads[i]!;
        if (p[1] !== q.n) continue;
        const [x, y] = this.p(p[3], p[4]);
        mejor = Math.min(mejor, Math.max(0, Math.hypot(v.x - x, v.y - y) - Math.max(p[5], p[6]) / 200));
      }
      if (mejor < Infinity) max = Math.max(max, mejor);
    }
    return max;
  }

  /** Shielding cans stay apart: they turn translucent when the selected part is under them. */
  private blindaje(pl: Plantilla, m: Matrix4, caja: Box3): void {
    const mat = new MeshStandardMaterial({ color: '#c9cdd1', roughness: 0.32, metalness: 0.9, transparent: true, opacity: 1 });
    const o = new Group();
    for (const p of pl.piezas) {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(p.pos.slice(), 3));
      geo.setAttribute('normal', new BufferAttribute(p.nor.slice(), 3));
      const me = new Mesh(geo, mat);
      me.applyMatrix4(m);
      o.add(me);
      this.liberables.push(geo);
    }
    this.liberables.push(mat);
    this.blindajes.push({ o, caja, mat });
    this.piezas.add(o);
  }

  /** One mesh per material for all the copies, written in slices between pauses. */
  private async unir(copias: { pl: Plantilla; m: Matrix4 }[], pausa: () => Promise<boolean>, rev?: RevisionPiezas): Promise<Group> {
    const porMat = new Map<Material, { n: number; pos?: Float32Array; nor?: Float32Array; uv?: Float32Array; k: number }>();
    for (const c of copias)
      for (const p of c.pl.piezas) {
        const e = porMat.get(p.mat) ?? { n: 0, k: 0 };
        e.n += p.n;
        porMat.set(p.mat, e);
      }
    for (const e of porMat.values()) {
      e.pos = new Float32Array(e.n * 3);
      e.nor = new Float32Array(e.n * 3);
      e.uv = new Float32Array(e.n * 2);
    }
    const nm = new Matrix3();
    for (const c of copias) {
      const m = c.m.elements;
      nm.getNormalMatrix(c.m);
      const q = nm.elements;
      for (const p of c.pl.piezas) {
        const e = porMat.get(p.mat)!;
        const P = e.pos!;
        const N = e.nor!;
        let o = e.k * 3;
        for (let i = 0; i < p.n * 3; i += 3, o += 3) {
          const x = p.pos[i]!;
          const y = p.pos[i + 1]!;
          const z = p.pos[i + 2]!;
          P[o] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
          P[o + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
          P[o + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
          const a = p.nor[i]!;
          const b = p.nor[i + 1]!;
          const d = p.nor[i + 2]!;
          let nx = q[0]! * a + q[3]! * b + q[6]! * d;
          let ny = q[1]! * a + q[4]! * b + q[7]! * d;
          let nz = q[2]! * a + q[5]! * b + q[8]! * d;
          const l = Math.hypot(nx, ny, nz) || 1;
          nx /= l;
          ny /= l;
          nz /= l;
          N[o] = nx;
          N[o + 1] = ny;
          N[o + 2] = nz;
        }
        if (p.uv) e.uv!.set(p.uv, e.k * 2);
        e.k += p.n;
      }
      if (await pausa()) {
        if (!this.vivo) break;
      }
    }
    const grupo = new Group();
    for (const [mat, e] of porMat) {
      if (!e.n) continue;
      if (rev) {
        // the merged buffers once more (a template was checked, but a board matrix could still be broken)
        let malos = 0;
        for (const a of [e.pos!, e.nor!]) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i]!)) malos++;
        rev.fusionNoFinitos += malos;
        rev.vertices += e.n;
        rev.triangulos += e.n / 3;
        await pausa();
        if (!this.vivo) break;
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(e.pos!, 3));
      g.setAttribute('normal', new BufferAttribute(e.nor!, 3));
      g.setAttribute('uv', new BufferAttribute(e.uv!, 2));
      g.computeBoundingSphere();
      const me = new Mesh(g, mat);
      me.matrixAutoUpdate = false;
      grupo.add(me);
      this.liberables.push(g);
    }
    return grupo;
  }

  /** Depth range from the board and its parts (exploded too): precision for mobile GPUs. */
  private ajustarProfundidad(): void {
    const r = Math.hypot(this.W, this.H) / 2;
    const paso = Math.max(10, Math.max(this.W, this.H) * 0.1);
    this.orbita.escena = { centro: new Vector3(0, 0, this.altoMax / 2), radio: r + this.altoMax + paso * 4 + 10 };
  }

  // ---------------------------------------------------------------- explode and X-ray

  private capasExplosion(): void {
    if (this.capasX.length) return;
    const geo = this.caras.F.geometry;
    const plano = (pintar: (ctx: CanvasRenderingContext2D, s: number) => void, z: number, lado: Lado, opacidad = 1): Mesh => {
      const t = this.texturaPintada(pintar, 0.4);
      const m = new MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, side: DoubleSide, roughness: 0.6, metalness: 0, opacity: opacidad, depthWrite: false });
      const me = new Mesh(geo, m);
      me.userData.z = z;
      me.userData.lado = lado;
      me.visible = false;
      this.placa.add(me);
      this.liberables.push(t, m);
      this.capasX.push(me);
      return me;
    };
    const cobre = (lado: Lado) => (ctx: CanvasRenderingContext2D, s: number) =>
      pintarLado(ctx, this.d, this.g, { lado, aspecto: 'real', acabado: 'hasl', visibles: { F: true, B: true, mascara: false, serigrafia: false, fab: false, areas: false }, mascara: 'verde', escala: s, soloCobre: true });
    const mascara = (lado: Lado) => (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = 'rgba(29,110,55,0.72)';
      ctx.fill(this.g.contorno);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(this.g.aberturas[lado], 'nonzero');
      ctx.fill(this.g.taladros, 'nonzero');
    };
    const seri = (lado: Lado) => (ctx: CanvasRenderingContext2D) => {
      const s = this.g.serigrafia[lado];
      if (!s) return;
      ctx.strokeStyle = '#f5f5ef';
      ctx.fillStyle = '#f5f5ef';
      ctx.lineCap = 'round';
      for (const [w, p] of s.trazos) {
        ctx.lineWidth = w;
        ctx.stroke(p);
      }
      ctx.fill(s.rellenos);
    };
    // X-ray: tracks, pads and vias solid, copper pours faint, so the other face shows through
    const xray = (lado: Lado) => (ctx: CanvasRenderingContext2D) => {
      const c = this.g.cobre[lado];
      const col = lado === 'F' ? '255,90,74' : '90,150,255';
      ctx.save();
      ctx.clip(this.g.contorno);
      ctx.fillStyle = `rgba(${col},0.16)`;
      for (const z of c.zonas.values()) ctx.fill(z, 'evenodd');
      ctx.strokeStyle = `rgb(${col})`;
      ctx.fillStyle = `rgb(${col})`;
      ctx.lineCap = 'round';
      for (const [w, porRed] of c.pistas) {
        ctx.lineWidth = w;
        for (const p of porRed.values()) ctx.stroke(p);
      }
      for (const m of [c.pads, c.vias]) for (const p of m.values()) ctx.fill(p);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(this.g.taladros, 'nonzero');
      ctx.restore();
    };
    plano(xray('F'), 1, 'F').userData.tipo = 'xray';
    plano(xray('B'), -1, 'B').userData.tipo = 'xray';
    plano(cobre('F'), 1, 'F').userData.tipo = 'cobre';
    plano(cobre('B'), -1, 'B').userData.tipo = 'cobre';
    plano(mascara('F'), 2, 'F').userData.tipo = 'mascara';
    plano(mascara('B'), -2, 'B').userData.tipo = 'mascara';
    plano(seri('F'), 3, 'F').userData.tipo = 'serigrafia';
    plano(seri('B'), -3, 'B').userData.tipo = 'serigrafia';
  }

  /** Applies explosion (0–1), X-ray and layer toggles to the visible objects. */
  private aplicarCapas(): void {
    const e = this.explosion;
    const rx = this.opc.rayosX;
    const cap = this.opc.capas;
    const separado = e > 0.001 || rx;
    if (separado) this.capasExplosion();
    this.caras.F.visible = !separado;
    this.caras.B.visible = !separado;
    this.realce.F.visible = !separado && !!this.texRealce.F;
    this.realce.B.visible = !separado && !!this.texRealce.B;
    const paso = Math.max(10, Math.max(this.W, this.H) * 0.1) * e;
    for (const me of this.capasX) {
      const tipo = me.userData.tipo as string;
      const lado = me.userData.lado as Lado;
      const z = me.userData.z as number;
      let vis = separado && !rx && cap[lado];
      if (tipo === 'xray') vis = rx && cap[lado];
      if (tipo === 'mascara') vis = separado && !rx && cap.mascara;
      if (tipo === 'serigrafia') vis = separado && !rx && cap.serigrafia;
      me.visible = vis;
      me.position.z = (lado === 'F' ? 0.02 : -this.t - 0.02) + Math.sign(z) * (Math.abs(z) - 1) * paso * 0.9 + Math.sign(z) * paso * 0.4;
      const m = me.material as MeshStandardMaterial;
      if (tipo === 'xray') m.alphaTest = 0.01;
    }
    for (const m of [this.matNucleo, this.matNucleoTapas]) {
      m.transparent = rx;
      m.opacity = rx ? 0.18 : 1;
      m.depthWrite = !rx;
      m.needsUpdate = true;
    }
    this.matNucleoTapas.visible = separado;
    if (separado && !this.matNucleoTapas.map) {
      const t = this.texturaTapasNucleo();
      this.liberables.push(t);
      this.matNucleoTapas.map = t;
      this.matNucleoTapas.needsUpdate = true;
    }
    this.stats.tapasNucleo = separado;
    this.piezas.visible = cap.componentes && !rx;
    this.piezas.position.z = paso * 3.2;
    if (this.seleccion) this.seleccion.visible = !rx;
    this.pedir();
  }

  // ---------------------------------------------------------------- public controls

  opciones(o: Partial<typeof this.opc>): void {
    const antes = { ...this.opc, capas: { ...this.opc.capas } };
    Object.assign(this.opc, o);
    if (o.capas) this.opc.capas = { ...o.capas };
    const c0 = antes.capas;
    const c1 = this.opc.capas;
    if (c0.F !== c1.F || c0.B !== c1.B || c0.mascara !== c1.mascara || c0.serigrafia !== c1.serigrafia || antes.acabado !== this.opc.acabado) {
      // The change shows at once at a quarter of the resolution; the full one follows (unless the board is
      // still loading: then it comes with the parts, as usual).
      const fino = !this.provisional;
      this.pintarCaras(0.25);
      if (fino) void this.refinarCaras();
    }
    else if (antes.red !== this.opc.red || antes.tensiones !== this.opc.tensiones) this.pintarRealce();
    this.aplicarCapas();
  }

  explotar(f: number): void {
    this.explosionObjetivo = f;
    this.pedir();
  }

  seleccionar(h: number | null): void {
    if (this.seleccion) {
      this.placa.remove(this.seleccion);
      this.seleccion.geometry.dispose();
      (this.seleccion.material as Material).dispose();
      this.seleccion = null;
    }
    const c = h === null ? null : this.cajas.find((x) => x.h === h);
    for (const b of this.blindajes) {
      const debajo = !!c && c.h !== this.cajas.find((x) => x.caja === b.caja)?.h && b.caja.intersectsBox(c.caja);
      b.mat.opacity = debajo ? 0.22 : 1;
      b.mat.depthWrite = !debajo;
    }
    if (c) {
      const b = c.caja.clone().expandByScalar(0.4);
      this.seleccion = new Box3Helper(b, new Color('#ffb02e'));
      (this.seleccion.material as Material).depthTest = false;
      this.seleccion.renderOrder = 5;
      this.placa.add(this.seleccion);
    }
    this.pedir();
  }

  /** Camera presets; «abajo» turns the board over (as one does with a real board). */
  vista(v: Vista, animar = true): void {
    const lado: Lado = v === 'abajo' ? 'B' : v === 'iso' ? this.ladoComponentes : 'F';
    if (lado !== this.ladoArriba) {
      this.ladoArriba = lado;
      this.giro = { de: this.placa.rotation.y, a: lado === 'B' ? Math.PI : 0, t0: performance.now() };
    }
    // fit the board in the window (aspect-aware), a little margin
    const r = Math.max(this.W / Math.max(0.3, this.camara.aspect), this.H) * (v === 'iso' ? 1.15 : 1.08) + (v === 'iso' ? this.altoMax * 0.8 : 0);
    const d = r / (2 * Math.tan((this.camara.fov * Math.PI) / 360)) + 6;
    const e: EstadoOrbita = {
      azimut: v === 'iso' ? -0.5 : 0,
      elevacion: v === 'iso' ? 0.72 : v === 'lado' ? 0.06 : 1.52,
      distancia: v === 'lado' ? d * 0.75 : d,
      objetivo: new Vector3(0, v === 'iso' ? -this.H * 0.06 : 0, v === 'lado' ? 2 : v === 'iso' ? this.altoMax * 0.3 : 0),
    };
    this.orbita.ir(e, animar);
    this.pedir();
  }

  /** Frames a part or a net (board box in u). */
  enfocar(b: [number, number, number, number]): void {
    const [x0, y0] = this.p(b[0], b[1]);
    const [x1, y1] = this.p(b[2], b[3]);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const r = Math.max(8, Math.abs(x1 - x0), Math.abs(y1 - y0));
    const s = this.orbita.estado();
    const flip = this.ladoArriba === 'B' ? -1 : 1;
    // the part and its surroundings fill about a third of the window, whatever its shape
    const vis = Math.max(r, r / Math.max(0.3, this.camara.aspect)) * 3.2;
    const dist = vis / (2 * Math.tan((this.camara.fov * Math.PI) / 360));
    this.orbita.ir({ ...s, distancia: Math.max(this.orbita.minDist, dist), objetivo: new Vector3(cx * flip, cy, 2 * flip) }, true);
  }

  tamano(w: number, h: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // at most about 2.4 Mpx drawn (Iris Plus 640 at 1280 × 800, DPR 2)
    const k = Math.min(dpr, Math.sqrt(2.4e6 / Math.max(1, w * h)));
    this.renderer.setSize(w, h, false);
    this.res.ponerBase(k, this.orbita.moviendo());
    const primera = this.camara.aspect === 1 && !this.ajustada;
    this.camara.aspect = w / Math.max(1, h);
    this.camara.updateProjectionMatrix();
    if (primera) {
      this.ajustada = true;
      this.vista('iso', false);
    }
    this.pedir();
  }

  // ---------------------------------------------------------------- picking

  private ray = new Raycaster();

  /**
   * What is under the pointer: a part (its body box) or a point of a face (board coordinates in u and the
   * face), whichever is nearest.
   */
  tocar(px: number, py: number, w: number, h: number): { huella: number } | { x: number; y: number; lado: Lado } | null {
    this.ray.setFromCamera(new Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), this.camara);
    this.placa.updateMatrixWorld(true);
    const inv = new Matrix4().copy(this.placa.matrixWorld).invert();
    const r = this.ray.ray.clone().applyMatrix4(inv);
    let mejor: { d: number; res: { huella: number } | { x: number; y: number; lado: Lado } } | null = null;
    if (this.piezas.visible) {
      const desp = new Vector3(0, 0, this.piezas.position.z);
      let area = Infinity;
      for (const c of this.cajas) {
        const b = c.caja.clone().translate(desp);
        const p = r.intersectBox(b, new Vector3());
        if (!p) continue;
        const dd = p.distanceTo(r.origin);
        const sz = b.getSize(new Vector3());
        const a = sz.x * sz.y;
        // nearest box; among overlapping ones, the smallest
        if (!mejor || dd < mejor.d - 0.5 || (Math.abs(dd - mejor.d) <= 0.5 && a < area)) {
          mejor = { d: dd, res: { huella: c.h } };
          area = a;
        }
      }
    }
    for (const lado of ['F', 'B'] as const) {
      const z = lado === 'F' ? 0 : -this.t;
      if (Math.abs(r.direction.z) < 1e-6) continue;
      const t = (z - r.origin.z) / r.direction.z;
      if (t <= 0) continue;
      const q = r.origin.clone().addScaledVector(r.direction, t);
      // only the face turned towards the camera
      if ((lado === 'F') !== r.direction.z < 0) continue;
      const x = (q.x + this.W / 2) * 100;
      const y = (this.H / 2 - q.y) * 100;
      if (x < 0 || y < 0 || x > this.d.placa.ancho || y > this.d.placa.alto) continue;
      if (!mejor || t < mejor.d) mejor = { d: t, res: { x, y, lado } };
    }
    return mejor?.res ?? null;
  }

  /** Screen position (CSS px) of a part's top, for the label. */
  proyectar(h: number, w: number, hh: number): [number, number] | null {
    const c = this.cajas.find((x) => x.h === h);
    if (!c || !this.piezas.visible) return null;
    const p = c.caja.getCenter(new Vector3());
    p.z = c.caja.max.z + this.piezas.position.z;
    this.placa.updateMatrixWorld(true);
    p.applyMatrix4(this.placa.matrixWorld).project(this.camara);
    if (p.z > 1) return null;
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * hh];
  }

  // ---------------------------------------------------------------- rendering on demand

  pedir(): void {
    this.sucio = true;
    if (!this.raf && this.vivo) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(ahora: number): void {
    this.raf = 0;
    if (!this.vivo || !this.preparado) return;
    let mas = this.orbita.paso(ahora);
    // board turn-over
    if (this.placa.rotation.y !== this.giro.a) {
      const u = Math.min(1, (ahora - this.giro.t0) / 520);
      const e = 1 - (1 - u) ** 3;
      this.placa.rotation.y = this.giro.de + (this.giro.a - this.giro.de) * e;
      this.placa.position.z = this.giro.a ? this.t * e : this.t * (1 - e);
      if (u >= 1) this.placa.rotation.y = this.giro.a;
      mas = true;
    }
    if (Math.abs(this.explosion - this.explosionObjetivo) > 1e-3) {
      const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.explosion = quieto ? this.explosionObjetivo : this.explosion + (this.explosionObjetivo - this.explosion) * 0.2;
      if (Math.abs(this.explosion - this.explosionObjetivo) <= 1e-3) this.explosion = this.explosionObjetivo;
      this.aplicarCapas();
      mas = true;
    }
    // Adaptive resolution: measured on the frames drawn while moving; at rest the full one, with a final frame.
    const moviendo = mas || this.movido || this.orbita.moviendo(ahora, REPOSO);
    this.movido = false;
    if (!moviendo && this.res.enReposo()) this.sucio = true;
    if (this.sucio || mas) {
      if (moviendo) this.res.enMovimiento(ahora);
      const t0 = performance.now();
      this.renderer.render(this.estudio.escena, this.camara);
      const ms = performance.now() - t0;
      this.stats.cuadros++;
      this.stats.primerCuadroPlaca ??= performance.now() - this.creada;
      this.placaDibujada();
      if (this.stats.fases && !this.stats.fases.primerCuadro) {
        this.stats.fases.primerCuadro = ms;
        this.stats.programas = this.renderer.info.programs?.length;
      }
      this.stats.ms.push(ms);
      if (this.stats.ms.length > 300) this.stats.ms.splice(0, 150);
      this.stats.llamadas = this.renderer.info.render.calls;
      this.stats.triangulos = this.renderer.info.render.triangles;
      this.sucio = false;
      this.alCambiar();
      if (this.refinarTrasCuadro) {
        this.refinarTrasCuadro = false;
        setTimeout(() => void this.refinarCaras(), 100);
      }
      if (moviendo) {
        // Check again when the camera has been still for a moment: the full resolution (with a final frame).
        clearTimeout(this.despertar);
        this.despertar = window.setTimeout(this.revisarReposo, REPOSO + 20);
      }
    }
    if (mas) this.pedir();
  }

  liberar(): void {
    this.vivo = false;
    this.generacion++;
    clearTimeout(this.despertar);
    this.cerrarTrabajador('vista cerrada');
    if (this.refino) clearTimeout(this.refino);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.orbita.liberar();
    for (const x of this.liberables) x.dispose();
    for (const l of ['F', 'B'] as const) {
      this.texCaras[l]?.color.dispose();
      this.texCaras[l]?.pbr.dispose();
      this.texRealce[l]?.dispose();
    }
    this.barriles?.dispose();
    this.seleccion?.geometry.dispose();
    this.estudio.liberar();
    this.recursos?.liberar();
    liberarMateriales();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// ---------------------------------------------------------------- templates of equal parts

interface HuellaModelo {
  ancho: number;
  fondo: number;
  origenKicad: [number, number];
  pads?: { n: string; x: number; y: number }[];
}

/** A part built once: its triangles per material in the part's own axes (non-indexed), box and footprint. */
interface Plantilla {
  piezas: { mat: Material; pos: Float32Array; nor: Float32Array; uv: Float32Array | null; n: number }[];
  caja: Box3;
  huella?: HuellaModelo;
}

/** Flattens a built part (meshes, instanced meshes, multi-material meshes) into a template. */
function plantilla(o: Object3D, huella: HuellaModelo | undefined): Plantilla | null {
  o.updateMatrixWorld(true);
  const inv = new Matrix4().copy(o.matrixWorld).invert();
  const piezas: Plantilla['piezas'] = [];
  const tmp = new Matrix4();
  const rel = new Matrix4();
  const nm = new Matrix3();
  const v = new Vector3();
  const caja = new Box3();
  o.traverse((x) => {
    const me = x as Mesh;
    if (!me.isMesh || !me.visible) return;
    const geo = me.geometry;
    const pos = geo.getAttribute('position');
    if (!pos) return;
    const nor = geo.getAttribute('normal') ?? (geo.computeVertexNormals(), geo.getAttribute('normal'));
    const uv = geo.getAttribute('uv');
    const idx = geo.index;
    const rangos: [Material, number, number][] = [];
    const total = idx ? idx.count : pos.count;
    if (Array.isArray(me.material)) {
      for (const g of geo.groups) {
        const m = me.material[g.materialIndex ?? 0];
        if (m) rangos.push([m, g.start, Math.min(g.count, total - g.start)]);
      }
    } else rangos.push([me.material, 0, total]);
    const im = (me as InstancedMesh).isInstancedMesh ? (me as InstancedMesh) : null;
    const n = im ? im.count : 1;
    for (let k = 0; k < n; k++) {
      rel.multiplyMatrices(inv, me.matrixWorld);
      if (im) {
        im.getMatrixAt(k, tmp);
        rel.multiply(tmp);
      }
      nm.getNormalMatrix(rel);
      for (const [mat, ini, cuenta] of rangos) {
        const P = new Float32Array(cuenta * 3);
        const N = new Float32Array(cuenta * 3);
        const U = uv ? new Float32Array(cuenta * 2) : null;
        for (let j = 0; j < cuenta; j++) {
          const i = idx ? idx.getX(ini + j) : ini + j;
          v.fromBufferAttribute(pos, i).applyMatrix4(rel);
          P[j * 3] = v.x;
          P[j * 3 + 1] = v.y;
          P[j * 3 + 2] = v.z;
          caja.expandByPoint(v);
          v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
          N[j * 3] = v.x;
          N[j * 3 + 1] = v.y;
          N[j * 3 + 2] = v.z;
          if (U && uv) {
            U[j * 2] = uv.getX(i);
            U[j * 2 + 1] = uv.getY(i);
          }
        }
        piezas.push({ mat, pos: P, nor: N, uv: U, n: cuenta });
      }
    }
  });
  // The template keeps the triangles; the part's own geometries (not shared through Recursos) can go.
  return piezas.length ? { piezas, caja, huella } : null;
}

/**
 * A pause every ~12 ms of work (a frame's worth): resolves to true when it did pause, so the caller can report
 * progress. Uses scheduler.yield() where it exists (the task keeps its priority), else a macrotask.
 */
function crearPausa(ms = 12): (() => Promise<boolean>) & { max: number } {
  let t = performance.now();
  const f = async () => {
    const dt = performance.now() - t;
    if (dt < ms) return false;
    // the stretch of work that ends here (the longest one is kept in `max`)
    f.max = Math.max(f.max, dt);
    await ceder();
    t = performance.now();
    return true;
  };
  f.max = 0;
  return f;
}

/** Gives the page's thread back for a moment: scheduler.yield() where it exists, else a macrotask. */
function ceder(): Promise<void> {
  const sch = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return sch?.yield ? sch.yield() : new Promise<void>((r) => setTimeout(r, 0));
}

/** The textures a material uses (uploaded one material per task before the first frame). */
function texturasDe(m: Material): Texture[] {
  const r: Texture[] = [];
  for (const v of Object.values(m)) if (v && (v as Texture).isTexture) r.push(v as Texture);
  return r;
}

/** Distinct pad numbers of a footprint (unnumbered pads, such as mounting holes, do not count). */
function numerosPads(d: DatosPlaca, h: Huella): Set<string> {
  const r = new Set<string>();
  for (let i = h.pads[0]; i < h.pads[0] + h.pads[1]; i++) {
    const p = d.pads[i]!;
    if (p[1] !== '' && !(p[11] & PAD_NPTH)) r.add(p[1]);
  }
  return r;
}

/** The footprint's pads in its own axes (mm, KiCad's: x right, y down; as the fab outline `m.caja`). */
export function padsLocales(d: DatosPlaca, h: Huella): { n: string; x: number; y: number }[] {
  const an = (-h.a * Math.PI) / 180;
  const r: { n: string; x: number; y: number }[] = [];
  for (let i = h.pads[0]; i < h.pads[0] + h.pads[1]; i++) {
    const p = d.pads[i]!;
    const dx = p[3] - h.x;
    const dy = p[4] - h.y;
    r.push({ n: p[1], x: Math.round(dx * Math.cos(an) + dy * Math.sin(an)) / 100, y: Math.round(-dx * Math.sin(an) + dy * Math.cos(an)) / 100 });
  }
  return r;
}
