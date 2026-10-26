// Validation of cpu6502.mjs (run by hand; downloads test data into a scratch folder, never into the repo):
//   node contenido/fotograma/validar6502.mjs <carpeta de trabajo> [pruebas por opcode = 300]
// 1. Tom Harte's SingleStepTests 65x02/nes6502 (MIT): for every official opcode, the first N tests of its file
//    (fetched with an HTTP range request: each test is one line): registers, RAM and the address, data and
//    direction of every bus cycle must match.
// 2. nestest.nes (kevtris) in automation mode from $C000 against the reference log nestest.log: PC, A, X, Y, P, S
//    and the CPU cycle count of the first 5003 instructions (all official opcodes).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Cpu6502, OPCODES_6502 } from './cpu6502.mjs';

const dir = process.argv[2];
const porOp = Number(process.argv[3] ?? 300);
if (!dir) {
  console.error('uso: node validar6502.mjs <carpeta> [pruebas por opcode]');
  process.exit(2);
}
mkdirSync(dir, { recursive: true });

function bajar(url, destino, rango) {
  if (existsSync(destino)) return;
  const args = ['-sS', '-f', '-m', '120', '-o', destino];
  if (rango) args.push('-r', rango);
  execFileSync('curl', [...args, url]);
}

let fallos = 0;
let pruebas = 0;
let ciclos = 0;
const ops = Object.keys(OPCODES_6502).map(Number).sort((a, b) => a - b);
for (const op of ops) {
  const h = op.toString(16).padStart(2, '0');
  const f = join(dir, `nes6502-${h}.json`);
  // about 330 bytes per test
  bajar(`https://raw.githubusercontent.com/SingleStepTests/65x02/main/nes6502/v1/${h}.json`, f, `0-${porOp * 420 + 2000}`);
  const lineas = readFileSync(f, 'utf8').split('\n');
  let hechas = 0;
  for (const l of lineas) {
    const t = l.trim().replace(/,$/, '');
    if (!t.startsWith('{')) continue;
    let p;
    try {
      p = JSON.parse(t);
    } catch {
      continue; // the last, cut line
    }
    if (hechas++ >= porOp) break;
    pruebas++;
    const mem = new Map();
    for (const [a, v] of p.initial.ram) mem.set(a, v);
    const bus = [];
    const cpu = new Cpu6502({
      leer: (a) => {
        const v = mem.get(a) ?? 0;
        bus.push([a, v, 'read']);
        return v;
      },
      escribir: (a, v) => {
        mem.set(a, v);
        bus.push([a, v, 'write']);
      },
    });
    Object.assign(cpu, { pc: p.initial.pc, s: p.initial.s, a: p.initial.a, x: p.initial.x, y: p.initial.y, p: p.initial.p });
    cpu.paso();
    ciclos += bus.length;
    const e = p.final;
    let mal = cpu.pc !== e.pc || cpu.s !== e.s || cpu.a !== e.a || cpu.x !== e.x || cpu.y !== e.y || cpu.p !== e.p;
    for (const [a, v] of e.ram) if ((mem.get(a) ?? 0) !== v) mal = true;
    if (bus.length !== p.cycles.length) mal = true;
    else for (let i = 0; i < bus.length; i++) if (bus[i][0] !== p.cycles[i][0] || bus[i][1] !== p.cycles[i][1] || bus[i][2] !== p.cycles[i][2]) mal = true;
    if (mal) {
      if (fallos < 10) console.log('FALLO', p.name, JSON.stringify({ cpu: [cpu.pc, cpu.s, cpu.a, cpu.x, cpu.y, cpu.p], e, bus, esperado: p.cycles }));
      fallos++;
    }
  }
}
console.log(`SingleStepTests nes6502: ${ops.length} opcodes oficiales, ${pruebas} pruebas, ${ciclos} ciclos de bus comparados, ${fallos} fallos`);

// ---------------------------------------------------------------- nestest
const rom = join(dir, 'nestest.nes');
const log = join(dir, 'nestest.log');
bajar('https://raw.githubusercontent.com/christopherpow/nes-test-roms/master/other/nestest.nes', rom);
bajar('https://raw.githubusercontent.com/christopherpow/nes-test-roms/master/other/nestest.log', log);
const r = readFileSync(rom);
const prg = r.subarray(16, 16 + 16384);
const ram = new Uint8Array(0x800);
const cpu = new Cpu6502({
  leer: (a) => (a < 0x2000 ? ram[a & 0x7ff] : a >= 0x8000 ? prg[a & 0x3fff] : 0),
  escribir: (a, v) => {
    if (a < 0x2000) ram[a & 0x7ff] = v;
  },
});
cpu.pc = 0xc000;
cpu.s = 0xfd;
cpu.p = 0x24;
cpu.ciclos = 7;
const ref = readFileSync(log, 'utf8').split('\n').filter((l) => l.trim());
let malN = 0;
const N = 5003;
for (let i = 0; i < N; i++) {
  const l = ref[i];
  const hx = (re) => parseInt(re.exec(l)[1], 16);
  const esperado = { pc: parseInt(l.slice(0, 4), 16), a: hx(/A:(\w\w)/), x: hx(/X:(\w\w)/), y: hx(/Y:(\w\w)/), p: hx(/P:(\w\w)/), s: hx(/SP:(\w\w)/), cyc: Number(/CYC:(\d+)/.exec(l)[1]) };
  const real = { pc: cpu.pc, a: cpu.a, x: cpu.x, y: cpu.y, p: cpu.p, s: cpu.s, cyc: cpu.ciclos };
  if (JSON.stringify(esperado) !== JSON.stringify(real)) {
    if (malN < 5) console.log('nestest difiere en la línea', i + 1, l, JSON.stringify(real));
    malN++;
    if (malN > 20) break;
  }
  cpu.paso();
}
console.log(`nestest: ${N} instrucciones comparadas con nestest.log (PC, A, X, Y, P, S y ciclo), ${malN} diferencias; resultado en $02/$03 = ${ram[2].toString(16)} ${ram[3].toString(16)} (00 00 = todo bien)`);
process.exit(fallos || malN ? 1 : 0);
