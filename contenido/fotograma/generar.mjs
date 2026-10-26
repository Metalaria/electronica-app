// «Un fotograma»: builds the demo programs and writes the cycle-level traces of every console of this generator
// into web/public/consolas/fotograma/<maquina>/ (see ESQUEMA.md, «Un fotograma», and contenido/fotograma/README).
//   node contenido/fotograma/generar.mjs [nes] [gb] [gbc]
// Toolchains (optional; without them the versioned ROMs are used): CC65_BIN = folder with ca65/ld65,
// RGBDS_BIN = folder with rgbasm/rgblink/rgbfix. Homebrew games: contenido/fotograma/juegos.json.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../..');
const salidaDe = (m) => join(raiz, 'web/public/consolas/fotograma', m);
const pedidas = process.argv.slice(2);
const todas = ['nes', 'gb', 'gbc'];
const maquinas = pedidas.length ? pedidas : todas;
const tmp = mkdtempSync(join(tmpdir(), 'fotograma-'));
const juegos = existsSync(join(raiz, 'contenido/fotograma/juegos.json')) ? JSON.parse(readFileSync(join(raiz, 'contenido/fotograma/juegos.json'), 'utf8')).juegos : [];

const DEMO = {
  titulo: 'Paso a paso',
  tipo: 'demo',
  resumen: 'Programa de demostración escrito para la aplicación: un fondo fijo y un robot de cuatro sprites que avanza un píxel por cuadro.',
};

function escribirIndice(m, programas) {
  const ruta = join(salidaDe(m), 'indice.json');
  mkdirSync(salidaDe(m), { recursive: true });
  writeFileSync(ruta, JSON.stringify({ version: 1, programas }, null, 1) + '\n');
}

try {
  for (const m of maquinas) {
    const programas = [];
    if (m === 'nes') {
      const { construirDemoNes, generarNes } = await import('./maquina_nes.mjs');
      const b = construirDemoNes(raiz, tmp);
      const meta = { ...DEMO, programa: { fuente: 'contenido/consolas_demos/nes/demo.s', autor: 'Electrónica Práctica Avanzada', licencia: 'Código propio de la aplicación' } };
      const r = generarNes({ raiz, tmp, salida: join(salidaDe('nes'), 'demo.bin'), programa: 'demo', ...b, fuente: 'demo.s', meta });
      programas.push({ id: 'demo', titulo: DEMO.titulo, tipo: 'demo', archivo: 'demo.bin', bytes: r.bytes, resumen: DEMO.resumen });
    } else if (m === 'gb' || m === 'gbc') {
      const { construirDemoGb, generarGb } = await import('./maquina_gb.mjs');
      const b = construirDemoGb(raiz, tmp, m);
      const meta = { ...DEMO, programa: { fuente: `contenido/consolas_demos/${m}/demo.asm`, autor: 'Electrónica Práctica Avanzada', licencia: 'Código propio de la aplicación' } };
      const r = generarGb({ raiz, tmp, salida: join(salidaDe(m), 'demo.bin'), programa: 'demo', maquina: m, ...b, fuente: 'demo.asm', meta });
      programas.push({ id: 'demo', titulo: DEMO.titulo, tipo: 'demo', archivo: 'demo.bin', bytes: r.bytes, resumen: DEMO.resumen });
    } else {
      console.error(`generar: máquina desconocida ${m}`);
      continue;
    }
    // homebrew games: one entry each in juegos.json (see the README of this folder)
    for (const j of juegos.filter((x) => x.maquina === m)) {
      const { generarJuego } = await import('./juegos.mjs');
      const r = await generarJuego(raiz, tmp, j, salidaDe(m));
      programas.push({
        id: j.id,
        titulo: 'Un juego de verdad',
        tipo: 'juego',
        archivo: `${j.id}.bin`,
        bytes: r.bytes,
        resumen: `${j.nombre}, de ${j.autor} (${j.licencia}).`,
        juego: { nombre: j.nombre, autor: j.autor, licencia: j.licencia, url: j.url, commit: j.commit ?? '', licenciaTexto: j.licenciaTexto ? `${j.id}-LICENCIA.txt` : '' },
      });
    }
    escribirIndice(m, programas);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
