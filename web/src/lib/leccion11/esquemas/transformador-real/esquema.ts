// Schematic «transformador-real» (1.2, esquemas12): the real transformer in AC of sección 23.9: the source with its
// resistance R_s, the leakage inductance L_d in series (L₁·(1 − k²), referred to the primary), the magnetising
// inductance L_m in parallel, an ideal transformer of N₁ and N₂ turns (as «transformador»: a VCVS and a CCCS) and a
// load; optionally the windings' capacitance C_p across the secondary. Its pass band: below, L_m shorts the source
// (f_inf = R_s‖R'_L/(2π·L_m), R'_L = (N₁/N₂)²·R_L), above, L_d (with C_p, a resonance). AC readings and curves against
// frequency.
import { ng, num } from '../comun';
import { fuenteSeno, observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'transformador-real',
  titulo: 'Transformador real en alterna (magnetizante y dispersión)',
  resumen: 'Fuente con R_s, inductancia de dispersión en serie, magnetizante en paralelo, transformador ideal y carga; la banda pasante frente a la frecuencia.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (valor de pico) de la fuente senoidal, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la fuente (Hz)' },
    fase: { descripcion: 'fase inicial de la fuente, φ (grados)' },
    rs: { obligatoria: true, descripcion: 'resistencia de la fuente, R_s (Ω)' },
    lm: { obligatoria: true, descripcion: 'inductancia magnetizante, en paralelo con el primario, L_m (H)', color: 'azul' },
    ld: { descripcion: 'inductancia de dispersión, en serie y referida al primario, L_d (H)', color: 'naranja' },
    n1: { obligatoria: true, descripcion: 'espiras del primario', color: 'azul' },
    n2: { obligatoria: true, descripcion: 'espiras del secundario', color: 'naranja' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga del secundario, R_L (Ω)', color: 'verde' },
    cp: { descripcion: 'capacidad de los devanados, en paralelo con el secundario, C_p (F)', color: 'verde' },
  },
  observables: {
    ...observablesCA('salida', 'v(s)', 'V', 'la tensión del secundario'),
    ...observablesCA('primario', 'v(b)', 'V', 'la tensión del primario ideal (tras L_d)'),
    ...observablesCA('i1', 'i(vmed)', 'A', 'la corriente del primario'),
    ...observablesCA('im', 'i(vmm)', 'A', 'la corriente magnetizante'),
  },
  netlist(c) {
    const a = c.p('n2') / c.p('n1');
    return [
      fuenteSeno(c),
      `RS fte a ${ng(c.p('rs'))}`,
      'VMED a a2 0',
      c.tiene('ld') ? `LD a2 b ${ng(c.p('ld'))}` : 'VLD a2 b 0',
      'VMM b m 0',
      `LM m 0 ${ng(c.p('lm'))}`,
      `E2 s 0 b 0 ${num(a)}`,
      'VCARGA s l 0',
      `RL l 0 ${ng(c.p('carga'))}`,
      // (C_p after the secondary's meter: its current is reflected to the primary with the load's)
      ...(c.tiene('cp') ? [`CP l 0 ${ng(c.p('cp'))}`] : []),
      // what the primary draws for the secondary, through the ratio
      `F1 b 0 VCARGA ${num(a)}`,
    ];
  },
  describir: (c) =>
    `Transformador real: fuente senoidal de ${c.val('fuente')} de pico y ${c.val('f')} con ${c.val('rs')} en serie; ${c.tiene('ld') ? `dispersión ${c.sim('ld')} de ${c.val('ld')} en serie, ` : ''}magnetizante ${c.sim('lm')} de ${c.val('lm')} en paralelo; transformador ideal de ${c.val('n1')} y ${c.val('n2')} espiras; carga ${c.sim('carga')} de ${c.val('carga')}${c.tiene('cp') ? ` con ${c.sim('cp')} de ${c.val('cp')} en paralelo` : ''}`,
};
export default d;
