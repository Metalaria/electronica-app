// 1.4 «instrumentos14», in Node (no browser, no server): the real instruments on the owner's other platforms.
//   - Android: the app's activity declares the USB devices it handles (USB_DEVICE_ATTACHED and a device filter with
//     the FNIRSI's link and the Brymen's BU-86X cable). Without it Android asks its permission again every time the
//     device appears on the bus — the FNIRSI leaves it and comes back at every change of mode —, and its dialog has
//     no «always» box; with it, once the reader ticks that box, the permission holds for that device.
//   - The Kotlin plugins and the device filter name the same USB ids.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-plataformas-unidad.spec.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAURI = path.join(WEB, '../src-tauri');
const leer = (f: string) => readFileSync(path.join(TAURI, f), 'utf8');

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

/** The constant `nombre = 0x…` of a Kotlin plugin. */
function constante(kt: string, nombre: string): number {
  const m = new RegExp(`const val ${nombre} = (0x[0-9a-fA-F]+)`).exec(kt);
  if (!m) throw new Error(`falta ${nombre}`);
  return parseInt(m[1]!, 16);
}

test('Android: el filtro de dispositivos USB nombra el enlace del FNIRSI y el cable del Brymen, con los ids de sus plugins', () => {
  const filtro = leer('recursos-android/xml/epa_usb.xml');
  const fn = leer('plugins/fnirsi/android/src/main/java/es/gonzalomejias/fnirsi/FnirsiPlugin.kt');
  const bm = leer('plugins/brymen/android/src/main/java/es/gonzalomejias/brymen/BrymenPlugin.kt');
  const dispositivos = [...filtro.matchAll(/<usb-device\b([^>]*)\/>/g)].map((m) => {
    const a = (n: string) => new RegExp(`${n}="([^"]*)"`).exec(m[1]!)?.[1] ?? null;
    return { vid: Number(a('vendor-id')), pid: Number(a('product-id')), producto: a('product-name') };
  });
  // (decimal: the form every Android version reads)
  expect(filtro).not.toMatch(/-id="0x/);
  expect(dispositivos).toEqual([
    { vid: constante(fn, 'VID'), pid: constante(fn, 'PID'), producto: /const val PRODUCTO = "([^"]+)"/.exec(fn)![1]! },
    { vid: constante(bm, 'VID'), pid: constante(bm, 'PID'), producto: null },
  ]);
  // 1209:0001 is pid.codes' shared test id: the product name keeps other test devices from offering the app
  expect(dispositivos[0]).toEqual({ vid: 0x1209, pid: 0x0001, producto: '2C53T stock-link' });
  expect(dispositivos[1]).toEqual({ vid: 0x0820, pid: 0x0001, producto: null });
});

test('Android: la actividad declara USB_DEVICE_ATTACHED con el filtro, sin tocar el resto del manifiesto', async () => {
  const { prepararUsbManifiesto, BLOQUE_USB } = await import('../scripts/android-usb.mjs');
  const { prepararManifiesto } = await import('../scripts/android-enlaces.mjs');
  const conf = JSON.parse(leer('tauri.conf.json')) as { plugins: Record<string, unknown> };
  const plantilla = readFileSync(path.join(WEB, 'tests/enlaces11/AndroidManifest.plantilla.xml'), 'utf8');
  // as android-preparar applies them: the book's links, then the USB devices
  const una = prepararUsbManifiesto(prepararManifiesto(plantilla, conf.plugins['deep-link']));
  expect(prepararUsbManifiesto(una)).toBe(una);
  const marca = `<!-- ${BLOQUE_USB}. AUTO-GENERATED. DO NOT REMOVE. -->`;
  expect(una.split(marca).length).toBe(3);
  const actividad = /<activity\b[\s\S]*?<\/activity>/.exec(una)![0];
  expect(actividad).toContain('<action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />');
  expect(actividad).toContain('<meta-data android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" android:resource="@xml/epa_usb" />');
  // the links' filter is still there, and the launcher's
  expect((una.match(/<intent-filter/g) ?? []).length).toBe(3);
  expect(actividad).toContain('<data android:scheme="epa" />');
  // only the block was added
  const sin = una.replace(new RegExp(`\\s*${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '');
  expect(sin).toBe(prepararManifiesto(plantilla, conf.plugins['deep-link']));
  expect(() => prepararUsbManifiesto('<manifest></manifest>')).toThrow(/única <activity>/);
});

test('Android: android-preparar escribe el bloque USB y copia el filtro con los recursos de la app', () => {
  const s = readFileSync(path.join(WEB, 'scripts/android-preparar.mjs'), 'utf8');
  expect(s).toContain("from './android-usb.mjs'");
  expect(s).toMatch(/prepararUsbAndroid\(androidDir\)/);
  // the filter travels with src-tauri/recursos-android (copied whole into app/src/main/res) and is checked there
  expect(s).toContain("path.join('xml', 'epa_usb.xml')");
});
