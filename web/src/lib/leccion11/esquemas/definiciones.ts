// 1.1 lessons, in the app: every schematic folder's definition (<nombre>/esquema.ts), collected by Vite and
// registered on import. Importing this module is all the app needs; Node uses web/scripts/esquemas11.mjs instead.

import { carpetaDe, registrarEsquemas } from './registro';
import type { DefinicionEsquema } from './tipos';

const modulos = import.meta.glob<DefinicionEsquema>('./*/esquema.ts', { eager: true, import: 'default' });
registrarEsquemas(Object.entries(modulos).map(([ruta, d]) => [carpetaDe(ruta), d]));
