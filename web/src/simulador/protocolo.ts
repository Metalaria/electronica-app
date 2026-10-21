// Messages between the app and the simulation worker.

import type { Simulacion } from './motor/simular.ts';

export type MensajeAlMotor =
  | { t: 'motor'; modulo?: WebAssembly.Module; bytes?: ArrayBuffer }
  | { t: 'simular'; id: number; texto: string };

export type MensajeDelMotor =
  | { t: 'listo' }
  | { t: 'lineas'; id: number; lineas: string[] }
  | { t: 'fin'; id: number; resultado: Simulacion }
  | { t: 'error'; id: number; mensaje: string };
