// Z80 bus machine cycles (Zilog «Z80 CPU User Manual» UM0080, figures «Instruction Op Code Fetch», «Memory Read or
// Write Cycles» and «Input or Output Cycles»), shared by the Master System and the Mega Drive's sound CPU.
//   M1 (opcode fetch, 4 T): address at T1↑, /M1 low from T1↑; /MREQ and /RD low at T1↓; data sampled at T3↑, where
//     /MREQ, /RD and /M1 rise; then the refresh address with /RFSH low from T3↑ to the end of T4 and /MREQ low
//     from T3↓ to T4↓.
//   memory read (3 T): /MREQ and /RD low from T1↓ to T3↓, data sampled at T3↓.
//   memory write (3 T): /MREQ low from T1↓ to T3↓, data on the bus from T1↓, /WR low from T2↓ to T3↓.
//   I/O read or write (4 T: T1, T2, the automatic wait TW, T3): /IORQ and /RD (or /WR) low from T2↑ to T3↓.

import { Cronograma, hex } from './modelo';

export type TipoZ80 = 'M1' | 'MR' | 'MW' | 'IOR' | 'IOW';

export interface CicloZ80 {
  tipo: TipoZ80;
  dir: number;
  dato: number;
  nota: string;
  /** Extra wait states (T) inserted after T2 (/WAIT low). */
  esperas?: number;
  /** Access time of the selected device (s) for reads: data valid that long after /RD falls. */
  acceso?: number;
}

/** Declares the standard Z80 signals on a timeline (ids: CLK, A, D, M1, MREQ, IORQ, RD, WR, RFSH, WAIT). */
export function senalesZ80(c: Cronograma, mhz: string): void {
  c.bit('CLK', `Reloj del Z80 (${mhz})`, 1)
    .bus('A', 'A15–A0', 'Dirección del Z80')
    .bus('D', 'D7–D0', 'Datos (null = alta impedancia)')
    .bit('M1', '/M1', 1, 'Ciclo de búsqueda de instrucción')
    .bit('MREQ', '/MREQ', 1, 'Acceso a memoria')
    .bit('IORQ', '/IORQ', 1, 'Acceso a puerto de E/S')
    .bit('RD', '/RD', 1)
    .bit('WR', '/WR', 1)
    .bit('RFSH', '/RFSH', 1, 'Refresco (dirección R en A0–A6)')
    .bit('WAIT', '/WAIT', 1, 'Esperas pedidas por el sistema');
}

/** Duration of a cycle in T states. */
export function duracionZ80(x: CicloZ80): number {
  return (x.tipo === 'M1' || x.tipo === 'IOR' || x.tipo === 'IOW' ? 4 : 3) + (x.esperas ?? 0);
}

/**
 * Writes one machine cycle starting at t0 (T = clock period). Returns the times of interest: the strobe start
 * (when /RD, /WR or /IORQ go low), its end and the end of the cycle.
 */
export function cicloZ80(c: Cronograma, t0: number, T: number, x: CicloZ80, refresco = 0): { ini: number; fin: number; total: number } {
  const w = (x.esperas ?? 0) * T;
  const n = duracionZ80(x);
  const total = t0 + n * T;
  c.marca(t0);
  c.set('A', t0, hex(x.dir, 4));
  let ini = t0;
  let fin = total;
  const acceso = x.acceso ?? 150e-9;
  if (x.tipo === 'M1') {
    ini = t0 + 0.5 * T;
    fin = t0 + 2 * T + w;
    c.set('M1', t0 + 0.1 * T, 0);
    c.set('MREQ', ini, 0);
    c.set('RD', ini, 0);
    c.set('D', ini + acceso, hex(x.dato, 2));
    if (w) {
      c.set('WAIT', t0 + 1.5 * T, 0);
      c.set('WAIT', t0 + 1.5 * T + w, 1);
    }
    c.set('MREQ', fin, 1);
    c.set('RD', fin, 1);
    c.set('M1', fin, 1);
    c.set('D', fin + 10e-9, null);
    // refresh
    c.set('A', fin, hex(refresco & 0x7f, 4));
    c.set('RFSH', fin, 0);
    c.set('MREQ', fin + 0.5 * T, 0);
    c.set('MREQ', fin + 1.5 * T, 1);
    c.set('RFSH', total, 1);
  } else if (x.tipo === 'MR') {
    ini = t0 + 0.5 * T;
    fin = t0 + 2.5 * T + w;
    c.set('MREQ', ini, 0);
    c.set('RD', ini, 0);
    c.set('D', Math.min(ini + acceso, fin - 5e-9), hex(x.dato, 2));
    if (w) {
      c.set('WAIT', t0 + 1.5 * T, 0);
      c.set('WAIT', t0 + 1.5 * T + w, 1);
    }
    c.set('MREQ', fin, 1);
    c.set('RD', fin, 1);
    c.set('D', fin + 10e-9, null);
  } else if (x.tipo === 'MW') {
    ini = t0 + 0.5 * T;
    fin = t0 + 2.5 * T + w;
    c.set('MREQ', ini, 0);
    c.set('D', ini, hex(x.dato, 2));
    c.set('WR', t0 + 1.5 * T, 0);
    if (w) {
      c.set('WAIT', t0 + 1.5 * T, 0);
      c.set('WAIT', t0 + 1.5 * T + w, 1);
    }
    c.set('MREQ', fin, 1);
    c.set('WR', fin, 1);
    c.set('D', fin + 10e-9, null);
  } else {
    ini = t0 + T;
    fin = t0 + 3.5 * T + w;
    const rd = x.tipo === 'IOR';
    c.set('IORQ', ini, 0);
    c.set(rd ? 'RD' : 'WR', ini, 0);
    if (rd) c.set('D', Math.min(ini + acceso, fin - 5e-9), hex(x.dato, 2));
    else c.set('D', t0 + 0.5 * T, hex(x.dato, 2));
    c.set('IORQ', fin, 1);
    c.set(rd ? 'RD' : 'WR', fin, 1);
    c.set('D', fin + 10e-9, null);
  }
  c.marca(ini);
  return { ini, fin, total };
}
