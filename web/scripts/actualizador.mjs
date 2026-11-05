#!/usr/bin/env node
// Signed automatic updates (0.12): the CI side of tauri-plugin-updater, with no dependencies (Node built-ins only).
//
//   node web/scripts/actualizador.mjs clave
//       Checks the public key in src-tauri/tauri.conf.json (plugins.updater.pubkey): exit 0 when it is a
//       real minisign public key, 2 while it is still the placeholder or is not valid.
//   node web/scripts/actualizador.mjs exigir
//       Tag builds, before the draft release is created: with EPA_ESTRICTO=1 (set by the workflow on tags unless the
//       repository variable EPA_PERMITIR_SIN_ACTUALIZADOR is 1), fails when the public key is still the placeholder
//       or not valid, or when the signing secret is missing (HAY_CLAVE=true|false, from the workflow): a release built
//       like that would ship apps that can never update themselves, or an update path with no signatures.
//   node web/scripts/actualizador.mjs cli --lock web/package-lock.json --instalado DIR/node_modules
//       Job «firmar»: checks that the Tauri CLI installed on its own (npm install --ignore-scripts) is exactly the one
//       of the repository's lockfile (same version and integrity of @tauri-apps/cli and its native package).
//   node web/scripts/actualizador.mjs firmar --dir DIR --version X.Y.Z --cli PATH/tauri.js
//       Job «firmar» (the only one that sees TAURI_SIGNING_PRIVATE_KEY): signs the three updater artifacts in DIR
//       (Electronica-X.Y.Z-windows-x64-setup.exe, …-windows-x64.msi, …-macos-universal.app.tar.gz) with
//       `tauri signer sign --app-version X.Y.Z` (the version goes into the signature's trusted comment, as
//       createUpdaterArtifacts does; the app requires it, requireSignedVersion), and verifies each .sig against the
//       public key of tauri.conf.json. Missing secret, invalid public key, missing artifact, signature that fails or does
//       not verify: an ::error:: and exit 1 with EPA_ESTRICTO=1 (tag builds), a ::warning:: otherwise.
//   node web/scripts/actualizador.mjs verificar <file> <file.sig> [--version X.Y.Z]
//       Verifies a .sig (as written by the Tauri bundler) against the public key; exit 0 when valid.
//   node web/scripts/actualizador.mjs manifiesto --firmas DIR --version X.Y.Z --etiqueta vX.Y.Z
//       --repo owner/repo [--notas FILE] [--fecha ISO] --salida latest.json
//       Publish job: builds latest.json (Tauri static update manifest) from the .sig files attached to the
//       release. Without usable signatures it writes nothing and warns (the release is still published); with
//       EPA_ESTRICTO=1 a missing platform is an ::error:: (exit 1) and nothing is published.
//
// Signature format (minisign, as used by Tauri): the .sig file and the configured public key are base64 of the
// minisign text files. The signature algorithm «ED» signs the BLAKE2b-512 hash of the file; a second «global»
// signature covers the signature plus the trusted comment, where the Tauri CLI records `version:X.Y.Z`
// (checked by the app because tauri.conf.json sets requireSignedVersion).

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ACTUALIZADOR_CONF: another tauri.conf.json (tests)
export const CONF = process.env.ACTUALIZADOR_CONF || path.join(web, '..', 'src-tauri', 'tauri.conf.json');

/**
 * Release asset name suffix → keys of the manifest's `platforms` object it serves. The plugin looks for
 * `{os}-{arch}-{bundle type}` and then `{os}-{arch}`; the generic `windows-x86_64` (the NSIS, for an install whose
 * bundle type is unknown) is only added when the .msi has its own entry too, or an MSI install would get the NSIS
 * installer and end up installed twice.
 */
export const PLATAFORMAS = [
  { sufijo: '-windows-x64-setup.exe', claves: ['windows-x86_64-nsis'] },
  { sufijo: '-windows-x64.msi', claves: ['windows-x86_64-msi'] },
  // One universal .app serves both Mac architectures.
  { sufijo: '-macos-universal.app.tar.gz', claves: ['darwin-aarch64', 'darwin-x86_64'] },
];

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function deBase64Estricto(texto) {
  const t = texto.trim();
  if (!t || t.length % 4 !== 0 || !B64.test(t)) return null;
  return Buffer.from(t, 'base64');
}

/** Base64 of a minisign text file → its lines (null when it is not base64 of UTF-8 text). */
function lineasDe(b64) {
  const bytes = deBase64Estricto(b64);
  if (!bytes) return null;
  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return texto.split(/\r?\n/);
}

/** Key id as minisign prints it (a little-endian 64-bit number in hex, as in «minisign public key: 38A4…»). */
function idDe(bytes) {
  return Buffer.from(bytes).reverse().toString('hex').toUpperCase();
}

/**
 * The configured public key, decoded as tauri-plugin-updater does (base64 → text; second line → 42 bytes:
 * algorithm «Ed», 8-byte key id, 32-byte Ed25519 key). Returns { idClave, clave } or { error }.
 */
export function leerClavePublica(pubkey) {
  if (typeof pubkey !== 'string' || !pubkey.trim()) return { error: 'falta plugins.updater.pubkey en tauri.conf.json' };
  const lineas = lineasDe(pubkey);
  if (!lineas || lineas.length < 2) return { error: 'plugins.updater.pubkey no es una clave pública de minisign en base64 (¿sigue el marcador?)' };
  const bin = deBase64Estricto(lineas[1]);
  if (!bin || bin.length !== 42) return { error: 'la clave pública no tiene el formato de minisign (42 bytes)' };
  if (bin[0] !== 0x45 || (bin[1] !== 0x64 && bin[1] !== 0x44)) return { error: 'la clave pública no es Ed25519 (minisign)' };
  return { idClave: idDe(bin.subarray(2, 10)), clave: bin.subarray(10, 42) };
}

/** A .sig file's content → { prehash, idClave, firma, comentario, global, version } or { error }. */
export function leerFirma(contenido) {
  const lineas = lineasDe(contenido);
  if (!lineas || lineas.length < 4) return { error: 'la firma no es base64 de una firma de minisign' };
  const bin1 = deBase64Estricto(lineas[1]);
  const bin2 = deBase64Estricto(lineas[3]);
  if (!bin1 || bin1.length !== 74 || !bin2 || bin2.length !== 64) return { error: 'la firma no tiene el formato de minisign' };
  if (!lineas[2].startsWith('trusted comment: ')) return { error: 'a la firma le falta el comentario de confianza' };
  if (bin1[0] !== 0x45 || (bin1[1] !== 0x44 && bin1[1] !== 0x64)) return { error: 'algoritmo de firma desconocido' };
  const comentario = lineas[2].slice('trusted comment: '.length);
  const version = comentario.split('\t').find((c) => c.startsWith('version:'))?.slice('version:'.length) ?? null;
  return {
    prehash: bin1[1] === 0x44,
    idClave: idDe(bin1.subarray(2, 10)),
    firma: bin1.subarray(10, 74),
    comentario,
    global: bin2,
    version,
  };
}

function claveEd25519(raw) {
  return crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw.toString('base64url') }, format: 'jwk' });
}

/** Verifies `datos` against a .sig content and the public key; returns '' when valid or the reason (Spanish). */
export function verificarFirma(datos, contenidoFirma, pubkey, version = null) {
  const pk = leerClavePublica(pubkey);
  if (pk.error) return pk.error;
  const s = leerFirma(contenidoFirma);
  if (s.error) return s.error;
  if (s.idClave !== pk.idClave) return `la firma es de otra clave (id ${s.idClave}; la pública configurada es ${pk.idClave})`;
  const clave = claveEd25519(pk.clave);
  const mensaje = s.prehash ? crypto.createHash('blake2b512').update(datos).digest() : datos;
  if (!crypto.verify(null, mensaje, clave, s.firma)) return 'la firma no corresponde a este fichero';
  if (!crypto.verify(null, Buffer.concat([s.firma, Buffer.from(s.comentario, 'utf8')]), clave, s.global))
    return 'el comentario de confianza de la firma está alterado';
  if (version !== null) {
    if (!s.version) return 'la firma no lleva la versión (la app exige requireSignedVersion)';
    if (s.version.replace(/^v/, '') !== version.replace(/^v/, '')) return `la firma es de la versión ${s.version}, no de la ${version}`;
  }
  return '';
}

export function clavePublicaConfigurada(conf = CONF) {
  const c = JSON.parse(fs.readFileSync(conf, 'utf8'));
  return c?.plugins?.updater?.pubkey ?? '';
}

/**
 * latest.json from a folder with the release's .sig files. Returns { manifiesto, avisos, usados }; manifiesto is
 * null when no signature is usable. Signatures of another key, of another version or of an unknown asset are
 * left out with a warning.
 */
export function construirManifiesto({ firmas, version, etiqueta, repo, notas = '', fecha = new Date(), pubkey }) {
  const avisos = [];
  const usados = [];
  const platforms = {};
  const pk = leerClavePublica(pubkey);
  if (pk.error) return { manifiesto: null, avisos: [`No se genera latest.json: ${pk.error}.`], usados, faltan: PLATAFORMAS.map((p) => p.sufijo) };
  const ficheros = fs.existsSync(firmas) ? fs.readdirSync(firmas).filter((f) => f.endsWith('.sig')).sort() : [];
  for (const f of ficheros) {
    const asset = f.slice(0, -'.sig'.length);
    const plataforma = PLATAFORMAS.find((p) => asset === `Electronica-${version}${p.sufijo}`);
    if (!plataforma) {
      avisos.push(`${f}: no corresponde a ningún instalador de la versión ${version}; se ignora.`);
      continue;
    }
    const contenido = fs.readFileSync(path.join(firmas, f), 'utf8').trim();
    const s = leerFirma(contenido);
    if (s.error) {
      avisos.push(`${f}: ${s.error}; se ignora.`);
      continue;
    }
    if (s.idClave !== pk.idClave) {
      avisos.push(`${f}: firmada con otra clave (id ${s.idClave}, la pública es ${pk.idClave}); se ignora.`);
      continue;
    }
    if (!s.version || s.version.replace(/^v/, '') !== version) {
      avisos.push(`${f}: firmada para la versión ${s.version ?? '(ninguna)'}, no para la ${version}; se ignora.`);
      continue;
    }
    const url = `https://github.com/${repo}/releases/download/${encodeURIComponent(etiqueta)}/${encodeURIComponent(asset)}`;
    for (const clave of plataforma.claves) platforms[clave] = { signature: contenido, url };
    usados.push(asset);
  }
  const faltan = PLATAFORMAS.filter((p) => !p.claves.some((c) => platforms[c])).map((p) => p.sufijo);
  if (!Object.keys(platforms).length) {
    avisos.push('No hay firmas utilizables: no se genera latest.json (las apps seguirán mostrando el aviso con el enlace).');
    return { manifiesto: null, avisos, usados, faltan };
  }
  for (const f of faltan) avisos.push(`Falta la firma de *${f}: esa plataforma no tendrá actualización automática en esta versión.`);
  if (platforms['windows-x86_64-nsis'] && platforms['windows-x86_64-msi']) platforms['windows-x86_64'] = platforms['windows-x86_64-nsis'];
  const manifiesto = {
    version,
    notes: notas,
    // RFC 3339 without fractional seconds
    pub_date: new Date(fecha).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    platforms,
  };
  return { manifiesto, avisos, usados, faltan };
}

// ------------------------------------------------------------------ command line

function opciones(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      o[a.slice(2)] = args[i + 1];
      i++;
    } else o._.push(a);
  }
  return o;
}

function salidaGitHub(nombre, valor) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${nombre}=${valor}\n`);
  console.log(`actualizador: ${nombre}=${valor}`);
}

function aviso(texto) {
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${texto}` : `AVISO: ${texto}`);
}

function error(texto) {
  console.log(process.env.GITHUB_ACTIONS ? `::error::${texto}` : `ERROR: ${texto}`);
}

/** Tag builds (the workflow sets EPA_ESTRICTO=1 unless vars.EPA_PERMITIR_SIN_ACTUALIZADOR is 1). */
function estricto() {
  return process.env.EPA_ESTRICTO === '1';
}

const SALIDA_ESTRICTA =
  'Una versión etiquetada debe llevar la actualización automática firmada (README, «Actualizaciones automáticas ' +
  'firmadas»). Para publicar a propósito sin ella: variable del repositorio EPA_PERMITIR_SIN_ACTUALIZADOR=1.';

/** Tag builds: the public key and the signing secret must be there before anything is built. */
function exigir() {
  if (!estricto()) {
    console.log('actualizador: no se exige la actualización automática en esta compilación.');
    if (process.env.EPA_PERMITIR_SIN_ACTUALIZADOR === '1') aviso('EPA_PERMITIR_SIN_ACTUALIZADOR=1: esta versión se publica a propósito sin actualización automática firmada.');
    return 0;
  }
  const pk = leerClavePublica(clavePublicaConfigurada());
  if (pk.error) {
    error(`La clave pública de src-tauri/tauri.conf.json no sirve: ${pk.error}. ${SALIDA_ESTRICTA}`);
    return 1;
  }
  if (process.env.HAY_CLAVE !== 'true') {
    error(`Falta el secreto TAURI_SIGNING_PRIVATE_KEY en el entorno «firma» del repositorio. ${SALIDA_ESTRICTA}`);
    return 1;
  }
  console.log(`actualizador: clave pública ${pk.idClave} y secreto de firma presentes.`);
  return 0;
}

/** The Tauri CLI installed on its own must be exactly the lockfile's (version and integrity of every package). */
function cliComoElLock(lock, instalado) {
  const esperado = JSON.parse(fs.readFileSync(lock, 'utf8')).packages ?? {};
  const oculto = path.join(instalado, '.package-lock.json');
  if (!fs.existsSync(oculto)) return `no está ${oculto}`;
  const hay = JSON.parse(fs.readFileSync(oculto, 'utf8')).packages ?? {};
  const claves = Object.keys(hay).filter((k) => k.startsWith('node_modules/@tauri-apps/cli'));
  if (!claves.includes('node_modules/@tauri-apps/cli')) return 'no se instaló @tauri-apps/cli';
  for (const k of claves) {
    if (!esperado[k]) return `${k} no está en el lockfile del repositorio`;
    if (hay[k].version !== esperado[k].version || hay[k].integrity !== esperado[k].integrity)
      return `${k} ${hay[k].version} no coincide con el lockfile (${esperado[k].version})`;
  }
  return '';
}

/** Signs and verifies the three updater artifacts (job «firmar»). */
function firmar(o) {
  const problema = (texto) => (estricto() ? error(texto) : aviso(texto));
  const version = String(o.version ?? '').replace(/^v/, '');
  if (!o.dir || !version || !o.cli) {
    console.error('uso: actualizador.mjs firmar --dir DIR --version X.Y.Z --cli PATH/tauri.js');
    return 64;
  }
  const pubkey = clavePublicaConfigurada(o.conf ?? CONF);
  const pk = leerClavePublica(pubkey);
  if (pk.error) {
    problema(`La clave pública de src-tauri/tauri.conf.json no sirve: ${pk.error}. No se firma nada. ${SALIDA_ESTRICTA}`);
    return estricto() ? 1 : 0;
  }
  // base64 has no whitespace: a line break pasted into the secret must not matter
  const privada = (process.env.TAURI_SIGNING_PRIVATE_KEY ?? '').replace(/\s+/g, '');
  if (!privada) {
    problema(`Falta el secreto TAURI_SIGNING_PRIVATE_KEY (entorno «firma» del repositorio). No se firma nada. ${SALIDA_ESTRICTA}`);
    return estricto() ? 1 : 0;
  }
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) aviso('Falta el secreto TAURI_SIGNING_PRIVATE_KEY_PASSWORD; se firma como si la clave no tuviera contraseña.');
  let fallos = 0;
  let firmados = 0;
  for (const p of PLATAFORMAS) {
    const nombre = `Electronica-${version}${p.sufijo}`;
    const fichero = path.join(o.dir, nombre);
    const sig = `${fichero}.sig`;
    fs.rmSync(sig, { force: true });
    if (!fs.existsSync(fichero)) {
      problema(`Falta ${nombre}: esa plataforma no tendrá actualización automática.`);
      fallos++;
      continue;
    }
    const r = spawnSync(process.execPath, [o.cli, 'signer', 'sign', '--app-version', version, fichero], {
      env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: privada, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? '', CI: 'true' },
      encoding: 'utf8',
    });
    if (r.status !== 0 || !fs.existsSync(sig)) {
      // never print the CLI's output: it could echo part of the key
      problema(`El Tauri CLI no pudo firmar ${nombre} con TAURI_SIGNING_PRIVATE_KEY (¿clave mal copiada o contraseña distinta?).`);
      fs.rmSync(sig, { force: true });
      fallos++;
      continue;
    }
    const motivo = verificarFirma(fs.readFileSync(fichero), fs.readFileSync(sig, 'utf8'), pubkey, version);
    if (motivo) {
      problema(`La firma de ${nombre} no se verifica con la clave pública de tauri.conf.json (${motivo}): se quita.`);
      fs.rmSync(sig, { force: true });
      fallos++;
      continue;
    }
    firmados++;
    console.log(`actualizador: ${nombre}.sig (clave ${pk.idClave}, versión ${version}) verificada.`);
  }
  if (fallos && estricto()) {
    error(`No se firmaron todas las plataformas (${firmados} de ${PLATAFORMAS.length}): la versión no se publica. ${SALIDA_ESTRICTA}`);
    return 1;
  }
  return 0;
}

function main(argv) {
  const [orden, ...resto] = argv;
  const o = opciones(resto);
  if (orden === 'clave') {
    const pk = leerClavePublica(clavePublicaConfigurada(o.conf ?? CONF));
    if (pk.error) {
      console.log(`actualizador: ${pk.error}`);
      return 2;
    }
    console.log(`actualizador: clave pública válida (id ${pk.idClave})`);
    return 0;
  }
  if (orden === 'exigir') return exigir();
  if (orden === 'firmar') return firmar(o);
  if (orden === 'cli') {
    if (!o.lock || !o.instalado) {
      console.error('uso: actualizador.mjs cli --lock web/package-lock.json --instalado DIR/node_modules');
      return 64;
    }
    const motivo = cliComoElLock(o.lock, o.instalado);
    if (motivo) {
      error(`El Tauri CLI instalado para firmar no es el del lockfile: ${motivo}.`);
      return 1;
    }
    console.log('actualizador: el Tauri CLI instalado coincide con web/package-lock.json.');
    return 0;
  }
  if (orden === 'verificar') {
    const [fichero, firma] = o._;
    if (!fichero || !firma) {
      console.error('uso: actualizador.mjs verificar <fichero> <fichero.sig> [--version X.Y.Z]');
      return 64;
    }
    const motivo = verificarFirma(fs.readFileSync(fichero), fs.readFileSync(firma, 'utf8'), clavePublicaConfigurada(o.conf ?? CONF), o.version ?? null);
    if (motivo) {
      aviso(`${path.basename(firma)}: ${motivo}.`);
      return 1;
    }
    console.log(`actualizador: ${path.basename(firma)} verificada.`);
    return 0;
  }
  if (orden === 'manifiesto') {
    for (const k of ['firmas', 'version', 'etiqueta', 'repo', 'salida']) {
      if (!o[k]) {
        console.error(`actualizador: falta --${k}`);
        return 64;
      }
    }
    const notas = o.notas && fs.existsSync(o.notas) ? fs.readFileSync(o.notas, 'utf8').trim() : '';
    const { manifiesto, avisos, usados, faltan } = construirManifiesto({
      firmas: o.firmas,
      version: o.version.replace(/^v/, ''),
      etiqueta: o.etiqueta,
      repo: o.repo,
      notas,
      fecha: o.fecha ? new Date(o.fecha) : new Date(),
      pubkey: clavePublicaConfigurada(o.conf ?? CONF),
    });
    fs.rmSync(o.salida, { force: true });
    if (estricto() && faltan.length) {
      for (const a of avisos) aviso(a);
      error(`Faltan firmas válidas de ${faltan.map((f) => `*${f}`).join(', ')}: no se publica. ${SALIDA_ESTRICTA}`);
      return 1;
    }
    for (const a of avisos) aviso(a);
    if (!manifiesto) return 0;
    fs.writeFileSync(o.salida, JSON.stringify(manifiesto, null, 2) + '\n');
    console.log(`actualizador: ${o.salida} con ${Object.keys(manifiesto.platforms).join(', ')} (${usados.join(', ')}).`);
    return 0;
  }
  console.error('uso: actualizador.mjs clave | exigir | cli | firmar | verificar <fichero> <sig> | manifiesto --firmas DIR --version X --etiqueta vX --repo o/r --salida latest.json');
  return 64;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
