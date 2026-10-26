// Types of the Emscripten factory of the XSPICE build (web/vendor/ngspice-xspice/ngspice.mjs, copied here by
// scripts/ngspice.mjs): the same interface as the eecircuit-engine one.

import type { ModuloNgspice, OpcionesModulo } from './ngspice.js';

declare function crearModulo(opciones?: OpcionesModulo): Promise<ModuloNgspice>;
export default crearModulo;
