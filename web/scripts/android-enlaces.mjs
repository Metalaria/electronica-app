// 1.1: the book's QR links (epa://leccion/<parte>/<label>) on Android, for web/scripts/android-preparar.mjs.
// The Android project is generated (`tauri android init`, src-tauri/gen/android) and never edited by hand: this step
// writes into its AndroidManifest.xml
//   - the intent filter of every `plugins.deep-link.mobile` entry of src-tauri/tauri.conf.json (the scheme «epa», host
//     «leccion»), in the block «DEEP LINK PLUGIN» exactly as tauri-plugin-deep-link's build script writes it at every
//     Android build (same markers, same content, same place: tauri-utils `update_android_manifest`) — so the build only
//     rewrites the same block, never adds a second filter, and the project is right even before its first build;
//   - android:launchMode="singleTask" on the activity (Tauri's template already has it): a link opened while the app
//     runs reaches the running activity (onNewIntent → the plugin's onOpenUrl) instead of starting a second one.
// Pure functions (tested in Node by tests/enlaces11-unidad.spec.ts) and one that applies them to the project.
import fs from 'node:fs';
import path from 'node:path';

/** The block identifier of tauri-plugin-deep-link's build script. */
export const BLOQUE = 'DEEP LINK PLUGIN';

const marca = (id) => `<!-- ${id}. AUTO-GENERATED. DO NOT REMOVE. -->`;

/** The intent filter of one `mobile` entry (tauri-plugin-deep-link 2.6.3 build.rs `intent_filter`). */
export function filtroIntencion(d) {
  const lista = (x) => (Array.isArray(x) ? x : []);
  const esquemas = Array.isArray(d.scheme) ? d.scheme : ['https', 'http'];
  const web = esquemas.some((s) => s === 'https' || s === 'http');
  const appLink = d.appLink ?? (web && d.host != null);
  const datos = (atributo, xs) => xs.map((x) => `<data android:${atributo}="${x}" />`).join('\n    ');
  return `<intent-filter ${appLink ? 'android:autoVerify="true" ' : ''}>
    <action android:name="android.intent.action.VIEW" />
    <!-- ChromeOS ARC++ uses a different action for deep links -->
    <action android:name="org.chromium.arc.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    ${datos('scheme', esquemas)}
    ${d.host != null ? `<data android:host="${d.host}" />` : ''}
    ${datos('path', lista(d.path))}
    ${datos('pathPattern', lista(d.pathPattern))}
    ${datos('pathPrefix', lista(d.pathPrefix))}
    ${datos('pathSuffix', lista(d.pathSuffix))}
</intent-filter>`.trim();
}

/** The block's content for the `plugins.deep-link` section of tauri.conf.json. */
export function contenidoBloque(config) {
  return (config?.mobile ?? []).map(filtroIntencion).join('\n');
}

/** tauri-utils `insert_into_xml`: the block (a previous one removed) before each closing tag of `padre`. */
export function insertarEnXml(xml, id, padre, contenido) {
  const m = marca(id);
  const cierre = `</${padre}>`;
  const out = [];
  let dentro = false;
  for (const linea of xml.split('\n')) {
    if (linea.includes(m)) {
      dentro = !dentro;
      continue;
    }
    if (dentro) continue;
    const i = linea.indexOf(cierre);
    if (i >= 0) {
      const sangria = ' '.repeat(i + 4);
      out.push(sangria + m);
      for (const l of contenido.split('\n')) out.push(sangria + l);
      out.push(sangria + m);
    }
    out.push(linea);
  }
  return out.join('\n');
}

/** android:launchMode="singleTask" on every <activity> (added, or another mode replaced). */
export function conSingleTask(xml) {
  return xml.replace(/<activity\b[^>]*>/g, (tag) => {
    if (/android:launchMode="singleTask"/.test(tag)) return tag;
    if (/android:launchMode="[^"]*"/.test(tag)) return tag.replace(/android:launchMode="[^"]*"/, 'android:launchMode="singleTask"');
    return tag.replace(/^<activity\b/, '<activity android:launchMode="singleTask"');
  });
}

/**
 * The manifest with the deep links of `config` (plugins.deep-link) and singleTask. Throws when it cannot be done: no
 * mobile scheme configured, no <activity> or more than one.
 */
export function prepararManifiesto(xml, config) {
  const contenido = contenidoBloque(config);
  if (!contenido) throw new Error('tauri.conf.json no declara ningún esquema en plugins.deep-link.mobile.');
  const actividades = (xml.match(/<activity\b/g) ?? []).length;
  if (actividades !== 1 || !xml.includes('</activity>')) throw new Error(`se esperaba una única <activity> en el manifiesto y hay ${actividades}.`);
  return conSingleTask(insertarEnXml(xml, BLOQUE, 'activity', contenido));
}

/** Applies it to the generated project. Returns what changed (for the log). */
export function prepararEnlacesAndroid(androidDir, tauriConf) {
  const manifiesto = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifiesto)) throw new Error(`no existe ${manifiesto}`);
  const config = JSON.parse(fs.readFileSync(tauriConf, 'utf8'))?.plugins?.['deep-link'];
  const antes = fs.readFileSync(manifiesto, 'utf8');
  const despues = prepararManifiesto(antes, config);
  if (despues !== antes) fs.writeFileSync(manifiesto, despues);
  const esquemas = (config?.mobile ?? []).flatMap((d) => d.scheme ?? []);
  return { manifiesto, cambiado: despues !== antes, esquemas };
}
