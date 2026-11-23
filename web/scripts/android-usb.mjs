// 1.4: the USB devices the app reads on Android (the FNIRSI 2C53T's link and the Brymen's BU-86X cable), for
// web/scripts/android-preparar.mjs. It writes into the generated project's AndroidManifest.xml, inside the activity, the
// USB_DEVICE_ATTACHED intent filter and the meta-data that points to the device filter
// (src-tauri/recursos-android/xml/epa_usb.xml, copied into app/src/main/res with the app's other resources).
//
// Why: Android grants a USB permission to one appearance of a device. The FNIRSI leaves the bus at every change of mode
// and comes back as a new device, so without this the system would ask again every time; and its dialog only offers
// «always use this app for this device» to an app whose activity declares the device. Once the reader ticks it, the
// permission holds for that device (same ids, name and serial) whenever it comes back, and no dialog is shown.
// When the device is plugged in with the app closed, Android offers to open the app (the reader may decline).
//
// The block has its own markers (the same form as tauri-utils' blocks), so running it again replaces it, and the
// deep-link plugin's build, which rewrites only its own block, leaves it alone.
import fs from 'node:fs';
import path from 'node:path';
import { insertarEnXml } from './android-enlaces.mjs';

/** The block identifier. */
export const BLOQUE_USB = 'EPA USB DEVICES';
/** The device filter's resource (src-tauri/recursos-android/xml/epa_usb.xml). */
export const RECURSO_USB = '@xml/epa_usb';

const ACCION = 'android.hardware.usb.action.USB_DEVICE_ATTACHED';

/** The block's content: the intent filter and the meta-data with the device filter. */
export function contenidoUsb() {
  return `<intent-filter>
    <action android:name="${ACCION}" />
</intent-filter>
<meta-data android:name="${ACCION}" android:resource="${RECURSO_USB}" />`;
}

/** The manifest with the block in its only activity. Throws when there is no activity or more than one. */
export function prepararUsbManifiesto(xml) {
  const actividades = (xml.match(/<activity\b/g) ?? []).length;
  if (actividades !== 1 || !xml.includes('</activity>')) throw new Error(`se esperaba una única <activity> en el manifiesto y hay ${actividades}.`);
  return insertarEnXml(xml, BLOQUE_USB, 'activity', contenidoUsb());
}

/** Applies it to the generated project. Returns what changed (for the log). */
export function prepararUsbAndroid(androidDir) {
  const manifiesto = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifiesto)) throw new Error(`no existe ${manifiesto}`);
  const antes = fs.readFileSync(manifiesto, 'utf8');
  const despues = prepararUsbManifiesto(antes);
  if (despues !== antes) fs.writeFileSync(manifiesto, despues);
  return { manifiesto, cambiado: despues !== antes };
}
