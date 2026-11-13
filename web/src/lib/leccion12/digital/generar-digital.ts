// 1.2 widgets «figura» and «logica» and their step types in the generator (GUIA §11): from the author's YAML to the
// data the app loads (tipos.ts), checking it on the way — a figure that exists and zones inside it, a logic circuit
// whose every pin is wired and that settles (simulated here with lib/leccion12/digital/logica.ts), faults that the
// probe can find, a design whose «fewest gates» is really the fewest. lib/leccion11/generar.ts calls `widgetDigitalDe`
// for those widgets and lib/leccion12/generar12.ts `actividadDigitalDe` for their steps. Pure.

import { analizarTexto, contarPalabras } from '../../leccion11/texto';
import type { Mando, Tarjeta, Texto } from '../../leccion11/tipos';
import { circuitoSecuencial, cronograma, entradasTabla, iniciar, mascaraDe, minimoPuertas, pinesEntrada, pinesPermitidos, PUERTAS, salidasDe, senales, sondear, tablaVerdad, TIPOS_PIEZA, type CircuitoLogico, type EntradaLogica, type FalloLogico, type Lectura, type Nivel, type PiezaLogica, type Punto, type SalidaLogica, type TipoPieza, type TipoPuerta } from './logica';
import { esperadoTabla, NOMBRE_FALLO_LOGICO, nombrePieza, ondaDe } from './motor-digital';
import type { ActividadDigital, AveriaLogica, CronogramaLogica, DibujarDigital, DisenoLogico, FalloLogicoPaso, FuenteFigura, PuntoSonda, TablaPaso, Tocar, WidgetFigura, WidgetLogica, ZonaFigura } from './tipos';
import { CODIGO_COL, CODIGO_LINEA, CODIGO_MARGEN } from './tipos';

/** What the generator gets from the book and the app's public folder to resolve a figure (the script passes it). */
export interface RecursosLibro {
  /** A figure block of the book by its label («fig-13.5»), from any part. */
  figura(label: string): Record<string, unknown> | null;
  /** Pixel size of an image under web/public («libro/img/x.jpg»). */
  tamano(ruta: string): { ancho: number; alto: number } | null;
  /** A console of the explorer (web/public/consolas/<maquina>.json). */
  consola(maquina: string): Record<string, unknown> | null;
}

export interface ContextoDigital {
  parte: string;
  bloques(parte: string): unknown[] | null;
  recursos?: RecursosLibro;
  e(m: string): void;
  aviso(m: string): void;
  texto(x: unknown, campo: string, obligatorio?: boolean): Texto | undefined;
  /** Author texts of the widget that go through the numbers rule (zone texts). */
  textos: [string, Texto][];
}

export const MAX_ENTRADAS = 6;
export const MAX_PIEZAS = 16;
export const MAX_SALIDAS = 8;
export const MAX_ZONAS = 12;
/** Narrowest figure on a phone (360 px less the card's padding): a zone under 24 px there gets a warning. */
const ANCHO_TELEFONO = 312;

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const ID_ZONA = /^[a-z0-9][a-z0-9-]*$/;
const ID_PIEZA = /^[a-z][a-z0-9-]*$/;
const ID_ENTRADA = /^[A-Za-z][A-Za-z0-9_]*$/;
const planoHtml = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ figure

export function widgetFiguraDe(x: Record<string, unknown>, c: ContextoDigital): WidgetFigura | null {
  const { e } = c;
  for (const k of Object.keys(x)) if (!['tipo', 'figura', 'imagen', 'consola', 'codigo', 'resaltar', 'zonas', 'mandos'].includes(k)) e(`«widget.${k}»: clave desconocida`);
  if (Array.isArray(x.mandos) && x.mandos.length) e('«widget.mandos»: una figura no lleva mandos (se tocan sus zonas)');
  const fuentes = ['figura', 'imagen', 'consola', 'codigo'].filter((k) => x[k] != null);
  if (fuentes.length !== 1) {
    e('«widget»: una figura lleva una de figura (fig-13.5 o «cap13#64»), imagen (img/x.jpg), consola ({ maquina, foto }) o codigo («apK#10» o { lenguaje, texto })');
    return null;
  }
  if (x.resaltar != null && x.codigo == null) e('«widget.resaltar»: solo con «codigo» (las líneas resaltadas de un listado)');
  let fuente: FuenteFigura | null = null;
  let hotspots: Record<string, unknown>[] = [];
  if (x.codigo != null) {
    // 1.2 (motor12e, autor-digital-C, autor-digital-D): a code listing — a book «codigo» block («apK#10») or the
    // author's own text — drawn in monospace, with highlighted lines and zones of whole lines
    let lenguaje = '';
    let texto = '';
    let alt = 'Listado de código';
    if (typeof x.codigo === 'string') {
      const m = /^([a-zA-Z0-9-]+)#(\d+)$/.exec(x.codigo);
      const bl = m ? c.bloques(m[1]!)?.[Number(m[2])] : null;
      if (!esObjeto(bl) || bl.t !== 'codigo') {
        e(`«widget.codigo»: «${x.codigo}» no es un bloque de código del libro («apK#10»)`);
        return null;
      }
      lenguaje = String(bl.lenguaje ?? '');
      texto = String(bl.texto ?? '');
      alt = `Listado del libro${lenguaje ? ` (${lenguaje})` : ''}`;
    } else if (esObjeto(x.codigo)) {
      for (const k of Object.keys(x.codigo)) if (!['lenguaje', 'texto'].includes(k)) e(`«widget.codigo.${k}»: clave desconocida`);
      lenguaje = typeof x.codigo.lenguaje === 'string' ? x.codigo.lenguaje : '';
      texto = typeof x.codigo.texto === 'string' ? x.codigo.texto : '';
      if (lenguaje) alt = `Listado (${lenguaje})`;
    }
    const lineas = texto.replace(/\t/g, '    ').replace(/\s+$/, '').split('\n').map((l) => l.replace(/\s+$/, ''));
    if (!texto.trim()) {
      e('«widget.codigo»: un bloque del libro («apK#10») o { lenguaje, texto } con el listado');
      return null;
    }
    if (lineas.length > 40) e(`«widget.codigo»: ${lineas.length} líneas (como mucho 40: cite el trozo que importa con { lenguaje, texto })`);
    const cols = Math.max(...lineas.map((l) => [...l].length), 1);
    if (cols > 72) c.aviso(`«widget.codigo»: una línea de ${cols} caracteres; en un teléfono el listado sale muy pequeño (ámplielo o pártala)`);
    const resaltar: number[] = [];
    if (x.resaltar != null) {
      if (!Array.isArray(x.resaltar) || !x.resaltar.every((n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= lineas.length)) e(`«widget.resaltar»: números de línea, de 1 a ${lineas.length}`);
      else resaltar.push(...[...new Set(x.resaltar as number[])].sort((p, q) => p - q));
    }
    fuente = {
      origen: 'codigo',
      src: '',
      vista: [0, 0, cols * CODIGO_COL + 2 * CODIGO_MARGEN, lineas.length * CODIGO_LINEA + 2 * CODIGO_MARGEN],
      vectorial: false,
      alt,
      codigo: { lenguaje, lineas, resaltar },
    };
  } else if (x.figura != null) {
    const ref = String(x.figura);
    let b: Record<string, unknown> | null = null;
    const m = /^([a-zA-Z0-9-]+)#(\d+)$/.exec(ref);
    if (m) {
      const bl = c.bloques(m[1]!)?.[Number(m[2])];
      b = esObjeto(bl) ? bl : null;
    } else {
      const propia = (c.bloques(c.parte) ?? []).find((y) => esObjeto(y) && y.t === 'figura' && y.label === ref);
      b = esObjeto(propia) ? propia : (c.recursos?.figura(ref) ?? null);
    }
    if (!b || b.t !== 'figura') {
      e(`«widget.figura»: «${ref}» no es una figura del libro (su etiqueta, fig-13.5, o el bloque «cap13#64»)`);
      return null;
    }
    const src = String(b.src ?? '');
    const vectorial = /\.svg$/i.test(src);
    let vista: FuenteFigura['vista'] | null = null;
    if (vectorial && Array.isArray(b.svg_vista) && b.svg_vista.length === 4 && b.svg_vista.every(esNumero)) vista = b.svg_vista as FuenteFigura['vista'];
    else if (!vectorial && Array.isArray(b.img_tam) && b.img_tam.length === 2 && b.img_tam.every(esNumero)) vista = [0, 0, b.img_tam[0] as number, b.img_tam[1] as number];
    else if (!vectorial) {
      const t = c.recursos?.tamano(`libro/${src}`);
      if (t) vista = [0, 0, t.ancho, t.alto];
    }
    if (!vista) {
      e(`«widget.figura»: no se conoce el tamaño de ${src} (svg_vista o img_tam del bloque)`);
      return null;
    }
    const num = typeof b.num === 'string' ? b.num : undefined;
    fuente = {
      origen: 'libro',
      src,
      vista,
      vectorial,
      alt: `${num ? `Figura ${num}: ` : ''}${planoHtml(String(b.pie ?? '')) || 'figura del libro'}`,
      ...(num ? { num } : {}),
      ...(typeof b.credito === 'string' && b.credito ? { credito: planoHtml(b.credito) } : {}),
    };
  } else if (x.imagen != null) {
    const src = String(x.imagen).replace(/^\/+/, '');
    if (!/^img\/[\w.-]+\.(jpe?g|png|webp)$/i.test(src)) e('«widget.imagen»: una foto del libro, «img/nombre.jpg»');
    const t = c.recursos?.tamano(`libro/${src}`);
    if (!t) {
      e(`«widget.imagen»: no existe libro/${src} (o no se puede leer su tamaño)`);
      return null;
    }
    fuente = { origen: 'libro', src, vista: [0, 0, t.ancho, t.alto], vectorial: false, alt: 'Foto del libro' };
  } else {
    const o = esObjeto(x.consola) ? x.consola : {};
    for (const k of Object.keys(o)) if (!['maquina', 'foto'].includes(k)) e(`«widget.consola.${k}»: clave desconocida`);
    const d = typeof o.maquina === 'string' ? c.recursos?.consola(o.maquina) : null;
    if (!d) {
      e(`«widget.consola.maquina»: «${String(o.maquina)}» no es una consola del explorador (nes, snes, gb…)`);
      return null;
    }
    const principal = esObjeto(d.foto) ? { ...d.foto, id: (d.foto as Record<string, unknown>).id ?? 'principal', hotspots: d.hotspots } : null;
    const fotos = [principal, ...(Array.isArray(d.fotos) ? d.fotos : [])].filter(esObjeto);
    const id = o.foto == null ? String(principal?.id ?? 'principal') : String(o.foto);
    const f = fotos.find((y) => y.id === id);
    if (!f) {
      e(`«widget.consola.foto»: «${id}» no es una foto de ${String(o.maquina)} (${fotos.map((y) => String(y.id)).join(', ')})`);
      return null;
    }
    if (!esNumero(f.ancho) || !esNumero(f.alto) || typeof f.src !== 'string') {
      e('«widget.consola»: la foto no tiene tamaño');
      return null;
    }
    hotspots = (Array.isArray(f.hotspots) ? f.hotspots : []).filter(esObjeto);
    fuente = {
      origen: 'consola',
      src: f.src,
      vista: [0, 0, f.ancho, f.alto],
      vectorial: false,
      alt: `${String(d.titulo ?? '')}, placa ${String(d.placa ?? '')}: ${String(f.titulo ?? '')}`.trim(),
      ...(typeof f.credito === 'string' ? { credito: f.credito } : {}),
    };
  }
  const [vx, vy, vw, vh] = fuente.vista;
  const zonas: ZonaFigura[] = [];
  const cod = fuente.codigo;
  // (a code listing may have no zones: it is then the visual of a question, with its highlighted lines)
  if (cod && (x.zonas == null || (Array.isArray(x.zonas) && !x.zonas.length))) {
    if (!cod.resaltar.length) c.aviso('«widget.codigo» sin zonas ni «resaltar»: ¿qué líneas importan?');
  } else if (!Array.isArray(x.zonas) || !x.zonas.length || x.zonas.length > MAX_ZONAS) e(`«widget.zonas»: de 1 a ${MAX_ZONAS} { id, rotulo, ${cod ? 'lineas' : 'rect | poligono | hotspot'} }`);
  else
    x.zonas.forEach((z: unknown, k: number) => {
      const d = `widget.zonas ${k + 1}`;
      const o = esObjeto(z) ? z : {};
      for (const q of Object.keys(o)) if (!['id', 'rotulo', 'texto', 'rect', 'poligono', 'hotspot', 'lineas'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
      const id = String(o.id ?? o.hotspot ?? '');
      if (!ID_ZONA.test(id)) e(`«${d}.id»: minúsculas, cifras y guiones`);
      if (zonas.some((y) => y.id === id)) e(`«${d}.id»: «${id}» repetido`);
      const formas = ['rect', 'poligono', 'hotspot', 'lineas'].filter((q) => o[q] != null);
      if (cod ? formas.join() !== 'lineas' : formas.length !== 1 || formas[0] === 'lineas')
        return e(cod ? `«${d}»: en un listado, una zona son líneas: lineas [primera, última] (o [una])` : `«${d}»: una de rect [x, y, ancho, alto], poligono [[x, y], …] u hotspot (de la consola)`);
      const zona: ZonaFigura = { id, rotulo: [], rects: [] };
      let rotuloDefecto = '';
      let textoDefecto = '';
      if (cod) {
        const l = o.lineas;
        const ls = Array.isArray(l) ? l : [l];
        if (!(ls.length === 1 || ls.length === 2) || !ls.every((n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= cod.lineas.length) || (ls.length === 2 && (ls[1] as number) < (ls[0] as number)))
          e(`«${d}.lineas»: [primera, última] (o [una]) entre 1 y ${cod.lineas.length}`);
        else {
          const a0 = ls[0] as number;
          const a1 = (ls[1] ?? ls[0]) as number;
          zona.lineas = [a0, a1];
          zona.rects.push([CODIGO_MARGEN / 2, CODIGO_MARGEN + (a0 - 1) * CODIGO_LINEA, vw - CODIGO_MARGEN, (a1 - a0 + 1) * CODIGO_LINEA]);
        }
      } else if (o.rect != null) {
        const r = o.rect;
        if (!Array.isArray(r) || r.length !== 4 || !r.every(esNumero) || !((r[2] as number) > 0 && (r[3] as number) > 0)) e(`«${d}.rect»: [x, y, ancho, alto] en las coordenadas de la figura`);
        else zona.rects.push(r as [number, number, number, number]);
      } else if (o.poligono != null) {
        const p = o.poligono;
        if (!Array.isArray(p) || p.length < 3 || p.length > 24 || !p.every((q) => Array.isArray(q) && q.length === 2 && q.every(esNumero))) e(`«${d}.poligono»: de 3 a 24 puntos [x, y]`);
        else zona.poligono = p as [number, number][];
      } else {
        if (fuente!.origen !== 'consola') e(`«${d}.hotspot»: solo en una foto de consola`);
        const h = hotspots.find((y) => y.id === o.hotspot);
        if (!h) e(`«${d}.hotspot»: «${String(o.hotspot)}» no está en esa foto (${hotspots.map((y) => String(y.id)).join(', ') || 'ninguno'})`);
        else {
          zona.hotspot = String(h.id);
          for (const b of Array.isArray(h.cajas) ? h.cajas : [])
            if (Array.isArray(b) && b.length === 4 && b.every(esNumero)) zona.rects.push([b[0] as number, b[1] as number, (b[2] as number) - (b[0] as number), (b[3] as number) - (b[1] as number)]);
          if (!zona.rects.length) e(`«${d}.hotspot»: «${String(h.id)}» no tiene cajas en la foto`);
          rotuloDefecto = String(h.nombre ?? h.id);
          textoDefecto = String(h.pieza ?? '');
        }
      }
      // inside the picture
      const puntos = [...zona.rects.flatMap((r) => [[r[0], r[1]], [r[0] + r[2], r[1] + r[3]]]), ...(zona.poligono ?? [])];
      if (puntos.some(([px, py]) => px! < vx - 1e-6 || py! < vy - 1e-6 || px! > vx + vw + 1e-6 || py! > vy + vh + 1e-6)) e(`«${d}»: se sale de la figura (${vx}…${vx + vw} × ${vy}…${vy + vh})`);
      // big enough to touch on a phone (the list of zones is the alternative: a warning; not for a listing's lines)
      if (puntos.length && !cod) {
        const xs = puntos.map((p) => p[0]!);
        const ys = puntos.map((p) => p[1]!);
        const lado = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        if ((lado * ANCHO_TELEFONO) / vw < 24) c.aviso(`«${d}»: en un teléfono mide menos de 24 px (se puede ampliar y está la lista de zonas, pero tóquela usted)`);
      }
      if (o.rotulo != null) zona.rotulo = c.texto(o.rotulo, `${d}.rotulo`, true) ?? [];
      else if (rotuloDefecto) zona.rotulo = analizarTexto(rotuloDefecto);
      else e(`«${d}.rotulo»: falta (el nombre de la zona en la lista)`);
      if (contarPalabras(zona.rotulo) > 8) e(`«${d}.rotulo»: como mucho 8 palabras`);
      if (o.texto != null) {
        const tx = c.texto(o.texto, `${d}.texto`, true);
        if (tx) {
          if (contarPalabras(tx) > 40) e(`«${d}.texto»: más de 40 palabras`);
          zona.texto = tx;
          c.textos.push([`${d}.texto`, tx]);
        }
      } else if (textoDefecto) zona.texto = analizarTexto(textoDefecto);
      if (o.rotulo != null) c.textos.push([`${d}.rotulo`, zona.rotulo]);
      zonas.push(zona);
    });
  // overlapping zones: a touch picks the smallest one; warn when one hides most of another
  for (let i = 0; i < zonas.length; i++)
    for (let j = i + 1; j < zonas.length; j++) {
      const a = cajaDe(zonas[i]!);
      const b = cajaDe(zonas[j]!);
      const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
      const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const menor = Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]));
      if (menor > 0 && (ix * iy) / menor > 0.5) c.aviso(`«widget.zonas»: «${zonas[i]!.id}» y «${zonas[j]!.id}» se tapan en más de la mitad`);
    }
  return { tipo: 'figura', fuente, zonas, mandos: [], ocultar: false };
}

/** Bounding box [x0, y0, x1, y1] of a zone. */
export function cajaDe(z: ZonaFigura): [number, number, number, number] {
  const ps = [...z.rects.flatMap((r) => [[r[0], r[1]], [r[0] + r[2], r[1] + r[3]]]), ...(z.poligono ?? [])] as [number, number][];
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// ------------------------------------------------------------------ logic circuit

export function widgetLogicaDe(x: Record<string, unknown>, c: ContextoDigital, ocultar: boolean, mandos: Mando[]): WidgetLogica | null {
  let errores = 0;
  const e = (m: string) => {
    errores++;
    c.e(m);
  };
  for (const k of Object.keys(x)) if (!['tipo', 'entradas', 'piezas', 'salidas', 'cronograma', 'tabla', 'ocultar', 'dibujo', 'mandos'].includes(k)) e(`«widget.${k}»: clave desconocida`);
  if (mandos.length) e('«widget.mandos»: un circuito lógico no lleva mandos del modelo (sus interruptores son sus entradas)');
  const nombres = new Set<string>();
  const entradas: EntradaLogica[] = [];
  const lista = Array.isArray(x.entradas) ? x.entradas : [];
  if (lista.length > MAX_ENTRADAS) e(`«widget.entradas»: como mucho ${MAX_ENTRADAS}`);
  lista.forEach((y: unknown, k: number) => {
    const d = `widget.entradas ${k + 1}`;
    const o = esObjeto(y) ? y : { id: y };
    for (const q of Object.keys(o)) if (!['id', 'rotulo', 'valor', 'reloj'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
    const id = String(o.id ?? '');
    if (!ID_ENTRADA.test(id)) e(`«${d}.id»: letras y cifras, empezando por una letra («A», «CLK», «D0»)`);
    if (nombres.has(id)) e(`«${d}.id»: «${id}» repetido`);
    nombres.add(id);
    if (o.valor != null && o.valor !== 0 && o.valor !== 1) e(`«${d}.valor»: 0 o 1`);
    entradas.push({ id, rotulo: o.rotulo != null ? (c.texto(o.rotulo, `${d}.rotulo`, true) ?? []) : analizarTexto(id), valor: o.valor === 1 ? 1 : 0, reloj: o.reloj === true });
  });
  if (entradas.filter((y) => y.reloj).length > 1) e('«widget.entradas»: un solo reloj');
  const piezas: PiezaLogica[] = [];
  const lp = Array.isArray(x.piezas) ? x.piezas : [];
  if (lp.length > MAX_PIEZAS) e(`«widget.piezas»: como mucho ${MAX_PIEZAS}`);
  lp.forEach((y: unknown, k: number) => {
    const d = `widget.piezas ${k + 1}`;
    const o = esObjeto(y) ? y : {};
    for (const q of Object.keys(o)) if (!['id', 'tipo', 'entradas', 'bits', 'modulo', 'inicial', 'rotulo'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
    const id = String(o.id ?? '');
    if (!ID_PIEZA.test(id)) e(`«${d}.id»: minúsculas, cifras y guiones, empezando por una letra («n1», «ff-a»)`);
    if (nombres.has(id)) e(`«${d}.id»: «${id}» repetido`);
    nombres.add(id);
    const tipo = String(o.tipo ?? '') as TipoPieza;
    if (!TIPOS_PIEZA.includes(tipo)) return e(`«${d}.tipo»: ${TIPOS_PIEZA.join(', ')}`);
    const p: PiezaLogica = { id, tipo, entradas: (Array.isArray(o.entradas) ? o.entradas : []).map((q: unknown) => String(q)) };
    if (o.bits != null) {
      const maxBits = tipo === 'contador' ? 8 : tipo === 'mux' ? 3 : 4;
      if (!['contador', 'mux', 'decodificador'].includes(tipo)) e(`«${d}.bits»: solo en contador, mux o decodificador`);
      else if (!Number.isInteger(o.bits) || (o.bits as number) < 1 || (o.bits as number) > maxBits) e(`«${d}.bits»: de 1 a ${maxBits}`);
      else p.bits = o.bits as number;
    } else if (tipo === 'contador') p.bits = 4;
    if (o.modulo != null) {
      if (tipo !== 'contador' || !Number.isInteger(o.modulo) || (o.modulo as number) < 2 || (o.modulo as number) > 2 ** (p.bits ?? 4)) e(`«${d}.modulo»: en un contador, de 2 a 2^bits`);
      else p.modulo = o.modulo as number;
    }
    if (o.inicial != null) {
      if (!['d', 'jk', 't', 'contador', 'latch'].includes(tipo) || !Number.isInteger(o.inicial) || (o.inicial as number) < 0 || (o.inicial as number) >= (tipo === 'contador' ? (p.modulo ?? 2 ** (p.bits ?? 4)) : 2)) e(`«${d}.inicial»: el estado al encender de un biestable (0 o 1) o de un contador`);
      else p.inicial = o.inicial as number;
    }
    if (o.rotulo != null) p.rotulo = c.texto(o.rotulo, `${d}.rotulo`, true) ?? [];
    const [mn, mx] = pinesPermitidos(p);
    if (p.entradas.length < mn || p.entradas.length > mx) e(`«${d}.entradas»: ${mn === mx ? mn : `de ${mn} a ${mx}`} señales (${pinesEntrada({ ...p, entradas: new Array(mx).fill('') }).join(', ')})`);
    piezas.push(p);
  });
  const conocidas = new Set(senales({ entradas, piezas, salidas: [] }));
  piezas.forEach((p, k) => p.entradas.forEach((r, q) => {
    if (r !== '0' && r !== '1' && !conocidas.has(r)) e(`«widget.piezas ${k + 1}.entradas ${q + 1}»: «${r}» no es una entrada ni la salida de una pieza (${[...conocidas].slice(0, 12).join(', ')}…)`);
  }));
  const salidas: SalidaLogica[] = [];
  const ls = Array.isArray(x.salidas) ? x.salidas : [];
  if (ls.length > MAX_SALIDAS) e(`«widget.salidas»: como mucho ${MAX_SALIDAS}`);
  ls.forEach((y: unknown, k: number) => {
    const d = `widget.salidas ${k + 1}`;
    const o = esObjeto(y) ? y : {};
    for (const q of Object.keys(o)) if (!['id', 'de', 'rotulo'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
    const id = String(o.id ?? '');
    if (!ID_ENTRADA.test(id)) e(`«${d}.id»: letras y cifras, empezando por una letra («Y», «Q0»)`);
    if (nombres.has(id)) e(`«${d}.id»: «${id}» repetido`);
    nombres.add(id);
    const de = String(o.de ?? '');
    if (de !== '0' && !conocidas.has(de)) e(`«${d}.de»: «${de}» no es una señal del circuito`);
    salidas.push({ id, de, rotulo: o.rotulo != null ? (c.texto(o.rotulo, `${d}.rotulo`, true) ?? []) : analizarTexto(id) });
  });
  if (!entradas.length && !piezas.length) e('«widget»: un circuito lógico necesita entradas y piezas');
  const circuito: CircuitoLogico = { entradas, piezas, salidas };
  const w: WidgetLogica = { tipo: 'logica', circuito, mandos: [], ocultar };
  if (x.dibujo === false) w.dibujo = false;
  else if (x.dibujo != null && x.dibujo !== true) e('«widget.dibujo»: true o false');
  if (ocultar && !salidas.length) e('«widget.ocultar»: no hay salidas (LED) que ocultar');
  // (simulated only when it is well formed)
  if (errores) return w;
  // it settles
  try {
    if (!iniciar(circuito).estable) e('el circuito oscila al encender (un lazo sin biestable): no se puede simular');
    if (!circuitoSecuencial(circuito) && !tablaVerdad(circuito).estable) e('el circuito oscila con alguna combinación de entradas');
  } catch (er) {
    e(`el circuito no se puede simular: ${er instanceof Error ? er.message : String(er)}`);
  }
  if (x.tabla != null) {
    if (x.tabla !== true && x.tabla !== false) e('«widget.tabla»: true o false');
    else if (x.tabla) {
      if (circuitoSecuencial(circuito)) e('«widget.tabla»: la tabla de verdad es de un circuito combinacional (sin biestables ni contadores)');
      else if (entradasTabla(circuito).length > 4) e('«widget.tabla»: como mucho 4 entradas (16 filas)');
      w.tabla = true;
    }
  }
  if (x.cronograma != null) {
    const cr = cronogramaDe(x.cronograma, circuito, c);
    if (cr) w.cronograma = cr;
  }
  if (w.dibujo === false && !w.cronograma) e('«widget.dibujo: false» sin «cronograma»: no quedaría nada que ver');
  return w;
}

function cronogramaDe(x: unknown, circuito: CircuitoLogico, c: ContextoDigital): CronogramaLogica | null {
  const { e } = c;
  if (!esObjeto(x)) {
    e('«widget.cronograma»: { ciclos, estimulo, senales }');
    return null;
  }
  for (const k of Object.keys(x)) if (!['ciclos', 'estimulo', 'senales', 'etiquetas'].includes(k)) e(`«widget.cronograma.${k}»: clave desconocida`);
  const ciclos = Number.isInteger(x.ciclos) ? (x.ciclos as number) : 0;
  if (ciclos < 2 || ciclos > 16) e('«widget.cronograma.ciclos»: de 2 a 16');
  const estimulo: Record<string, Nivel[]> = {};
  for (const [k, v] of Object.entries(esObjeto(x.estimulo) ? x.estimulo : {})) {
    const en = circuito.entradas.find((y) => y.id === k);
    if (!en || en.reloj) {
      e(`«widget.cronograma.estimulo.${k}»: una entrada del circuito que no sea el reloj`);
      continue;
    }
    const xs = typeof v === 'string' ? v.replace(/\s+/g, '').split('') : Array.isArray(v) ? v.map(String) : [];
    if (xs.length !== ciclos || !xs.every((q) => q === '0' || q === '1')) e(`«widget.cronograma.estimulo.${k}»: ${ciclos} niveles («0110…»), uno por ciclo`);
    else estimulo[k] = xs.map((q) => (q === '1' ? 1 : 0));
  }
  if (x.estimulo != null && !esObjeto(x.estimulo)) e('«widget.cronograma.estimulo»: { entrada: "0101…" }');
  const sen = Array.isArray(x.senales) ? x.senales.map(String) : [];
  const validas = new Set([...senales(circuito), ...circuito.salidas.map((s) => s.id)]);
  if (!sen.length || sen.length > 8) e('«widget.cronograma.senales»: de 1 a 8 señales (filas del cronograma)');
  for (const s of sen) if (!validas.has(s)) e(`«widget.cronograma.senales»: «${s}» no es una señal del circuito`);
  if (!circuito.entradas.some((y) => y.reloj) && !Object.keys(estimulo).length) e('«widget.cronograma»: sin reloj ni estímulo no cambia nada');
  if (ciclos >= 2 && !cronograma(circuito, ciclos, estimulo).estable) e('«widget.cronograma»: el circuito no se asienta en algún tramo');
  // (motor12e, autor-digital-E: the cycles' names — one bit per cycle of a UART frame, a CAN arbitration)
  let etiquetas: string[] | undefined;
  if (x.etiquetas != null) {
    const xs = Array.isArray(x.etiquetas) ? x.etiquetas.map((q) => (typeof q === 'number' ? String(q) : q)) : null;
    if (!xs || xs.length !== ciclos || !xs.every((q) => typeof q === 'string' && q.trim() !== '' && q.trim().length <= 6)) e(`«widget.cronograma.etiquetas»: ${ciclos} nombres de hasta 6 caracteres, uno por ciclo`);
    else etiquetas = xs.map((q) => (q as string).trim());
  }
  return { ciclos, estimulo, senales: sen, ...(etiquetas ? { etiquetas } : {}) };
}

// ------------------------------------------------------------------ step types

export interface ResultadoDigital {
  actividad: ActividadDigital | null;
  textos: [string, Texto][];
}

/** The step of a «tocar» or «tabla» card, or of an «averia», «diseno» or «dibujar» card whose widget is «logica». */
export function actividadDigitalDe(tipo: 'tocar' | 'tabla' | 'averia' | 'diseno' | 'dibujar', x: Record<string, unknown>, t: Tarjeta, c: ContextoDigital): ResultadoDigital {
  const out: ResultadoDigital = { actividad: null, textos: [] };
  let errores = 0;
  const e = (m: string) => {
    errores++;
    c.e(m);
  };
  const claves = (ok: string[], d: string) => {
    for (const k of Object.keys(x)) if (!ok.includes(k)) e(`«${d}.${k}»: clave desconocida`);
  };
  const explicacion = (v: unknown, campo: string, obligatorio = true): Texto | undefined => {
    const r = c.texto(v, campo, obligatorio);
    if (r && contarPalabras(r) > 40) e(`«${campo}»: ${contarPalabras(r)} palabras (máximo 40)`);
    if (r) out.textos.push([campo, r]);
    return r;
  };
  const w = t.widget;
  if (tipo === 'tocar') {
    claves(['bien', 'todas', 'porque'], 'tocar');
    if (w?.tipo !== 'figura') {
      e('una tarjeta «tocar» lleva un widget «figura» con sus zonas');
      return out;
    }
    const ids = w.zonas.map((z) => z.id);
    const bien = (Array.isArray(x.bien) ? x.bien : x.bien != null ? [x.bien] : []).map(String);
    if (!bien.length) e('«tocar.bien»: la zona (o zonas) que responden');
    for (const z of bien) if (!ids.includes(z)) e(`«tocar.bien»: «${z}» no es una zona de la figura (${ids.join(', ')})`);
    if (bien.length >= ids.length) e('«tocar.bien»: alguna zona tiene que no ser la respuesta');
    const todas = x.todas === true;
    if (x.todas != null && typeof x.todas !== 'boolean') e('«tocar.todas»: true o false');
    if (!todas && bien.length > 1) c.aviso('«tocar»: varias zonas buenas y «todas: false»: vale tocar una cualquiera');
    const porque: Record<string, Texto> = {};
    const fp = esObjeto(x.porque) ? x.porque : {};
    for (const [k, v] of Object.entries(fp)) {
      if (!ids.includes(k)) e(`«tocar.porque.${k}»: no es una zona`);
      else if (bien.includes(k)) e(`«tocar.porque.${k}»: es una zona buena (su explicación va en «exito»)`);
      else {
        const r = explicacion(v, `tocar.porque.${k}`);
        if (r) porque[k] = r;
      }
    }
    for (const z of ids) if (!bien.includes(z) && !porque[z]) e(`«tocar.porque»: falta por qué no es «${z}» (cada zona que no es la respuesta lleva su explicación)`);
    out.actividad = { tipo: 'tocar', bien, todas, porque } satisfies Tocar;
    return out;
  }
  if (w?.tipo !== 'logica') {
    e(`una tarjeta «${tipo}» ${tipo === 'tabla' ? 'lleva' : 'con circuito lógico lleva'} un widget «logica»`);
    return out;
  }
  const circ = w.circuito;
  const ledOSenal = (s: string) => circ.salidas.some((y) => y.id === s) || senales(circ).includes(s);
  if (tipo === 'tabla') {
    claves(['salidas'], 'tabla');
    if (circuitoSecuencial(circ)) e('una «tabla» de verdad es de un circuito combinacional');
    const ent = entradasTabla(circ);
    if (!ent.length || ent.length > 4) e('una «tabla» necesita de 1 a 4 entradas (hasta 16 filas)');
    const ids = (Array.isArray(x.salidas) ? x.salidas.map(String) : circ.salidas.map((s) => s.id));
    if (!ids.length || ids.length > 3) e('«tabla.salidas»: de 1 a 3 columnas que rellenar');
    for (const s of ids) if (!ledOSenal(s)) e(`«tabla.salidas»: «${s}» no es una salida ni una señal del circuito`);
    if (w.cronograma) e('una «tabla» no lleva cronograma');
    const salidas = ids.map((id) => ({ id, rotulo: circ.salidas.find((y) => y.id === id)?.rotulo ?? analizarTexto(id) }));
    out.actividad = { tipo: 'tabla', entradas: ent, salidas, esperado: ent.length && ent.length <= 4 ? esperadoTabla(circ, ids) : [] } satisfies TablaPaso;
    return out;
  }
  if (tipo === 'dibujar') {
    claves(['senal', 'rotulo'], 'dibujar');
    if (!w.cronograma) {
      e('«dibujar» en modo digital: el widget lleva su «cronograma» (los ciclos y el estímulo)');
      return out;
    }
    const s = String(x.senal ?? '');
    if (!ledOSenal(s)) e(`«dibujar.senal»: «${s}» no es una señal ni un LED del circuito`);
    if (circ.entradas.some((y) => y.id === s)) e('«dibujar.senal»: una entrada se ve en el estímulo: dibuje una salida');
    const rotulo = x.rotulo != null ? (c.texto(x.rotulo, 'dibujar.rotulo', true) ?? []) : (circ.salidas.find((y) => y.id === s)?.rotulo ?? analizarTexto(s));
    const esperado = ondaDe(w, s);
    if (esperado.every((v) => v === esperado[0])) c.aviso('«dibujar.senal» no cambia en todo el cronograma: ¿es lo que se quiere dibujar?');
    out.actividad = { tipo: 'dibujar-digital', senal: s, rotulo, esperado } satisfies DibujarDigital;
    return out;
  }
  if (tipo === 'diseno') {
    claves(['salida', 'funcion', 'columna', 'permitidas', 'minimo', 'exigir_minimo', 'max_puertas', 'referencia'], 'diseno');
    if (circuitoSecuencial(circ)) e('un «diseno» lógico es combinacional');
    const ent = entradasTabla(circ);
    if (!ent.length || ent.length > 4) e('un «diseno» lógico: de 1 a 4 entradas');
    const salida = String(x.salida ?? circ.salidas[0]?.id ?? '');
    if (!circ.salidas.some((y) => y.id === salida)) e(`«diseno.salida»: el LED que gobierna su diseño (${circ.salidas.map((y) => y.id).join(', ')})`);
    if (circ.piezas.length) e('un «diseno» lógico empieza sin piezas: las pone el lector (el widget solo da entradas y el LED)');
    const permitidas = (Array.isArray(x.permitidas) ? x.permitidas.map(String) : ['and', 'or', 'not']) as TipoPuerta[];
    for (const p of permitidas) if (!PUERTAS.includes(p)) e(`«diseno.permitidas»: «${p}» no es una puerta (${PUERTAS.join(', ')})`);
    // the target: a column of the truth table («0111») or the reference circuit's
    const filas = 2 ** ent.length;
    let objetivo: Nivel[] = [];
    if (x.columna != null) {
      const s = String(x.columna).replace(/\s+/g, '');
      if (s.length !== filas || !/^[01]+$/.test(s)) e(`«diseno.columna»: ${filas} ceros y unos, la salida fila a fila (${ent.join(', ')} = 0…0 primero)`);
      else objetivo = s.split('').map((q) => (q === '1' ? 1 : 0));
    }
    const ref = Array.isArray(x.referencia) ? x.referencia : [];
    if (!ref.length) e('«diseno.referencia»: un circuito que lo hace con el mínimo de puertas ([{ tipo, entradas }], cada una lee entradas o p1, p2…)');
    const piezasRef: PiezaLogica[] = [];
    ref.forEach((y: unknown, k: number) => {
      const o = esObjeto(y) ? y : {};
      const tp = String(o.tipo ?? '') as TipoPuerta;
      if (!permitidas.includes(tp)) e(`«diseno.referencia ${k + 1}.tipo»: una de las permitidas (${permitidas.join(', ')})`);
      const es = (Array.isArray(o.entradas) ? o.entradas : []).map(String);
      const validas = [...ent, ...piezasRef.map((p) => p.id)];
      for (const r of es) if (!validas.includes(r)) e(`«diseno.referencia ${k + 1}.entradas»: «${r}» (entradas o puertas anteriores: ${validas.join(', ')})`);
      if (es.length !== (tp === 'not' || tp === 'buf' ? 1 : 2)) e(`«diseno.referencia ${k + 1}.entradas»: ${tp === 'not' || tp === 'buf' ? 'una' : 'dos'}`);
      piezasRef.push({ id: `p${k + 1}`, tipo: tp, entradas: es });
    });
    const minimo = Number.isInteger(x.minimo) ? (x.minimo as number) : piezasRef.length;
    if (piezasRef.length && minimo !== piezasRef.length) e(`«diseno.minimo» (${minimo}) no es el número de puertas de la referencia (${piezasRef.length})`);
    const maxPuertas = Number.isInteger(x.max_puertas) ? (x.max_puertas as number) : Math.max(minimo + 3, 4);
    if (maxPuertas < minimo || maxPuertas > 12) e('«diseno.max_puertas»: entre el mínimo y 12');
    const exigirMinimo = x.exigir_minimo === true;
    const d: DisenoLogico = { tipo: 'diseno-logico', salida, objetivo, permitidas, minimo, exigirMinimo, maxPuertas };
    if (!errores && piezasRef.length && ent.length && ent.length <= 4) {
      const cref: CircuitoLogico = { entradas: circ.entradas, piezas: piezasRef, salidas: [{ id: salida, de: piezasRef[piezasRef.length - 1]!.id, rotulo: [] }] };
      const col = tablaVerdad(cref, [salida]).filas.map((f) => f.s[0]!);
      if (objetivo.length && col.join('') !== objetivo.join('')) e(`«diseno.referencia» da la columna ${col.join('')}, no la de «diseno.columna» (${objetivo.join('')})`);
      if (!objetivo.length) d.objetivo = col;
      if (d.objetivo.every((v) => v === d.objetivo[0])) e('«diseno»: la función es constante');
      // the fewest gates, really (a search over every circuit with fewer gates)
      const r = minimoPuertas(mascaraDe(d.objetivo), ent.length, permitidas, Math.max(0, minimo - 1));
      if (r.minimo != null) e(`«diseno.minimo»: con ${r.minimo} ${r.minimo === 1 ? 'puerta' : 'puertas'} ${permitidas.join('/')} ya se hace (la referencia usa ${minimo})`);
      else if (r.agotado) c.aviso('«diseno.minimo»: no se ha podido comprobar que no haya un circuito más pequeño (demasiadas combinaciones)');
    }
    out.actividad = d;
    return out;
  }
  // averia on a logic circuit
  claves(['fallos', 'sospechosos', 'puntos', 'pasos', 'eleccion', 'preguntar_tipo'], 'averia');
  if (circuitoSecuencial(circ)) e('una «averia» lógica, por ahora, en circuitos combinacionales (sin biestables ni contadores)');
  if (w.cronograma || w.ocultar) e('una «averia» lógica no lleva cronograma ni «ocultar» (los LED son el síntoma)');
  const piezasIds = circ.piezas.map((p) => p.id);
  const sospechosos: AveriaLogica['sospechosos'] = [];
  const lsos = Array.isArray(x.sospechosos) ? x.sospechosos : piezasIds.map((id) => ({ id }));
  if (lsos.length < 2 || lsos.length > 8) e('«averia.sospechosos»: de 2 a 8 piezas del circuito');
  lsos.forEach((y: unknown, k: number) => {
    const o = esObjeto(y) ? y : { id: y };
    const id = String(o.id ?? '');
    if (!piezasIds.includes(id)) e(`«averia.sospechosos ${k + 1}»: «${id}» no es una pieza del circuito`);
    if (sospechosos.some((s) => s.id === id)) e(`«averia.sospechosos»: «${id}» repetido`);
    sospechosos.push({ id, rotulo: o.rotulo != null ? (c.texto(o.rotulo, `averia.sospechosos ${k + 1}.rotulo`, true) ?? []) : analizarTexto(nombrePieza(circ, id)) });
  });
  const fallos: FalloLogicoPaso[] = [];
  const lf = Array.isArray(x.fallos) ? x.fallos : [];
  if (!lf.length || lf.length > 12) e('«averia.fallos»: de 1 a 12 { id, pieza, tipo: atascada-0 | atascada-1 | sin-conexion, texto }');
  lf.forEach((y: unknown, k: number) => {
    const d = `averia.fallos ${k + 1}`;
    const o = esObjeto(y) ? y : {};
    for (const q of Object.keys(o)) if (!['id', 'pieza', 'tipo', 'pin', 'senal', 'texto'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
    const id = String(o.id ?? '');
    if (!ID_ZONA.test(id)) e(`«${d}.id»: minúsculas, cifras y guiones`);
    if (fallos.some((f) => f.id === id)) e(`«${d}.id»: «${id}» repetido`);
    const pieza = circ.piezas.find((p) => p.id === o.pieza);
    if (!pieza) return e(`«${d}.pieza»: una pieza del circuito`);
    if (!sospechosos.some((s) => s.id === pieza.id)) e(`«${d}.pieza»: «${pieza.id}» no está entre los sospechosos`);
    const tf = String(o.tipo ?? '');
    let fallo: FalloLogico;
    if (tf === 'atascada-0' || tf === 'atascada-1') {
      const sals = salidasDe(pieza);
      const senal = o.senal != null ? String(o.senal) : sals[0]!;
      if (!sals.includes(senal)) e(`«${d}.senal»: una salida de ${pieza.id} (${sals.join(', ')})`);
      if (o.pin != null) e(`«${d}.pin»: solo en «sin-conexion»`);
      fallo = { tipo: tf, senal };
    } else if (tf === 'sin-conexion') {
      const n = pieza.entradas.length;
      if (!Number.isInteger(o.pin) || (o.pin as number) < 1 || (o.pin as number) > n) e(`«${d}.pin»: la entrada de ${pieza.id} que queda al aire (de 1 a ${n})`);
      fallo = { tipo: tf, pieza: pieza.id, pin: Math.max(0, Math.min(n - 1, Number(o.pin) - 1)) };
    } else return e(`«${d}.tipo»: atascada-0, atascada-1 o sin-conexion`);
    fallos.push({ id, pieza: pieza.id, tipo: tf, fallo, texto: explicacion(o.texto, `${d}.texto`) ?? [] });
  });
  for (const s of sospechosos) if (!fallos.some((f) => f.pieza === s.id)) e(`«averia.sospechosos»: «${s.id}» no tiene ninguna avería en «fallos» (sin ella no se puede explicar por qué no es)`);
  // probe points: every wire, and every input pin when a pin can be open
  const puntos: PuntoSonda[] = [];
  if (x.puntos != null) {
    if (!Array.isArray(x.puntos) || x.puntos.length < 2 || x.puntos.length > 24) e('«averia.puntos»: de 2 a 24 { id, rotulo, senal | pieza + pin }');
    else
      x.puntos.forEach((y: unknown, k: number) => {
        const d = `averia.puntos ${k + 1}`;
        const o = esObjeto(y) ? y : {};
        const id = String(o.id ?? '');
        if (!ID_ZONA.test(id)) e(`«${d}.id»: minúsculas, cifras y guiones`);
        const rot = c.texto(o.rotulo, `${d}.rotulo`, true) ?? [];
        let punto: Punto | null = null;
        if (o.senal != null && senales(circ).includes(String(o.senal))) punto = { senal: String(o.senal) };
        else if (o.pieza != null && circ.piezas.find((p) => p.id === o.pieza) && Number.isInteger(o.pin) && (o.pin as number) >= 1 && (o.pin as number) <= circ.piezas.find((p) => p.id === o.pieza)!.entradas.length) punto = { pieza: String(o.pieza), pin: (o.pin as number) - 1 };
        else e(`«${d}»: senal (una señal del circuito) o pieza + pin (1, 2…)`);
        if (punto) puntos.push({ id, rotulo: rot, punto });
      });
  } else puntos.push(...puntosPorDefecto(circ, fallos.some((f) => f.tipo === 'sin-conexion')));
  const pasos = x.pasos == null ? null : Number.isInteger(x.pasos) && (x.pasos as number) >= 1 ? (x.pasos as number) : (e('«averia.pasos»: medidas permitidas (1 o más)'), null);
  const eleccion = x.eleccion === 'azar' ? 'azar' : 'fija';
  if (x.eleccion != null && x.eleccion !== 'azar' && x.eleccion !== 'fija') e('«averia.eleccion»: fija o azar');
  const a: AveriaLogica = { tipo: 'averia-logica', fallos, sospechosos, puntos, pasos, eleccion, preguntarTipo: x.preguntar_tipo === true };
  // findable: each fault reads differently from the healthy board somewhere; faults of different suspects differ
  if (!errores && fallos.length && puntos.length) {
    const firma = (f: FalloLogico | null) => lecturasTodas(circ, puntos.map((p) => p.punto), f).join('');
    const sana = firma(null);
    const firmas = fallos.map((f) => firma(f.fallo));
    fallos.forEach((f, k) => {
      if (firmas[k] === sana) e(`la avería «${f.id}» (${NOMBRE_FALLO_LOGICO[f.tipo]}) mide lo mismo que el circuito sano con todas las entradas y en todos los puntos: no se puede encontrar`);
    });
    for (let i = 0; i < fallos.length; i++)
      for (let j = i + 1; j < fallos.length; j++)
        if (fallos[i]!.pieza !== fallos[j]!.pieza && firmas[i] === firmas[j]) e(`las averías «${fallos[i]!.id}» y «${fallos[j]!.id}» (de piezas distintas) miden lo mismo en todo: añada un punto que las distinga`);
  }
  out.actividad = a;
  return out;
}

/** Every reading of every point for every combination of the inputs, with fault `f`. */
function lecturasTodas(c: CircuitoLogico, puntos: Punto[], f: FalloLogico | null): Lectura[] {
  const ent = entradasTabla(c);
  const out: Lectura[] = [];
  for (let r = 0; r < 2 ** ent.length; r++) {
    const niveles = Object.fromEntries(ent.map((id, k) => [id, ((r >> (ent.length - 1 - k)) & 1) as Nivel]));
    const s = iniciar(c, f, niveles);
    for (const p of puntos) out.push(sondear(c, s, p, f));
  }
  return out;
}

/** The probe points of a circuit by default: every signal (inputs and outputs of pieces), and each input pin if asked. */
export function puntosPorDefecto(c: CircuitoLogico, pines: boolean): PuntoSonda[] {
  const out: PuntoSonda[] = [];
  for (const en of c.entradas) out.push({ id: `s-${en.id.toLowerCase()}`, rotulo: en.rotulo, punto: { senal: en.id } });
  for (const p of c.piezas)
    for (const s of salidasDe(p)) {
      const nombre = nombrePieza(c, p.id);
      const suf = s.includes('.') ? ` (${s.split('.')[1]!.toUpperCase()})` : '';
      out.push({ id: `s-${s.replace(/\./g, '-')}`, rotulo: analizarTexto(`Salida de ${nombre}${suf}`), punto: { senal: s } });
    }
  if (pines)
    for (const p of c.piezas)
      p.entradas.forEach((r, k) => {
        if (r === '0' || r === '1') return;
        out.push({ id: `p-${p.id}-${k + 1}`, rotulo: analizarTexto(`Entrada ${pinesEntrada(p)[k]} de ${nombrePieza(c, p.id)}`), punto: { pieza: p.id, pin: k } });
      });
  return out;
}
