// «Un juego de verdad»: the trace of a free homebrew game, one entry of contenido/fotograma/juegos.json each:
//   { "id": "rfk", "maquina": "nes", "nombre": "robotfindskitten", "autor": "Damian Yerrick", "licencia": "zlib",
//     "url": "https://github.com/pinobatch/rfk-nes",
//     "rom": "contenido/consolas_juegos/nes/rfk.nes", "sha256": "…"   (versioned ROM, the licence allows it) or
//     "descarga": { "url": "https://…/rfk.nes", "sha256": "…" }    (fetched into contenido/.cache/juegos/),
//     "licenciaTexto": "contenido/consolas_juegos/nes/rfk-LICENSE.txt"   (shipped next to the trace; required for GPL),
//     "cuadro": 300,                       (frame recorded: VBlanks after the picture is switched on) or
//     "cuadroDesdeReset": 1450,            (frame recorded: VBlanks since reset)
//     "entradas": [[200, "start"], [210, ""]]   (buttons held from a VBlank since reset: a b select start arriba
//                                                abajo izquierda derecha, joined with «+»)
//   }
// Only NROM on the NES and ROM only / MBC1 / MBC3 / MBC5 on the Game Boy are emulated.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

function rom(raiz, j) {
  if (j.rom) {
    const b = readFileSync(join(raiz, j.rom));
    const h = createHash('sha256').update(b).digest('hex');
    if (j.sha256 && h !== j.sha256) throw new Error(`juegos.json: «${j.id}»: ${j.rom} tiene otro SHA-256 (${h})`);
    return b;
  }
  if (!j.descarga) throw new Error(`juegos.json: «${j.id}» necesita «rom» o «descarga»`);
  const dir = join(raiz, 'contenido/.cache/juegos');
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${j.id}.rom`);
  if (!existsSync(f)) execFileSync('curl', ['-sS', '-f', '-L', '-m', '120', '-o', f, j.descarga.url]);
  const b = readFileSync(f);
  const h = createHash('sha256').update(b).digest('hex');
  if (j.descarga.sha256 && h !== j.descarga.sha256) throw new Error(`juegos.json: «${j.id}» descargado con otro SHA-256 (${h})`);
  return b;
}

export async function generarJuego(raiz, tmp, j, salidaDir) {
  const meta = {
    titulo: 'Un juego de verdad',
    tipo: 'juego',
    programa: { fuente: j.url, autor: j.autor, licencia: j.licencia, url: j.url, nombre: j.nombre },
  };
  const comun = { raiz, tmp, salida: join(salidaDir, `${j.id}.bin`), programa: j.id, rom: rom(raiz, j), meta, cuadroTras: j.cuadroDesdeReset ?? j.cuadro ?? 300, desdeReset: j.cuadroDesdeReset !== undefined, entradas: j.entradas ?? [] };
  let r;
  if (j.maquina === 'nes') {
    const { generarNes } = await import('./maquina_nes.mjs');
    r = generarNes({ ...comun, lbl: null, dbg: null, dir: null, fuente: null });
  } else {
    const { generarGb } = await import('./maquina_gb.mjs');
    r = generarGb({ ...comun, maquina: j.maquina, sym: null, dir: null });
  }
  if (j.licenciaTexto) copyFileSync(join(raiz, j.licenciaTexto), join(salidaDir, `${j.id}-LICENCIA.txt`));
  writeFileSync(join(salidaDir, `${j.id}-FUENTE.txt`), `${j.nombre}, de ${j.autor}. Licencia: ${j.licencia}.\nCódigo fuente: ${j.url}\n`);
  return r;
}
