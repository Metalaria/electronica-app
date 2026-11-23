// 1.3.1 (qa131-plataforma): unit checks of the platform review, without a browser.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/qa131-plataforma-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');

function ficheros(dir: string, salida: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, salida);
    else salida.push(p);
  }
  return salida;
}

// The practice items a book revision retired keep their 1.0 ids (practica10.mjs retiradosDe), but their equation was
// the old one: cap33's «ley-v-f» and «velocidad-sincrona» pointed at ec/*.svg files no longer published, so their
// formula showed as a broken image (and a failed request) in a practice session.
test('todo fichero que nombra el JSON publicado del libro existe, con sus mayúsculas exactas', () => {
  // (a name is relative to the book folder, to public/ — consolas/… — or to the JSON's own folder)
  const publico = path.dirname(libro);
  const todos = ficheros(libro);
  const conjunto = new Set(ficheros(publico).map((f) => path.relative(publico, f)));
  const re = /"([\w./%-]+\.(?:png|jpe?g|webp|svg|glb|gltf|json|avif|woff2?|pdf|mp4|webm|bin))"/g;
  const faltan: string[] = [];
  for (const f of todos) {
    if (!f.endsWith('.json')) continue;
    const texto = fs.readFileSync(f, 'utf8');
    for (let m = re.exec(texto); m; m = re.exec(texto)) {
      const ref = m[1]!.replace(/^\.\//, '');
      const candidatos = [ref, `libro/${ref}`, path.join(path.relative(publico, path.dirname(f)), ref)].map((x) => path.normalize(x));
      if (!candidatos.some((x) => conjunto.has(x))) faltan.push(`${path.relative(libro, f)}: ${ref}`);
    }
  }
  expect([...new Set(faltan)]).toEqual([]);
});

// ------------------------------------------------------------------ «Informe de fallos» (the owner's crash on Android)

test.describe('informe de fallos: memoria y migas de acciones', () => {
  class Memoria {
    m = new Map<string, string>();
    getItem(k: string) {
      return this.m.get(k) ?? null;
    }
    setItem(k: string, v: string) {
      this.m.set(k, v);
    }
    removeItem(k: string) {
      this.m.delete(k);
    }
  }

  test('cada fallo lleva las últimas muestras de memoria, y el texto del informe las enseña', async () => {
    const I = await import('../src/lib/informe-fallos.ts');
    I.usarAlmacenamiento(new Memoria());
    let usado = 80 * 1048576;
    Object.defineProperty(globalThis.performance, 'memory', { configurable: true, get: () => ({ usedJSHeapSize: usado, jsHeapSizeLimit: 512 * 1048576 }) });
    try {
      I.miga('ruta #/consolas/nes/placa3d');
      usado = 300 * 1048576;
      I.miga('ruta #/protoboard');
      const e = I.informarFallo('error', new Error('algo'))!;
      expect(e.mem!.map((x) => x.replace(/^\d\d:\d\d:\d\d /, ''))).toEqual(['montón 80 MB', 'montón 300 MB', 'montón 300 MB']);
      const texto = I.textoInforme('1.3.1');
      expect(texto).toContain('   Memoria:');
      expect(texto).toMatch(/\n {5}\d\d:\d\d:\d\d montón 300 MB/);
    } finally {
      delete (globalThis.performance as unknown as { memory?: unknown }).memory;
      I.usarAlmacenamiento(undefined);
    }
  });

  test('un cierre de golpe hallado al abrir trae las muestras de memoria de la página que murió', async () => {
    const I = await import('../src/lib/informe-fallos.ts');
    const a = new Memoria();
    I.usarAlmacenamiento(a);
    try {
      const t = Date.now() - 600_000;
      const m = ['20:29:55 montón 180 MB · 5200 nodos · 4 lienzos 9,8 Mpx · WebGL 1', '20:40:20 montón 410 MB · 9100 nodos · 7 lienzos 31,0 Mpx · WebGL 1 (+2 fuera de la página)'];
      a.setItem('epa-informe-sesion', JSON.stringify({ otra: { t, e: 'activa', v: '1.3.0', r: '#/protoboard', b: ['20:29:55 ruta #/protoboard'], m } }));
      const [e] = await I.revisarCierres({ sinLatido: 1000, esperar: async () => {}, respuesta: 0 });
      expect(e!.k).toBe('cierre');
      expect(e!.mem).toEqual(m);
      expect(I.textoInforme('1.3.1')).toContain('WebGL 1 (+2 fuera de la página)');
    } finally {
      I.usarAlmacenamiento(undefined);
    }
  });

  test('las migas de acciones se limitan: la misma una vez cada 15 s y seis por minuto', async () => {
    const I = await import('../src/lib/informe-fallos.ts');
    I.usarAlmacenamiento(new Memoria());
    const real = Date.now;
    let t = 1_800_000_000_000;
    Date.now = () => t;
    try {
      for (let k = 0; k < 10; k++) I.migaAccion('protoboard: arrastrar pata');
      expect(I.migasActuales().filter((x) => x.endsWith('arrastrar pata'))).toHaveLength(1);
      t += I.ACCION_CADA_MS;
      I.migaAccion('protoboard: arrastrar pata');
      expect(I.migasActuales().filter((x) => x.endsWith('arrastrar pata'))).toHaveLength(2);
      for (let k = 0; k < 10; k++) I.migaAccion(`medir: punta ${k}`);
      expect(I.migasActuales().filter((x) => / medir: punta \d$/.test(x))).toHaveLength(I.ACCIONES_POR_MINUTO - 2);
      // the route crumbs are never throttled
      for (let k = 0; k < 5; k++) I.miga(`ruta #/cap0${k}`);
      expect(I.migasActuales().filter((x) => / ruta #\/cap0\d$/.test(x))).toHaveLength(5);
    } finally {
      Date.now = real;
      I.usarAlmacenamiento(undefined);
    }
  });
});
