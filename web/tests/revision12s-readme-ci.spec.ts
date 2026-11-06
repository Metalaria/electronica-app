// Fourth review of the 0.12 «platform» block: the owner commands of README §6 («Actualizaciones automáticas firmadas»)
// are run exactly as written (extracted from README.md) against a copy of the files they touch and a fake `gh`, so a
// README edit that breaks them fails here instead of in the owner's WSL. No network, no browser.
import { test, expect } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.join(WEB, '..');
const README = fs.readFileSync(path.join(RAIZ, 'README.md'), 'utf8');
const FLUJO = path.join(RAIZ, '.github', 'workflows', 'compilar.yml');
const TAURI = path.join(WEB, 'scripts', 'tauri.mjs');

const temporales: string[] = [];
function temporal(nombre: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `epa-r12s-${nombre}-`));
  temporales.push(d);
  return d;
}
test.afterAll(() => {
  for (const d of temporales.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** The ```bash block of README.md that starts with `inicio` (its whole text). */
function bloque(inicio: string): string {
  const re = /```bash\n([\s\S]*?)\n```/g;
  for (let m = re.exec(README); m; m = re.exec(README)) if (m[1]!.startsWith(inicio)) return m[1]!;
  throw new Error(`README.md: no hay bloque bash que empiece por ${inicio}`);
}

test('README §6: fijar las acciones por SHA cambia solo las líneas uses:, deja la etiqueta como comentario y es idempotente', () => {
  const dir = temporal('sha');
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, '.github', 'workflows'), { recursive: true });
  const copia = path.join(repo, '.github', 'workflows', 'compilar.yml');
  // The repository's workflow is already pinned (the owner ran this command): the test starts from a tag-style copy
  // of it, every `uses: owner/action@<sha> # tag` turned back into `uses: owner/action@tag`.
  const real = fs.readFileSync(FLUJO, 'utf8');
  const porEtiqueta = real.replace(/^(\s*uses: [\w.-]+\/[\w.-]+)@[0-9a-f]{40} # ([\w.-]+)$/gm, '$1@$2');
  expect(porEtiqueta.split('\n').filter((l) => /^\s*uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40}/.test(l))).toEqual([]);
  fs.writeFileSync(copia, porEtiqueta);
  // fake gh: `gh api repos/OWNER/ACTION/commits/REF --jq .sha` → a deterministic 40-hex SHA; logs every call
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, 'gh'),
    `#!/bin/bash\necho "$*" >> "${path.join(dir, 'llamadas.txt')}"\n[ "$1" = api ] && [ "$3" = --jq ] || exit 2\nprintf '%s\\n' "$(printf '%s' "$2" | sha1sum | cut -c1-40)"\n`,
    { mode: 0o755 },
  );
  const script = bloque("python3 - <<'PY'\nimport re, subprocess");
  const correr = () =>
    spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
      cwd: repo,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
  const r1 = correr();
  expect(r1.status, r1.stdout + r1.stderr).toBe(0);
  const antes = porEtiqueta.split('\n');
  const despues = fs.readFileSync(copia, 'utf8').split('\n');
  expect(despues).toHaveLength(antes.length);
  const usos = antes.map((l, i) => [l, despues[i]!] as const).filter(([a, d]) => a !== d);
  // every `uses:` line, and nothing else
  expect(usos.length).toBeGreaterThan(0);
  expect(usos.length).toBe(antes.filter((l) => /^\s*uses: /.test(l)).length);
  for (const [a, d] of usos) {
    const m = /^(\s*uses: )([\w.-]+\/[\w.-]+)@([\w.-]+)$/.exec(a);
    expect(m, a).not.toBeNull();
    expect(d).toMatch(new RegExp(`^${m![1]}${m![2]!.replace(/\./g, '\\.')}@[0-9a-f]{40} # ${m![3]}$`));
  }
  // one API call per distinct action@ref
  const llamadas = fs.readFileSync(path.join(dir, 'llamadas.txt'), 'utf8').trim().split('\n');
  expect(new Set(llamadas).size).toBe(llamadas.length);
  // a second run changes nothing and asks nothing
  const r2 = correr();
  expect(r2.status, r2.stdout + r2.stderr).toBe(0);
  expect(fs.readFileSync(copia, 'utf8')).toBe(despues.join('\n'));
  expect(fs.readFileSync(path.join(dir, 'llamadas.txt'), 'utf8').trim().split('\n')).toHaveLength(llamadas.length);
  // and on the repository's own (pinned) workflow it changes nothing either
  fs.writeFileSync(copia, real);
  const r3 = correr();
  expect(r3.status, r3.stdout + r3.stderr).toBe(0);
  expect(fs.readFileSync(copia, 'utf8')).toBe(real);
  expect(fs.readFileSync(path.join(dir, 'llamadas.txt'), 'utf8').trim().split('\n')).toHaveLength(llamadas.length);
});

test('README §6: la orden que pone la clave pública en tauri.conf.json deja una clave que `actualizador.mjs clave` acepta y no toca nada más', () => {
  const dir = temporal('pub');
  const casa = path.join(dir, 'casa');
  fs.mkdirSync(path.join(casa, 'electronica-firma'), { recursive: true });
  const clave = path.join(casa, 'electronica-firma', 'electronica-actualizador.key');
  execFileSync(process.execPath, [TAURI, 'signer', 'generate', '--ci', '-p', 'prueba', '-w', clave, '-f'], { stdio: 'pipe' });
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, 'src-tauri'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'web', 'scripts'), { recursive: true });
  const conf = path.join(repo, 'src-tauri', 'tauri.conf.json');
  fs.copyFileSync(path.join(RAIZ, 'src-tauri', 'tauri.conf.json'), conf);
  fs.copyFileSync(path.join(WEB, 'scripts', 'actualizador.mjs'), path.join(repo, 'web', 'scripts', 'actualizador.mjs'));
  const env = { ...process.env, HOME: casa };
  const orden = bloque('node -e "const fs=require(');
  const comprobar = bloque('node web/scripts/actualizador.mjs clave');
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', orden], { cwd: repo, env, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  const c = spawnSync('bash', ['--noprofile', '--norc', '-c', comprobar], { cwd: repo, env, encoding: 'utf8' });
  expect(c.status, c.stdout).toBe(0);
  // the id it prints is the one in the decoded .key.pub
  const id = /minisign public key: ([0-9A-F]{16})/.exec(Buffer.from(fs.readFileSync(clave + '.pub', 'utf8').trim(), 'base64').toString('utf8'))![1];
  expect(c.stdout).toContain(`id ${id}`);
  const original = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  const nuevo = JSON.parse(fs.readFileSync(conf, 'utf8'));
  expect(nuevo.plugins.updater.pubkey).toBe(fs.readFileSync(clave + '.pub', 'utf8').trim());
  nuevo.plugins.updater.pubkey = original.plugins.updater.pubkey;
  expect(nuevo).toEqual(original);
  // running it again gives the same file
  const una = fs.readFileSync(conf, 'utf8');
  expect(spawnSync('bash', ['-c', orden], { cwd: repo, env }).status).toBe(0);
  expect(fs.readFileSync(conf, 'utf8')).toBe(una);
});
