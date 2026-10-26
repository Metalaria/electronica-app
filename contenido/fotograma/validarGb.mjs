// Validation of sm83.mjs + gb.mjs with blargg's Game Boy test ROMs (run by hand; the ROMs go into a scratch folder,
// never into the repo): node contenido/fotograma/validarGb.mjs <carpeta de trabajo>
// cpu_instrs (the 11 individual ROMs: every instruction's result and flags), instr_timing (the machine cycles of
// every instruction, measured with the timer) and mem_timing (when, inside an instruction, its memory accesses
// happen). The ROMs print their result through the serial port.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameBoy } from './gb.mjs';
import { Registro } from './registro.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('uso: node validarGb.mjs <carpeta>');
  process.exit(2);
}
mkdirSync(dir, { recursive: true });
const BASE = 'https://raw.githubusercontent.com/retrio/gb-test-roms/master/';
const ROMS = [
  ...['01-special', '02-interrupts', '03-op sp,hl', '04-op r,imm', '05-op rp', '06-ld r,r', '07-jr,jp,call,ret,rst', '08-misc instrs', '09-op r,r', '10-bit ops', '11-op a,(hl)'].map((n) => `cpu_instrs/individual/${n}.gb`),
  'instr_timing/instr_timing.gb',
  'mem_timing/individual/01-read_timing.gb',
  'mem_timing/individual/02-write_timing.gb',
  'mem_timing/individual/03-modify_timing.gb',
];
let mal = 0;
for (const r of ROMS) {
  const f = join(dir, r.replace(/[/ ,]/g, '_'));
  if (!existsSync(f)) execFileSync('curl', ['-sS', '-f', '-m', '120', '-o', f, BASE + r.split('/').map(encodeURIComponent).join('/')]);
  const gb = new GameBoy(readFileSync(f), new Registro());
  const t0 = Date.now();
  let res = '';
  for (let i = 0; i < 60_000_000; i++) {
    gb.paso();
    if (i % 100000 === 0 && /Passed|Failed/.test(gb.serie)) break;
  }
  res = gb.serie.trim().replace(/\s+/g, ' ');
  const ok = /Passed/.test(gb.serie) && !/Failed/.test(gb.serie);
  if (!ok) mal++;
  console.log(`${ok ? 'BIEN' : 'MAL '} ${r} (${((Date.now() - t0) / 1000).toFixed(1)} s): ${res.slice(0, 160)}`);
}
console.log(`blargg: ${ROMS.length - mal} de ${ROMS.length} ROM de prueba superadas`);
process.exit(mal ? 1 : 0);
