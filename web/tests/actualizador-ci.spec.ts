// Signed automatic updates (0.12), CI side: web/scripts/actualizador.mjs and the publish step of
// .github/workflows/compilar.yml, run for real (bash) against a fake `gh` (tests/actualizador-ci/gh-falso.mjs)
// and signatures made with the real Tauri CLI (`tauri signer`) and throwaway keys; and web/scripts/android-preparar.mjs
// copying the reminder's own notification icon into a fake generated Android project. No browser, no network.
//   PLAYWRIGHT_BROWSERS_PATH=… npx playwright test -c playwright.plataforma12.config.ts actualizador-ci
import { test, expect } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.join(WEB, '..');
const SCRIPT = path.join(WEB, 'scripts', 'actualizador.mjs');
const TAURI = path.join(WEB, 'scripts', 'tauri.mjs');
const GH_FALSO = path.join(WEB, 'tests', 'actualizador-ci', 'gh-falso.mjs');
const REPO = 'Metalaria/electronica-app';
const VERSION = '0.12.0';
const TAG = `v${VERSION}`;
const CLAVE = 'contraseña de prueba';
// The placeholder the repository shipped until the owner pasted his public key (0.12; the real key since 1.0). The
// placeholder scenarios run on a temporary tauri.conf.json carrying it, never on the repository's own file.
const MARCADOR = 'CLAVE-PUBLICA-PENDIENTE: sustituir por el contenido de electronica-actualizador.key.pub (README, «Actualizaciones automáticas firmadas»)';

interface Par {
  privada: string;
  ficheroPrivada: string;
  publica: string;
}

const temporales: string[] = [];
function temporal(nombre: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `epa-act-${nombre}-`));
  temporales.push(d);
  return d;
}
test.afterAll(() => {
  for (const d of temporales.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A throwaway key pair made with the same CLI the owner will use. */
function parDeClaves(dir: string, nombre: string): Par {
  const fichero = path.join(dir, `${nombre}.key`);
  execFileSync(process.execPath, [TAURI, 'signer', 'generate', '--ci', '-p', CLAVE, '-w', fichero, '-f'], { stdio: 'pipe' });
  return { privada: fs.readFileSync(fichero, 'utf8').trim(), ficheroPrivada: fichero, publica: fs.readFileSync(fichero + '.pub', 'utf8').trim() };
}

/** Signs as `tauri build` does (the version goes into the trusted comment); returns the .sig content. */
function firmar(par: Par, fichero: string, version: string): string {
  execFileSync(process.execPath, [TAURI, 'signer', 'sign', '-f', par.ficheroPrivada, '-p', CLAVE, '--app-version', version, fichero], { stdio: 'pipe' });
  return fs.readFileSync(fichero + '.sig', 'utf8').trim();
}

/** A tauri.conf.json like the real one with this public key. */
function conf(dir: string, pubkey: string): string {
  const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  c.plugins.updater.pubkey = pubkey;
  const f = path.join(dir, 'tauri.conf.json');
  fs.writeFileSync(f, JSON.stringify(c, null, 2));
  return f;
}

/** The `run:` script of a step of the publish job, exactly as in the workflow. */
function pasoDelFlujo(nombrePaso: string): string {
  const lineas = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'compilar.yml'), 'utf8').split('\n');
  const inicio = lineas.findIndex((l) => l.trim() === `- name: ${nombrePaso}`);
  expect(inicio, `paso «${nombrePaso}» en compilar.yml`).toBeGreaterThan(0);
  const run = lineas.findIndex((l, i) => i > inicio && /^\s*run: \|\s*$/.test(l));
  const sangria = lineas[run]!.search(/\S/);
  const cuerpo: string[] = [];
  for (let i = run + 1; i < lineas.length; i++) {
    const l = lineas[i]!;
    if (l.trim() && l.search(/\S/) <= sangria) break;
    cuerpo.push(l);
  }
  const quitar = Math.min(...cuerpo.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return cuerpo.map((l) => l.slice(quitar)).join('\n');
}

interface Publicacion {
  dir: string;
  trabajo: string;
  assets: string;
}

/**
 * A draft release as the three build jobs leave it: installers, per-platform sums and, when signed, .sig files;
 * plus a checkout with the script and a tauri.conf.json carrying `pubkey`.
 */
function publicacion(pubkey: string, ficheros: Record<string, Buffer | string>): Publicacion {
  const dir = temporal('rel');
  const assets = path.join(dir, 'gh', 'assets');
  fs.mkdirSync(assets, { recursive: true });
  for (const [n, c] of Object.entries(ficheros)) fs.writeFileSync(path.join(assets, n), c);
  fs.writeFileSync(path.join(dir, 'gh', 'body.txt'), 'Instaladores de uso privado.\nNovedades de la 0.12.');
  const trabajo = path.join(dir, 'checkout');
  fs.mkdirSync(path.join(trabajo, 'web', 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(trabajo, 'src-tauri'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(trabajo, 'web', 'scripts', 'actualizador.mjs'));
  fs.copyFileSync(conf(dir, pubkey), path.join(trabajo, 'src-tauri', 'tauri.conf.json'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${GH_FALSO}" "$@"\n`, { mode: 0o755 });
  return { dir, trabajo, assets };
}

/** Runs the publish step of the workflow (bash -e -o pipefail, as GitHub does) in the fake checkout. */
function publicar(p: Publicacion, extra: NodeJS.ProcessEnv = {}): { estado: number; salida: string } {
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', pasoDelFlujo('Checksums, update manifest and publish')], {
    cwd: p.trabajo,
    env: {
      ...process.env,
      PATH: `${path.join(p.dir, 'bin')}:${process.env.PATH}`,
      GH_FALSO_DIR: path.join(p.dir, 'gh'),
      GH_TOKEN: 'falso',
      TAG,
      GITHUB_REPOSITORY: REPO,
      GITHUB_ACTIONS: 'true',
      // a manual run unless the test says otherwise (tag builds set EPA_ESTRICTO=1 at the workflow level)
      EPA_ESTRICTO: '0',
      ...extra,
    },
    encoding: 'utf8',
  });
  return { estado: r.status ?? -1, salida: (r.stdout ?? '') + (r.stderr ?? '') };
}

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const sumas = (ficheros: Record<string, Buffer>) =>
  Object.entries(ficheros)
    .map(([n, c]) => `${sha(c)}  ${n}`)
    .join('\n') + '\n';

const EXE = `Electronica-${VERSION}-windows-x64-setup.exe`;
const MSI = `Electronica-${VERSION}-windows-x64.msi`;
const DMG = `Electronica-${VERSION}-macos-universal.dmg`;
const TGZ = `Electronica-${VERSION}-macos-universal.app.tar.gz`;
const APK = `Electronica-${VERSION}-android.apk`;

/** Installers with distinct content, signed with `par` (or not), and the three SHA256SUMS-*.txt. */
function instaladores(dir: string, par: Par | null, firmaVersion: Record<string, string> = {}): Record<string, Buffer | string> {
  const bytes = (n: string) => Buffer.from(`${n} ${'x'.repeat(2000)}`);
  const win = { [EXE]: bytes(EXE), [MSI]: bytes(MSI) };
  const mac: Record<string, Buffer> = { [DMG]: bytes(DMG) };
  if (par) mac[TGZ] = bytes(TGZ);
  const and = { [APK]: bytes(APK) };
  const r: Record<string, Buffer | string> = { ...win, ...mac, ...and };
  if (par) {
    for (const n of [EXE, MSI, TGZ]) {
      const f = path.join(dir, n);
      fs.writeFileSync(f, r[n] as Buffer);
      r[`${n}.sig`] = firmar(par, f, firmaVersion[n] ?? VERSION);
    }
  }
  const conSig = (o: Record<string, Buffer>) => Object.fromEntries(Object.keys(r).filter((k) => Object.keys(o).some((n) => k === n || k === `${n}.sig`)).map((k) => [k, Buffer.from(r[k] as Buffer | string)]));
  r['SHA256SUMS-windows.txt'] = sumas(conSig(win));
  r['SHA256SUMS-macos.txt'] = sumas(conSig(mac));
  r['SHA256SUMS-android.txt'] = sumas(conSig(and));
  return r;
}

test.describe('latest.json en la publicación (paso real de compilar.yml con gh simulado)', () => {
  let claves: string;
  let par: Par;
  let otro: Par;
  test.beforeAll(() => {
    claves = temporal('claves');
    par = parDeClaves(claves, 'buena');
    otro = parDeClaves(claves, 'otra');
  });

  test('con las tres firmas: manifiesto completo, subido antes de publicar y en SHA256SUMS.txt', () => {
    const tmp = temporal('firmas');
    const ficheros = instaladores(tmp, par);
    const p = publicacion(par.publica, ficheros);
    const r = publicar(p);
    expect(r.estado, r.salida).toBe(0);
    const manifiesto = JSON.parse(fs.readFileSync(path.join(p.assets, 'latest.json'), 'utf8'));
    expect(manifiesto.version).toBe(VERSION);
    expect(manifiesto.notes).toBe('Instaladores de uso privado.\nNovedades de la 0.12.');
    expect(manifiesto.pub_date).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(Object.keys(manifiesto.platforms).sort()).toEqual(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64', 'windows-x86_64-msi', 'windows-x86_64-nsis']);
    const url = (n: string) => `https://github.com/${REPO}/releases/download/${TAG}/${n}`;
    expect(manifiesto.platforms['windows-x86_64-nsis']).toEqual({ url: url(EXE), signature: ficheros[`${EXE}.sig`] });
    expect(manifiesto.platforms['windows-x86_64']).toEqual(manifiesto.platforms['windows-x86_64-nsis']);
    expect(manifiesto.platforms['windows-x86_64-msi']).toEqual({ url: url(MSI), signature: ficheros[`${MSI}.sig`] });
    expect(manifiesto.platforms['darwin-aarch64']).toEqual({ url: url(TGZ), signature: ficheros[`${TGZ}.sig`] });
    expect(manifiesto.platforms['darwin-x86_64']).toEqual(manifiesto.platforms['darwin-aarch64']);
    // every signature verifies against its asset with the configured key (what the app does after downloading)
    for (const n of [EXE, MSI, TGZ]) {
      const v = spawnSync(process.execPath, [SCRIPT, 'verificar', path.join(p.assets, n), path.join(p.assets, `${n}.sig`), '--version', VERSION], {
        env: { ...process.env, ACTUALIZADOR_CONF: path.join(p.trabajo, 'src-tauri', 'tauri.conf.json') },
        encoding: 'utf8',
      });
      expect(v.status, v.stdout + v.stderr).toBe(0);
    }
    // latest.json is attached before the draft becomes the public «latest» release
    const estado = JSON.parse(fs.readFileSync(path.join(p.dir, 'gh', 'estado.json'), 'utf8'));
    expect(estado).toMatchObject({ borrador: false, ultima: true });
    expect(estado.alPublicar).toContain('latest.json');
    expect(estado.alPublicar).toContain('SHA256SUMS.txt');
    expect(estado.alPublicar.filter((n: string) => n.startsWith('SHA256SUMS-'))).toEqual([]);
    const lineas = fs.readFileSync(path.join(p.assets, 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
    expect(lineas).toContain(`${sha(fs.readFileSync(path.join(p.assets, 'latest.json')))}  latest.json`);
    expect(lineas).toContain(`${sha(ficheros[EXE] as Buffer)}  ${EXE}`);
    expect(lineas).toContain(`${sha(ficheros[`${TGZ}.sig`] as string)}  ${TGZ}.sig`);
    expect(lineas).toHaveLength(Object.keys(ficheros).filter((n) => !n.startsWith('SHA256SUMS-')).length + 1);
  });

  test('sin firmas (faltan los secretos): se publica igual, sin latest.json y con un aviso', () => {
    const p = publicacion(par.publica, instaladores(temporal('sin'), null));
    const r = publicar(p);
    expect(r.estado, r.salida).toBe(0);
    expect(fs.existsSync(path.join(p.assets, 'latest.json'))).toBe(false);
    expect(r.salida).toContain('::warning::Esta versión se publica sin latest.json');
    const estado = JSON.parse(fs.readFileSync(path.join(p.dir, 'gh', 'estado.json'), 'utf8'));
    expect(estado).toMatchObject({ borrador: false, ultima: true });
    expect(fs.readFileSync(path.join(p.assets, 'SHA256SUMS.txt'), 'utf8')).not.toContain('latest.json');
    // gh was never asked to download signatures that are not there (that would fail the step)
    expect(fs.readFileSync(path.join(p.dir, 'gh', 'llamadas.txt'), 'utf8')).not.toContain("--pattern *.sig");
  });

  test('una firma de otra versión o de otra clave queda fuera, con aviso, y el resto sí entra', () => {
    const tmp = temporal('mezcla');
    const ficheros = instaladores(tmp, par, { [TGZ]: '0.11.9' });
    // the .msi signed with a key that is not the configured one
    const msi = path.join(tmp, 'otra-' + MSI);
    fs.writeFileSync(msi, ficheros[MSI] as Buffer);
    ficheros[`${MSI}.sig`] = firmar(otro, msi, VERSION);
    ficheros['Electronica-0.11.0-windows-x64-setup.exe.sig'] = ficheros[`${EXE}.sig`]!;
    const p = publicacion(par.publica, ficheros);
    const r = publicar(p);
    expect(r.estado, r.salida).toBe(0);
    const manifiesto = JSON.parse(fs.readFileSync(path.join(p.assets, 'latest.json'), 'utf8'));
    // without the .msi's signature there is no generic «windows-x86_64» key: an MSI install must not get the NSIS
    expect(Object.keys(manifiesto.platforms).sort()).toEqual(['windows-x86_64-nsis']);
    expect(r.salida).toMatch(/::warning::.*macos-universal\.app\.tar\.gz\.sig: firmada para la versión 0\.11\.9/);
    expect(r.salida).toMatch(/::warning::.*windows-x64\.msi\.sig: firmada con otra clave/);
    expect(r.salida).toMatch(/::warning::Electronica-0\.11\.0-windows-x64-setup\.exe\.sig: no corresponde/);
    expect(r.salida).toMatch(/::warning::Falta la firma de \*-macos-universal\.app\.tar\.gz/);
  });

  test('en una etiqueta (estricto) falta una plataforma: la publicación falla y queda en borrador', () => {
    const tmp = temporal('estricto');
    const ficheros = instaladores(tmp, par);
    delete ficheros[`${MSI}.sig`];
    const p = publicacion(par.publica, ficheros);
    const r = publicar(p, { EPA_ESTRICTO: '1' });
    expect(r.estado, r.salida).not.toBe(0);
    expect(r.salida).toMatch(/::error::.*-windows-x64\.msi/);
    expect(fs.existsSync(path.join(p.dir, 'gh', 'estado.json'))).toBe(false);
    expect(fs.existsSync(path.join(p.assets, 'latest.json'))).toBe(false);
  });

  test('una lista larga de assets no hace perder latest.json (sin `| grep -q` bajo pipefail)', () => {
    const tmp = temporal('largo');
    const p = publicacion(par.publica, instaladores(tmp, par));
    const r = publicar(p, { GH_FALSO_RELLENO: '200000' });
    expect(r.estado, r.salida).toBe(0);
    expect(fs.existsSync(path.join(p.assets, 'latest.json')), r.salida).toBe(true);
  });

  test('ningún `| grep -q` ni `| head` bajo pipefail en compilar.yml', () => {
    const flujo = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'compilar.yml'), 'utf8');
    const malas = flujo.split('\n').filter((l) => !l.trim().startsWith('#') && /\|\s*(grep\s+(-\w*q|--quiet)|head\b)/.test(l));
    expect(malas).toEqual([]);
  });

  test('con la clave pública aún de marcador no se genera latest.json aunque haya firmas', () => {
    const p = publicacion(MARCADOR, instaladores(temporal('marcador'), par));
    const r = publicar(p);
    expect(r.estado, r.salida).toBe(0);
    expect(fs.existsSync(path.join(p.assets, 'latest.json'))).toBe(false);
    expect(r.salida).toContain('No se genera latest.json');
  });
});

test.describe('actualizador.mjs en los trabajos de compilación', () => {
  let claves: string;
  let par: Par;
  let otro: Par;
  test.beforeAll(() => {
    claves = temporal('claves2');
    par = parDeClaves(claves, 'buena');
    otro = parDeClaves(claves, 'otra');
  });

  const CLI = path.join(WEB, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

  /** The three unsigned updater artifacts, as the build jobs attach them. */
  function artefactos(dir: string, version = VERSION): void {
    for (const n of [`Electronica-${version}-windows-x64-setup.exe`, `Electronica-${version}-windows-x64.msi`, `Electronica-${version}-macos-universal.app.tar.gz`])
      fs.writeFileSync(path.join(dir, n), Buffer.from(`${n} ${'y'.repeat(3000)}`));
  }

  function firmarDir(dir: string, pubkey: string, privada: string | null, opciones: { contrasena?: string; estricto?: boolean } = {}) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ACTUALIZADOR_CONF: conf(temporal('conf'), pubkey),
      GITHUB_ACTIONS: 'true',
      EPA_ESTRICTO: opciones.estricto ? '1' : '0',
    };
    delete env.TAURI_SIGNING_PRIVATE_KEY;
    delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
    if (privada !== null) {
      env.TAURI_SIGNING_PRIVATE_KEY = privada;
      env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = opciones.contrasena ?? CLAVE;
    }
    const r = spawnSync(process.execPath, [SCRIPT, 'firmar', '--dir', dir, '--version', VERSION, '--cli', CLI], { env, encoding: 'utf8' });
    const log = r.stdout + r.stderr;
    // nothing ever prints the private key
    if (privada) expect(log).not.toContain(privada.slice(10, 40));
    return { estado: r.status, log, firmas: fs.readdirSync(dir).filter((f) => f.endsWith('.sig')).sort() };
  }

  test('firmar: firma las tres con la versión, las verifica, y avisa (o falla en una etiqueta) si algo falta o no casa', () => {
    const bien = temporal('firmar');
    artefactos(bien);
    // a line break pasted into the secret is harmless
    const r = firmarDir(bien, par.publica, par.privada + '\r\n');
    expect(r.estado, r.log).toBe(0);
    expect(r.firmas).toEqual([`${EXE}.sig`, `${TGZ}.sig`, `${MSI}.sig`].sort());
    for (const f of r.firmas) {
      const v = spawnSync(process.execPath, [SCRIPT, 'verificar', path.join(bien, f.slice(0, -4)), path.join(bien, f), '--version', VERSION], {
        env: { ...process.env, ACTUALIZADOR_CONF: conf(temporal('c'), par.publica) },
        encoding: 'utf8',
      });
      expect(v.status, v.stdout).toBe(0);
    }

    // no secret: a warning on a manual run, an error on a tag
    const sin = temporal('firmar-sin');
    artefactos(sin);
    expect(firmarDir(sin, par.publica, null)).toMatchObject({ estado: 0, firmas: [] });
    const sinEstricto = firmarDir(sin, par.publica, null, { estricto: true });
    expect(sinEstricto.estado).toBe(1);
    expect(sinEstricto.log).toContain('::error::Falta el secreto TAURI_SIGNING_PRIVATE_KEY');

    // a key pair that does not match the public key: nothing kept, an error on a tag
    const cruzada = temporal('firmar-cruzada');
    artefactos(cruzada);
    const c = firmarDir(cruzada, par.publica, otro.privada, { estricto: true });
    expect(c.estado).toBe(1);
    expect(c.firmas).toEqual([]);
    expect(c.log).toMatch(/::error::La firma de .* no se verifica/);

    // a wrong password
    const mala = temporal('firmar-contrasena');
    artefactos(mala);
    const m = firmarDir(mala, par.publica, par.privada, { contrasena: 'otra', estricto: true });
    expect(m.estado).toBe(1);
    expect(m.log).toContain('no pudo firmar');

    // a missing artifact on a tag
    const falta = temporal('firmar-falta');
    artefactos(falta);
    fs.rmSync(path.join(falta, MSI));
    const f = firmarDir(falta, par.publica, par.privada, { estricto: true });
    expect(f.estado).toBe(1);
    expect(f.log).toContain(`::error::Falta ${MSI}`);

    // the placeholder public key
    const marcador = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src-tauri', 'tauri.conf.json'), 'utf8')).plugins.updater.pubkey;
    expect(firmarDir(temporal('firmar-marcador'), marcador, par.privada, { estricto: true }).estado).toBe(1);
  });

  test('trabajo «firmar» (paso real con gh simulado) y luego «publicar»: latest.json completo y verificable', () => {
    // the draft release as the build jobs leave it: installers (unsigned) and their sums
    const tmp = temporal('trabajo-firmar');
    const ficheros = instaladores(tmp, null);
    const bytes = (n: string) => Buffer.from(`${n} ${'x'.repeat(2000)}`);
    ficheros[TGZ] = bytes(TGZ);
    const p = publicacion(par.publica, ficheros);
    // the CLI where the install step leaves it
    const runner = temporal('runner');
    fs.mkdirSync(path.join(runner, 'tauri-cli', 'node_modules', '@tauri-apps'), { recursive: true });
    for (const n of fs.readdirSync(path.join(WEB, 'node_modules', '@tauri-apps')).filter((n) => n.startsWith('cli')))
      fs.symlinkSync(path.join(WEB, 'node_modules', '@tauri-apps', n), path.join(runner, 'tauri-cli', 'node_modules', '@tauri-apps', n));
    const env = {
      ...process.env,
      PATH: `${path.join(p.dir, 'bin')}:${process.env.PATH}`,
      GH_FALSO_DIR: path.join(p.dir, 'gh'),
      GH_TOKEN: 'falso',
      TAG,
      GITHUB_REPOSITORY: REPO,
      GITHUB_ACTIONS: 'true',
      RUNNER_TEMP: runner,
      EPA_ESTRICTO: '1',
      TAURI_SIGNING_PRIVATE_KEY: par.privada,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: CLAVE,
      // the build jobs' outputs
      SHA256_EXE: sha(ficheros[EXE] as Buffer),
      SHA256_MSI: sha(ficheros[MSI] as Buffer),
      SHA256_TGZ: sha(ficheros[TGZ] as Buffer),
    };
    const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', pasoDelFlujo('Sign the updater artifacts')], { cwd: p.trabajo, env, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    for (const n of [EXE, MSI, TGZ]) expect(fs.existsSync(path.join(p.assets, `${n}.sig`)), n).toBe(true);
    expect(fs.readFileSync(path.join(p.assets, 'SHA256SUMS-firmas.txt'), 'utf8').trim().split('\n')).toHaveLength(3);
    const pub = publicar(p, { EPA_ESTRICTO: '1' });
    expect(pub.estado, pub.salida).toBe(0);
    const manifiesto = JSON.parse(fs.readFileSync(path.join(p.assets, 'latest.json'), 'utf8'));
    expect(Object.keys(manifiesto.platforms).sort()).toEqual(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64', 'windows-x86_64-msi', 'windows-x86_64-nsis']);
    expect(fs.readFileSync(path.join(p.assets, 'SHA256SUMS.txt'), 'utf8')).toContain(`  ${TGZ}.sig`);
    // the same step without the key on a tag: fails, nothing attached
    const p2 = publicacion(par.publica, { ...ficheros });
    const r2 = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', pasoDelFlujo('Sign the updater artifacts')], {
      cwd: p2.trabajo,
      env: { ...env, PATH: `${path.join(p2.dir, 'bin')}:${process.env.PATH}`, GH_FALSO_DIR: path.join(p2.dir, 'gh'), TAURI_SIGNING_PRIVATE_KEY: '' },
      encoding: 'utf8',
    });
    expect(r2.status).not.toBe(0);
    expect(fs.readdirSync(p2.assets).filter((n) => n.endsWith('.sig'))).toEqual([]);
    // an asset replaced in the draft after its build job uploaded it (another job's token): nothing is signed
    const p3 = publicacion(par.publica, { ...ficheros, [MSI]: Buffer.from('cambiado por otro trabajo') });
    const r3 = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', pasoDelFlujo('Sign the updater artifacts')], {
      cwd: p3.trabajo,
      env: { ...env, PATH: `${path.join(p3.dir, 'bin')}:${process.env.PATH}`, GH_FALSO_DIR: path.join(p3.dir, 'gh') },
      encoding: 'utf8',
    });
    expect(r3.status).not.toBe(0);
    expect(r3.stdout + r3.stderr).toContain('::error::Lo descargado de la release no es lo que subieron');
    expect(fs.readdirSync(p3.assets).filter((n) => n.endsWith('.sig'))).toEqual([]);
    // and a missing output (a build job that did not report its hash)
    const p4 = publicacion(par.publica, { ...ficheros });
    const r4 = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', pasoDelFlujo('Sign the updater artifacts')], {
      cwd: p4.trabajo,
      env: { ...env, PATH: `${path.join(p4.dir, 'bin')}:${process.env.PATH}`, GH_FALSO_DIR: path.join(p4.dir, 'gh'), SHA256_TGZ: '' },
      encoding: 'utf8',
    });
    expect(r4.status).not.toBe(0);
    expect(fs.readdirSync(p4.assets).filter((n) => n.endsWith('.sig'))).toEqual([]);
  });

  test('cli: el Tauri CLI instalado aparte tiene que ser el del lockfile (versión e integridad)', () => {
    const lock = path.join(WEB, 'package-lock.json');
    const esperado = JSON.parse(fs.readFileSync(lock, 'utf8')).packages;
    const instalado = (cambio: (o: Record<string, { version: string; integrity: string }>) => void) => {
      const d = temporal('cli');
      const paquetes: Record<string, { version: string; integrity: string }> = {};
      for (const k of Object.keys(esperado).filter((k) => /^node_modules\/@tauri-apps\/cli(-linux-x64-gnu)?$/.test(k)))
        paquetes[k] = { version: esperado[k].version, integrity: esperado[k].integrity };
      cambio(paquetes);
      fs.writeFileSync(path.join(d, '.package-lock.json'), JSON.stringify({ packages: paquetes }));
      return spawnSync(process.execPath, [SCRIPT, 'cli', '--lock', lock, '--instalado', d], { env: { ...process.env, GITHUB_ACTIONS: 'true' }, encoding: 'utf8' });
    };
    expect(instalado(() => {}).status).toBe(0);
    const otro = instalado((o) => (o['node_modules/@tauri-apps/cli']!.integrity = 'sha512-otra'));
    expect(otro.status).toBe(1);
    expect(otro.stdout).toContain('::error::El Tauri CLI instalado para firmar no es el del lockfile');
  });

  test('exigir (trabajo «borrador» de una etiqueta): marcador o secreto ausente → falla; desactivable a propósito', () => {
    const marcador = MARCADOR;
    const exigir = (pubkey: string, env: NodeJS.ProcessEnv) => {
      const dir = temporal('exigir');
      const r = spawnSync(process.execPath, [SCRIPT, 'exigir'], {
        env: { ...process.env, ACTUALIZADOR_CONF: conf(dir, pubkey), GITHUB_ACTIONS: 'true', ...env },
        encoding: 'utf8',
      });
      return { estado: r.status, log: r.stdout + r.stderr };
    };
    const conMarcador = exigir(marcador, { EPA_ESTRICTO: '1', HAY_CLAVE: 'true' });
    expect(conMarcador.estado).toBe(1);
    expect(conMarcador.log).toContain('::error::La clave pública de src-tauri/tauri.conf.json no sirve');
    const sinSecreto = exigir(par.publica, { EPA_ESTRICTO: '1', HAY_CLAVE: 'false' });
    expect(sinSecreto.estado).toBe(1);
    expect(sinSecreto.log).toContain('::error::Falta el secreto TAURI_SIGNING_PRIVATE_KEY en el entorno «firma»');
    expect(exigir(par.publica, { EPA_ESTRICTO: '1', HAY_CLAVE: 'true' }).estado).toBe(0);
    // manual run, or the deliberate opt-out (the workflow then sets EPA_ESTRICTO=0)
    expect(exigir(marcador, { EPA_ESTRICTO: '0', HAY_CLAVE: 'false' }).estado).toBe(0);
    const fuera = exigir(marcador, { EPA_ESTRICTO: '0', EPA_PERMITIR_SIN_ACTUALIZADOR: '1', HAY_CLAVE: 'false' });
    expect(fuera.estado).toBe(0);
    expect(fuera.log).toContain('::warning::EPA_PERMITIR_SIN_ACTUALIZADOR=1');
  });

  test('compilar.yml: estricto en etiquetas; la clave solo en el paso de firma del trabajo «firmar»; sin credenciales persistentes', () => {
    const flujo = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'compilar.yml'), 'utf8');
    expect(flujo).toContain("EPA_ESTRICTO: ${{ github.ref_type == 'tag' && vars.EPA_PERMITIR_SIN_ACTUALIZADOR != '1' && '1' || '0' }}");
    expect(flujo).toContain('run: node web/scripts/actualizador.mjs exigir');
    // the exigir step comes before the draft is created
    expect(flujo.indexOf('actualizador.mjs exigir')).toBeLessThan(flujo.indexOf('gh release create'));
    const pasos = flujo.split(/\n(?=      - name: )/);
    const nombre = (p: string) => p.split('\n')[0]!.trim();
    // the key itself: only the «Sign the updater artifacts» step (borrador only learns whether it exists)
    expect(pasos.filter((p) => /secrets\.TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)? \}\}/.test(p)).map(nombre)).toEqual(['- name: Sign the updater artifacts']);
    expect(flujo.split('\n').filter((l) => l.includes('secrets.TAURI_SIGNING') && !/HAY_CLAVE|^\s+TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)?: \$\{\{ secrets\./.test(l))).toEqual([]);
    // the environment: borrador (presence check) and firmar only; no build job has it
    expect((flujo.match(/^\s+environment: firma$/gm) ?? []).length).toBe(2);
    expect(flujo).not.toMatch(/environment: \$\{\{/);
    const trabajos = flujo.split(/\n(?=  [a-z]+:\n)/);
    const trabajo = (n: string) => trabajos.find((t) => t.startsWith(`  ${n}:`))!;
    for (const t of ['windows', 'macos', 'android', 'publicar']) expect(trabajo(t), t).not.toMatch(/environment:|TAURI_SIGNING/);
    // after every job that runs third-party code with a write token (android included)
    expect(trabajo('firmar')).toContain('needs: [borrador, windows, macos, android]');
    // the hashes of what the build jobs uploaded travel as job outputs and are checked before signing
    expect(trabajo('windows')).toContain('sha256_exe: ${{ steps.recoger.outputs.exe }}');
    expect(trabajo('windows')).toContain('sha256_msi: ${{ steps.recoger.outputs.msi }}');
    expect(trabajo('macos')).toContain('sha256_tgz: ${{ steps.recoger.outputs.tgz }}');
    const firma = pasoDelFlujo('Sign the updater artifacts');
    expect(firma.indexOf('sha256sum -c -')).toBeGreaterThan(0);
    expect(firma.indexOf('sha256sum -c -')).toBeLessThan(firma.indexOf('actualizador.mjs firmar'));
    expect(trabajo('publicar')).toContain('needs: [borrador, windows, macos, android, firmar]');
    // firmar runs no dependency code: sparse checkout, the CLI alone without install scripts, checked against the lock
    expect(trabajo('firmar')).toContain('sparse-checkout-cone-mode: false');
    expect(trabajo('firmar')).toMatch(/npm install --prefix "\$cli" --no-save --ignore-scripts/);
    expect(trabajo('firmar')).toContain('actualizador.mjs cli --lock web/package-lock.json');
    expect(trabajo('firmar')).not.toMatch(/npm ci|npm run/);
    // the build jobs install without scripts and make no updater signature
    expect((flujo.match(/run: npm ci --ignore-scripts$/gm) ?? []).length).toBe(3);
    expect(flujo).not.toMatch(/^\s+run: npm ci$/m);
    expect(flujo).not.toContain('createUpdaterArtifacts":');
    // every bundle retry starts from the pristine binary (the bundler patches the bundle type in place)
    const empaquetan = pasos.filter((p) => /npm run tauri -- bundle /.test(p));
    expect(empaquetan).toHaveLength(2);
    for (const p of empaquetan) {
      const bucle = p.slice(p.indexOf('for attempt'));
      expect(bucle, nombre(p)).toMatch(/cp "\$RUNNER_TEMP\/binario-sin-tocar(\.exe)?" "\$binario"/);
      expect(bucle, nombre(p)).toContain('grep -ac __TAURI_BUNDLE_TYPE_VAR_UNK');
      expect(bucle.indexOf('cp "$RUNNER_TEMP')).toBeLessThan(bucle.indexOf('npm run tauri -- bundle'));
    }
    // dtolnay/rust-toolchain names its toolchain (a pin by SHA would lose the one its ref implies)
    for (const p of pasos.filter((p) => p.includes('dtolnay/rust-toolchain'))) expect(p).toMatch(/toolchain: stable/);
    // every checkout without persisted credentials
    const checkouts = flujo.split('uses: actions/checkout@').length - 1;
    expect(flujo.match(/^ +persist-credentials: false$/gm)).toHaveLength(checkouts);
  });

  test('Windows: un reintento de `tauri bundle` empieza con el binario sin marcar (pasos reales con npm simulado)', () => {
    // The bundler patches __TAURI_BUNDLE_TYPE_VAR_UNK in place (→ _NSS for the NSIS, _MSI for the .msi) and restores
    // it only when that package succeeds. The fake npm reproduces that: the first bundle patches and fails.
    const raiz = temporal('reintento');
    const web = path.join(raiz, 'web');
    fs.mkdirSync(path.join(raiz, 'src-tauri', 'target', 'release'), { recursive: true });
    fs.mkdirSync(web);
    const bin = path.join(raiz, 'bin');
    fs.mkdirSync(bin);
    const registro = path.join(raiz, 'npm.log');
    fs.writeFileSync(
      path.join(bin, 'npm'),
      `#!/bin/bash
exe=../src-tauri/target/release/electronica-practica-avanzada.exe
case "$*" in
  *"build --no-bundle"*) printf 'MZ binario __TAURI_BUNDLE_TYPE_VAR_UNK fin' > "$exe"; echo build >> "${registro}";;
  *"bundle --bundles nsis,msi"*)
    echo "bundle: $(grep -ao '__TAURI_BUNDLE_TYPE_VAR_[A-Z]*' "$exe")" >> "${registro}"
    sed -i 's/__TAURI_BUNDLE_TYPE_VAR_UNK/__TAURI_BUNDLE_TYPE_VAR_NSS/' "$exe"
    if [ ! -f "${raiz}/ya-fallo" ]; then touch "${raiz}/ya-fallo"; exit 1; fi
    mkdir -p ../src-tauri/target/release/bundle/nsis ../src-tauri/target/release/bundle/msi
    sed -i 's/__TAURI_BUNDLE_TYPE_VAR_NSS/__TAURI_BUNDLE_TYPE_VAR_UNK/' "$exe";;
  *) echo "npm simulado: $*" >&2; exit 2;;
esac
`,
      { mode: 0o755 },
    );
    // (sleep between attempts made instant)
    fs.writeFileSync(path.join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: raiz, GITHUB_ACTIONS: 'true' };
    for (const paso of ['Build the app', 'Bundle the installers']) {
      const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', pasoDelFlujo(paso)], { cwd: web, env, encoding: 'utf8' });
      expect(r.status, `${paso}: ${r.stdout}${r.stderr}`).toBe(0);
    }
    // both attempts started from the unmarked binary (without the restore, the second one would see _NSS)
    expect(fs.readFileSync(registro, 'utf8').trim().split('\n')).toEqual(['build', 'bundle: __TAURI_BUNDLE_TYPE_VAR_UNK', 'bundle: __TAURI_BUNDLE_TYPE_VAR_UNK']);
  });

  test('macOS: el .app.tar.gz tiene la forma del de createUpdaterArtifacts (paso real, un .app de prueba)', () => {
    const flujo = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'compilar.yml'), 'utf8');
    const paso = pasoDelFlujo('Collect installer');
    const py = paso.slice(paso.indexOf("<<'PY'\n") + 7, paso.indexOf('\nPY\n'));
    expect(flujo).toContain(`python3 - "\${app[0]}" "salida/Electronica-\${VERSION}-macos-universal.app.tar.gz" <<'PY'`);
    const d = temporal('app');
    const app = path.join(d, 'Electrónica Práctica Avanzada.app');
    fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
    fs.mkdirSync(path.join(app, 'Contents', '_CodeSignature'), { recursive: true });
    fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), '<plist/>');
    fs.writeFileSync(path.join(app, 'Contents', 'MacOS', 'electronica-practica-avanzada'), 'binario', { mode: 0o755 });
    fs.writeFileSync(path.join(app, 'Contents', '_CodeSignature', 'CodeResources'), 'firma ad hoc');
    fs.symlinkSync('MacOS/electronica-practica-avanzada', path.join(app, 'Contents', 'enlace'));
    const salida = path.join(d, 'salida.app.tar.gz');
    const r = spawnSync('python3', ['-', app, salida], { input: py, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    // what tauri-plugin-updater does with it: drop the first component of every entry
    const lista = spawnSync('python3', ['-c', `import tarfile,sys,json
t=tarfile.open(sys.argv[1],'r:gz')
print(json.dumps([[m.name, m.type.decode(), oct(m.mode), m.linkname] for m in t.getmembers()]))`, salida], { encoding: 'utf8' });
    const entradas = JSON.parse(lista.stdout) as [string, string, string, string][];
    expect(new Set(entradas.map((e) => e[0].split('/')[0]))).toEqual(new Set(['Electrónica Práctica Avanzada.app']));
    const sin = Object.fromEntries(entradas.map((e) => [e[0].split('/').slice(1).join('/'), e]));
    expect(Object.keys(sin)).toEqual(expect.arrayContaining(['Contents/Info.plist', 'Contents/MacOS/electronica-practica-avanzada', 'Contents/_CodeSignature/CodeResources', 'Contents/enlace']));
    expect(sin['Contents/MacOS/electronica-practica-avanzada']![2]).toBe('0o755');
    // a symlink stays a symlink (tauri's builder: follow_symlinks(false))
    expect(sin['Contents/enlace']![1]).toBe('2');
    expect(sin['Contents/enlace']![3]).toBe('MacOS/electronica-practica-avanzada');
    // no AppleDouble «._» entries
    expect(entradas.filter((e) => e[0].split('/').some((c) => c.startsWith('._')))).toEqual([]);
    // a hard link inside the .app (stored as a link entry, which the updater cannot extract) stops the step
    fs.linkSync(path.join(app, 'Contents', 'Info.plist'), path.join(app, 'Contents', 'duro.plist'));
    const conDuro = spawnSync('python3', ['-', app, path.join(d, 'duro.app.tar.gz')], { input: py, encoding: 'utf8' });
    expect(conDuro.status).not.toBe(0);
    expect(conDuro.stderr).toContain('enlaces duros');
  });

  test('verificar: acepta la firma buena y rechaza fichero alterado, versión distinta y otra clave', () => {
    const dir = temporal('ver');
    const f = path.join(dir, EXE);
    fs.writeFileSync(f, Buffer.from('instalador '.repeat(500)));
    firmar(par, f, VERSION);
    const ver = (pubkey: string, version: string) =>
      spawnSync(process.execPath, [SCRIPT, 'verificar', f, `${f}.sig`, '--version', version], { env: { ...process.env, ACTUALIZADOR_CONF: conf(dir, pubkey) }, encoding: 'utf8' });
    expect(ver(par.publica, VERSION).status).toBe(0);
    const v2 = ver(par.publica, '0.12.1');
    expect(v2.status).toBe(1);
    expect(v2.stdout).toContain('es de la versión 0.12.0');
    const v3 = ver(otro.publica, VERSION);
    expect(v3.status).toBe(1);
    expect(v3.stdout).toContain('es de otra clave');
    fs.appendFileSync(f, 'x');
    const v4 = ver(par.publica, VERSION);
    expect(v4.status).toBe(1);
    expect(v4.stdout).toContain('no corresponde a este fichero');
  });

  test('clave: el marcador de tauri.conf.json se detecta y una clave real se acepta', () => {
    // the placeholder, on a temporary copy of the configuration
    const conMarcador = spawnSync(process.execPath, [SCRIPT, 'clave'], { env: { ...process.env, ACTUALIZADOR_CONF: conf(temporal('clave-marcador'), MARCADOR) }, encoding: 'utf8' });
    expect(conMarcador.status, conMarcador.stdout + conMarcador.stderr).toBe(2);
    // the repository's own file carries the owner's real key since 1.0 (a release with the placeholder would leave
    // whoever installs it without automatic updates)
    const real = spawnSync(process.execPath, [SCRIPT, 'clave'], { encoding: 'utf8' });
    expect(real.status, real.stdout + real.stderr).toBe(0);
    const dir = temporal('clave');
    const ok = spawnSync(process.execPath, [SCRIPT, 'clave'], { env: { ...process.env, ACTUALIZADOR_CONF: conf(dir, par.publica) }, encoding: 'utf8' });
    expect(ok.status).toBe(0);
    // the id minisign prints in the key's own comment
    const id = /public key: ([0-9A-F]{16})/.exec(Buffer.from(par.publica, 'base64').toString('utf8'))![1]!;
    expect(ok.stdout).toContain(id);
  });
});

// ------------------------------------------------------------------ Android: the reminder's own icon

test.describe('android-preparar.mjs: icono de la notificación del recordatorio', () => {
  /** A copy of the layout the script expects, with a project as `tauri android init` leaves it. */
  function proyecto(conRecursos: boolean): { raiz: string; res: string; env: NodeJS.ProcessEnv } {
    const raiz = temporal('android');
    fs.mkdirSync(path.join(raiz, 'web', 'scripts'), { recursive: true });
    fs.copyFileSync(path.join(WEB, 'scripts', 'android-preparar.mjs'), path.join(raiz, 'web', 'scripts', 'android-preparar.mjs'));
    // 1.1: the script also writes the book's QR links into the manifest (android-enlaces.mjs, from tauri.conf.json)
    fs.copyFileSync(path.join(WEB, 'scripts', 'android-enlaces.mjs'), path.join(raiz, 'web', 'scripts', 'android-enlaces.mjs'));
    fs.cpSync(path.join(RAIZ, 'src-tauri', 'icons', 'android'), path.join(raiz, 'src-tauri', 'icons', 'android'), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, 'src-tauri', 'tauri.conf.json'), path.join(raiz, 'src-tauri', 'tauri.conf.json'));
    if (conRecursos) fs.cpSync(path.join(RAIZ, 'src-tauri', 'recursos-android'), path.join(raiz, 'src-tauri', 'recursos-android'), { recursive: true });
    const app = path.join(raiz, 'src-tauri', 'gen', 'android', 'app');
    const res = path.join(app, 'src', 'main', 'res');
    fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
    fs.copyFileSync(path.join(WEB, 'tests', 'enlaces11', 'AndroidManifest.plantilla.xml'), path.join(app, 'src', 'main', 'AndroidManifest.xml'));
    fs.writeFileSync(
      path.join(app, 'build.gradle.kts'),
      'plugins {\n    id("com.android.application")\n}\n\nandroid {\n    buildTypes {\n        getByName("release") {\n            isMinifyEnabled = true\n        }\n    }\n}\n',
    );
    const firma = path.join(raiz, 'firma');
    fs.mkdirSync(firma);
    fs.writeFileSync(path.join(firma, 'electronica-release.jks'), 'no es un almacén real');
    fs.writeFileSync(path.join(firma, 'firma.properties'), 'keyAlias=electronica\nstorePassword=uno\nkeyPassword=dos\n');
    const env: NodeJS.ProcessEnv = { ...process.env, ELECTRONICA_FIRMA_DIR: firma };
    delete env.ANDROID_KEYSTORE_FILE;
    return { raiz, res, env };
  }

  test('copia ic_stat_epa.xml (vector monocromo) a res/drawable junto a los iconos', () => {
    const { raiz, res, env } = proyecto(true);
    const r = spawnSync(process.execPath, [path.join(raiz, 'web', 'scripts', 'android-preparar.mjs')], { env, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('icono de la notificación copiado');
    const icono = fs.readFileSync(path.join(res, 'drawable', 'ic_stat_epa.xml'), 'utf8');
    expect(icono).toBe(fs.readFileSync(path.join(RAIZ, 'src-tauri', 'recursos-android', 'drawable', 'ic_stat_epa.xml'), 'utf8'));
    // a status-bar icon: a vector drawable of 24 dp, every path filled with opaque white (Android uses the alpha)
    expect(icono).toMatch(/<vector[^>]+android:width="24dp"[^>]+android:height="24dp"/);
    const colores = [...icono.matchAll(/android:(fill|stroke)Color="([^"]+)"/g)].map((m) => m[2]);
    expect(colores.length).toBeGreaterThan(0);
    expect(new Set(colores)).toEqual(new Set(['#FFFFFFFF']));
    expect(fs.existsSync(path.join(res, 'mipmap-hdpi'))).toBe(true);
    // and the rule that keeps it in a release build with resource shrinking (it is only asked for by name)
    expect(fs.readFileSync(path.join(res, 'raw', 'epa_conservar.xml'), 'utf8')).toContain('tools:keep="@drawable/ic_stat_epa"');
    // the name the reminder asks for
    expect(fs.readFileSync(path.join(WEB, 'src', 'lib', 'aprendizaje', 'recordatorio.ts'), 'utf8')).toContain("ICONO_RECORDATORIO = 'ic_stat_epa'");
  });

  test('sin el recurso se detiene con un error claro (no se compila un APK con la «i» genérica)', () => {
    const { raiz, env } = proyecto(false);
    const r = spawnSync(process.execPath, [path.join(raiz, 'web', 'scripts', 'android-preparar.mjs')], { env, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('ic_stat_epa.xml');
  });

  test('tauri.conf.json no configura plugins.notification (su configuración en Rust es () y un objeto la rompería)', () => {
    const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src-tauri', 'tauri.conf.json'), 'utf8'));
    expect(c.plugins.notification).toBeUndefined();
  });
});

// ------------------------------------------------------------------ backup file: no fs/dialog permission in the webview

test.describe('copia de seguridad: el fichero solo se toca desde Rust', () => {
  test('ninguna capacidad da permisos dialog:* ni fs:* a la vista web', () => {
    const dir = path.join(RAIZ, 'src-tauri', 'capabilities');
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { permissions: (string | { identifier: string })[] };
      const ids = c.permissions.map((p) => (typeof p === 'string' ? p : p.identifier));
      expect(ids.filter((p) => /^(fs|dialog):/.test(p)), f).toEqual([]);
    }
    // and exactly what the updater code calls (no updater:default)
    const esc = JSON.parse(fs.readFileSync(path.join(dir, 'escritorio.json'), 'utf8'));
    expect(esc.permissions).toEqual(['updater:allow-check', 'updater:allow-download', 'updater:allow-install', 'process:allow-restart']);
    // the commands that replace them are registered
    const lib = fs.readFileSync(path.join(RAIZ, 'src-tauri', 'src', 'lib.rs'), 'utf8');
    expect(lib).toContain('fichero::guardar_fichero_elegido');
    expect(lib).toContain('fichero::abrir_fichero_elegido');
  });

  test('fichero.ts usa los comandos propios (guardar, cancelar, error en español, abrir)', async () => {
    const llamadas: [string, unknown][] = [];
    let respuesta: () => unknown = () => true;
    const g = globalThis as unknown as { window?: unknown };
    const antes = g.window;
    g.window = {
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args: unknown) => {
          llamadas.push([cmd, args]);
          return respuesta();
        },
        transformCallback: () => 1,
      },
    };
    try {
      const { guardarFichero, abrirFicheroTauri, CANCELADO } = await import('../src/lib/sincronizacion/fichero');
      expect(await guardarFichero('copia.json', '{"a":1}')).toBe('guardado');
      expect(llamadas.at(-1)).toEqual(['guardar_fichero_elegido', { nombre: 'copia.json', texto: '{"a":1}' }]);
      respuesta = () => false;
      expect(await guardarFichero('copia.json', '{}')).toBe(CANCELADO);
      respuesta = () => {
        throw 'No se pudo escribir el fichero: disco lleno';
      };
      await expect(guardarFichero('copia.json', '{}')).rejects.toThrow('No se pudo escribir el fichero: disco lleno');
      respuesta = () => ({ nombre: 'copia.json', texto: '{}' });
      expect(await abrirFicheroTauri()).toEqual({ nombre: 'copia.json', texto: '{}' });
      expect(llamadas.at(-1)![0]).toBe('abrir_fichero_elegido');
      respuesta = () => null;
      expect(await abrirFicheroTauri()).toBeNull();
      expect(llamadas.map((l) => l[0]).every((c) => !c.startsWith('plugin:'))).toBe(true);
    } finally {
      g.window = antes;
    }
  });

  test('fichero.ts: solo el rechazo de Tauri a la orden activa la alternativa; en Android nunca se finge una descarga', async () => {
    const { noDisponible, guardarFichero, abrirFicheroTauri } = await import('../src/lib/sincronizacion/fichero');
    expect(noDisponible('Command guardar_fichero_elegido not found')).toBe(true);
    expect(noDisponible('Command abrir_fichero_elegido not allowed by ACL')).toBe(true);
    expect(noDisponible('guardar_fichero_elegido not allowed. Command not found')).toBe(true);
    // errors of the file itself are errors
    expect(noDisponible('No se pudo abrir el fichero: File not found')).toBe(false);
    expect(noDisponible('No se pudo crear el fichero: java.io.FileNotFoundException: open failed: ENOENT (not found)')).toBe(false);
    expect(noDisponible('Command otra_orden not found')).toBe(false);

    let respuesta: () => unknown = () => true;
    const g = globalThis as unknown as { window?: unknown };
    const antes = g.window;
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    g.window = { __TAURI_INTERNALS__: { invoke: async () => respuesta(), transformCallback: () => 1 } };
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro; wv) AppleWebKit/537.36' },
      configurable: true,
    });
    try {
      // a provider's «not found» reaches the reader as it is (no fallback)
      respuesta = () => {
        throw 'No se pudo abrir el fichero: File not found';
      };
      await expect(abrirFicheroTauri()).rejects.toThrow('No se pudo abrir el fichero: File not found');
      await expect(guardarFichero('copia.json', '{}')).rejects.toThrow('No se pudo abrir el fichero: File not found');
      // the command missing on Android: an error, never «descargado» (the WebView ignores the Blob download)
      respuesta = () => {
        throw 'Command guardar_fichero_elegido not found';
      };
      await expect(guardarFichero('copia.json', '{}')).rejects.toThrow('Este dispositivo no permite guardar el fichero de la copia');
    } finally {
      g.window = antes;
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
    }
  });

  test('1.0, PDF del modo docente: guardarBinario manda base64 y el tipo, y la orden de Rust decodifica sin elegir la ruta', async () => {
    const llamadas: [string, Record<string, unknown>][] = [];
    let respuesta: () => unknown = () => true;
    const g = globalThis as unknown as { window?: unknown };
    const antes = g.window;
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    g.window = {
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args: Record<string, unknown>) => {
          llamadas.push([cmd, args]);
          return respuesta();
        },
        transformCallback: () => 1,
      },
    };
    try {
      const { guardarBinario, guardarFichero, aBase64, CANCELADO } = await import('../src/lib/sincronizacion/fichero');
      // every byte value survives (a PDF is binary), also past the 32 KB pieces of the encoder
      const bytes = new Uint8Array(70_000).map((_, i) => (i * 37) % 256);
      expect(Buffer.from(aBase64(bytes), 'base64').equals(Buffer.from(bytes))).toBe(true);
      expect(await guardarBinario('examen.pdf', bytes)).toBe('guardado');
      const [cmd, args] = llamadas.at(-1)!;
      expect(cmd).toBe('guardar_fichero_elegido');
      expect(Object.keys(args).sort()).toEqual(['base64', 'filtro', 'nombre', 'texto']);
      expect(args).toMatchObject({ nombre: 'examen.pdf', base64: true, filtro: ['Documento PDF', ['pdf']] });
      expect(Buffer.from(args.texto as string, 'base64').equals(Buffer.from(bytes))).toBe(true);
      respuesta = () => false;
      expect(await guardarBinario('examen.pdf', bytes)).toBe(CANCELADO);
      // the backup's call is unchanged (no base64, no filter: JSON filter on desktop)
      respuesta = () => true;
      await guardarFichero('copia.json', '{}');
      expect(llamadas.at(-1)).toEqual(['guardar_fichero_elegido', { nombre: 'copia.json', texto: '{}' }]);
      // Android without the command: an error, never a pretended download
      Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Linux; Android 14; wv)' }, configurable: true });
      respuesta = () => {
        throw 'Command guardar_fichero_elegido not found';
      };
      await expect(guardarBinario('examen.pdf', bytes)).rejects.toThrow('Este dispositivo no permite guardar el fichero');
    } finally {
      g.window = antes;
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
    }
    // Rust: optional arguments, the decoded bytes are what is written, the path only from the dialog, 50 MB cap
    const lib = fs.readFileSync(path.join(RAIZ, 'src-tauri', 'src', 'lib.rs'), 'utf8');
    const orden = lib.slice(lib.indexOf('pub async fn guardar_fichero_elegido'), lib.indexOf('pub async fn abrir_fichero_elegido'));
    expect(orden).toContain('base64: Option<bool>');
    expect(orden).toContain('filtro: Option<(String, Vec<String>)>');
    expect(orden).toContain('let bytes = contenido(texto, base64.unwrap_or(false))?;');
    expect(orden).toContain('f.write_all(&bytes)');
    expect(orden).toContain('blocking_save_file()');
    expect(orden).toContain('None => dialogo.add_filter("Copia de seguridad (JSON)", &["json"])');
    // review 10c: only the JSON backup and the PDF, with the names fixed in Rust (test pruebas::solo_json_y_pdf)
    expect(orden).toContain('let permitido = filtro_permitido(&filtro)?;');
    // review 10f: the proposed name gets the filter's extension (test pruebas::el_nombre_lleva_la_extension_del_filtro)
    expect(orden).toContain('Some((_, ext)) => nombre_con_extension(&nombre, ext)');
    expect(lib).toMatch(/fn filtro_permitido[\s\S]*?"json"[\s\S]*?"pdf"[\s\S]*?_ => Err\(/);
    expect(orden.match(/\.open\(ruta, opciones\)/g)).toHaveLength(1);
    expect(lib).toMatch(/fn contenido\(texto: String, base64: bool\)[\s\S]*?> MAXIMO[\s\S]*?bytes\.len\(\) as u64 > MAXIMO/);
  });
});

// ------------------------------------------------------------------ no native alert/confirm/prompt in the app's code

test('ningún alert( / confirm( / prompt( en web/src (salvo ngspice*.js): se usa el diálogo propio', () => {
  const malas: string[] = [];
  const recorrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (/\.(ts|js|svelte)$/.test(e.name) && !/^ngspice/.test(e.name)) {
        fs.readFileSync(f, 'utf8')
          .split('\n')
          .forEach((l, i) => {
            const codigo = l.replace(/\/\/.*$/, '');
            // a call of the global (bare or through window/globalThis), not a method like `.confirm(` of something else
            if (/(^|[^.\w$])(window\.|globalThis\.)?(alert|confirm|prompt)\s*\(/.test(codigo) && !/function (alert|confirm|prompt)\b/.test(codigo))
              malas.push(`${path.relative(WEB, f)}:${i + 1}: ${l.trim()}`);
          });
      }
    }
  };
  recorrer(path.join(WEB, 'src'));
  expect(malas).toEqual([]);
});
