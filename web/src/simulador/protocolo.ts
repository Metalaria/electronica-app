// Messages between the app and the simulation worker.

import type { Simulacion } from './motor/simular.ts';
import type { IdMotor } from './motor/motores.ts';

export type MensajeAlMotor =
  // `motor`: which build of ngspice the module or bytes are (default MOTOR_PREDETERMINADO).
  | { t: 'motor'; modulo?: WebAssembly.Module; bytes?: ArrayBuffer; motor?: IdMotor }
  | { t: 'simular'; id: number; texto: string };

export type MensajeDelMotor =
  | { t: 'listo' }
  | { t: 'lineas'; id: number; lineas: string[] }
  | { t: 'fin'; id: number; resultado: Simulacion }
  | { t: 'error'; id: number; mensaje: string };
