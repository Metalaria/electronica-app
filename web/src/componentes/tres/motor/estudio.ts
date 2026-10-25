// The «studio» shared by the viewer and the thumbnail renderer: soft lighting (hemisphere + key + fill, and
// a small room environment for the PBR metals), a baked contact shadow under the model and a background
// colour from the theme. No shadow maps: the Iris Plus 640 is the reference GPU.

import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Estudio {
  escena: Scene;
  raiz: Group;
  sombra: Mesh;
  /** Places and scales the contact shadow for a model footprint (mm) resting at height z. */
  ajustarSombra(ancho: number, fondo: number, z: number): void;
  ponerFondo(color: string, oscuro: boolean): void;
  liberar(): void;
}

let texturaSombra: { t: Texture; usos: number } | null = null;

/** A soft rounded-rectangle shadow, blurred once on a canvas (shared by every studio). */
function sombraTextura(): Texture {
  if (texturaSombra) {
    texturaSombra.usos++;
    return texturaSombra.t;
  }
  const N = 256;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const g = c.getContext('2d');
  if (g) {
    // The shape is drawn off the canvas and only its blurred shadow falls inside: works without ctx.filter.
    g.shadowColor = 'rgba(0,0,0,1)';
    g.shadowBlur = N * 0.12;
    g.shadowOffsetX = N * 4;
    g.fillStyle = '#000';
    const m = N * 0.22;
    const r = N * 0.12;
    g.beginPath();
    g.roundRect(m - N * 4, m, N - 2 * m, N - 2 * m, r);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  texturaSombra = { t, usos: 1 };
  return t;
}

function soltarSombra(): void {
  if (!texturaSombra) return;
  if (--texturaSombra.usos <= 0) {
    texturaSombra.t.dispose();
    texturaSombra = null;
  }
}

export function crearEstudio(renderer: WebGLRenderer): Estudio {
  const escena = new Scene();
  const raiz = new Group();
  escena.add(raiz);

  const hemi = new HemisphereLight(0xffffff, 0xb9b2a6, 1.1);
  hemi.position.set(0, 0, 1);
  const clave = new DirectionalLight(0xffffff, 2.1);
  clave.position.set(-0.6, -0.9, 1.4);
  const relleno = new DirectionalLight(0xdfe8ff, 0.7);
  relleno.position.set(1.1, 0.8, 0.5);
  escena.add(hemi, clave, relleno);

  // Small room environment so that tin, copper and gold look like metals (prefiltered once).
  const pmrem = new PMREMGenerator(renderer);
  const sala = new RoomEnvironment();
  const env = pmrem.fromScene(sala, 0.04).texture;
  sala.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    }
  });
  pmrem.dispose();
  escena.environment = env;
  escena.environmentIntensity = 0.55;

  const matSombra = new MeshBasicMaterial({ map: sombraTextura(), transparent: true, depthWrite: false, opacity: 0.32, color: 0x000000 });
  const sombra = new Mesh(new PlaneGeometry(1, 1), matSombra);
  sombra.renderOrder = -1;
  escena.add(sombra);

  return {
    escena,
    raiz,
    sombra,
    ajustarSombra(ancho, fondo, z) {
      // The texture's shape fills 56 % of the plane: scale so that the dark core matches the footprint.
      sombra.scale.set(Math.max(1, ancho) / 0.5, Math.max(1, fondo) / 0.5, 1);
      sombra.position.set(0, 0, z - 0.01);
    },
    ponerFondo(color, oscuro) {
      escena.background = new Color(color);
      matSombra.opacity = oscuro ? 0.55 : 0.3;
    },
    liberar() {
      env.dispose();
      sombra.geometry.dispose();
      matSombra.dispose();
      soltarSombra();
    },
  };
}
