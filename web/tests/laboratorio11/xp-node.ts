// 1.1 guided labs: the XP the app's own ledger rule (progreso.svelte.ts premioDe, a rune module: run with the loader)
// gives a lab step's answers. Prints one JSON array: [case, award] pairs.
import { premioDe } from '../../src/lib/aprendizaje/progreso.svelte.ts';
import { idPaso } from '../../src/componentes/instrumentos/practicas/laboratorio.ts';

const base = { tipo: 'respuesta' as const, id: idPaso(1, 'vout'), clase: 'practica' as const, origen: 'laboratorio' as const, parte: 'cap22', seccion: 'sec-22.1', subtipo: 'laboratorio', t: 1 };
const casos = {
  primera: { correcta: true, intento: 1, pistas: 0, final: true },
  conGuia: { correcta: true, intento: 1, pistas: 1, final: true },
  segunda: { correcta: true, intento: 2, pistas: 0, final: true },
  hagalo: { correcta: false, intento: 2, pistas: 1, final: true },
  fallo: { correcta: false, intento: 1, pistas: 0, final: false },
};
console.log(JSON.stringify(Object.fromEntries(Object.entries(casos).map(([k, c]) => [k, premioDe({ ...base, ...c })]))));
process.exit(0);
