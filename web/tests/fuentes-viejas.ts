// The web/src of an older release, extracted read-only from git (`git archive`, never touching the work tree or the
// index) into the system's temporary folder (TMPDIR), once per commit. Used by tests/actualizacion (0.10.1, 0.11.0 and
// 0.12.0 fill and read the stores) and by tests/motor-real (a device running the 0.12.0 engine, 1.0's transition).
// A commit missing from the clone (a rewritten history) is found by its message «Versión X.Y.Z:».
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../', import.meta.url));
export type Vieja = '0.10.1' | '0.11.0' | '0.12.0';
export const COMMITS: Record<Vieja, string> = { '0.10.1': '8ffa4c6', '0.11.0': '0afc439', '0.12.0': 'f0bd8d0' };

/** The commit of a release: its known hash, or the commit whose message starts «Versión X.Y.Z:» (null: not found). */
export function commitDe(version: Vieja): string | null {
  const git = (...a: string[]) => execFileSync('git', ['-C', join(WEB, '..'), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    return git('rev-parse', '--verify', '--quiet', `${COMMITS[version]}^{commit}`).slice(0, 7);
  } catch {
    try {
      return git('log', '--format=%h', '-n', '1', `--grep=^Versión ${version.replace(/\./g, '\\.')}:`) || null;
    } catch {
      return null;
    }
  }
}

/** The web/src of an older release (extracted once; null without git). */
export function fuenteVieja(version: Vieja): string | null {
  const commit = commitDe(version);
  if (!commit) return null;
  const dir = join(tmpdir(), `epa-v${version.replace(/\./g, '')}-${commit}`);
  const src = join(dir, 'web', 'src');
  if (existsSync(join(src, 'lib', 'usuario.svelte.ts'))) return src;
  try {
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['-C', join(WEB, '..'), 'archive', commit, 'web/src', 'web/package.json'], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    if (!existsSync(join(dir, 'web', 'node_modules'))) symlinkSync(join(WEB, 'node_modules'), join(dir, 'web', 'node_modules'));
    return src;
  } catch {
    return null;
  }
}
