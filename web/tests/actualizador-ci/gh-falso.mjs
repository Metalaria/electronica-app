#!/usr/bin/env node
// A fake GitHub CLI for tests/actualizador-ci.spec.ts: just the `gh release …` subcommands the publish job of
// .github/workflows/compilar.yml uses, over a folder (GH_FALSO_DIR) holding the release's assets, its body and
// its state (draft, latest). Every call is appended to llamadas.txt.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.GH_FALSO_DIR;
if (!dir) {
  console.error('gh-falso: falta GH_FALSO_DIR');
  process.exit(2);
}
const assets = path.join(dir, 'assets');
const estadoFichero = path.join(dir, 'estado.json');
const args = process.argv.slice(2);
fs.appendFileSync(path.join(dir, 'llamadas.txt'), args.join(' ') + '\n');

function opcion(nombre) {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
}
// gh's --pattern is a glob; the job only uses «*» wildcards
function casa(patron, nombre) {
  const re = new RegExp('^' + patron.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(nombre);
}

if (args[0] !== 'release') {
  console.error(`gh-falso: orden no simulada: ${args.join(' ')}`);
  process.exit(2);
}
const orden = args[1];
const nombres = () => (fs.existsSync(assets) ? fs.readdirSync(assets).sort() : []);

if (orden === 'download') {
  const patron = opcion('--pattern');
  const destino = opcion('--dir');
  const elegidos = nombres().filter((n) => casa(patron, n));
  if (!elegidos.length) {
    console.error('no assets match the file pattern');
    process.exit(1);
  }
  fs.mkdirSync(destino, { recursive: true });
  for (const n of elegidos) fs.copyFileSync(path.join(assets, n), path.join(destino, n));
} else if (orden === 'view') {
  const campo = opcion('--json');
  const jq = opcion('--jq') ?? '';
  if (campo === 'assets') {
    // GH_FALSO_RELLENO: that many more (non-.sig) assets, listed after the real ones — a long listing whose
    // reader may stop early (a pipe closed by `grep -q` makes this writer fail with EPIPE, as gh would)
    const lista = [...nombres(), ...Array.from({ length: Number(process.env.GH_FALSO_RELLENO ?? 0) }, (_, i) => `relleno-${i}.txt`)];
    if (/endswith\("\.sig"\)/.test(jq) && /length/.test(jq)) {
      process.stdout.write(lista.filter((n) => n.endsWith('.sig')).length + '\n');
    } else {
      // written synchronously line by line, like a CLI streaming its output
      for (const n of lista) fs.writeSync(1, n + '\n');
    }
  } else if (campo === 'body') process.stdout.write(fs.readFileSync(path.join(dir, 'body.txt'), 'utf8') + '\n');
  else process.exit(2);
} else if (orden === 'upload') {
  // gh release upload TAG file… --repo R --clobber
  const ficheros = [];
  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--repo') i++;
    else if (!args[i].startsWith('--')) ficheros.push(args[i]);
  }
  fs.mkdirSync(assets, { recursive: true });
  for (const f of ficheros) fs.copyFileSync(f, path.join(assets, path.basename(f)));
} else if (orden === 'delete-asset') {
  fs.rmSync(path.join(assets, args[3]), { force: true });
} else if (orden === 'edit') {
  const estado = fs.existsSync(estadoFichero) ? JSON.parse(fs.readFileSync(estadoFichero, 'utf8')) : {};
  if (args.includes('--draft=false')) estado.borrador = false;
  if (args.includes('--latest')) estado.ultima = true;
  // what was attached when it stopped being a draft
  estado.alPublicar = nombres();
  fs.writeFileSync(estadoFichero, JSON.stringify(estado));
} else {
  console.error(`gh-falso: orden no simulada: ${args.join(' ')}`);
  process.exit(2);
}
