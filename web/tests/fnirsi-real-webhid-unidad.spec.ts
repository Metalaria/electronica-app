// 2.2 (owner, 26-11): the browser's WebHID path reads the instrument's memory (order 0x02) only inside the
// generator's wave table, 1 to 56 bytes from 0x20000F5A to 0x20000F5A + 200, the same rule as the installed app's
// plugin filter (src-tauri/plugins/fnirsi/src/lib.rs `permitida`). The transport refuses anything else before it
// reaches the device; and no code of the app builds such a read any more (before, the connection read the
// generator's settings at 0x20000F50, the oscilloscope's state at 0x200000F8 and its measurements at 0x20000208).
// No browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-webhid-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebHid, LECTURA_FUERA_DE_TABLA } from '../src/lib/fnirsi-real/transporte.ts';
import {
  ORDEN_INFO,
  ORDEN_LEER,
  ORDEN_ONDA,
  ORDEN_SUSCRIBIR,
  PID_ENLACE,
  PRODUCTO_ENLACE,
  VID_ENLACE,
  peticion,
  peticionLeer,
  peticionOnda,
  permitidaEnLaAplicacion,
} from '../src/lib/fnirsi-real/protocolo.ts';
import { DIR_TABLA_ONDA } from '../src/lib/fnirsi-real/ondas.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

/** A WebHID device standing in for the link: it records every report the transport sends it. */
function dispositivoFalso() {
  const enviados: number[][] = [];
  const d = {
    opened: false,
    productName: PRODUCTO_ENLACE,
    vendorId: VID_ENLACE,
    productId: PID_ENLACE,
    async open() {
      d.opened = true;
    },
    async close() {
      d.opened = false;
    },
    async sendReport(_id: number, datos: BufferSource) {
      enviados.push(Array.from(datos instanceof Uint8Array ? datos : new Uint8Array(datos as ArrayBuffer)));
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const hid = { getDevices: async () => [d], requestDevice: async () => [d], addEventListener() {}, removeEventListener() {} };
  return { hid, enviados };
}

async function abierto() {
  const { hid, enviados } = dispositivoFalso();
  Object.defineProperty(globalThis, 'navigator', { value: { hid }, configurable: true, writable: true });
  const t = new WebHid();
  await t.abrir();
  return { t, enviados };
}

/** A read request with any length byte and address (peticionLeer itself refuses a length outside 1 … 56). */
function lectura(n: number, x: number): Uint8Array {
  const r = peticion(ORDEN_LEER, 1, n);
  for (let k = 0; k < 4; k++) r[4 + k] = (x >>> (8 * k)) & 0xff;
  return r;
}

test('WebHID: una lectura 0x02 fuera de la tabla de ondas no llega al dispositivo; dentro de ella, sí (los mismos bordes que el filtro nativo)', async () => {
  const { t, enviados } = await abierto();
  // the three reads the app made before 2.2
  for (const [x, n] of [[0x20000f50, 10], [0x200000f8, 56], [0x20000208, 48]] as const)
    await expect(t.enviar(peticionLeer(1, x, n)), `0x${x.toString(16)}`).rejects.toThrow(LECTURA_FUERA_DE_TABLA);
  expect(enviados).toEqual([]);
  // the edges of the native rule, one by one, against what reached the device
  const inicio = DIR_TABLA_ONDA;
  const fin = inicio + 200;
  const casos = [[0, inicio], [1, inicio], [56, inicio], [57, inicio], [1, inicio - 1], [56, fin - 56], [56, fin - 55], [1, fin], [56, 0xffffffff], [255, inicio]] as const;
  for (const [n, x] of casos) {
    const p = lectura(n, x);
    const antes = enviados.length;
    if (permitidaEnLaAplicacion(p)) await expect(t.enviar(p)).resolves.toBeUndefined();
    else await expect(t.enviar(p)).rejects.toThrow(LECTURA_FUERA_DE_TABLA);
    expect(enviados.length - antes, `lectura ${n} en ${x.toString(16)}`).toBe(permitidaEnLaAplicacion(p) ? 1 : 0);
  }
  expect(enviados.length).toBe(casos.filter(([n, x]) => permitidaEnLaAplicacion(lectura(n, x))).length);
  expect(enviados.length).toBe(3);
  // the guard is only for reads: the identification, the subscription and the custom wave go through as before
  await t.enviar(peticion(ORDEN_INFO, 2));
  await t.enviar(peticion(ORDEN_SUSCRIBIR, 3, 3));
  await t.enviar(peticionOnda(4, 0, Array.from({ length: 28 }, () => 2047)));
  expect(enviados.slice(-3).map((r) => r[0])).toEqual([ORDEN_INFO, ORDEN_SUSCRIBIR, ORDEN_ONDA]);
  await t.cerrar();
});

test('ningún código de la aplicación pide una lectura 0x02 fuera de la tabla de ondas', () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const ficheros: string[] = [];
  const recorrer = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.(ts|svelte)$/.test(e.name)) ficheros.push(p);
    }
  };
  recorrer(raiz);
  const llamadas: string[] = [];
  for (const f of ficheros) {
    // (the code only: comments may tell what was read before)
    const s = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const m of s.matchAll(/peticionLeer\(([^)]*)\)/g)) if (!s.slice(0, m.index!).endsWith('function ')) llamadas.push(`${path.relative(raiz, f)}: ${m[0]}`);
    // the addresses of the old reads are named only where they are documented (estado.ts) and in the test link
    if (!/fnirsi-real[/\\](estado|transporte)\.ts$/.test(f)) {
      expect(s, f).not.toMatch(/DIR_GENERADOR|DIR_ESTADO_OSCILOSCOPIO|DIR_MEDIDAS_CH1/);
      expect(s, f).not.toMatch(/0x20000f50|0x200000f8|0x20000208/i);
    }
  }
  // the only read the app builds: the wave table, read back after a waveform was sent (conexion.svelte.ts enviarOnda)
  const fuera = llamadas.filter((l) => !/peticionLeer\(sec, DIR_TABLA_ONDA \+ desde, largo\)$/.test(l));
  expect(fuera).toEqual([]);
  expect(llamadas.some((l) => l.startsWith(path.join('lib', 'fnirsi-real', 'conexion.svelte.ts')))).toBe(true);
});
