// KiCad footprint name (+ optional value field) → model type and parameters, for the board views that place
// these models on the book's KiCad boards. Covers the standard KiCad library names of the packages modelled
// here; anything else returns null (the caller can draw a neutral box from the footprint's courtyard).
// The footprint origin offset is in the built model: crearModelo(...).userData.huella.origenKicad.

import { leerValor } from './codigos';
import type { Parametros } from './tipos';

export interface Correspondencia {
  tipo: string;
  parametros: Parametros;
}

const num = (s: string | undefined, d = 0) => (s ? Number(s.replace(',', '.')) : d);

/** «16MHz», «16.000 MHz», «8M» → Hz. */
function frecuencia(v: string): number | undefined {
  const m = /([\d.,]+)\s*(M|k)?(?:Hz)?/i.exec(v);
  if (!m) return undefined;
  const x = num(m[1]);
  return m[2]?.toUpperCase() === 'M' ? x * 1e6 : m[2]?.toLowerCase() === 'k' ? x * 1e3 : x > 1000 ? x : x * 1e6;
}

function colorLed(v: string): string | undefined {
  const t = v.toLowerCase();
  if (/red|rojo|\bR\b/i.test(t)) return 'rojo';
  if (/green|verde/.test(t)) return 'verde';
  if (/blue|azul/.test(t)) return 'azul';
  if (/yellow|amarillo|amber|ambar/.test(t)) return 'amarillo';
  if (/white|blanco/.test(t)) return 'blanco';
  if (/\bir\b|infra/.test(t)) return 'infrarrojo';
  return undefined;
}

/** A value only when the field holds one (KiCad's default value is often the reference or «~»). */
function valorDe(valor: string | undefined, porDefecto: number): number | undefined {
  if (!valor || valor === '~') return undefined;
  void porDefecto;
  const v = leerValor(valor.replace(/\s+/g, '').replace(/(Ω|ohm|F|H)$/i, ''), NaN);
  return Number.isFinite(v) ? v : undefined;
}

export function tipoDeHuella(nombre: string, valor?: string): Correspondencia | null {
  const n = nombre.includes(':') ? nombre.slice(nombre.indexOf(':') + 1) : nombre;
  const v = valor?.trim() ?? '';
  let m: RegExpExecArray | null;
  const conValor = (p: Parametros, def = 1): Parametros => {
    const x = valorDe(v, def);
    return x != null ? { ...p, valor: x } : p;
  };

  // Resistors.
  if ((m = /^R_Axial_DIN(\d{4})_.*?P([\d.]+)mm/.exec(n))) return { tipo: 'resistencia-axial', parametros: conValor({ cuerpo: m[1]!, paso: num(m[2]) }) };
  if ((m = /^R_(\d{4})_\d{4}Metric/.exec(n))) return { tipo: 'resistencia-smd', parametros: conValor({ tamano: m[1]! }) };
  if (/^(Potentiometer_Bourns_33[68]|.*Trimmer)/i.test(n)) return { tipo: 'trimmer', parametros: conValor({}) };
  if (/^Potentiometer_/.test(n)) return { tipo: 'potenciometro', parametros: conValor({}) };
  if ((m = /^(?:RV_Disc|R_Disc)_D([\d.]+)mm/.exec(n))) return { tipo: 'termistor', parametros: { clase: /^RV/.test(n) || /^S\d|D\d{3}K|MOV|VDR/i.test(v) ? 'varistor' : /PTC/i.test(v) ? 'ptc' : 'ntc', diametro: Math.round(num(m[1])) } };
  if (/LDR/.test(n)) return { tipo: 'ldr', parametros: {} };

  // Capacitors.
  if ((m = /^C_(\d{4})_\d{4}Metric/.exec(n))) return { tipo: 'mlcc', parametros: conValor({ tamano: m[1]! }) };
  if ((m = /^C_Disc_D([\d.]+)mm/.exec(n))) return { tipo: 'condensador-disco', parametros: conValor({ diametro: Math.round(num(m[1])) }) };
  if ((m = /^C_Rect_L[\d.]+mm_W[\d.]+mm_P([\d.]+)mm/.exec(n))) return { tipo: 'condensador-pelicula', parametros: conValor({ paso: num(m[1]) }) };
  if ((m = /^CP_Radial_D([\d.]+)mm_P([\d.]+)mm/.exec(n))) return { tipo: 'electrolitico', parametros: conValor({ diametro: num(m[1]), paso: num(m[2]) }) };
  if ((m = /^CP_Elec_([\d.]+)x([\d.]+)/.exec(n))) return { tipo: 'electrolitico-smd', parametros: conValor({ diametro: num(m[1]), alto: num(m[2]) }) };
  if ((m = /^CP_EIA-(\d{4})/.exec(n))) return { tipo: 'tantalo', parametros: conValor({ caja: ({ '3216': 'A', '3528': 'B', '6032': 'C', '7343': 'D' } as Record<string, string>)[m[1]!] ?? 'B' }) };

  // Inductors, transformers, relays.
  if (/^L_Axial/.test(n)) return { tipo: 'bobina-axial', parametros: conValor({}) };
  if ((m = /^L_Radial_D([\d.]+)mm/.exec(n))) return { tipo: 'bobina-radial', parametros: conValor({ diametro: Math.min(12, Math.max(6, Math.round(num(m[1]) / 2) * 2)) }) };
  if ((m = /^L_Toroid.*?(?:D|L)([\d.]+)mm/.exec(n))) return { tipo: 'toroide', parametros: { diametro: num(m[1]) > 20 ? 25 : num(m[1]) > 12 ? 16 : 10 } };
  if (/^L_/.test(n) && /(\d{1,2})[x.]?(\d{1,2})?/.test(n)) {
    const t = /(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)mm/.exec(n);
    const a = t ? num(t[1]) : 6;
    return { tipo: 'bobina-smd', parametros: conValor({ tamano: a >= 8 ? 10 : a >= 5 ? 6 : 4 }) };
  }
  if (/^Transformer/.test(nombre) || /^Transformer_/.test(n)) return { tipo: 'transformador', parametros: {} };
  if (/^Relay_/.test(n)) return { tipo: 'rele', parametros: {} };

  // Diodes and LEDs.
  if (/^D_DO-41|^D_DO-15/.test(n)) return { tipo: 'diodo-do41', parametros: v ? { referencia: /^P6KE/i.test(v) ? 'P6KE15A' : /5819|58\d\d/.test(v) ? '1N5819' : /UF/.test(v) ? 'UF4007' : '1N4007' } : {} };
  if (/^D_DO-35/.test(n)) return { tipo: 'diodo-do35', parametros: v ? { referencia: /BZX|ZPD|V\d/i.test(v) ? '5V6' : /BAT/i.test(v) ? 'BAT85' : '1N4148' } : {} };
  if (/^D_SOD-123/.test(n)) return { tipo: 'diodo-sod123', parametros: {} };
  if (/^LED_D[35]\.0mm/.test(n)) return { tipo: 'led-5mm', parametros: { color: colorLed(v) ?? 'rojo' } };
  if (/^LED_(0805|0603)/.test(n)) return { tipo: 'led-smd', parametros: { tamano: '0805', color: colorLed(v) ?? 'rojo' } };
  if (/^LED_PLCC|^LED_.*3528/.test(n)) return { tipo: 'led-smd', parametros: { tamano: '3528', color: colorLed(v) ?? 'blanco' } };
  if (/^Diode_Bridge/.test(n)) return { tipo: 'puente', parametros: {} };

  // Transistors.
  if (/^TO-92/.test(n)) return { tipo: 'to92', parametros: v ? { referencia: /557|PNP/i.test(v) ? 'BC557B' : /7000/.test(v) ? '2N7000' : /J20|JFET|BF2/i.test(v) ? 'J201' : /78L/.test(v) ? '78L05' : /3144|HALL/i.test(v) ? 'A3144' : 'BC547B' } : {} };
  if (/^TO-220/.test(n)) return { tipo: 'to220', parametros: v ? { referencia: /9540|P-?ch/i.test(v) ? 'IRF9540N' : /TIP|BD/i.test(v) ? 'TIP31C' : /BT1|TRIAC/i.test(v) ? 'BT136' : /TYN|SCR/i.test(v) ? 'TYN612' : /78\d\d|LM317/i.test(v) ? 'L7805CV' : 'IRF540N' } : {} };
  if (/^SOT-23(-3)?$/.test(n) || /^SOT-23_/.test(n)) return { tipo: 'sot23', parametros: v ? { referencia: /3906/.test(v) ? 'MMBT3906' : /7002/.test(v) ? '2N7002' : /BAT54/i.test(v) ? 'BAT54S' : 'MMBT3904' } : {} };
  if (/^TO-252/.test(n)) return { tipo: 'dpak', parametros: {} };

  // Integrated circuits.
  if ((m = /^DIP-(\d+)_W([\d.]+)mm/.exec(n))) {
    if (/PC8\d\d|4N3\d|TLP|CNY|H11/i.test(v)) return { tipo: 'optoacoplador', parametros: { pines: Number(m[1]) === 6 ? 6 : 4 } };
    return { tipo: 'dip', parametros: { pines: Number(m[1]), ...(v ? { referencia: v } : {}) } };
  }
  if ((m = /^SOIC-(\d+)/.exec(n)) || (m = /^SO-(\d+)/.exec(n))) return { tipo: 'soic', parametros: { pines: [8, 14, 16].includes(Number(m[1])) ? Number(m[1]) : 8, ...(v ? { referencia: v } : {}) } };
  if ((m = /^[LT]QFP-(\d+)/.exec(n))) return { tipo: 'qfp', parametros: { pines: Number(m[1]) <= 32 ? 32 : Number(m[1]) <= 44 ? 44 : Number(m[1]) <= 48 ? 48 : 64, ...(v ? { referencia: v } : {}) } };
  if ((m = /^V?QFN-(\d+)/.exec(n))) return { tipo: 'qfn', parametros: { pines: Number(m[1]) <= 16 ? 16 : Number(m[1]) <= 20 ? 20 : Number(m[1]) <= 32 ? 32 : 48, ...(v ? { referencia: v } : {}) } };

  // Crystals, protection, connectors.
  if (/^Crystal_HC49/.test(n)) return { tipo: 'cristal', parametros: { cuerpo: /HC49-U/.test(n) ? 'U' : 'S', ...(frecuencia(v) ? { frecuencia: frecuencia(v)! } : {}) } };
  if (/RXEF|PTC|Polyfuse|MF-R/i.test(n)) return { tipo: 'ptc', parametros: {} };
  if (/5x20|Fuseholder/.test(n)) return { tipo: 'fusible', parametros: {} };
  if ((m = /^Pin(?:Header|Socket)_(\d)x(\d+)_P2\.54mm/.exec(n))) return { tipo: 'tira-pines', parametros: { filas: Number(m[1]), pines: Number(m[2]) } };
  if ((m = /^TerminalBlock.*_1x(\d+)_P5\.0?8?mm/.exec(n))) return { tipo: 'borna', parametros: { polos: Number(m[1]) } };
  return null;
}
