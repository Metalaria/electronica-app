// Schematic «cristal» (1.2, esquemas12d; sección 27.3 «Osciladores de Cristal», bloques 66 to 69): the quartz crystal's
// electrical model (Butterworth–Van Dyke) — the motional branch R₁, L₁, C₁ in series, in parallel with C₀, «la del
// propio encapsulado y sus electrodos». Its impedance, measured as rlc-serie's |Z| (a 1 A AC current source: the
// voltage is Z, in ohms): a minimum R₁ at the series resonance f_s = 1/(2π·√(L₁·C₁)), a maximum at the parallel one,
// f_p ≈ f_s·(1 + C₁/(2·C₀)), «del orden de una milésima más arriba», and inductive in between («la zona donde
// trabajan la mayoría de los osciladores»). AC only; sweep it on a linear axis close to f_s (its Q is 10⁴–10⁵).
import { ng } from '../comun';
import { observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'cristal',
  titulo: 'Cristal de cuarzo: modelo eléctrico y sus dos resonancias',
  resumen: 'La rama serie R₁, L₁, C₁ en paralelo con C₀; |Z| y su fase entre la resonancia serie y la paralelo.',
  piezas: {
    f: { descripcion: 'frecuencia de una lectura (Hz; las curvas barren la frecuencia)' },
    r1: { obligatoria: true, descripcion: 'resistencia de la rama serie, R₁ (Ω)', color: 'naranja' },
    l1: { obligatoria: true, descripcion: 'inductancia de la rama serie, L₁ (H)', color: 'naranja' },
    c1: { obligatoria: true, descripcion: 'capacidad de la rama serie, C₁ (F; femtofaradios)', color: 'naranja' },
    c0: { obligatoria: true, descripcion: 'capacidad en paralelo del encapsulado y los electrodos, C₀ (F)', color: 'azul' },
  },
  observables: {
    ...observablesCA('z', 'v(zx)', 'Ω', 'la impedancia del cristal (la tensión que da una corriente de 1 A)'),
    ...observablesCA('serie', 'i(vms)', 'A', 'la corriente de la rama serie con 1 A en el cristal'),
  },
  netlist: (c) => [
    'IZ 0 zx DC 0 AC 1',
    `C0 zx 0 ${ng(c.p('c0'))}`,
    'VMS zx m1 0',
    `R1 m1 m2 ${ng(c.p('r1'))}`,
    `L1 m2 m3 ${ng(c.p('l1'))}`,
    `C1 m3 0 ${ng(c.p('c1'))}`,
  ],
  describir: (c) =>
    `Cristal de cuarzo, su modelo eléctrico: la rama serie con ${c.sim('r1')} de ${c.val('r1')}, ${c.sim('l1')} de ${c.val('l1')} y ${c.sim('c1')} de ${c.val('c1')}, en paralelo con ${c.sim('c0')} de ${c.val('c0')}; se mide su impedancia entre los dos terminales`,
};
export default d;
