// Model thumbnails: one shared off-screen renderer draws each model once (same studio and framing as the
// viewer) into a small image (WebP where the browser can encode it, else PNG); sequential, one per idle slot,
// and the renderer is released when the queue is empty. Part of the 3D chunk, imported lazily by the
// glossary and by the catalogue (whose thumbnails are normally the WebP files pre-rendered by
// scripts/miniaturas.mjs with a transparent background, `fondo` null; this is its fallback).

import { Box3, MeshBasicMaterial, PerspectiveCamera, Sphere, Vector3, WebGLRenderer, NeutralToneMapping, SRGBColorSpace } from 'three';
import { crearEstudio, type Estudio } from './motor/estudio';
import { crearPlaca } from './motor/placa';
import type { DatosModelo } from './modelos/tipos';
import { crearModelo, liberarModelo } from './modelos';
import type { Montaje, Parametros } from './modelos/tipos';

interface Pedido {
  clave: string;
  tipo: string;
  p: Parametros;
  montaje: Montaje;
  /** Studio background colour, or null for a transparent background. */
  fondo: string | null;
  oscuro: boolean;
  resolver: (url: string) => void;
  rechazar: (e: unknown) => void;
}

const W = 384;
const H = 288;
const hechas = new Map<string, Promise<string>>();
const cola: Pedido[] = [];
let renderer: WebGLRenderer | null = null;
let estudio: Estudio | null = null;
let trabajando = false;
let cierre: ReturnType<typeof setTimeout> | null = null;

function preparar(): void {
  if (renderer) return;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  renderer = new WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  estudio = crearEstudio(renderer);
}

function soltar(): void {
  estudio?.liberar();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = null;
  estudio = null;
}

function dibujar(x: Pedido): Promise<string> {
  preparar();
  const r = renderer!;
  const e = estudio!;
  e.ponerFondo(x.fondo ?? '#000000', x.oscuro);
  if (x.fondo == null) {
    // Transparent: the page's own studio colour shows through (one image for every theme); a shadow
    // strength between the light (0.3) and dark (0.55) studios.
    e.escena.background = null;
    r.setClearColor(0x000000, 0);
    (e.sombra.material as MeshBasicMaterial).opacity = 0.4;
  }
  // Thumbnails: markings at board resolution (a 1024 px texture per marking is wasted at this size).
  const g = crearModelo(x.tipo, x.p, { montaje: x.montaje, marcas: 'baja' });
  e.raiz.add(g);
  const caja = new Box3().setFromObject(g);
  const tam = caja.getSize(new Vector3());
  const datos = g.userData as DatosModelo;
  // Board top, shadow and pads a real distance apart, as in the viewer.
  const capa = Math.max(0.004, caja.getBoundingSphere(new Sphere()).radius * 0.004);
  const placa = x.montaje === 'placa' && datos.huella.pads.length ? crearPlaca(datos.huella, tam.x, tam.y, 1.6, 2 * capa) : null;
  if (placa) {
    e.raiz.add(placa.grupo);
    caja.expandByPoint(new Vector3(caja.min.x, caja.min.y, -0.5));
    caja.max.z = Math.max(caja.max.z, 0);
    caja.min.z = Math.max(caja.min.z, -1.6);
    e.ajustarSombra(tam.x * 0.85, tam.y * 0.85, capa + 0.01);
  } else e.ajustarSombra(tam.x * 0.92, tam.y * 0.92, caja.min.z);
  const esfera = caja.getBoundingSphere(new Sphere());
  const cam = new PerspectiveCamera(30, W / H, 0.1, 5000);
  const dist = (esfera.radius / Math.sin((30 * Math.PI) / 360)) * 1.08;
  const az = 0.5;
  const el = 0.55;
  cam.up.set(0, 0, 1);
  cam.position.set(esfera.center.x + dist * Math.cos(el) * Math.sin(az), esfera.center.y - dist * Math.cos(el) * Math.cos(az), esfera.center.z + dist * Math.sin(el));
  cam.lookAt(esfera.center);
  // Tight depth range (the board piece reaches a little beyond the model's sphere).
  cam.near = Math.max(dist - esfera.radius * 2.2, dist / 100);
  cam.far = dist + esfera.radius * 2.2;
  cam.updateProjectionMatrix();
  r.render(e.escena, cam);
  e.raiz.remove(g);
  liberarModelo(g);
  if (placa) {
    e.raiz.remove(placa.grupo);
    placa.liberar();
  }
  return new Promise((res, rej) =>
    (r.domElement as HTMLCanvasElement).toBlob((b) => (b ? res(URL.createObjectURL(b)) : rej(new Error('toBlob'))), 'image/webp', 0.9),
  );
}

async function trabajar(): Promise<void> {
  if (trabajando) return;
  trabajando = true;
  if (cierre) clearTimeout(cierre);
  while (cola.length) {
    const x = cola.shift()!;
    try {
      x.resolver(await dibujar(x));
    } catch (e) {
      x.rechazar(e);
    }
    // Leave the main thread to the page between thumbnails.
    await new Promise((r) => setTimeout(r, 16));
  }
  trabajando = false;
  cierre = setTimeout(soltar, 3000);
}

/** Object URL of a model thumbnail (cached per model, parameters and background). */
export function miniatura(tipo: string, p: Parametros, montaje: Montaje, fondo: string | null, oscuro: boolean): Promise<string> {
  const clave = `${tipo}|${JSON.stringify(p)}|${montaje}|${fondo ?? 'transparente'}`;
  let pr = hechas.get(clave);
  if (!pr) {
    pr = new Promise<string>((resolver, rechazar) => cola.push({ clave, tipo, p, montaje, fondo, oscuro, resolver, rechazar }));
    hechas.set(clave, pr);
    void trabajar();
  }
  return pr;
}
