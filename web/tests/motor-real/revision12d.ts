// Independent review 12d: pure checks of two counting rules (run from web/):
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision12d.ts
//   d12d·2  repaso-diario: an answer undone («Deshacer») after this device's last run already sent the day comes back:
//           the file's union (`unirDiasRepaso`, field max) keeps the larger count, and the device applies it
//   d12d·3  progreso-diario with an 0.11 device: after an undo on the 0.12 device (its undo record «~»), the 0.11
//           device's next step on top of the mirror it fully saw is not counted (the excess is taken against the sum
//           without the undo records). 1.0: compatibility with 0.10/0.11 clients was dropped — a 0.11 device cannot
//           read the file of format 2, so it can never write such a mirror —, and the day's total is the records' sum:
//           the check now says that a mirror written on top is NOT read (no longer a documented limit)
import { fusionarColecciones } from '../../src/lib/sincronizacion/fusion.ts';
import { efectivo, unirDiasRepaso } from '../../src/componentes/repaso/diario.ts';
import { grupoDe, tocarDia, totalDia, type DiaProgreso } from '../../src/lib/progreso-dias.ts';

const problemas: string[] = [];
/** Checks that fail on purpose: documented limits (an expected failure, with its reason). */
const limites: string[] = [];

// d12d·2 — the file holds the day as sent by this device's previous run (6 answers); then the reader undid the last
// one (5), a change marked after that run (dated later)
{
  // (round 4 of fixes: an undo no longer lowers r/n/b — it raises the day's undo counters dr/dn/db, and the day's
  // counts are the difference, `efectivo`; the undone answer was a new card answered «Bien»: what estado.svelte.ts
  // `deshacer` now stores. The review's version stored { r: 5, n: 1, b: 4 } here.)
  const fichero = { '2026-11-04': { t: 1000, v: { r: 6, n: 2, b: 5 } } };
  const local = { '2026-11-04': { t: 2000, v: { r: 6, n: 2, b: 5, dr: 1, dn: 1, db: 1 } } };
  const r = fusionarColecciones(fichero, local, { unir: (a, b) => unirDiasRepaso(a as never, b as never), valido: (v) => typeof (v as { r?: unknown })?.r === 'number' });
  const v = efectivo((r['2026-11-04'] as { v: { r: number; n: number; b: number } }).v);
  if (v.r !== 5 || v.n !== 1 || v.b !== 4) problemas.push(`d12d·2: deshecha una respuesta ya sincronizada, el fichero queda con r=${v.r}, n=${v.n}, b=${v.b} (esperado 5, 1, 4)`);
}

// d12d·3 — 0.12 device X: 2 steps, one undone (total 1); 0.11 device Y receives the mirror (pasos 1) and adds one step
// the 0.11 way (mirror + 1, t = max(now, t + 1)); X receives it
{
  const OBJ = { tipo: 'pasos' as const, cantidad: 3, secciones: true };
  const dia = '2026-11-04';
  const m: Record<string, DiaProgreso> = {};
  tocarDia(m, dia, 'x', 1000, OBJ, 'pasos', 1);
  tocarDia(m, dia, 'x', 2000, OBJ, 'pasos', 1);
  tocarDia(m, dia, 'x', 3000, OBJ, 'pasos', -1);
  const visto = totalDia(grupoDe(m, dia)).pasos;
  const e = m[dia]!;
  m[dia] = { ...e, pasos: e.pasos + 1, t: Math.max(4000, e.t + 1) };
  const total = totalDia(grupoDe(m, dia)).pasos;
  // 1.0: the summary item is not read for a day with records (its counts are the records' sum when 1.0 writes it); a
  // summary written on top by an older version — which can no longer synchronise — changes nothing
  if (total !== visto) problemas.push(`d12d·3 (1.0): un resumen del día escrito encima cambia la cuenta (${visto} → ${total})`);
}

console.log(JSON.stringify({ problemas, limites }));
if (problemas.length) process.exitCode = 1;
