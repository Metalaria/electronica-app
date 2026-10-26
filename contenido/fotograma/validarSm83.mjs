// Validation of sm83.mjs (run by hand; test data goes into a scratch folder, never into the repo):
//   node contenido/fotograma/validarSm83.mjs <carpeta de trabajo> [pruebas por opcode = 300]
// SingleStepTests sm83 (MIT): for every opcode (and the 256 CB opcodes), the first N tests of its file, fetched with
// an HTTP range request: registers, IME, RAM and the bus activity of every M-cycle (read, write or internal) must
// match. HALT and STOP are left out (their tests assume a particular interrupt state).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Sm83 } from './sm83.mjs';

const dir = process.argv[2];
const porOp = Number(process.argv[3] ?? 300);
if (!dir) {
  console.error('uso: node validarSm83.mjs <carpeta> [pruebas por opcode]');
  process.exit(2);
}
mkdirSync(dir, { recursive: true });

const INEXISTENTES = new Set([0xd3, 0xdb, 0xdd, 0xe3, 0xe4, 0xeb, 0xec, 0xed, 0xf4, 0xfc, 0xfd, 0x76, 0x10]);

/** Complete JSON objects of a cut array (the file is one JSON array). */
function objetos(texto) {
  const out = [];
  let prof = 0;
  let ini = -1;
  let enCadena = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (enCadena) {
      if (ch === '"' && texto[i - 1] !== '\\') enCadena = false;
      continue;
    }
    if (ch === '"') enCadena = true;
    else if (ch === '{') {
      if (prof === 0) ini = i;
      prof++;
    } else if (ch === '}') {
      prof--;
      if (prof === 0 && ini >= 0) out.push(texto.slice(ini, i + 1));
    }
  }
  return out;
}

let pruebas = 0;
let fallos = 0;
let ciclos = 0;
let archivos = 0;
const lista = [];
for (let op = 0; op < 256; op++) if (!INEXISTENTES.has(op) && op !== 0xcb) lista.push(op.toString(16).padStart(2, '0'));
for (let op = 0; op < 256; op++) lista.push('cb ' + op.toString(16).padStart(2, '0'));
for (const nombre of lista) {
  const f = join(dir, `sm83-${nombre.replace(' ', '_')}.json`);
  if (!existsSync(f)) {
    execFileSync('curl', ['-sS', '-f', '-m', '120', '-r', `0-${porOp * 560 + 3000}`, '-o', f, `https://raw.githubusercontent.com/SingleStepTests/sm83/main/v1/${encodeURIComponent(nombre)}.json`]);
  }
  archivos++;
  const objs = objetos(readFileSync(f, 'utf8')).slice(0, porOp);
  for (const o of objs) {
    const p = JSON.parse(o);
    pruebas++;
    const mem = new Map(p.initial.ram);
    const bus = [];
    let ult = [0, 0];
    const cpu = new Sm83({
      leer: (a) => {
        const v = mem.get(a) ?? 0;
        ult = [a, v];
        bus.push([a, v, 'r-m']);
        return v;
      },
      escribir: (a, v) => {
        mem.set(a, v);
        ult = [a, v];
        bus.push([a, v, '-wm']);
      },
      interno: () => bus.push([ult[0], ult[1], '---']),
    });
    const i = p.initial;
    Object.assign(cpu, { pc: i.pc, sp: i.sp, a: i.a, b: i.b, c: i.c, d: i.d, e: i.e, f: i.f, h: i.h, l: i.l, ime: i.ime });
    cpu.paso();
    ciclos += bus.length;
    const e = p.final;
    let mal = ['pc', 'sp', 'a', 'b', 'c', 'd', 'e', 'f', 'h', 'l'].some((k) => cpu[k] !== e[k]);
    if (e.ime !== undefined && cpu.ime !== e.ime && !(cpu.eiPendiente && e.ime === 1)) mal = true;
    for (const [a, v] of e.ram) if ((mem.get(a) ?? 0) !== v) mal = true;
    const esperado = p.cycles.filter(Boolean);
    if (bus.length !== esperado.length) mal = true;
    else
      for (let k = 0; k < bus.length; k++) {
        const [a, v, t] = esperado[k];
        if (bus[k][2] !== t) mal = true;
        else if (t !== '---' && (bus[k][0] !== a || bus[k][1] !== v)) mal = true;
      }
    if (mal) {
      if (fallos < 8) console.log('FALLO', p.name, JSON.stringify({ cpu: { pc: cpu.pc, sp: cpu.sp, a: cpu.a, f: cpu.f, b: cpu.b, c: cpu.c, h: cpu.h, l: cpu.l }, e, bus, esperado }));
      fallos++;
    }
  }
}
console.log(`SingleStepTests sm83: ${archivos} opcodes (${lista.length - 256} + 256 CB), ${pruebas} pruebas, ${ciclos} ciclos de máquina comparados, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
